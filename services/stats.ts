import { supabase } from "@/utils/supabase";

export async function getDashboardStats(state?: string, provider?: string) {
  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_state: state || null,
    p_provider: provider || null,
  });

  if (error || !data || data.length === 0) {
    console.error("Error fetching dashboard stats:", error);
    return {
      availability: 0,
      activeSensors: 0,
      onlineSensors: 0,
      avgLatency: 0,
      trend: "0%",
    };
  }

  const result = data[0];
  const availability =
    result.total_nodes > 0
      ? Math.round((result.online_nodes / result.total_nodes) * 100)
      : 0;

  return {
    availability,
    activeSensors: Number(result.total_nodes) || 0,
    onlineSensors: Number(result.online_nodes) || 0,
    avgLatency: Math.round(Number(result.avg_latency)) || 0,
    trend: "-5.2%", // Static for now
  };
}

export async function getRegionalStats(state?: string, provider?: string) {
  const [{ data: regions, error }, activeBlackouts] = await Promise.all([
    supabase.rpc("get_regional_stats", {
      p_state: state || null,
      p_provider: provider || null,
    }),
    getActiveBlackouts(),
  ]);

  if (error || !regions) {
    console.error("Error fetching regional stats:", error);
    return [];
  }

  // Group by state
  const stateStats: Record<
    string,
    { total: number; online: number; latency_sum: number; count: number }
  > = {};

  regions.forEach((data: any) => {
    const s = data.state || "Unknown";
    if (!stateStats[s]) {
      stateStats[s] = { total: 0, online: 0, latency_sum: 0, count: 0 };
    }
    stateStats[s].total += data.total_nodes;
    stateStats[s].online += data.online_nodes;
    stateStats[s].latency_sum += data.avg_latency || 0;
    stateStats[s].count += 1;
  });

  const formattedStats: any[] = [];

  // Add state-level stats
  Object.entries(stateStats).forEach(([stateName, stats]) => {
    const ratio = stats.total > 0 ? stats.online / stats.total : 0;
    const avgLatency = stats.count > 0 ? stats.latency_sum / stats.count : 0;
    const SLOW_THRESHOLD = 1200;

    let status = "status.outage";
    let color = "text-danger";
    let bg = "bg-danger/10";

    if (ratio > 0.8) {
      if (avgLatency > SLOW_THRESHOLD) {
        status = "status.slow";
        color = "text-warning";
        bg = "bg-warning/10";
      } else {
        status = "status.operational";
        color = "text-success";
        bg = "bg-success/10";
      }
    } else if (ratio > 0.3) {
      status = "status.rationing";
      color = "text-warning";
      bg = "bg-warning/10";
    }

    formattedStats.push({
      location: stateName,
      availability: stats.total === 0 ? "N/A" : `${Math.round(ratio * 100)}%`,
      status: stats.total === 0 ? "table.notAvailable" : status,
      lastSync: "table.updated",
      color: stats.total === 0 ? "text-muted-foreground" : color,
      bg: stats.total === 0 ? "bg-secondary" : bg,
      isState: true,
    });
  });

  // Add individual city rows ONLY if they have an active blackout
  regions.forEach((data: any) => {
    const hasBlackout = activeBlackouts.some(
      (b) => b.state === data.state && b.city === data.city,
    );

    if (hasBlackout && data.city) {
      const ratio =
        data.total_nodes > 0 ? data.online_nodes / data.total_nodes : 0;
      const SLOW_THRESHOLD = 1200;

      let status = "status.outage";
      let color = "text-danger";
      let bg = "bg-danger/10";

      if (ratio > 0.8) {
        if (data.avg_latency > SLOW_THRESHOLD) {
          status = "status.slow";
          color = "text-warning";
          bg = "bg-warning/10";
        } else {
          status = "status.operational";
          color = "text-success";
          bg = "bg-success/10";
        }
      } else if (ratio > 0.3) {
        status = "status.rationing";
        color = "text-warning";
        bg = "bg-warning/10";
      }

      formattedStats.push({
        location: `${data.state} - ${data.city}`,
        availability:
          data.total_nodes === 0 ? "N/A" : `${Math.round(ratio * 100)}%`,
        status: data.total_nodes === 0 ? "table.notAvailable" : status,
        lastSync: "table.activeAlert",
        color: data.total_nodes === 0 ? "text-muted-foreground" : color,
        bg: data.total_nodes === 0 ? "bg-secondary" : bg,
        isAlert: true,
      });
    }
  });

  return formattedStats.sort((a, b) => {
    if (a.isState && !b.isState) return -1;
    if (!a.isState && b.isState) return 1;
    return a.location.localeCompare(b.location);
  });
}

