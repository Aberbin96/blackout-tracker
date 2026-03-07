import { supabase } from "./utils/supabase";

async function testTableLimit() {
  console.log("Testing monitoring_targets with limit...");
  const { data, error } = await supabase
    .from("monitoring_targets")
    .select("ip")
    .eq("is_active", true)
    .limit(5000);

  if (error) {
    console.error("Table Error:", error);
  } else {
    console.log("Table returned rows:", data?.length);
  }
}

testTableLimit();
