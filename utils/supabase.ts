import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Supabase URL and Key are required. Found URL: ${supabaseUrl ? "SET" : "MISSING"}, Key: ${supabaseKey ? "SET" : "MISSING"}. Please check your .env.local file.`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
