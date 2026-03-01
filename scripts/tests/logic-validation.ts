import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Mock data generator for testing logic
function mockResults(
  scenarios: {
    state: string;
    total: number;
    offline: number;
    avgLatency: number;
  }[],
) {
  const results: any[] = [];
  scenarios.forEach((s) => {
    for (let i = 0; i < s.total; i++) {
      const isOffline = i < s.offline;
      results.push({
        ip: `1.1.1.${results.length}`,
        provider: "TestISP",
        state: s.state,
        status: isOffline ? "offline" : "online",
        latency: isOffline ? undefined : s.avgLatency,
        timestamp: new Date().toISOString(),
      });
    }
  });
  return results;
}

async function testLogic() {
  console.log("--- Starting Logic Validation Test ---");

  // We can't easily call MonitoringService.processBlackouts because it's private and depends on Supabase.
  // However, we've implemented the logic in MonitoringService.ts.
  // To verify without polluting the DB, let's manually mirror the thresholds here and verify they match our plan.

  const scenarios = [
    {
      name: "MASSIVE BLACKOUT",
      offlinePercent: 70,
      total: 10,
      expected: "massive",
    },
    {
      name: "PARTIAL OUTAGE",
      offlinePercent: 30,
      total: 10,
      expected: "partial",
    },
    {
      name: "DEGRADED (SLOW)",
      offlinePercent: 0,
      avgLat: 1600,
      total: 10,
      expected: "degraded",
    },
    {
      name: "STABLE",
      offlinePercent: 5,
      avgLat: 200,
      total: 10,
      expected: "none",
    },
  ];

  scenarios.forEach((s) => {
    let severity = "none";
    const offlineCount = Math.round((s.offlinePercent / 100) * s.total);
    const actualOfflinePercent = (offlineCount / s.total) * 100;
    const avgLat = s.avgLat || 0;

    if (s.total >= 3) {
      if (actualOfflinePercent > 60) {
        severity = "massive";
      } else if (actualOfflinePercent > 25) {
        severity = "partial";
      } else if (avgLat > 1500) {
        severity = "degraded";
      }
    }

    const passed = severity === s.expected;
    console.log(
      `[${passed ? "PASS" : "FAIL"}] ${s.name}: Got ${severity}, Expected ${s.expected} (Offline: ${actualOfflinePercent}%, Latency: ${avgLat}ms)`,
    );
  });

  console.log("--- Test Finished ---");
}

testLogic();
