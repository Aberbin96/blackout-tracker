import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState(stateName: string) {
  console.log(`\n--- Validating State: ${stateName} ---`);
  
  // 1. Get targets for the state
  const { data: targets, error: targetError, count } = await supabase
    .from("monitoring_targets")
    .select("ip, provider", { count: "exact" })
    .ilike("state", stateName)
    .eq("is_active", true);

  if (targetError) {
    console.error("Error fetching targets:", targetError.message);
    return;
  }

  if (!targets || targets.length === 0) {
    console.log("No active sensors found for this state.");
    return;
  }

  console.log(`Total Active Sensors (Inventory): ${count}`);

  // 2. Get the most recent status for each IP (matching the RPC logic)
  // We'll fetch the last check for each IP in the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: checks, error: checkError } = await supabase
    .from("connectivity_checks")
    .select("ip, status, timestamp")
    .in("ip", targets.map(t => t.ip))
    .gte("timestamp", fifteenMinutesAgo)
    .order("timestamp", { ascending: false });

  if (checkError) {
    console.error("Error fetching connectivity checks:", checkError.message);
    return;
  }

  // Deduplicate manually (mimicking DISTINCT ON (ip))
  const latestChecks: Record<string, string> = {};
  checks?.forEach(c => {
    if (!latestChecks[c.ip]) {
      latestChecks[c.ip] = c.status;
    }
  });

  const online = Object.values(latestChecks).filter(s => s === "online").length;
  const offline = Object.values(latestChecks).filter(s => s === "offline").length;
  const unknown = (count || 0) - Object.keys(latestChecks).length;

  console.log(`\nDashboard Status (matching 15m window):`);
  console.log(`- Online: ${online}`);
  console.log(`- Offline: ${offline}`);
  console.log(`- Pending/Unknown: ${unknown}`);
  
  // Breakdown by provider
  const providers: Record<string, number> = {};
  targets.forEach(t => {
    providers[t.provider] = (providers[t.provider] || 0) + 1;
  });
  
  console.log("\nProvider Breakdown (Total Inventory):");
  Object.entries(providers).forEach(([name, val]) => {
    console.log(`- ${name}: ${val}`);
  });
}

const targetState = process.argv.slice(2).join(" ") || "amazonas";
checkState(targetState);
