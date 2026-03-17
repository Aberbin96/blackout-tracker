-- Migration: Full Security Update (RLS + Functions Search Path)
-- Filename: 20260317_full_security_fix.sql
-- Description: Consolidated script for immediate execution to fix RLS warnings and function search_path issues.

-- 1. ROW LEVEL SECURITY (RLS)
ALTER TABLE monitoring_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_regional_stats ENABLE ROW LEVEL SECURITY;

-- 2. POLICIES
DROP POLICY IF EXISTS "Allow all management" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow all" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow service manage" ON monitoring_targets;
CREATE POLICY "Allow all management" ON monitoring_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all management" ON scanned_prefixes;
CREATE POLICY "Allow all management" ON scanned_prefixes FOR ALL USING (true) WITH CHECK (true);

-- 3. FUNCTION SECURITY (search_path)
ALTER FUNCTION get_dashboard_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_regional_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_provider_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_map_data(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_historical_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION rollup_and_cleanup_checks() SET search_path = public;

-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, reload_schema;
