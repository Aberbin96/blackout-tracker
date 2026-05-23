import { db } from "@/db";
import { connectivityChecks, monitoringTargets, blackoutEvents, dailyRegionalStats } from "@/db/schema";
import { and, eq, gte, sql, desc, asc, inArray, isNotNull } from "drizzle-orm";
import { cacheLife } from "next/cache";

const MIN_SCORE = Number(process.env.MIN_STABILITY_SCORE || 10);

function fifteenMinutesAgo() {
  return new Date(Date.now() - 15 * 60 * 1000);
}

function buildBaseFilters(state?: string, provider?: string) {
  const filters = [
    eq(monitoringTargets.isActive, true),
    gte(monitoringTargets.stabilityScore, MIN_SCORE),
  ];
  if (state) filters.push(eq(monitoringTargets.state, state));
  if (provider) filters.push(eq(monitoringTargets.provider, provider));
  return filters;
}

export async function getDashboardStats(state?: string, provider?: string) {
  "use cache";
  cacheLife("minutes");

  try {
    const cutoff = fifteenMinutesAgo();

    // Get latest check per IP in the last 15 minutes
    const latestChecks = db
      .select({
        ip: connectivityChecks.ip,
        status: connectivityChecks.status,
        latency: connectivityChecks.latency,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${connectivityChecks.ip} ORDER BY ${connectivityChecks.timestamp} DESC)`.as("rn"),
      })
      .from(connectivityChecks)
      .where(gte(connectivityChecks.timestamp, cutoff))
      .as("latest_checks");

    const rows = await db
      .select({
        totalNodes: sql<number>`COUNT(DISTINCT ${monitoringTargets.ip})`,
        onlineNodes: sql<number>`SUM(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN 1 ELSE 0 END)`,
        avgLatency: sql<number>`AVG(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN latest_checks.latency END)`,
      })
      .from(monitoringTargets)
      .leftJoin(latestChecks, and(
        eq(monitoringTargets.ip, latestChecks.ip),
        eq(sql`${latestChecks.rn}`, 1),
      ))
      .where(and(...buildBaseFilters(state, provider)));

    const result = rows[0];
    const totalNodes = Number(result?.totalNodes ?? 0);
    const onlineNodes = Number(result?.onlineNodes ?? 0);
    const availability = totalNodes > 0 ? Math.round((onlineNodes / totalNodes) * 100) : 0;

    return {
      availability,
      activeSensors: totalNodes,
      onlineSensors: onlineNodes,
      avgLatency: Math.round(Number(result?.avgLatency ?? 0)) || 0,
      trend: "-5.2%",
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return { availability: 0, activeSensors: 0, onlineSensors: 0, avgLatency: 0, trend: "0%" };
  }
}

export async function getRegionalStats(state?: string, provider?: string) {
  "use cache";
  cacheLife("minutes");

  try {
    const cutoff = fifteenMinutesAgo();

    const latestChecks = db
      .select({
        ip: connectivityChecks.ip,
        status: connectivityChecks.status,
        latency: connectivityChecks.latency,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${connectivityChecks.ip} ORDER BY ${connectivityChecks.timestamp} DESC)`.as("rn"),
      })
      .from(connectivityChecks)
      .where(gte(connectivityChecks.timestamp, cutoff))
      .as("latest_checks");

    const [regions, activeBlackouts] = await Promise.all([
      db
        .select({
          state: monitoringTargets.state,
          city: monitoringTargets.city,
          totalNodes: sql<number>`COUNT(DISTINCT ${monitoringTargets.ip})`,
          onlineNodes: sql<number>`SUM(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN 1 ELSE 0 END)`,
          avgLatency: sql<number>`AVG(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN latest_checks.latency END)`,
        })
        .from(monitoringTargets)
        .leftJoin(latestChecks, and(
          eq(monitoringTargets.ip, latestChecks.ip),
          eq(sql`${latestChecks.rn}`, 1),
        ))
        .where(and(...buildBaseFilters(state, provider)))
        .groupBy(monitoringTargets.state, monitoringTargets.city),
      getActiveBlackouts(),
    ]);

    const stateStats: Record<string, { total: number; online: number; latencySum: number; count: number }> = {};

    regions.forEach((data) => {
      const s = data.state || "Unknown";
      if (!stateStats[s]) stateStats[s] = { total: 0, online: 0, latencySum: 0, count: 0 };
      stateStats[s].total += Number(data.totalNodes);
      stateStats[s].online += Number(data.onlineNodes ?? 0);
      stateStats[s].latencySum += Number(data.avgLatency ?? 0);
      stateStats[s].count += 1;
    });

    const formattedStats: any[] = [];

    Object.entries(stateStats).forEach(([stateName, stats]) => {
      const ratio = stats.total > 0 ? stats.online / stats.total : 0;
      const avgLatency = stats.count > 0 ? stats.latencySum / stats.count : 0;
      const SLOW = 1200;
      let status = "status.outage", color = "text-danger", bg = "bg-danger/10";
      if (ratio > 0.8) {
        if (avgLatency > SLOW) { status = "status.slow"; color = "text-warning"; bg = "bg-warning/10"; }
        else { status = "status.operational"; color = "text-success"; bg = "bg-success/10"; }
      } else if (ratio >= 0.6) {
        status = "status.rationing"; color = "text-warning"; bg = "bg-warning/10";
      }
      formattedStats.push({
        location: stateName, totalNodes: stats.total,
        availability: stats.total === 0 ? "N/A" : `${Math.round(ratio * 100)}%`,
        status: stats.total === 0 ? "table.notAvailable" : status,
        lastSync: "table.updated",
        color: stats.total === 0 ? "text-muted-foreground" : color,
        bg: stats.total === 0 ? "bg-secondary" : bg,
        isState: true,
      });
    });

    regions.forEach((data) => {
      const hasBlackout = activeBlackouts.some((b: any) => b.state === data.state && b.city === data.city);
      if (hasBlackout && data.city) {
        const ratio = Number(data.totalNodes) > 0 ? Number(data.onlineNodes ?? 0) / Number(data.totalNodes) : 0;
        const SLOW = 1200;
        let status = "status.outage", color = "text-danger", bg = "bg-danger/10";
        if (ratio > 0.8) {
          if (Number(data.avgLatency) > SLOW) { status = "status.slow"; color = "text-warning"; bg = "bg-warning/10"; }
          else { status = "status.operational"; color = "text-success"; bg = "bg-success/10"; }
        } else if (ratio >= 0.6) {
          status = "status.rationing"; color = "text-warning"; bg = "bg-warning/10";
        }
        formattedStats.push({
          location: `${data.state} - ${data.city}`, totalNodes: Number(data.totalNodes),
          availability: Number(data.totalNodes) === 0 ? "N/A" : `${Math.round(ratio * 100)}%`,
          status: Number(data.totalNodes) === 0 ? "table.notAvailable" : status,
          lastSync: "table.activeAlert",
          color: Number(data.totalNodes) === 0 ? "text-muted-foreground" : color,
          bg: Number(data.totalNodes) === 0 ? "bg-secondary" : bg,
          isAlert: true,
        });
      }
    });

    return formattedStats.sort((a, b) => {
      if (a.isState && !b.isState) return -1;
      if (!a.isState && b.isState) return 1;
      return a.location.localeCompare(b.location);
    });
  } catch (error) {
    console.error("Error fetching regional stats:", error);
    return [];
  }
}

