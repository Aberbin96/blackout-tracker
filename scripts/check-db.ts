import { supabase } from "../utils/supabase";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function check() {
  const { count, error } = await supabase
    .from("scanned_prefixes")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error fetching count:", error.message);
  } else {
    console.log(`Total scanned prefixes: ${count}`);
  }

  const { data: distribution, error: distError } = await supabase
    .from("monitoring_targets")
    .select("provider");

  if (distError) {
    console.error("Error fetching distribution:", distError.message);
  } else {
    const counts = distribution.reduce((acc: any, curr: any) => {
      acc[curr.provider] = (acc[curr.provider] || 0) + 1;
      return acc;
    }, {});
    console.log("Nodes per provider:", counts);
    console.log(`Total nodes: ${distribution.length}`);
  }
}

check();
