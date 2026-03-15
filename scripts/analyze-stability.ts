import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";
import dns from "dns/promises";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

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
  let score = 20; // Base score

  // 1. Longevity (max 40 points)
  const createdAt = new Date(target.created_at);
  const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  score += Math.min(daysOld, 40);

  // 2. Mobile Check
  if (target.is_mobile || target.network_type === "mobile") {
    score -= 50;
  }

  // 3. DNS/Hostname Check
  if (target.hostname) {
    const host = target.hostname.toLowerCase();
    const dynamicKeywords = ["dynamic", "pool", "dhcp", "customer", "dsl", "dialup", "user"];
    const isLikelyDynamic = dynamicKeywords.some(keyword => host.includes(keyword));
    
    if (isLikelyDynamic) {
        score -= 20;
    } else {
        score += 20; // Likely business or static assignment
    }
  }

  // Bound it
  return Math.max(0, Math.min(100, score));
}

async function main() {
  console.log("--- Starting Stability Analysis (Anchor Node Identification) ---");
  
  const BATCH_SIZE = 500;
  let offset = 0;

  while (true) {
    const { data: targets, error } = await supabase
      .from("monitoring_targets")
      .select("id, ip, created_at, hostname, is_mobile, network_type")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error || !targets || targets.length === 0) break;

    console.log(`Analyzing batch ${offset}...`);

    for (const target of targets) {
      const score = await calculateStability(target);
      
      const { error: updateError } = await supabase
        .from("monitoring_targets")
        .update({ 
            stability_score: score,
            network_type: score >= 70 ? "fixed" : target.network_type
        })
        .eq("id", target.id);

      if (updateError) {
        console.error(`Error updating target ${target.ip}:`, updateError.message);
      }
    }

    if (targets.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log("Stability analysis complete.");
}

main().catch(console.error);
