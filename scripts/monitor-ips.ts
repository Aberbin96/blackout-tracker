import net from "net";
import axios from "axios";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import { normalizeStateName } from "../utils/normalization";

const execAsync = promisify(exec);

// Load environment variables
const envPath = path.join(process.cwd(), ".env.local");
const envResult = dotenv.config({ path: envPath });

console.log(`[ENV] Loading from: ${envPath}`);
if (envResult.error) {
  console.warn(`[ENV] Warning: Failed to load .env.local: ${envResult.error.message}`);
} else {
  console.log(`[ENV] Successfully loaded .env.local keys: ${Object.keys(envResult.parsed || {}).join(", ")}`);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const apiUrl = process.env.API_CHECK_URL;
const cronSecret = process.env.CRON_SECRET;
const minStabilityScoreEnv = parseInt(
  process.env.MIN_STABILITY_SCORE || process.env.MIN_STABILITY_SCORE || "10",
);

if (!supabaseUrl) {
  console.error("Error: SUPABASE_URL is missing");
  process.exit(1);
}
if (!supabaseKey) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_DEFAULT_KEY is missing",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Target {
  id: string;
  ip: string;
  provider: string;
  state: string;
  services: number[];
  stability_score?: number;
}

interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  working_port?: number;
  error_type?: string;
  timeout_ms: number;
  timestamp: string;
}

