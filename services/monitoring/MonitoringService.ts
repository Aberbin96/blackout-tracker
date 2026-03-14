import net from "net";
import { supabase } from "@/utils/supabase";
import { normalizeStateName } from "@/utils/normalization";
import { AnalyzerService } from "@/services/analyzer";

export interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  timestamp: string;
}

export class MonitoringService {
  /**
   * Fetches the latest check results from the database for analysis.
   */
  static async analyzeLastResults(state?: string, limit: number = 200) {
    let query = supabase
      .from("connectivity_checks")
      .select("*")
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (state) {
      query = query.eq('state', state.toLowerCase());
    }

    const { data: results, error } = await query;

    if (error) {
      console.error("[MonitoringService] Error fetching results for analysis:", error.message);
      return { success: false, error: error.message };
    }

    if (!results || results.length === 0) {
      return { success: true, count: 0, message: "No recent results found" };
    }

    // Trigger analysis
    await AnalyzerService.analyze(results as CheckResult[]);

    return {
      success: true,
      count: results.length,
      online: results.filter((r) => r.status === "online").length,
    };
  }

  /**
   * Processes a batch of externally collected check results.
   */
  static async processResults(results: CheckResult[]) {
    if (!results || results.length === 0) return;

    // 1. Store results in Supabase
    await this.storeResults(results);

    // 2. Trigger analysis for blackouts
    try {
      await AnalyzerService.analyze(results);
    } catch (err) {
      console.error("[Analyzer] Trigger failed:", err);
    }

    return {
      success: true,
      count: results.length,
      online: results.filter((r) => r.status === "online").length,
    };
  }

  /**
   * Performs a connectivity check for active targets from Supabase (Legacy/Manual).
   */
  static async performAllChecks(stateFilter?: string): Promise<CheckResult[]> {
    const timestamp = new Date().toISOString();

    // Fetch active targets from Supabase with retry logic
    let targets: any[] = [];
    let retries = 3;
    let fetchError: any = null;

    while (retries > 0) {
      try {
        let query = supabase
          .from("monitoring_targets")
          .select("*")
          .eq("is_active", true);

        if (stateFilter) {
          query = query.eq("state", stateFilter.toLowerCase());
        }

        const { data, error } = await query;

        if (error) throw error;
        if (data) {
          targets = data;
          break; // Success
        }
      } catch (err) {
        fetchError = err;
        retries--;
        if (retries > 0) {
          console.warn(`Supabase fetch timeout. Retrying... (${retries} left)`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    if (!targets || targets.length === 0) {
      console.error(
        "Error fetching targets from Supabase after retries:",
        fetchError?.message || fetchError,
      );
      return [];
    }

    // Group targets by state to divide the sync process
    const targetsByState: Record<string, any[]> = {};
    targets.forEach((t) => {
      const state = t.state || "unknown";
      if (!targetsByState[state]) targetsByState[state] = [];
      targetsByState[state].push(t);
    });

    const results: CheckResult[] = [];

    // Process each state sequentially
    for (const stateTargets of Object.values(targetsByState)) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < stateTargets.length; i += CHUNK_SIZE) {
        const chunk = stateTargets.slice(i, i + CHUNK_SIZE);
        const checkPromises = chunk.map((target) =>
          this.checkIp(target, timestamp),
        );
        const chunkResults = await Promise.all(checkPromises);
        results.push(...chunkResults);

        // Tiny delay between chunks to let OS clear TCP connection states
        await new Promise((r) => setTimeout(r, 100));
      }

      // Additional delay between states to further divide the load
      await new Promise((r) => setTimeout(r, 400));
    }

    // Store results in Supabase before returning so Vercel does not terminate the function
    try {
      await this.storeResults(results);
    } catch (err) {
      console.error("Delayed Supabase storage failed:", err);
    }

    // Process regional blackouts based on results
    try {
      await AnalyzerService.analyze(results);
    } catch (err) {
      console.error("[Analyzer] Trigger failed:", err);
    }

    return results;
  }

  /**
   * Performs a TCP connection check on the target IP and port.
   */
  private static async checkIp(
    target: any,
    timestamp: string,
  ): Promise<CheckResult> {
    const startTime = Date.now();

    // If we saved the service port during discovery, use it. Otherwise guess based on common VE ports.
    const portsToTry =
      target.services?.length > 0
        ? [target.services[0]]
        : [80, 443, 8080, 8291]; // 8291 is Mikrotik, very common

    let status: "online" | "offline" = "offline";
    let latency: number | undefined;

    // Try ports sequentially until one answers (for nodes missing precise port data)
    for (const port of portsToTry) {
      const isResponsive = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3500); // 3.5s timeout for high latency VE links

        socket.connect(port, target.ip, () => {
          socket.destroy();
          resolve(true);
        });

        const fail = () => {
          socket.destroy();
          resolve(false);
        };

        socket.on("error", fail);
        socket.on("timeout", fail);
        socket.on("close", fail);
      });

      if (isResponsive) {
        status = "online";
        latency = Date.now() - startTime;
        break; // Found an open port, stop trying others
      }
    }

    return {
      ip: target.ip,
      provider: target.provider,
      state: normalizeStateName(target.state),
      status,
      latency,
      timestamp,
    };
  }

  private static async storeResults(results: CheckResult[]) {
    const { error } = await supabase
      .from("connectivity_checks")
      .insert(results);

    if (error) {
      console.error("Error storing check results in Supabase:", error);
    }
  }
}
