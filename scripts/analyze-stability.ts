import path from "path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { monitoringTargets } from "../db/schema";
import { asc, eq } from "drizzle-orm";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found in .env.local");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function calculateStability(target: any): Promise<number> {
  let score = 0;

  const referenceDate = new Date(target.lastIpChangeAt || target.createdAt);
  const daysOld = Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(Math.max(0, daysOld * 2), 40);

  if (target.isMobile || target.networkType === "mobile") {
    score -= 50;
  }

  const hostNameToCheck = target.hostname || target.classificationMetadata?.ptr_record;
  if (hostNameToCheck) {
    const host = hostNameToCheck.toLowerCase();
    const dynamicKeywords = ["dynamic", "pool", "dhcp", "customer", "dsl", "dialup", "user"];
    const isLikelyDynamic = dynamicKeywords.some((kw) => host.includes(kw));
    if (isLikelyDynamic) score -= 20;
    else score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

async function main() {
  console.log("--- Starting Stability Analysis ---");

  const args = process.argv;
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const offsetArg = args.find((a) => a.startsWith("--offset="))?.split("=")[1];
  const limit = limitArg ? parseInt(limitArg) : Infinity;
  const initialOffset = offsetArg ? parseInt(offsetArg) : 0;

  let currentOffset = initialOffset;
  let fetchedCount = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;

  while (hasMore && fetchedCount < limit) {
    const fetchSize = Math.min(BATCH_SIZE, limit - fetchedCount);

    const targets = await db
      .select({
        id: monitoringTargets.id,
        ip: monitoringTargets.ip,
        createdAt: monitoringTargets.createdAt,
        lastIpChangeAt: monitoringTargets.lastIpChangeAt,
        lastOnlineAt: monitoringTargets.lastOnlineAt,
        hostname: monitoringTargets.hostname,
        classificationMetadata: monitoringTargets.classificationMetadata,
        isMobile: monitoringTargets.isMobile,
        networkType: monitoringTargets.networkType,
        stabilityScore: monitoringTargets.stabilityScore,
      })
      .from(monitoringTargets)
      .orderBy(asc(monitoringTargets.id))
      .limit(fetchSize)
      .offset(currentOffset);

    if (!targets || targets.length === 0) break;

    console.log(`Analyzing batch ${currentOffset}...`);

    for (const target of targets) {
      const baseScore = await calculateStability(target);

      const updates: any = {
        networkType: baseScore >= 70 ? "fixed" : target.networkType,
      };

      const now = Date.now();
      const lastOnlineTime = target.lastOnlineAt ? new Date(target.lastOnlineAt).getTime() : 0;
      const hoursSinceOnline = lastOnlineTime > 0 ? (now - lastOnlineTime) / (1000 * 60 * 60) : Infinity;

      let newScore = target.stabilityScore ?? 0;

      if (target.stabilityScore === null || target.stabilityScore === undefined) {
        newScore = baseScore;
      } else {
        if (hoursSinceOnline <= 24) newScore = Math.min(100, newScore + 1);
        else newScore = Math.max(0, newScore - 1);
      }

      updates.stabilityScore = newScore;

      if (updates.networkType === target.networkType && newScore === target.stabilityScore) continue;

      try {
        await db.update(monitoringTargets).set(updates).where(eq(monitoringTargets.id, target.id));
      } catch (err: any) {
        console.error(`Error updating target ${target.ip}:`, err.message);
      }
    }

    fetchedCount += targets.length;
    currentOffset += targets.length;
    if (targets.length < fetchSize) break;
  }

  console.log("Stability analysis complete.");
  await pool.end();
}

main().catch(console.error);
