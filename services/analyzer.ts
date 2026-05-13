import { db } from "@/db";
import { blackoutEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CheckResult } from "@/services/monitoring/MonitoringService";

export class AnalyzerService {
  private static MIN_NODES = 5;
  private static BLACKOUT_THRESHOLD = 0.4;
  private static RESOLVE_THRESHOLD = 0.2;

  public static async analyze(results: CheckResult[]) {
    console.log(`[Analyzer] Analyzing ${results.length} node checks...`);

    const stateStats: Record<string, { total: number; online: number; offline: number }> = {};

    results.forEach((res) => {
      if (!res.state) return;
      if (!stateStats[res.state]) stateStats[res.state] = { total: 0, online: 0, offline: 0 };
      stateStats[res.state].total++;
      if (res.status === "online") stateStats[res.state].online++;
      else stateStats[res.state].offline++;
    });

    const activeBlackouts = await db
      .select()
      .from(blackoutEvents)
      .where(eq(blackoutEvents.status, "active"));

    const activeMap = new Map(activeBlackouts.map((b) => [b.state, b]));

    for (const [state, stats] of Object.entries(stateStats)) {
      if (stats.total < this.MIN_NODES) continue;

      const failureRate = stats.offline / stats.total;
      const isBlackout = failureRate >= this.BLACKOUT_THRESHOLD;
      const isResolved = failureRate <= this.RESOLVE_THRESHOLD;
      const activeEvent = activeMap.get(state);

      if (isBlackout && !activeEvent) {
        console.log(`[Analyzer] 🚨 BLACKOUT DETECTED in ${state} (${Math.round(failureRate * 100)}% offline)`);
        await db.insert(blackoutEvents).values({
          state,
          nodesTotal: stats.total,
          nodesOffline: stats.offline,
          status: "active",
        });
      } else if (isResolved && activeEvent) {
        console.log(`[Analyzer] ✅ BLACKOUT RESOLVED in ${state} (${Math.round(failureRate * 100)}% offline)`);
        await db
          .update(blackoutEvents)
          .set({ status: "resolved", endedAt: new Date(), nodesTotal: stats.total, nodesOffline: stats.offline })
          .where(eq(blackoutEvents.id, activeEvent.id));
      } else if (activeEvent) {
        await db
          .update(blackoutEvents)
          .set({ nodesTotal: stats.total, nodesOffline: stats.offline })
          .where(eq(blackoutEvents.id, activeEvent.id));
      }
    }
  }
}
