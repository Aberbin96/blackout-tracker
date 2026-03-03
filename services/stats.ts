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
  const { data: regions, error } = await supabase.rpc("get_regional_stats", {
    p_state: state || null,
    p_provider: provider || null,
  });

  if (error || !regions) {
    console.error("Error fetching regional stats:", error);
    return [];
  }

  return regions.map((data: any) => {
    const stateName = data.state || "Unknown";

    if (data.total_nodes === 0) {
      return {
        location: `${stateName}${data.city ? " - " + data.city : ""}`,
        availability: `N/A`,
        status: "NO DISPONIBLE",
        lastSync: "> 15m",
        color: "text-muted-foreground",
        bg: "bg-secondary",
      };
    }

    const ratio =
      data.total_nodes > 0 ? data.online_nodes / data.total_nodes : 0;
    const SLOW_THRESHOLD = 1200;

    let status = "BLACKOUT";
    let color = "text-danger";
    let bg = "bg-danger/10";

    if (ratio > 0.8) {
      if (data.avg_latency > SLOW_THRESHOLD) {
        status = "SLOW";
        color = "text-warning";
        bg = "bg-warning/10";
      } else {
        status = "STABLE";
        color = "text-success";
        bg = "bg-success/10";
      }
    } else if (ratio > 0.3) {
      status = "RATIONING";
      color = "text-warning";
      bg = "bg-warning/10";
    }

    return {
      location: `${stateName}${data.city ? " - " + data.city : ""}`,
      availability: `${Math.round(ratio * 100)}%`,
      status,
      lastSync: "Actualizado",
      color,
      bg,
    };
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

    let status = "Massive Failure";
    let color = "bg-danger";
    let textColor = "text-danger";

    if (ratio > 0.8) {
      if (data.avg_latency > SLOW_THRESHOLD) {
        status = "Degraded (Slow)";
        color = "bg-warning";
        textColor = "text-warning";
      } else {
        status = "Stable";
        color = "bg-success";
        textColor = "text-success";
      }
    } else if (ratio > 0.3) {
      status = "Partial Outage";
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
  const { data, error } = await supabase.rpc("get_map_data", {
    p_state: state || null,
    p_provider: provider || null,
  });

  if (error) {
    console.error("Error fetching map data:", error);
    return [];
  }

  return data.map((t: any) => ({
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
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from("connectivity_checks")
    .select("timestamp, status")
    .gt("timestamp", sevenDaysAgo)
    .order("timestamp", { ascending: true })
    .limit(500000);

  if (state) query = query.eq("state", state);
  if (provider) query = query.eq("provider", provider);

  const { data: checks } = await query;
  if (!checks) return { daily: [], hourly: [] };

  // Group by day for the last 7 days
  const dailyMap: any = {};
  const hourlyMap: any = {};

  checks.forEach((c) => {
    const date = c.timestamp.split("T")[0];
    const hour = c.timestamp.split("T")[1].split(":")[0];
    const hourKey = `${date}T${hour}:00:00`;

    if (!dailyMap[date]) dailyMap[date] = { online: 0, total: 0 };
    if (!hourlyMap[hourKey]) hourlyMap[hourKey] = { online: 0, total: 0 };

    dailyMap[date].total++;
    hourlyMap[hourKey].total++;
    if (c.status === "online") {
      dailyMap[date].online++;
      hourlyMap[hourKey].online++;
    }
  });

  const daily = Object.entries(dailyMap)
    .map(([date, stats]: [string, any]) => ({
      name: new Date(date)
        .toLocaleDateString("en-US", { weekday: "short" })
        .toUpperCase(),
      uptime: Math.round((stats.online / stats.total) * 100),
    }))
    .slice(-7);

  const hourly = Object.entries(hourlyMap)
    .map(([hour, stats]: [string, any]) => ({
      time: hour.split("T")[1].substring(0, 5),
      uptime: Math.round((stats.online / stats.total) * 100),
    }))
    .slice(-24);

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
