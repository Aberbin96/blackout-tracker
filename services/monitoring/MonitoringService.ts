import net from "net";
import { supabase } from "@/utils/supabase";
import { normalizeStateName } from "@/utils/normalization";
import { TelegramService } from "../notifications/TelegramService";

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

    // Process regional blackouts based on results
    this.processBlackouts(results).catch((err) =>
      console.error("Blackout processing failed:", err),
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
          state: normalizeStateName(target.state),
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
            await TelegramService.sendBlackoutAlert(
              state,
              counts.total,
              counts.offline,
            );
          } else if (severity === "partial") {
            // We could add a specialized partial alert here
            await TelegramService.sendBlackoutAlert(
              state,
              counts.total,
              counts.offline,
            );
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

        await TelegramService.sendBlackoutResolved(state);
      }
    }
  }
}
