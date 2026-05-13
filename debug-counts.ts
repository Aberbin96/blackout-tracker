import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { monitoringTargets } from "./db/schema";
import { eq } from "drizzle-orm";

async function findLowDensityState() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool, { mode: "default" });

  const data = await db
    .select({ state: monitoringTargets.state })
    .from(monitoringTargets)
    .where(eq(monitoringTargets.isActive, true));

  const counts: Record<string, number> = {};
  data.forEach((t) => {
    if (t.state) counts[t.state] = (counts[t.state] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  console.log("State counts:", sorted);
  await pool.end();
}

findLowDensityState();
