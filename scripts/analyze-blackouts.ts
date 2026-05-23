import path from "path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { connectivityChecks, blackoutEvents } from "../db/schema";
import { eq, gte, sql } from "drizzle-orm";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found");
  process.exit(1);
}

const MIN_NODES = 5;
const BLACKOUT_THRESHOLD = 0.4;
const RESOLVE_THRESHOLD = 0.2;

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function run() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);

  console.log("[AnalyzeBlackouts] Reading recent checks...");
  const rows = await db
    .select({
      state: connectivityChecks.state,
      total: sql<number>`COUNT(*)`,
      offline: sql<number>`SUM(CASE WHEN ${connectivityChecks.status} = 'offline' THEN 1 ELSE 0 END)`,
    })
    .from(connectivityChecks)
    .where(gte(connectivityChecks.timestamp, cutoff))
    .groupBy(connectivityChecks.state);

  if (rows.length === 0) {
    console.log("[AnalyzeBlackouts] No recent checks found. Exiting.");
    await pool.end();
    return;
  }

  const activeBlackouts = await db
    .select()
    .from(blackoutEvents)
    .where(eq(blackoutEvents.status, "active"));

  const activeMap = new Map(activeBlackouts.map((b) => [b.state, b]));

  for (const row of rows) {
    const state = row.state;
    const total = Number(row.total);
    const offline = Number(row.offline);

    if (total < MIN_NODES) continue;

    const failureRate = offline / total;
    const activeEvent = activeMap.get(state);

    if (failureRate >= BLACKOUT_THRESHOLD && !activeEvent) {
      console.log(`[AnalyzeBlackouts] BLACKOUT in ${state} (${Math.round(failureRate * 100)}% offline)`);
      await db.insert(blackoutEvents).values({
        state,
        nodesTotal: total,
        nodesOffline: offline,
        status: "active",
      });
    } else if (failureRate <= RESOLVE_THRESHOLD && activeEvent) {
      console.log(`[AnalyzeBlackouts] RESOLVED in ${state} (${Math.round(failureRate * 100)}% offline)`);
      await db
        .update(blackoutEvents)
        .set({ status: "resolved", endedAt: new Date(), nodesTotal: total, nodesOffline: offline })
        .where(eq(blackoutEvents.id, activeEvent.id));
    } else if (activeEvent) {
      await db
        .update(blackoutEvents)
        .set({ nodesTotal: total, nodesOffline: offline })
        .where(eq(blackoutEvents.id, activeEvent.id));
    }
  }

  console.log("[AnalyzeBlackouts] Done.");
  await pool.end();
}

run().catch((err) => {
  console.error("[AnalyzeBlackouts] Error:", err.message);
  process.exit(1);
});
