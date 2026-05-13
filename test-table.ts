import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { monitoringTargets } from "./db/schema";
import { eq } from "drizzle-orm";

async function testTableLimit() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool, { mode: "default" });

  console.log("Testing monitoring_targets with limit...");
  const data = await db
    .select({ ip: monitoringTargets.ip })
    .from(monitoringTargets)
    .where(eq(monitoringTargets.isActive, true))
    .limit(5000);

  console.log("Table returned rows:", data?.length);
  await pool.end();
}

testTableLimit();