export async function getNodeComposition(state?: string, provider?: string) {
  "use cache";
  cacheLife("minutes");

  try {
    const cutoff = fifteenMinutesAgo();

    const latestChecks = db
      .select({
        ip: connectivityChecks.ip,
        status: connectivityChecks.status,
        latency: connectivityChecks.latency,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${connectivityChecks.ip} ORDER BY ${connectivityChecks.timestamp} DESC)`.as("rn"),
      })
      .from(connectivityChecks)
      .where(gte(connectivityChecks.timestamp, cutoff))
      .as("latest_checks");

    const providers = await db
      .select({
        provider: monitoringTargets.provider,
        totalNodes: sql<number>`COUNT(DISTINCT ${monitoringTargets.ip})`,
        onlineNodes: sql<number>`SUM(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN 1 ELSE 0 END)`,
        avgLatency: sql<number>`AVG(CASE WHEN latest_checks.status = 'online' AND latest_checks.rn = 1 THEN latest_checks.latency END)`,
      })
      .from(monitoringTargets)
      .leftJoin(latestChecks, and(
        eq(monitoringTargets.ip, latestChecks.ip),
        eq(sql`${latestChecks.rn}`, 1),
      ))
      .where(and(...buildBaseFilters(state, provider)))
      .groupBy(monitoringTargets.provider);

    return providers.map((data) => {
      const ratio = Number(data.totalNodes) > 0 ? Number(data.onlineNodes ?? 0) / Number(data.totalNodes) : 0;
      const SLOW = 1200;
      let status = "status.outage", color = "bg-danger", textColor = "text-danger";
      if (ratio > 0.8) {
        if (Number(data.avgLatency) > SLOW) { status = "status.slow"; color = "bg-warning"; textColor = "text-warning"; }
        else { status = "status.operational"; color = "bg-success"; textColor = "text-success"; }
      } else if (ratio >= 0.6) {
        status = "status.degraded"; color = "bg-warning"; textColor = "text-warning";
      }
      return {
        name: data.provider,
        total: Number(data.totalNodes),
        online: Number(data.onlineNodes ?? 0),
        status, color, textColor,
        percent: Math.round(ratio * 100),
      };
    });
  } catch (error) {
    console.error("Error fetching provider stats:", error);
    return [];
  }
}

export async function getMapData(state?: string, provider?: string) {
  "use cache";
  cacheLife("minutes");

  try {
    const cutoff = fifteenMinutesAgo();
    const PAGE_SIZE = 1000;
    const allData: any[] = [];
    let offset = 0;
    let hasMore = true;

    const latestChecks = db
      .select({
        ip: connectivityChecks.ip,
        status: connectivityChecks.status,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${connectivityChecks.ip} ORDER BY ${connectivityChecks.timestamp} DESC)`.as("rn"),
      })
      .from(connectivityChecks)
      .where(gte(connectivityChecks.timestamp, cutoff))
      .as("latest_checks");

    while (hasMore) {
      const rows = await db
        .select({
          ip: monitoringTargets.ip,
          lat: monitoringTargets.lat,
          lon: monitoringTargets.lon,
          provider: monitoringTargets.provider,
          state: monitoringTargets.state,
          city: monitoringTargets.city,
          status: sql<string>`COALESCE(latest_checks.status, 'unknown')`,
        })
        .from(monitoringTargets)
        .leftJoin(latestChecks, and(
          eq(monitoringTargets.ip, latestChecks.ip),
          eq(sql`${latestChecks.rn}`, 1),
        ))
        .where(and(...buildBaseFilters(state, provider)))
        .limit(PAGE_SIZE)
        .offset(offset);

      if (!rows || rows.length === 0) {
        hasMore = false;
      } else {
        allData.push(...rows);
        if (rows.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      }
    }

    return allData
      .filter((t) => t.lat && t.lon && t.lat !== 0 && t.lon !== 0)
      .map((t) => ({
        ip: t.ip,
        lat: t.lat ?? 0,
        lon: t.lon ?? 0,
        provider: t.provider,
        location: `${t.state} - ${t.city}`,
        status: t.status,
      }));
  } catch (error) {
    console.error("Error fetching map data:", error);
    return [];
  }
}

