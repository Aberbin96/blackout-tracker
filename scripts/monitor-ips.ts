import net from "net";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const apiUrl = process.env.API_CHECK_URL;
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Target {
  id: string;
  ip: string;
  provider: string;
  state: string;
  services: number[];
}

interface CheckResult {
  ip: string;
  provider: string;
  state: string;
  status: "online" | "offline";
  latency?: number;
  timestamp: string;
}

async function checkIp(target: Target, timestamp: string): Promise<CheckResult> {
  const startTime = Date.now();
  const portsToTry = target.services?.length > 0 ? target.services : [80, 443, 8291];
  
  let status: "online" | "offline" = "offline";
  let latency: number | undefined;

  // Try ports in parallel for faster results
  const portChecks = portsToTry.map(port => {
    return new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3500);

      socket.connect(port, target.ip, () => {
        socket.destroy();
        resolve(true);
      });

      const fail = () => {
        socket.destroy();
        resolve(false);
      };

      socket.on("error", fail);
      socket.on("timeout", fail);
      socket.on("close", fail);
    });
  });

  const results = await Promise.all(portChecks);
  if (results.some(r => r)) {
    status = "online";
    latency = Date.now() - startTime;
  }

  return {
    ip: target.ip,
    provider: target.provider,
    state: target.state,
    status,
    latency,
    timestamp
  };
}

async function main() {
  const stateFilter = process.argv.find(arg => arg.startsWith('--state='))?.split('=')[1];
  const timestamp = new Date().toISOString();

  console.log(`--- Starting External Monitoring Worker ---`);
  if (stateFilter) console.log(`Filter: [State: ${stateFilter}]`);

  // 1. Fetch Targets
  let query = supabase.from("monitoring_targets").select("id, ip, provider, state, services").eq("is_active", true);
  if (stateFilter) {
    query = query.ilike("state", stateFilter);
  }

  const { data: targets, error } = await query;
  if (error || !targets) {
    console.error("Error fetching targets:", error);
    process.exit(1);
  }

  console.log(`Found ${targets.length} targets to monitor.`);

  // 2. Process with Concurrency
  const CONCURRENCY = 100;
  const results: CheckResult[] = [];
  
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    console.log(`Checking block ${i + 1} to ${Math.min(i + CONCURRENCY, targets.length)}...`);
    
    const chunkResults = await Promise.all(chunk.map(t => checkIp(t as Target, timestamp)));
    results.push(...chunkResults);
  }

  // 3. Store Results Directly in Supabase
  console.log(`Storing ${results.length} results directly in Supabase...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from("connectivity_checks")
      .insert(batch);
    
    if (insertError) {
      console.error(`Error storing batch ${i/BATCH_SIZE + 1}:`, insertError.message);
    } else {
      console.log(`Batch ${i/BATCH_SIZE + 1} stored.`);
    }
  }

  // 4. Notify API to trigger analysis
  if (apiUrl && cronSecret) {
    const triggerUrl = new URL(apiUrl);
    triggerUrl.searchParams.set("trigger_only", "true");
    if (stateFilter) triggerUrl.searchParams.set("state", stateFilter);

    console.log(`Triggering analysis at ${triggerUrl.toString()}...`);
    try {
      await axios.post(triggerUrl.toString(), {}, {
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      console.log(`Analysis trigger sent.`);
    } catch (e: any) {
      console.error("Failed to notify API:", e.message);
    }
  } else {
    console.log("No API_CHECK_URL or CRON_SECRET found. Analysis not triggered.");
  }

  console.log("Worker finished.");
}

main();
