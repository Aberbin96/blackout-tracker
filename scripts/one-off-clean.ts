import path from "path";
import dotenv from "dotenv";
import { exec } from "child_process";
import { promisify } from "util";
import net from "net";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { monitoringTargets } from "../db/schema";
import { gte, inArray } from "drizzle-orm";

const execAsync = promisify(exec);
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function pingIp(ip: string, timeoutMs: number): Promise<boolean> {
  try {
    const cmd = process.platform === "win32"
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;
    await execAsync(cmd);
    return true;
  } catch { return false; }
}

async function performCheck(ip: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.connect(port, ip, () => { socket.destroy(); resolve(true); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("close", () => { socket.destroy(); resolve(false); });
  });
}

async function fastCheck(ip: string): Promise<boolean> {
  const portsToTry = [80, 443, 8291, 8080];
  const results = await Promise.all([pingIp(ip, 3000), ...portsToTry.map((p) => performCheck(ip, p, 3000))]);
  return results.some((r) => r === true);
}

async function main() {
  console.log("Fetching all nodes with score >= 10...");

  let allTargets: { id: number; ip: string; stabilityScore: number | null }[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const data = await db
      .select({ id: monitoringTargets.id, ip: monitoringTargets.ip, stabilityScore: monitoringTargets.stabilityScore })
      .from(monitoringTargets)
      .where(gte(monitoringTargets.stabilityScore, 10))
      .limit(PAGE_SIZE)
      .offset(offset);

    if (!data || data.length === 0) break;
    allTargets.push(...data);
    offset += data.length;
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`Found ${allTargets.length} nodes to aggressively clean.`);
  const deadIps: string[] = [];
  const aliveIps: string[] = [];

  const BATCH_SIZE = 50;
  for (let i = 0; i < allTargets.length; i += BATCH_SIZE) {
    const batch = allTargets.slice(i, i + BATCH_SIZE);
    const checks = await Promise.all(batch.map(async (t) => ({ ip: t.ip, isOnline: await fastCheck(t.ip) })));

    const batchDead = checks.filter((c) => !c.isOnline).map((c) => c.ip);
    const batchAlive = checks.filter((c) => c.isOnline).map((c) => c.ip);
    deadIps.push(...batchDead);
    aliveIps.push(...batchAlive);

    console.log(`Processed ${i + batch.length}/${allTargets.length} | Dead in batch: ${batchDead.length}`);

    if (batchDead.length > 0) {
      await db.update(monitoringTargets).set({ stabilityScore: 0 }).where(inArray(monitoringTargets.ip, batchDead));
    }
  }

  console.log(`--- CLEANUP FINISHED ---`);
  console.log(`Alive: ${aliveIps.length}`);
  console.log(`Dead (Reset to 0): ${deadIps.length}`);
  await pool.end();
}

main();
