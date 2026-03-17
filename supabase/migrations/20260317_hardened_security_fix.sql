-- Migration: Hardened Security Update (RLS + search_path)
-- Filename: 20260317_hardened_security_fix.sql
-- Description: Consolidated script to resolve RLS linter warnings (0024) and function search_path issues.

-- ==========================================
-- 1. ROW LEVEL SECURITY (RLS) ENABLEMENT
-- ==========================================
ALTER TABLE monitoring_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_regional_stats ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. HARDENED POLICIES (Fix Warning 0024)
-- Restricting ALL/INSERT/UPDATE/DELETE to service_role
-- ==========================================

-- monitoring_targets
DROP POLICY IF EXISTS "Allow all management" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow all" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow service manage" ON monitoring_targets;
CREATE POLICY "Allow service_role manage" ON monitoring_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON monitoring_targets FOR SELECT USING (true);

-- connectivity_checks
DROP POLICY IF EXISTS "Allow service insert" ON connectivity_checks;
DROP POLICY IF EXISTS "Allow authenticated select" ON connectivity_checks;
CREATE POLICY "Allow service_role manage" ON connectivity_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON connectivity_checks FOR SELECT USING (true);

-- blackout_events
DROP POLICY IF EXISTS "Allow service manage" ON blackout_events;
CREATE POLICY "Allow service_role manage" ON blackout_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON blackout_events FOR SELECT USING (true);

-- ip_geolocation_cache
DROP POLICY IF EXISTS "Allow all manage cache" ON ip_geolocation_cache;
CREATE POLICY "Allow service_role manage" ON ip_geolocation_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON ip_geolocation_cache FOR SELECT USING (true);

-- scanned_prefixes
DROP POLICY IF EXISTS "Allow all management" ON scanned_prefixes;
CREATE POLICY "Allow service_role manage" ON scanned_prefixes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON scanned_prefixes FOR SELECT USING (true);

-- daily_regional_stats
DROP POLICY IF EXISTS "Allow authenticated select on daily_stats" ON daily_regional_stats;
CREATE POLICY "Allow service_role manage" ON daily_regional_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON daily_regional_stats FOR SELECT USING (true);

-- ==========================================
-- 3. FUNCTION SECURITY (search_path)
-- ==========================================
ALTER FUNCTION get_dashboard_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_regional_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_provider_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_map_data(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION get_historical_stats(p_state TEXT, p_provider TEXT) SET search_path = public;
ALTER FUNCTION rollup_and_cleanup_checks() SET search_path = public;

-- ==========================================
-- 4. RELOAD SCHEMA CACHE
-- ==========================================
NOTIFY pgrst, reload_schema;
