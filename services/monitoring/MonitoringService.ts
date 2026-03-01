import net from "net";
import { supabase } from "@/utils/supabase";

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
   * Performs a connectivity check for all active targets from Supabase.
   */
  static async performAllChecks(): Promise<CheckResult[]> {
    const timestamp = new Date().toISOString();

    // Fetch active targets from Supabase
    const { data: targets, error } = await supabase
      .from("monitoring_targets")
      .select("*")
      .eq("is_active", true);

    if (error || !targets) {
      console.error("Error fetching targets from Supabase:", error);
      return [];
    }

    // Fire all checks in parallel
    const checkPromises = targets.map((target) =>
      this.checkIp(target, timestamp),
    );
    const results = await Promise.all(checkPromises);

    // Store results in Supabase in the background
    this.storeResults(results).catch((err) =>
      console.error("Delayed Supabase storage failed:", err),
    );

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
    // Use the first available service port or default to 80
    const port = target.services?.[0] || 80;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let status: "online" | "offline" = "offline";
      let latency: number | undefined;

      socket.setTimeout(2500);

      socket.connect(port, target.ip, () => {
        status = "online";
        latency = Date.now() - startTime;
        socket.destroy();
      });

      const handleEnd = () => {
        socket.destroy();
        resolve({
          ip: target.ip,
          provider: target.provider,
          state: target.state,
          status,
          latency,
          timestamp,
        });
      };

      socket.on("error", handleEnd);
      socket.on("timeout", handleEnd);
      socket.on("close", handleEnd);
    });
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
