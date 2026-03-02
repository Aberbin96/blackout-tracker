import net from "net";
import { supabase } from "@/utils/supabase";
import { normalizeStateName } from "@/utils/normalization";

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
   * Performs a connectivity check for active targets from Supabase.
   * If state is provided, only checks targets in that state.
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
      await this.processBlackouts(results);
    } catch (err) {
      console.error("Blackout processing failed:", err);
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

  /**
   * Analyzes check results to detect or resolve regional blackouts.
   */
  private static async processBlackouts(results: CheckResult[]) {
    const statesMap: Record<
      string,
      { total: number; offline: number; totalLatency: number }
    > = {};

    results.forEach((res) => {
      if (!statesMap[res.state])
        statesMap[res.state] = { total: 0, offline: 0, totalLatency: 0 };
      statesMap[res.state].total++;
      if (res.status === "offline") {
        statesMap[res.state].offline++;
      } else {
        statesMap[res.state].totalLatency += res.latency || 0;
      }
    });

    for (const [state, counts] of Object.entries(statesMap)) {
      const offlinePercent = (counts.offline / counts.total) * 100;
      const onlineCount = counts.total - counts.offline;
      const avgLatency =
        onlineCount > 0 ? counts.totalLatency / onlineCount : 0;

      // Severity Thresholds
      let severity: "massive" | "partial" | "degraded" | "none" = "none";

      if (counts.total >= 3) {
        if (offlinePercent > 60) {
          severity = "massive";
        } else if (offlinePercent > 25) {
          severity = "partial";
        } else if (avgLatency > 1500) {
          severity = "degraded";
        }
      }

      // Check for existing active event
      const { data: activeEvent } = await supabase
        .from("blackout_events")
        .select("*")
        .eq("state", state)
        .eq("status", "active")
        .maybeSingle();

      if (severity !== "none") {
        // If there's an active event, update it if significant change
        if (activeEvent) {
          // Update event details (counts) but keep it active
          await supabase
            .from("blackout_events")
            .update({
              nodes_total: counts.total,
              nodes_offline: counts.offline,
              metadata: {
                ...((activeEvent.metadata as object) || {}),
                current_severity: severity,
                avg_latency: Math.round(avgLatency),
              },
            })
            .eq("id", activeEvent.id);
        } else {
          // New event: Persistence check (only alert if severity persists across multiple checks)
          // For now, we'll implement a simple "new event" logic but we could add a buffer table here.
          await supabase.from("blackout_events").insert({
            state,
            nodes_total: counts.total,
            nodes_offline: counts.offline,
            status: "active",
            started_at: new Date().toISOString(),
            metadata: {
              initial_severity: severity,
              avg_latency: Math.round(avgLatency),
            },
          });

          // Send Telegram Alert based on severity
          if (severity === "massive") {
            // await TelegramService.sendBlackoutAlert(
            //   state,
            //   counts.total,
            //   counts.offline,
            // );
          } else if (severity === "partial") {
            // We could add a specialized partial alert here
            // await TelegramService.sendBlackoutAlert(
            //   state,
            //   counts.total,
            //   counts.offline,
            // );
          }
        }
      } else if (activeEvent) {
        // Recovery logic: verify it's not a temporary flicker (flicker protection)
        // Here we could add a "verify resolution" step, but for now we resolve immediately.
        await supabase
          .from("blackout_events")
          .update({
            status: "resolved",
            ended_at: new Date().toISOString(),
          })
          .eq("id", activeEvent.id);

        // await TelegramService.sendBlackoutResolved(state);
      }
    }
  }
}
