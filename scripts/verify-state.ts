import dotenv from "dotenv";
import path from "path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { connectivityChecks, monitoringTargets } from "../db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL not found in .env.local");
  process.exit(1);
}

const pool = mysql.createPool(DATABASE_URL);
const db = drizzle(pool, { mode: "default" });

async function checkState(stateName: string) {
  console.log(`\n--- Validating State: ${stateName} ---`);

  const targets = await db
    .select({ ip: monitoringTargets.ip, provider: monitoringTargets.provider })
    .from(monitoringTargets)
    .where(and(
      sql`${monitoringTargets.state} LIKE ${stateName}`,
      eq(monitoringTargets.isActive, true),
    ));

  if (!targets || targets.length === 0) {
    console.log("No active sensors found for this state.");
    return;
  }

  console.log(`Total Active Sensors (Inventory): ${targets.length}`);

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const ips = targets.map((t) => t.ip);

  const checks = await db
    .select({ ip: connectivityChecks.ip, status: connectivityChecks.status, timestamp: connectivityChecks.timestamp })
    .from(connectivityChecks)
    .where(and(
      inArray(connectivityChecks.ip, ips),
      gte(connectivityChecks.timestamp, fifteenMinutesAgo),
    ))
    .orderBy(sql`${connectivityChecks.timestamp} DESC`);

  const latestChecks: Record<string, string> = {};
  checks.forEach((c) => {
    if (!latestChecks[c.ip]) latestChecks[c.ip] = c.status;
  });

  const online = Object.values(latestChecks).filter((s) => s === "online").length;
  const offline = Object.values(latestChecks).filter((s) => s === "offline").length;
  const unknown = targets.length - Object.keys(latestChecks).length;

  console.log(`\nDashboard Status (matching 15m window):`);
  console.log(`- Online: ${online}`);
  console.log(`- Offline: ${offline}`);
  console.log(`- Pending/Unknown: ${unknown}`);

  const providers: Record<string, number> = {};
  targets.forEach((t) => { providers[t.provider] = (providers[t.provider] || 0) + 1; });

  console.log("\nProvider Breakdown (Total Inventory):");
  Object.entries(providers).forEach(([name, val]) => console.log(`- ${name}: ${val}`));
}

const targetState = process.argv.slice(2).join(" ") || "amazonas";
checkState(targetState).finally(() => pool.end());