async function pingIp(ip: string, timeoutMs: number): Promise<boolean> {
  try {
    const platform = process.platform;
    // -c 3: three packets, -W: timeout in ms per packet
    const cmd =
      platform === "win32"
        ? `ping -n 2 -w ${timeoutMs} ${ip}`
        : `ping -c 2 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;

    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

async function fastCheck(
  target: Target,
  timestamp: string,
): Promise<CheckResult> {
  const startTime = Date.now();
  const timeoutMs = 8000;
  const primaryPort = target.services?.[0] || 80;
  const commonPorts = [80, 443, 8291, 7547, 8080, 22, 53, 3389, 8443, 5060];
  const portsToTry = Array.from(new Set([primaryPort, ...commonPorts]));

  // Run ICMP (Ping) and Top Ports in parallel
  const results = await Promise.all([
    pingIp(target.ip, 8000),
    ...portsToTry.map((port) => performCheck(target.ip, port, timeoutMs)),
  ]);

  const icmpRes = results[0] as boolean;
  const tcpResults = results.slice(1) as { success: boolean; code?: string }[];
  const successIndex = tcpResults.findIndex((r) => r.success);

  const isOnline = icmpRes || successIndex !== -1;

  return {
    ip: target.ip,
    provider: target.provider,
    state: normalizeStateName(target.state).toLowerCase(),
    status: isOnline ? "online" : "offline",
    latency: Date.now() - startTime,
    working_port: successIndex !== -1 ? portsToTry[successIndex] : undefined,
    error_type:
      successIndex !== -1
        ? "DISCOVERY_OPEN"
        : icmpRes
          ? "ICMP_ONLY"
          : tcpResults[0]?.code,
    timeout_ms: timeoutMs,
    timestamp,
  };
}

async function retryCheck(
  target: Target,
  timestamp: string,
): Promise<CheckResult> {
  const startTime = Date.now();
  const RETRY_TIMEOUT = 10000;
  const primaryPort = target.services?.[0] || 80;
  const commonPorts = [80, 443, 8291, 7547, 8080, 22, 53, 3389, 8443]; // Expanded list to restore previous discovery power
  const portsToTry = Array.from(new Set([primaryPort, ...commonPorts]));

  // Multi-discovery retry
  const results = await Promise.all([
    pingIp(target.ip, 5000),
    ...portsToTry.map((port) => performCheck(target.ip, port, RETRY_TIMEOUT)),
  ]);

  const icmpRes = results[0] as boolean;
  const tcpResults = results.slice(1) as { success: boolean; code?: string }[];
  const successIndex = tcpResults.findIndex((r) => r.success);

  const isOnline = icmpRes || successIndex !== -1;

  return {
    ip: target.ip,
    provider: target.provider,
    state: normalizeStateName(target.state).toLowerCase(),
    status: isOnline ? "online" : "offline",
    latency: Date.now() - startTime,
    working_port: successIndex !== -1 ? portsToTry[successIndex] : undefined,
    error_type:
      successIndex !== -1
        ? "RETRY_OPEN"
        : icmpRes
          ? "RETRY_ICMP_ONLY"
          : "RETRY_TIMEOUT",
    timeout_ms: RETRY_TIMEOUT,
    timestamp,
  };
}

async function performCheck(
  ip: string,
  port: number,
  timeoutMs: number,
): Promise<{ success: boolean; code?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      socket.destroy();
      resolve({ success: true, code: "OPEN" });
    });

    socket.on("error", (err: any) => {
      socket.destroy();
      if (err.code === "ECONNREFUSED") {
        resolve({ success: true, code: "ECONNREFUSED" });
      } else {
        resolve({ success: false, code: err.code });
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ success: false, code: "ETIMEDOUT" });
    });

    socket.on("close", () => {
      socket.destroy();
      resolve({ success: false, code: "ECONNRESET" });
    });
  });
}

async function main() {
  const args = process.argv;
  const stateFilter = args
    .find((arg) => arg.startsWith("--state="))
    ?.split("=")[1];
  const providerFilter = args
    .find((arg) => arg.startsWith("--provider="))
    ?.split("=")[1];
  const limitFilter = args
    .find((arg) => arg.startsWith("--limit="))
    ?.split("=")[1];
  const offsetFilter = args
    .find((arg) => arg.startsWith("--offset="))
    ?.split("=")[1];
  const minScoreFilter = args
    .find((arg) => arg.startsWith("--min-score="))
    ?.split("=")[1];
  const minScore = minScoreFilter
    ? parseInt(minScoreFilter)
    : minStabilityScoreEnv;

  const timestamp = new Date().toISOString();

  console.log(`--- Starting External Monitoring Worker ---`);
  if (stateFilter) console.log(`Filter: [State: ${stateFilter}]`);
  if (providerFilter) console.log(`Filter: [Provider: ${providerFilter}]`);
  console.log(`Filter: [Min Score: ${minScore}]`);
  if (limitFilter || offsetFilter)
    console.log(
      `Range: [Limit: ${limitFilter || "ALL"}] [Offset: ${offsetFilter || "0"}]`,
    );

  // 1. Fetch Targets (with pagination to bypass 1000 default limit)
  console.log("Fetching monitoring targets...");
  const allTargets: Target[] = [];
  const limit = limitFilter ? parseInt(limitFilter) : Infinity;
  const initialOffset = offsetFilter ? parseInt(offsetFilter) : 0;
  
  let currentOffset = initialOffset;
  let fetchedCount = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore && fetchedCount < limit) {
    const fetchSize = Math.min(PAGE_SIZE, limit - fetchedCount);
    const toIndex = currentOffset + fetchSize - 1;

    let query = supabase
      .from("monitoring_targets")
      .select("id, ip, provider, state, services, stability_score")
      .eq("is_active", true)
      .gte("stability_score", minScore)
      .range(currentOffset, toIndex);

    if (stateFilter) {
      query = query.ilike("state", stateFilter);
    }

    if (providerFilter) {
      query = query.ilike("provider", providerFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching targets:", error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      allTargets.push(...(data as Target[]));
      fetchedCount += data.length;
      currentOffset += data.length;

      if (data.length < fetchSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  const targets = allTargets;

  console.log(`Found ${targets.length} targets to monitor.`);

  // 2. Phase 1: Fast Hybrid Scan for all nodes
  console.log(
    `Phase 1: Discovery-Rich check on all ${targets.length} nodes...`,
  );
  const initialResults = new Map<string, CheckResult>();
  const BATCH_SIZE = 50; // Increased to 50 for faster throughput

  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((target) => fastCheck(target, timestamp)),
    );

    batchResults.forEach((r) => {
      initialResults.set(r.ip, r);
    });

    const onlineInBatch = batchResults.filter(
      (r) => r.status === "online",
    ).length;
    console.log(
      `Phase 1: Block ${i + 1}-${Math.min(i + BATCH_SIZE, allTargets.length)} [${onlineInBatch} ONLINE]`,
    );

    await new Promise((r) => setTimeout(r, 1000)); // Conservative delay
  }

  // 4. Phase 2 (Removed)
  // Micro-Batch Retry Scan has been removed. Phase 1 now waits 8s.

  const finalResults = Array.from(initialResults.values()).map(
    ({ working_port, ...rest }) => rest,
  );
  const onlineCount = finalResults.filter((r) => r.status === "online").length;
  const offlineCount = finalResults.length - onlineCount;

  console.log(
    `--- Final Summary: ${onlineCount} Online, ${offlineCount} Offline ---`,
  );

  // 4b. Dynamic Score Penalty/Reward System
  if (finalResults.length > 0) {
    console.log(`Updating dynamic stability scores for ${finalResults.length} targets...`);
    const onlineIps = finalResults.filter((r) => r.status === "online").map((r) => r.ip);
    const offlineIps = finalResults.filter((r) => r.status === "offline").map((r) => r.ip);

    const { error: scoreError } = await supabase.rpc("update_node_scores", {
      online_ips: onlineIps,
      offline_ips: offlineIps,
    });

    if (scoreError) {
      console.error("Error updating stability scores:", scoreError.message);
    } else {
      console.log(`Stability scores updated successfully.`);
    }
  }

  // 5. Store Results Directly in Supabase
  console.log(`Storing ${finalResults.length} results directly in Supabase...`);
  const SUPABASE_INSERT_BATCH_SIZE = 500;
  for (let i = 0; i < finalResults.length; i += SUPABASE_INSERT_BATCH_SIZE) {
    const batch = finalResults.slice(i, i + SUPABASE_INSERT_BATCH_SIZE);
    const { error: insertError } = await supabase
      .from("connectivity_checks")
      .insert(batch);

    if (insertError) {
      console.error(
        `Error storing batch ${i / SUPABASE_INSERT_BATCH_SIZE + 1}:`,
        insertError.message,
      );
    } else {
      console.log(`Batch ${i / SUPABASE_INSERT_BATCH_SIZE + 1} stored.`);
    }
  }

  // 4. Notify API to trigger analysis
  if (apiUrl && cronSecret) {
    const triggerUrl = new URL(apiUrl);
    triggerUrl.searchParams.set("trigger_only", "true");
    if (stateFilter) triggerUrl.searchParams.set("state", stateFilter);

    console.log(`Triggering analysis at ${triggerUrl.toString()}...`);
    try {
      await axios.post(
        triggerUrl.toString(),
        {},
        {
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );
      console.log(`Analysis trigger sent.`);
    } catch (e: any) {
      console.error("Failed to notify API:", e.message);
    }
  } else {
    console.log(
      "No API_CHECK_URL or CRON_SECRET found. Analysis not triggered.",
    );
  }

  console.log("Worker finished.");
}

main();
