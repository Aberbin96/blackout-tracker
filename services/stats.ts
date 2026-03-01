import { supabase } from "@/utils/supabase";

export async function getDashboardStats(state?: string, provider?: string) {
  let query = supabase
    .from("monitoring_targets")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  if (state) query = query.eq("state", state);
  if (provider) query = query.eq("provider", provider);

  const { count: totalNodes } = await query;

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let checkQuery = supabase
    .from("connectivity_checks")
    .select("ip, status, latency")
    .gt("timestamp", fifteenMinutesAgo)
    .order("timestamp", { ascending: false });

  if (state) checkQuery = checkQuery.eq("state", state);
  if (provider) checkQuery = checkQuery.eq("provider", provider);

  const { data: recentChecks } = await checkQuery;

  const uniqueIps = new Set();
  let onlineCount = 0;
  let totalLatency = 0;

  recentChecks?.forEach((check) => {
    if (!uniqueIps.has(check.ip)) {
      uniqueIps.add(check.ip);
      if (check.status === "online") {
        onlineCount++;
        totalLatency += (check as any).latency || 0;
      }
    }
  });

  const availability = totalNodes
    ? Math.round((onlineCount / totalNodes) * 100)
    : 0;

  const avgLatency = onlineCount ? Math.round(totalLatency / onlineCount) : 0;
  const SLOW_THRESHOLD = 1200; // ms

  return {
    availability,
    activeSensors: totalNodes || 0,
    onlineSensors: onlineCount,
    avgLatency,
    trend: "-5.2%",
  };
}

export async function getRegionalStats(state?: string, provider?: string) {
  let targetQuery = supabase
    .from("monitoring_targets")
    .select("state, city, ip")
    .eq("is_active", true);

  if (state) targetQuery = targetQuery.eq("state", state);
  if (provider) targetQuery = targetQuery.eq("provider", provider);

  const { data: targets } = await targetQuery;

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let checkQuery = supabase
    .from("connectivity_checks")
    .select("ip, status, latency, timestamp")
    .gt("timestamp", fifteenMinutesAgo)
    .order("timestamp", { ascending: false });

  if (state) checkQuery = checkQuery.eq("state", state);
  if (provider) checkQuery = checkQuery.eq("provider", provider);

  const { data: checks } = await checkQuery;

  const statusMap = new Map();
  const latencyMap = new Map();
  checks?.forEach((c) => {
    if (!statusMap.has(c.ip)) {
      statusMap.set(c.ip, c.status);
      latencyMap.set(c.ip, (c as any).latency || 0);
    }
  });

  const regions: any = {};
  targets?.forEach((t) => {
    const stateName = t.state || "Unknown";
    if (!regions[stateName])
      regions[stateName] = {
        total: 0,
        online: 0,
        totalLatency: 0,
        city: t.city,
      };
    regions[stateName].total++;
    if (statusMap.get(t.ip) === "online") {
      regions[stateName].online++;
      regions[stateName].totalLatency += latencyMap.get(t.ip) || 0;
    }
  });

  return Object.entries(regions)
    .map(([state, data]: [string, any]) => {
      const ratio = data.total > 0 ? data.online / data.total : 0;
      const avgLat = data.online > 0 ? data.totalLatency / data.online : 0;
      const SLOW_THRESHOLD = 1200;

      let status = "BLACKOUT";
      let color = "text-danger";
      let bg = "bg-danger/10";

      if (ratio > 0.8) {
        if (avgLat > SLOW_THRESHOLD) {
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
        location: `${state}${data.city ? " - " + data.city : ""}`,
        availability: `${Math.round(ratio * 100)}%`,
        status,
        lastSync: "Actualizado",
        color,
        bg,
      };
    })
    .sort((a, b) => b.location.localeCompare(a.location));
}

export async function getNodeComposition(state?: string, provider?: string) {
  let query = supabase
    .from("monitoring_targets")
    .select("provider, ip")
    .eq("is_active", true);
  if (state) query = query.eq("state", state);
  if (provider) query = query.eq("provider", provider);

  const { data: targets } = await query;

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let checkQuery = supabase
    .from("connectivity_checks")
    .select("ip, status, latency")
    .gt("timestamp", fifteenMinutesAgo);

  if (state) checkQuery = checkQuery.eq("state", state);
  if (provider) checkQuery = checkQuery.eq("provider", provider);

  const { data: checks } = await checkQuery;

  const statusMap = new Map();
  const latencyMap = new Map();
  checks?.forEach((c) => {
    if (!statusMap.has(c.ip)) {
      statusMap.set(c.ip, c.status);
      latencyMap.set(c.ip, (c as any).latency || 0);
    }
  });

  const providers: any = {};
  targets?.forEach((t) => {
    if (!providers[t.provider])
      providers[t.provider] = { total: 0, online: 0, totalLatency: 0 };
    providers[t.provider].total++;
    if (statusMap.get(t.ip) === "online") {
      providers[t.provider].online++;
      providers[t.provider].totalLatency += latencyMap.get(t.ip) || 0;
    }
  });

  return Object.entries(providers).map(([name, data]: [string, any]) => {
    const ratio = data.total > 0 ? data.online / data.total : 0;
    const avgLat = data.online > 0 ? data.totalLatency / data.online : 0;
    const SLOW_THRESHOLD = 1200;

    let status = "Massive Failure";
    let color = "bg-danger";
    let textColor = "text-danger";

    if (ratio > 0.8) {
      if (avgLat > SLOW_THRESHOLD) {
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
      name,
      total: data.total,
      online: data.online,
      status,
      color,
      textColor,
      percent: Math.round(ratio * 100),
    };
  });
}

export async function getMapData(state?: string, provider?: string) {
  let query = supabase
    .from("monitoring_targets")
    .select("ip, lat, lon, provider, state, city")
    .eq("is_active", true)
    .not("lat", "is", null);

  if (state) query = query.eq("state", state);
  if (provider) query = query.eq("provider", provider);

  const { data: targets } = await query;

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  let checkQuery = supabase
    .from("connectivity_checks")
    .select("ip, status")
    .gt("timestamp", fifteenMinutesAgo)
    .order("timestamp", { ascending: false });

  if (state) checkQuery = checkQuery.eq("state", state);
  if (provider) checkQuery = checkQuery.eq("provider", provider);

  const { data: checks } = await checkQuery;

  const statusMap = new Map();
  checks?.forEach((c) => {
    if (!statusMap.has(c.ip)) statusMap.set(c.ip, c.status);
  });

  return (
    targets?.map((t) => ({
      ip: t.ip,
      lat: t.lat || 0,
      lon: t.lon || 0,
      provider: t.provider,
      location: `${t.state} - ${t.city}`,
      status: statusMap.get(t.ip) || "offline",
    })) || []
  );
}

export async function getFiltersData() {
  const { data: targets } = await supabase
    .from("monitoring_targets")
    .select("state, provider")
    .eq("is_active", true);

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
    .order("timestamp", { ascending: true });

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
