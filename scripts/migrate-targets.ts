import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TARGETS_DIR = path.join(process.cwd(), "data/targets");

async function migrate() {
  console.log("--- Starting Migration from JSON to Supabase ---");

  if (!fs.existsSync(TARGETS_DIR)) {
    console.error("Targets directory not found.");
    return;
  }

  const files = fs.readdirSync(TARGETS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const stateName = file.replace(".json", "").replace(/-/g, " ");
    console.log(`Processing ${stateName}...`);

    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(TARGETS_DIR, file), "utf-8"),
      );
      if (!Array.isArray(data) || data.length === 0) continue;

      const formatted = data.map((t: any) => ({
        ip: t.ip,
        provider: t.provider,
        asn: t.asn,
        state: stateName,
        city: t.city,
        services: t.services || [],
        is_active: true,
      }));

      const { error } = await supabase
        .from("monitoring_targets")
        .upsert(formatted, { onConflict: "ip" });

      if (error) {
        console.error(`  Error uploading ${stateName}:`, error.message);
      } else {
        console.log(
          `  Successfully migrated ${formatted.length} targets for ${stateName}.`,
        );
      }
    } catch (e: any) {
      console.error(`  Failed to parse ${file}:`, e.message);
    }
  }

  console.log("\nMigration complete.");
}

migrate();
