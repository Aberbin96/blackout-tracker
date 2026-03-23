import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import dns from "dns/promises";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Stability Scorer Logic:
 * 1. Longevity: Points for how long the record has existed (+1 per day, max 40).
 * 2. PTR Record: +30 if valid PTR, -20 if PTR contains "dynamic", "pool", "dhcp".
 * 3. Mobile Flag: -50 if explicitly marked as mobile.
 * 4. Latency Consistency: (Placeholder for future connectivity check analysis)
 */

async function calculateStability(target: any): Promise<number> {
  let score = 0; // Base score lowered to 0

  // 1. Longevity (max 40 points)
  const referenceDate = new Date(target.last_ip_change_at || target.created_at);
  const daysOld = Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(Math.max(0, daysOld * 2), 40); // 2 points per day, requires 5 days to reach 10 just by age

  // 2. Mobile Check
  if (target.is_mobile || target.network_type === "mobile") {
    score -= 50;
  }

  // 3. DNS/Hostname Check
  const hostNameToCheck = target.hostname || target.classification_metadata?.ptr_record;
  if (hostNameToCheck) {
    const host = hostNameToCheck.toLowerCase();
    const dynamicKeywords = ["dynamic", "pool", "dhcp", "customer", "dsl", "dialup", "user"];
    const isLikelyDynamic = dynamicKeywords.some((keyword: string) => host.includes(keyword));
    
    if (isLikelyDynamic) {
        score -= 20;
    } else {
        score += 10; // Likely business or static assignment (+10)
    }
  }

  // Bound it
  return Math.max(0, Math.min(100, score));
}

async function main() {
  console.log("--- Starting Stability Analysis (Anchor Node Identification) ---");
  
  const args = process.argv;
  const limitArg = args.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
  const offsetArg = args.find((arg) => arg.startsWith("--offset="))?.split("=")[1];
  
  const limit = limitArg ? parseInt(limitArg) : Infinity;
  const initialOffset = offsetArg ? parseInt(offsetArg) : 0;

  let currentOffset = initialOffset;
  let fetchedCount = 0;
  const BATCH_SIZE = 1000;
  let hasMore = true;

  while (hasMore && fetchedCount < limit) {
    const fetchSize = Math.min(BATCH_SIZE, limit - fetchedCount);
    const toIndex = currentOffset + fetchSize - 1;

    const { data: targets, error } = await supabase
      .from("monitoring_targets")
      .select("id, ip, created_at, last_ip_change_at, last_online_at, hostname, classification_metadata, is_mobile, network_type, stability_score")
      .order("id", { ascending: true })
      .range(currentOffset, toIndex);

    if (error) {
      console.error("Database query error:", error.message);
      break;
    }
    if (!targets || targets.length === 0) break;

    console.log(`Analyzing batch ${currentOffset}...`);

    for (const target of targets) {
      const baseScore = await calculateStability(target);
      
      const updates: any = {
        network_type: baseScore >= 70 ? "fixed" : target.network_type
      };

      const now = Date.now();
      const lastOnlineTime = target.last_online_at ? new Date(target.last_online_at).getTime() : 0;
      const hoursSinceOnline = lastOnlineTime > 0 ? (now - lastOnlineTime) / (1000 * 60 * 60) : Infinity;

      let newScore = target.stability_score || 0;

      if (target.stability_score === null || target.stability_score === undefined) {
        // ONLY initialize the score for new nodes
        newScore = baseScore;
      } else {
        // Daily evaluation: +1 if active in the last 24h, -1 if not
        if (hoursSinceOnline <= 24) {
          newScore = Math.min(100, newScore + 1);
        } else {
          newScore = Math.max(0, newScore - 1);
        }
      }

      updates.stability_score = newScore;

      // Skip update if nothing meaningful changed, to save DB writes
      if (updates.network_type === target.network_type && newScore === target.stability_score) {
        continue;
      }

      const { error: updateError } = await supabase
        .from("monitoring_targets")
        .update(updates)
        .eq("id", target.id);

      if (updateError) {
        console.error(`Error updating target ${target.ip}:`, updateError.message);
      }
    }

    if (targets.length > 0) {
      fetchedCount += targets.length;
      currentOffset += targets.length;
    }

    if (targets.length < fetchSize) break;
  }

  console.log("Stability analysis complete.");
}

main().catch(console.error);
