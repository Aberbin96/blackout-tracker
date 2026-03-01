import { supabase } from "@/utils/supabase";
import { CheckResult } from "@/services/monitoring/MonitoringService";
import { TelegramService } from "./notifications/TelegramService";

export class AnalyzerService {
  /**
   * Minimum nodes needed in a state to confidently declare a blackout.
   */
  private static MIN_NODES = 5;

  /**
   * Thresholds for determining blackout state
   */
  private static BLACKOUT_THRESHOLD = 0.4; // 40% offline
  private static RESOLVE_THRESHOLD = 0.2; // 20% offline

  public static async analyze(results: CheckResult[]) {
    console.log(`[Analyzer] Analyzing ${results.length} node checks...`);

    // 1. Group by state
    const stateStats: Record<
      string,
      { total: number; online: number; offline: number }
    > = {};

    results.forEach((res) => {
      if (!res.state) return; // Skip unknown regions
      if (!stateStats[res.state]) {
        stateStats[res.state] = { total: 0, online: 0, offline: 0 };
      }

      stateStats[res.state].total++;
      if (res.status === "online") {
        stateStats[res.state].online++;
      } else {
        stateStats[res.state].offline++;
      }
    });

    // 2. Fetch active blackouts to update them
    const { data: activeBlackouts } = await supabase
      .from("blackout_events")
      .select("*")
      .eq("status", "active");

    const activeMap = new Map(activeBlackouts?.map((b) => [b.state, b]) || []);

    // 3. Evaluate each state
    for (const [state, stats] of Object.entries(stateStats)) {
      if (stats.total < this.MIN_NODES) continue; // Not enough data for this state

      const failureRate = stats.offline / stats.total;
      const isBlackout = failureRate >= this.BLACKOUT_THRESHOLD;
      const isResolved = failureRate <= this.RESOLVE_THRESHOLD;

      const activeEvent = activeMap.get(state);

      if (isBlackout && !activeEvent) {
        // NEW Blackout detected!
        console.log(
          `[Analyzer] 🚨 BLACKOUT DETECTED in ${state} (${Math.round(failureRate * 100)}% offline)`,
        );

        await supabase.from("blackout_events").insert({
          state,
          nodes_total: stats.total,
          nodes_offline: stats.offline,
          status: "active",
        });

        // Trigger notification
        await TelegramService.sendBlackoutAlert(
          state,
          stats.total,
          stats.offline,
        );
      } else if (isResolved && activeEvent) {
        // Blackout resolved!
        console.log(
          `[Analyzer] ✅ BLACKOUT RESOLVED in ${state} (${Math.round(failureRate * 100)}% offline)`,
        );

        await supabase
          .from("blackout_events")
          .update({
            status: "resolved",
            ended_at: new Date().toISOString(),
            nodes_total: stats.total, // Update final numbers
            nodes_offline: stats.offline,
          })
          .eq("id", activeEvent.id);

        // Trigger notification
        await TelegramService.sendBlackoutResolved(state);
      } else if (activeEvent) {
        // Active blackout exists, just update the node counts
        await supabase
          .from("blackout_events")
          .update({
            nodes_total: stats.total,
            nodes_offline: stats.offline,
          })
          .eq("id", activeEvent.id);
      }
    }
  }
}
