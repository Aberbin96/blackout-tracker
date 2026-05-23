import path from "path";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { connectivityChecks } from "../db/schema";
import { lt, sql } from "drizzle-orm";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function run() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);

  console.log(`[Maintenance] Rolling up ${yesterdayDate} into daily_regional_stats...`);
  await db.execute(sql`
    INSERT INTO daily_regional_stats (date, state, provider, total_checks, online_checks, avg_latency)
    SELECT
      DATE(timestamp) AS date,
      state,
      provider,
      COUNT(*) AS total_checks,
      SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online_checks,
      AVG(CASE WHEN status = 'online' THEN latency END) AS avg_latency
    FROM connectivity_checks
    WHERE DATE(timestamp) = ${yesterdayDate}
    GROUP BY DATE(timestamp), state, provider
    ON DUPLICATE KEY UPDATE
      total_checks = VALUES(total_checks),
      online_checks = VALUES(online_checks),
      avg_latency = VALUES(avg_latency)
  `);

  console.log("[Maintenance] Deleting connectivity_checks older than 24h...");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(connectivityChecks).where(lt(connectivityChecks.timestamp, cutoff));

  console.log("[Maintenance] Done.");
  await pool.end();
}

run().catch((err) => {
  console.error("[Maintenance] Error:", err.message);
  process.exit(1);
});