export async function getFiltersData() {
  "use cache";
  cacheLife("weeks");

  try {
    const [stateRows, providerRows] = await Promise.all([
      db.selectDistinct({ state: monitoringTargets.state })
        .from(monitoringTargets)
        .where(and(eq(monitoringTargets.isActive, true), gte(monitoringTargets.stabilityScore, MIN_SCORE)))
        .orderBy(asc(monitoringTargets.state)),
      db.selectDistinct({ provider: monitoringTargets.provider })
        .from(monitoringTargets)
        .where(and(eq(monitoringTargets.isActive, true), gte(monitoringTargets.stabilityScore, MIN_SCORE)))
        .orderBy(asc(monitoringTargets.provider)),
    ]);

    const states = stateRows.map((r) => r.state).filter(Boolean) as string[];
    const providers = providerRows.map((r) => r.provider).filter(Boolean) as string[];

    return { states, providers };
  } catch (error) {
    console.error("Error fetching filters data:", error);
    return { states: [], providers: [] };
  }
}

export async function getHistoricalStats(state?: string, provider?: string) {
  "use cache";
  cacheLife("hours");

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const dailyFilters = [gte(dailyRegionalStats.date, sql`DATE(${sevenDaysAgo.toISOString().slice(0, 10)})`)];
    if (state) dailyFilters.push(eq(dailyRegionalStats.state, state));
    if (provider) dailyFilters.push(eq(dailyRegionalStats.provider, provider));

    const hourlyFilters = [gte(connectivityChecks.timestamp, twentyFourHoursAgo)];
    if (state) hourlyFilters.push(eq(connectivityChecks.state, state));
    if (provider) hourlyFilters.push(eq(connectivityChecks.provider, provider));

    const [dailyRows, hourlyRows] = await Promise.all([
      db
        .select({
          date: dailyRegionalStats.date,
          totalChecks: sql<number>`SUM(${dailyRegionalStats.totalChecks})`,
          onlineChecks: sql<number>`SUM(${dailyRegionalStats.onlineChecks})`,
        })
        .from(dailyRegionalStats)
        .where(and(...dailyFilters))
        .groupBy(dailyRegionalStats.date)
        .orderBy(asc(dailyRegionalStats.date)),
      db
        .select({
          hour: sql<string>`DATE_FORMAT(${connectivityChecks.timestamp}, '%Y-%m-%d %H:00:00')`,
          totalCount: sql<number>`COUNT(*)`,
          onlineCount: sql<number>`SUM(CASE WHEN ${connectivityChecks.status} = 'online' THEN 1 ELSE 0 END)`,
        })
        .from(connectivityChecks)
        .where(and(...hourlyFilters))
        .groupBy(sql`DATE_FORMAT(${connectivityChecks.timestamp}, '%Y-%m-%d %H:00:00')`)
        .orderBy(sql`DATE_FORMAT(${connectivityChecks.timestamp}, '%Y-%m-%d %H:00:00')`),
    ]);

    const daily = dailyRows.map((row) => ({
      name: new Date(row.date).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      uptime: Number(row.totalChecks) > 0
        ? Math.round((Number(row.onlineChecks) / Number(row.totalChecks)) * 100)
        : 0,
    }));

    const hourly = hourlyRows.map((row) => ({
      time: new Date(row.hour).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      uptime: Number(row.totalCount) > 0
        ? Math.round((Number(row.onlineCount) / Number(row.totalCount)) * 100)
        : 0,
    }));

    return { daily, hourly };
  } catch (error) {
    console.error("Error fetching historical stats:", error);
    return { daily: [], hourly: [] };
  }
}

export async function getActiveBlackouts() {
  "use cache";
  cacheLife("minutes");

  try {
    return await db
      .select()
      .from(blackoutEvents)
      .where(eq(blackoutEvents.status, "active"))
      .orderBy(desc(blackoutEvents.startedAt));
  } catch (error) {
    console.error("Error fetching active blackouts:", error);
    return [];
  }
}
