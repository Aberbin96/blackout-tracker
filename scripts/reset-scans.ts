import { supabase } from "../utils/supabase";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function reset() {
  console.log("Resetting scanned_prefixes table...");
  const { error } = await supabase
    .from("scanned_prefixes")
    .delete()
    .neq("prefix", "FORCE_DELETE_ALL"); // Fake condition to delete all

  if (error) {
    console.error("Error resetting table:", error.message);
  } else {
    console.log("Successfully cleared scanned_prefixes.");
  }
}

reset();
