import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (typeof window !== "undefined") {
  throw new Error("Supabase client should only be used on the server.");
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Supabase URL and Key are required on the server. Found URL: ${supabaseUrl ? "SET" : "MISSING"}, Key: ${supabaseKey ? "SET" : "MISSING"}.`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