export async function getNodeComposition(state?: string, provider?: string) {
  const { data: providers, error } = await supabase.rpc("get_provider_stats", {
    p_state: state || null,
    p_provider: provider || null,
  });

  if (error || !providers) {
    console.error("Error fetching provider stats:", error);
    return [];
  }

  return providers.map((data: any) => {
    const ratio =
      data.total_nodes > 0 ? data.online_nodes / data.total_nodes : 0;
    const SLOW_THRESHOLD = 1200;

    let status = "status.outage";
    let color = "bg-danger";
    let textColor = "text-danger";

    if (ratio > 0.8) {
      if (data.avg_latency > SLOW_THRESHOLD) {
        status = "status.slow";
        color = "bg-warning";
        textColor = "text-warning";
      } else {
        status = "status.operational";
        color = "bg-success";
        textColor = "text-success";
      }
    } else if (ratio > 0.3) {
      status = "status.degraded";
      color = "bg-warning";
      textColor = "text-warning";
    }

    return {
      name: data.provider,
      total: data.total_nodes,
      online: data.online_nodes,
      status,
      color,
      textColor,
      percent: Math.round(ratio * 100),
    };
  });
}

export async function getMapData(state?: string, provider?: string) {
  let allData: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .rpc("get_map_data", {
        p_state: state || null,
        p_provider: provider || null,
      })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching map data:", error.message || error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allData
    .filter((t: any) => t.lat && t.lon && t.lat !== 0 && t.lon !== 0)
    .map((t: any) => ({
      ip: t.ip,
      lat: t.lat || 0,
      lon: t.lon || 0,
      provider: t.provider,
      location: `${t.state} - ${t.city}`,
      status: t.status,
    }));
}

export async function getFiltersData() {
  const { data: targets } = await supabase
    .from("monitoring_targets")
    .select("state, provider")
    .eq("is_active", true)
    .limit(50000);

  const states = Array.from(
    new Set(targets?.map((t) => t.state).filter(Boolean)),
  ).sort();
  const providers = Array.from(
    new Set(targets?.map((t) => t.provider).filter(Boolean)),
  ).sort();

  return { states, providers };
}

export async function getHistoricalStats(state?: string, provider?: string) {
  const { data, error } = await supabase.rpc("get_historical_stats", {
    p_state: state || null,
    p_provider: provider || null,
  });

  if (error || !data) {
    console.error("Error fetching historical stats:", error?.message || error);
    return { daily: [], hourly: [] };
  }

  const daily = data
    .filter((row: any) => row.granularity === "day")
    .map((row: any) => ({
      name: new Date(row.bucket)
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase(),
      uptime: Math.round(
        (Number(row.online_count) / Number(row.total_count)) * 100,
      ),
    }));

  const hourly = data
    .filter((row: any) => row.granularity === "hour")
    .map((row: any) => ({
      time: new Date(row.bucket).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      uptime: Math.round(
        (Number(row.online_count) / Number(row.total_count)) * 100,
      ),
    }));

  return { daily, hourly };
}

export async function getActiveBlackouts() {
  const { data, error } = await supabase
    .from("blackout_events")
    .select("*")
    .eq("status", "active")
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching active blackouts:", error);
    return [];
  }
  return data || [];
}
