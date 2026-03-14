import { supabase } from "./utils/supabase";

async function findLowDensityState() {
  const { data, error } = await supabase
    .from("monitoring_targets")
    .select("state")
    .eq("is_active", true);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const counts: Record<string, number> = {};
  data.forEach(t => {
    if (t.state) {
      counts[t.state] = (counts[t.state] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts).sort((a, b) => a[1] - b[1]);
  console.log("State counts:", sorted);
}

findLowDensityState();
