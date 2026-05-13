import net from "net";
import { db } from "@/db";
import { connectivityChecks, monitoringTargets } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { normalizeStateName } from "@/utils/normalization";
import { AnalyzerService } from "@/services/analyzer";

const MIN_SCORE = Number(process.env.MIN_STABILITY_SCORE || 10);

export interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  timestamp: string;
}

export class MonitoringService {
  static async analyzeLastResults(state?: string, limit: number = 200) {
    try {
      const query = db
        .select()
        .from(connectivityChecks)
        .orderBy(desc(connectivityChecks.timestamp))
        .limit(limit);

      const results = state
        ? await db
            .select()
            .from(connectivityChecks)
            .where(eq(connectivityChecks.state, state.toLowerCase()))
            .orderBy(desc(connectivityChecks.timestamp))
            .limit(limit)
        : await query;

      if (!results || results.length === 0) {
        return { success: true, count: 0, message: "No recent results found" };
      }

      await AnalyzerService.analyze(results.map((r) => ({
        ip: r.ip,
        provider: r.provider,
        state: r.state,
        status: r.status as "online" | "offline",
        latency: r.latency ?? undefined,
        timestamp: r.timestamp?.toISOString() ?? new Date().toISOString(),
      })));

      return {
        success: true,
        count: results.length,
        online: results.filter((r) => r.status === "online").length,
      };
    } catch (error: any) {
      console.error("[MonitoringService] Error fetching results for analysis:", error.message);
      return { success: false, error: error.message };
    }
  }

  static async processResults(results: CheckResult[]) {
    if (!results || results.length === 0) return;

    await this.storeResults(results);

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

  static async performAllChecks(stateFilter?: string): Promise<CheckResult[]> {
    const timestamp = new Date().toISOString();
    let targets: any[] = [];

    try {
      const baseQuery = db
        .select()
        .from(monitoringTargets)
        .where(and(eq(monitoringTargets.isActive, true), gte(monitoringTargets.stabilityScore, MIN_SCORE)));

      targets = stateFilter
        ? await db
            .select()
            .from(monitoringTargets)
            .where(and(
              eq(monitoringTargets.isActive, true),
              gte(monitoringTargets.stabilityScore, MIN_SCORE),
              eq(monitoringTargets.state, stateFilter.toLowerCase()),
            ))
        : await baseQuery;
    } catch (err: any) {
      console.error("Error fetching targets:", err.message);
      return [];
    }

    if (!targets || targets.length === 0) return [];

    const targetsByState: Record<string, any[]> = {};
    targets.forEach((t) => {
      const s = t.state || "unknown";
      if (!targetsByState[s]) targetsByState[s] = [];
      targetsByState[s].push(t);
    });

    const results: CheckResult[] = [];

    for (const stateTargets of Object.values(targetsByState)) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < stateTargets.length; i += CHUNK_SIZE) {
        const chunk = stateTargets.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map((target) => this.checkIp(target, timestamp)));
        results.push(...chunkResults);
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    try {
      await this.storeResults(results);
    } catch (err) {
      console.error("Storage failed:", err);
    }

    try {
      await AnalyzerService.analyze(results);
    } catch (err) {
      console.error("[Analyzer] Trigger failed:", err);
    }

    return results;
  }

  private static async checkIp(target: any, timestamp: string): Promise<CheckResult> {
    const startTime = Date.now();
    const services = Array.isArray(target.services) ? target.services : (target.services ? JSON.parse(target.services) : []);
    const portsToTry = services.length > 0 ? [services[0]] : [80, 443, 8080, 8291];

    let status: "online" | "offline" = "offline";
    let latency: number | undefined;

    for (const port of portsToTry) {
      const isResponsive = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3500);
        socket.connect(port, target.ip, () => { socket.destroy(); resolve(true); });
        const fail = () => { socket.destroy(); resolve(false); };
        socket.on("error", fail);
        socket.on("timeout", fail);
        socket.on("close", fail);
      });

      if (isResponsive) {
        status = "online";
        latency = Date.now() - startTime;
        break;
      }
    }

    return { ip: target.ip, provider: target.provider, state: normalizeStateName(target.state), status, latency, timestamp };
  }

  private static async storeResults(results: CheckResult[]) {
    try {
      await db.insert(connectivityChecks).values(
        results.map((r) => ({
          ip: r.ip,
          provider: r.provider,
          state: r.state,
          status: r.status,
          latency: r.latency ?? null,
          timestamp: new Date(r.timestamp),
        })),
      );
    } catch (error) {
      console.error("Error storing check results:", error);
    }
  }
}
