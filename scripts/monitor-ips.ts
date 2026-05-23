import net from "net";
import path from "path";
import * as dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import { normalizeStateName } from "../utils/normalization";
import { withRetry } from "../utils/retry";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { connectivityChecks, monitoringTargets } from "../db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

const execAsync = promisify(exec);

const envPath = path.join(process.cwd(), ".env.local");
const envResult = dotenv.config({ path: envPath });

console.log(`[ENV] Loading from: ${envPath}`);
if (envResult.error) {
  console.warn(`[ENV] Warning: Failed to load .env.local: ${envResult.error.message}`);
} else {
  console.log(`[ENV] Successfully loaded .env.local keys: ${Object.keys(envResult.parsed || {}).join(", ")}`);
}

const DATABASE_URL = process.env.DATABASE_URL;
const minStabilityScoreEnv = parseInt(process.env.MIN_STABILITY_SCORE || "10");

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL is missing");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

interface Target {
  id: number;
  ip: string;
  provider: string;
  state: string;
  services: number[];
  stabilityScore?: number;
}

interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  workingPort?: number;
  errorType?: string;
  timeoutMs: number;
  timestamp: string;
}

async function pingIp(ip: string, timeoutMs: number): Promise<boolean> {
  try {
    const cmd = process.platform === "win32"
      ? `ping -n 2 -w ${timeoutMs} ${ip}`
      : `ping -c 2 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

async function performCheck(ip: string, port: number, timeoutMs: number): Promise<{ success: boolean; code?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, ip, () => { socket.destroy(); resolve({ success: true, code: "OPEN" }); });
    socket.on("error", (err: any) => {
      socket.destroy();
      resolve(err.code === "ECONNREFUSED" ? { success: true, code: "ECONNREFUSED" } : { success: false, code: err.code });
    });
    socket.on("timeout", () => { socket.destroy(); resolve({ success: false, code: "ETIMEDOUT" }); });
    socket.on("close", () => { socket.destroy(); resolve({ success: false, code: "ECONNRESET" }); });
  });
}

async function fastCheck(target: Target, timestamp: string): Promise<CheckResult> {
  const startTime = Date.now();
  const timeoutMs = 8000;
  const primaryPort = target.services?.[0] || 80;
  const commonPorts = [80, 443, 8291, 7547, 8080, 22, 53, 3389, 8443, 5060];
  const portsToTry = Array.from(new Set([primaryPort, ...commonPorts]));

  const promises = [
    pingIp(target.ip, timeoutMs).then((res) =>
      res ? { success: true, type: "ICMP", port: undefined, latency: Date.now() - startTime } : Promise.reject("Ping failed")
    ),
    ...portsToTry.map((port) =>
      performCheck(target.ip, port, timeoutMs).then((res) =>
        res.success ? { success: true, type: "TCP", port, latency: Date.now() - startTime } : Promise.reject(`Port ${port} failed`)
      )
    ),
  ];

  try {
    const fastest = await Promise.any(promises);
    return {
      ip: target.ip,
      provider: target.provider,
      state: normalizeStateName(target.state).toLowerCase(),
      status: "online",
      latency: fastest.latency,
      workingPort: fastest.type === "TCP" ? fastest.port : undefined,
      errorType: fastest.type === "TCP" ? "DISCOVERY_OPEN" : "ICMP_ONLY",
      timeoutMs,
      timestamp,
    };
  } catch {
    return {
      ip: target.ip,
      provider: target.provider,
      state: normalizeStateName(target.state).toLowerCase(),
      status: "offline",
      latency: Date.now() - startTime,
      errorType: "TIMEOUT",
      timeoutMs,
      timestamp,
    };
  }
}

async function main() {
  const args = process.argv;
  const stateFilter = args.find((a) => a.startsWith("--state="))?.split("=")[1];
  const providerFilter = args.find((a) => a.startsWith("--provider="))?.split("=")[1];
  const limitFilter = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const offsetFilter = args.find((a) => a.startsWith("--offset="))?.split("=")[1];
  const minScoreFilter = args.find((a) => a.startsWith("--min-score="))?.split("=")[1];
  const minScore = minScoreFilter ? parseInt(minScoreFilter) : minStabilityScoreEnv;

  const timestamp = new Date().toISOString();

  console.log(`--- Starting External Monitoring Worker ---`);
  if (stateFilter) console.log(`Filter: [State: ${stateFilter}]`);
  if (providerFilter) console.log(`Filter: [Provider: ${providerFilter}]`);
  console.log(`Filter: [Min Score: ${minScore}]`);

  const allTargets: Target[] = [];
  const limit = limitFilter ? parseInt(limitFilter) : Infinity;
  const initialOffset = offsetFilter ? parseInt(offsetFilter) : 0;
  let currentOffset = initialOffset;
  let fetchedCount = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  console.log("Fetching monitoring targets...");

  while (hasMore && fetchedCount < limit) {
    const fetchSize = Math.min(PAGE_SIZE, limit - fetchedCount);

    const data = await withRetry(async () => {
      const filters = [
        eq(monitoringTargets.isActive, true),
        gte(monitoringTargets.stabilityScore, minScore),
      ];
      if (stateFilter) filters.push(sql`${monitoringTargets.state} LIKE ${stateFilter}`);
      if (providerFilter) filters.push(sql`${monitoringTargets.provider} LIKE ${providerFilter}`);

      return db
        .select({
          id: monitoringTargets.id,
          ip: monitoringTargets.ip,
          provider: monitoringTargets.provider,
          state: monitoringTargets.state,
          services: monitoringTargets.services,
          stabilityScore: monitoringTargets.stabilityScore,
        })
        .from(monitoringTargets)
        .where(and(...filters))
        .limit(fetchSize)
        .offset(currentOffset);
    }, { operationName: `Fetching targets (Offset: ${currentOffset})` });

    if (data && data.length > 0) {
      allTargets.push(...(data.map((t) => ({
        ...t,
        services: Array.isArray(t.services) ? t.services : (t.services ? JSON.parse(t.services as any) : []),
      })) as Target[]));
      fetchedCount += data.length;
      currentOffset += data.length;
      if (data.length < fetchSize) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${allTargets.length} targets to monitor.`);

  const initialResults = new Map<string, CheckResult>();
  const BATCH_SIZE = 50;

  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((target) => fastCheck(target, timestamp)));
    batchResults.forEach((r) => initialResults.set(r.ip, r));
    const onlineInBatch = batchResults.filter((r) => r.status === "online").length;
    console.log(`Phase 1: Block ${i + 1}-${Math.min(i + BATCH_SIZE, allTargets.length)} [${onlineInBatch} ONLINE]`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  const finalResults = Array.from(initialResults.values()).map(({ workingPort, ...rest }) => rest);
  const onlineCount = finalResults.filter((r) => r.status === "online").length;
  const offlineCount = finalResults.length - onlineCount;
  console.log(`--- Final Summary: ${onlineCount} Online, ${offlineCount} Offline ---`);

  // Update last_online_at for online nodes
  const onlineIps = finalResults.filter((r) => r.status === "online").map((r) => r.ip);
  if (onlineIps.length > 0) {
    console.log(`Updating last_online_at for ${onlineIps.length} online nodes...`);
    const UPDATE_BATCH_SIZE = 500;
    for (let i = 0; i < onlineIps.length; i += UPDATE_BATCH_SIZE) {
      const batch = onlineIps.slice(i, i + UPDATE_BATCH_SIZE);
      await withRetry(
        () => db.update(monitoringTargets).set({ lastOnlineAt: new Date(timestamp) }).where(inArray(monitoringTargets.ip, batch)),
        { operationName: `Updating last_online_at batch ${Math.floor(i / UPDATE_BATCH_SIZE) + 1}` }
      );
    }
  }

  // Store results
  console.log(`Storing ${finalResults.length} results...`);
  const INSERT_BATCH_SIZE = 500;
  for (let i = 0; i < finalResults.length; i += INSERT_BATCH_SIZE) {
    const batch = finalResults.slice(i, i + INSERT_BATCH_SIZE);
    await withRetry(
      () => db.insert(connectivityChecks).values(batch.map((r) => ({
        ip: r.ip,
        provider: r.provider,
        state: r.state,
        status: r.status,
        latency: r.latency ?? null,
        errorType: r.errorType ?? null,
        timeoutMs: r.timeoutMs,
        timestamp: new Date(r.timestamp),
      }))),
      { operationName: `Storing batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1}` }
    ).then(() => console.log(`Batch ${Math.floor(i / INSERT_BATCH_SIZE) + 1} stored.`))
      .catch((err) => console.error(`Error storing batch:`, err.message));
  }

  console.log("Worker finished.");
  await pool.end();
}

main();
