import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

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
    const { error } = await supabase.rpc("rollup_and_cleanup_checks");

    if (error) {
      console.error("[Maintenance Cron] RPC Error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Daily rollup and cleanup completed successfully.",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[Maintenance Cron] Unexpected Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Support GET for manual testing via tool if needed
export async function GET(request: Request) {
  return POST(request);
}
