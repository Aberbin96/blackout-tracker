import { NextResponse } from "next/server";
import {
  MonitoringService,
  CheckResult,
} from "@/services/monitoring/MonitoringService";
import { AnalyzerService } from "@/services/analyzer";

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
    const url = new URL(request.url);
    const stateFilter = url.searchParams.get("state") || undefined;

    console.log(
      `[API] Triggering analysis for state: ${stateFilter || "all"}`,
    );
    const analysisResponse =
      await MonitoringService.analyzeLastResults(stateFilter);
    
    return NextResponse.json({
      ...analysisResponse,
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
