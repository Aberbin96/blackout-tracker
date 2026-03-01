import { AnalyzerService } from "../services/analyzer";
import { CheckResult } from "../services/monitoring/MonitoringService";

const mockResults: CheckResult[] = [
  // 3 offline, 2 online = 60% offline (BLACKOUT)
  {
    ip: "1.1.1.1",
    status: "offline",
    latency: undefined,
    state: "Zulia",
    provider: "CANTV",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "1.1.1.2",
    status: "offline",
    latency: undefined,
    state: "Zulia",
    provider: "CANTV",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "1.1.1.3",
    status: "offline",
    latency: undefined,
    state: "Zulia",
    provider: "CANTV",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "1.1.1.4",
    status: "online",
    latency: 50,
    state: "Zulia",
    provider: "CANTV",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "1.1.1.5",
    status: "online",
    latency: 50,
    state: "Zulia",
    provider: "CANTV",
    timestamp: new Date().toISOString(),
  },

  // 1 offline, 4 online = 20% offline (RESOLVED / STABLE)
  {
    ip: "2.2.2.1",
    status: "offline",
    latency: undefined,
    state: "Caracas",
    provider: "INTER",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "2.2.2.2",
    status: "online",
    latency: 20,
    state: "Caracas",
    provider: "INTER",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "2.2.2.3",
    status: "online",
    latency: 20,
    state: "Caracas",
    provider: "INTER",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "2.2.2.4",
    status: "online",
    latency: undefined,
    state: "Caracas",
    provider: "INTER",
    timestamp: new Date().toISOString(),
  },
  {
    ip: "2.2.2.5",
    status: "online",
    latency: 20,
    state: "Caracas",
    provider: "INTER",
    timestamp: new Date().toISOString(),
  },
];

async function test() {
  console.log("Running Analyzer Mock Test...");
  await AnalyzerService.analyze(mockResults);
  console.log("Done. Check your Supabase 'blackout_events' table!");
}

test();
