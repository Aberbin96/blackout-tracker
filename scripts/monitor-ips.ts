import net from "net";
import axios from "axios";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const apiUrl = process.env.API_CHECK_URL;
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL is missing");
  process.exit(1);
}
if (!supabaseKey) {
  console.error(
    "Error: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or SUPABASE_KEY) is missing",
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
}

interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  error_type?: string;
  timeout_ms: number;
  timestamp: string;
}

async function pingIp(ip: string, timeoutMs: number): Promise<boolean> {
  try {
    const platform = process.platform;
    // -c 3: three packets, -W: timeout in ms per packet
    const cmd = platform === "win32" 
      ? `ping -n 3 -w ${timeoutMs} ${ip}` 
      : `ping -c 3 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;
    
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
  const timeoutMs = 5000;
  const primaryPort =
    target.services && target.services.length > 0 ? target.services[0] : 80;

  const res = await performCheck(target.ip, primaryPort, timeoutMs);
  return {
    ip: target.ip,
    provider: target.provider,
    state: target.state,
    status: res.success ? "online" : "offline",
    latency: Date.now() - startTime,
    error_type: res.code,
    timeout_ms: timeoutMs,
    timestamp,
  };
}

async function deepCheck(
  target: Target,
  timestamp: string,
): Promise<CheckResult> {
  const startTime = Date.now();
  const timeoutMs = 5000;

  // 1. Prepare parallel checks: Ping + Common Ports
  const primaryPort =
    target.services && target.services.length > 0 ? target.services[0] : 80;
    
  const otherPorts =
    target.services?.length > 1
      ? target.services.slice(1)
      : [443, 8291, 22, 21, 53, 3389, 7547, 8080, 8443, 5060].filter((p) => p !== primaryPort);

  // We limit the number of parallel ports per node to avoid overwhelming local resources
  const portsToTry = [primaryPort, ...otherPorts.slice(0, 5)];

  const checkPromises: Promise<{ success: boolean; code?: string }>[] = [
    pingIp(target.ip, 3000).then(res => ({ success: res, code: 'ICMP_ECHO' })),
    ...portsToTry.map(port => performCheck(target.ip, port, timeoutMs))
  ];

  // Wait for results
  const results = await Promise.all(checkPromises);
  const success = results.find(r => r.success);

  if (success) {
    return {
      ip: target.ip,
      provider: target.provider,
      state: target.state,
      status: "online",
      latency: Date.now() - startTime,
      error_type: success.code,
      timeout_ms: timeoutMs,
      timestamp,
    };
  }

  // If all failed, find the most descriptive error (usually the first TCP one)
  const lastError = results.find(r => !r.success && r.code !== 'ICMP_ECHO')?.code;

  return {
    ip: target.ip,
    provider: target.provider,
    state: target.state,
    status: "offline",
    latency: Date.now() - startTime,
    error_type: lastError || "timeout",
    timeout_ms: timeoutMs,
    timestamp,
  };
}

async function performCheck(ip: string, port: number, timeoutMs: number): Promise<{ success: boolean; code?: string }> {
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
  const stateFilter = process.argv
    .find((arg) => arg.startsWith("--state="))
    ?.split("=")[1];
  const timestamp = new Date().toISOString();

  console.log(`--- Starting External Monitoring Worker ---`);
  if (stateFilter) console.log(`Filter: [State: ${stateFilter}]`);

  // 1. Fetch Targets (with pagination to bypass 1000 default limit)
  console.log("Fetching monitoring targets...");
  const allTargets: Target[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("monitoring_targets")
      .select("id, ip, provider, state, services")
      .eq("is_active", true)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (stateFilter) {
      query = query.ilike("state", stateFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching targets:", error);
      process.exit(1);
    }

    if (data && data.length > 0) {
      allTargets.push(...(data as Target[]));
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  const targets = allTargets;

  console.log(`Found ${targets.length} targets to monitor.`);

  // 2. Phase 1: Fast TCP Scan for all nodes
  console.log(`Phase 1: Fast TCP check on all ${targets.length} nodes...`);
  const initialResults = new Map<string, CheckResult>();
  const BATCH_SIZE = 200; // Increased

  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((target) => fastCheck(target, timestamp)),
    );

    batchResults.forEach((r) => {
      initialResults.set(r.ip, r);
    });

    const onlineInBatch = batchResults.filter((r) => r.status === "online").length;
    console.log(
      `FastCheck: Block ${i + 1}-${Math.min(i + BATCH_SIZE, allTargets.length)} [${onlineInBatch} ONLINE]`,
    );
  }

  // 3. Phase 2: Deep Scan for potentially offline nodes
  const offlineIps = Array.from(initialResults.values())
    .filter((r) => r.status === "offline")
    .map((r) => r.ip);

  console.log(`Phase 2: Deep Scan for ${offlineIps.length} nodes (ICMP + Sequential ports)...`);
  
  if (offlineIps.length > 0) {
    const DEEP_BATCH_SIZE = 100; // Parallel node checks
    const offlineTargets = allTargets.filter(t => offlineIps.includes(t.ip));

    for (let i = 0; i < offlineTargets.length; i += DEEP_BATCH_SIZE) {
      const batch = offlineTargets.slice(i, i + DEEP_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((target) => deepCheck(target, timestamp)),
      );

      batchResults.forEach((r) => {
        if (r.status === "online") {
          initialResults.set(r.ip, r);
        }
      });
      
      console.log(`DeepCheck: Block ${i + 1}-${Math.min(i + DEEP_BATCH_SIZE, offlineTargets.length)} verified.`);
    }
  }

  // 4. Phase 3: Heroic Retry (Long timeout for persistent timeouts)
  const stillOfflineIps = Array.from(initialResults.values())
    .filter((r) => r.status === "offline" && r.error_type === "ETIMEDOUT")
    .map((r) => r.ip);

  console.log(`Phase 3: Heroic Retry for ${stillOfflineIps.length} nodes (15s timeout)...`);

  if (stillOfflineIps.length > 0) {
    const HEROIC_BATCH_SIZE = 100;
    const heroicTargets = allTargets.filter(t => stillOfflineIps.includes(t.ip));
    const HEROIC_TIMEOUT = 10000; // 10s is enough for extreme cases

    for (let i = 0; i < heroicTargets.length; i += HEROIC_BATCH_SIZE) {
      const batch = heroicTargets.slice(i, i + HEROIC_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (target) => {
          // Check top 3 likely ports in parallel for heroic retry
          const results = await Promise.all([
            performCheck(target.ip, 80, HEROIC_TIMEOUT),
            performCheck(target.ip, 443, HEROIC_TIMEOUT),
            performCheck(target.ip, 8291, HEROIC_TIMEOUT)
          ]);
          
          const success = results.find(r => r.success);
          if (success) {
            return {
              ip: target.ip,
              provider: target.provider,
              state: target.state,
              status: "online" as const,
              latency: HEROIC_TIMEOUT / 2, 
              error_type: "HEROIC_" + success.code,
              timeout_ms: HEROIC_TIMEOUT,
              timestamp,
            };
          }
          return null;
        }),
      );

      batchResults.forEach((r) => {
        if (r) initialResults.set(r.ip, r);
      });

      console.log(`HeroicCheck: Block ${i + 1}-${Math.min(i + HEROIC_BATCH_SIZE, heroicTargets.length)} complete.`);
    }
  }

  const finalResults = Array.from(initialResults.values());
  const onlineCount = finalResults.filter((r) => r.status === "online").length;
  const offlineCount = finalResults.length - onlineCount;

  console.log(
    `--- Final Summary: ${onlineCount} Online, ${offlineCount} Offline ---`,
  );

  // 4. Store Results Directly in Supabase
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
