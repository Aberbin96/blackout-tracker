import { NextResponse } from "next/server";
import {
  MonitoringService,
  CheckResult,
} from "@/services/monitoring/MonitoringService";

export async function POST(request: Request) {
  // Optional: Add basic security check (e.g., CRON_SECRET)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await MonitoringService.performAllChecks();

    // Group results by state and then provider
    const stats: any = {};

    results.forEach((curr: CheckResult) => {
      if (!stats[curr.state]) {
        stats[curr.state] = { total: 0, online: 0, providers: {} };
      }

      const stateStats = stats[curr.state];
      stateStats.total++;
      if (curr.status === "online") {
        stateStats.online++;
      }

      if (!stateStats.providers[curr.provider]) {
        stateStats.providers[curr.provider] = { total: 0, online: 0 };
      }

      const providerStats = stateStats.providers[curr.provider];
      providerStats.total++;
      if (curr.status === "online") {
        providerStats.online++;
      }
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      online: results.filter((r) => r.status === "online").length,
      states: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// Allow for manual testing via GET if needed during development
export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger a check" });
}
