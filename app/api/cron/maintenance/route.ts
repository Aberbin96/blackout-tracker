import { NextResponse } from "next/server";
import { db } from "@/db";
import { connectivityChecks, dailyRegionalStats } from "@/db/schema";
import { and, lt, sql } from "drizzle-orm";

/**
 * Daily maintenance cron
 * 1. Aggregates connectivity_checks into daily_regional_stats
 * 2. Deletes checks older than 14 days
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("[Maintenance Cron] Running rollup and cleanup...");

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().slice(0, 10);

    // 1. Rollup yesterday's checks into daily_regional_stats
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

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(connectivityChecks).where(lt(connectivityChecks.timestamp, cutoff));

    return NextResponse.json({
      success: true,
      message: "Daily rollup and cleanup completed successfully.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Maintenance Cron] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
