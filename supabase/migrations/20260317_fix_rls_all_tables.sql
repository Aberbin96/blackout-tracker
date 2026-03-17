-- 1. Enable RLS on all tables (this is what fixes the warning)
ALTER TABLE monitoring_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_prefixes ENABLE ROW LEVEL SECURITY;

-- 2. Ensure we have the correct management policy for monitoring_targets
-- We drop any existing "Allow all" or "Allow all management" name to be sure it's clean
DROP POLICY IF EXISTS "Allow all" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow all management" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow service manage" ON monitoring_targets;

CREATE POLICY "Allow all management" ON monitoring_targets FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure "Allow all management" for scanned_prefixes
DROP POLICY IF EXISTS "Allow all management" ON scanned_prefixes;
CREATE POLICY "Allow all management" ON scanned_prefixes FOR ALL USING (true) WITH CHECK (true);

-- 4. CRITICAL for Supabase: Reload the schema cache so the Dashboard/API see the change
NOTIFY pgrst, reload_schema;

