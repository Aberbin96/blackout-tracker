-- Migration: Consolidated Security Fix (RLS + Search Path)
-- Filename: 20260317_total_security_fix.sql
-- Description: Enables RLS on all tables and secures all functions with search_path.

-- ==========================================
-- 1. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all core tables
ALTER TABLE monitoring_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectivity_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_regional_stats ENABLE ROW LEVEL SECURITY;

-- Standardize management policies
DROP POLICY IF EXISTS "Allow all" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow all management" ON monitoring_targets;
DROP POLICY IF EXISTS "Allow service manage" ON monitoring_targets;
CREATE POLICY "Allow all management" ON monitoring_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all management" ON scanned_prefixes;
CREATE POLICY "Allow all management" ON scanned_prefixes FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 2. FUNCTION SECURITY (SEARCH PATH)
-- ==========================================

-- Fix get_dashboard_stats
ALTER FUNCTION get_dashboard_stats(TEXT, TEXT) SET search_path = public;

-- Fix get_regional_stats
ALTER FUNCTION get_regional_stats(TEXT, TEXT) SET search_path = public;

-- Fix get_provider_stats
ALTER FUNCTION get_provider_stats(TEXT, TEXT) SET search_path = public;

-- Fix get_map_data
ALTER FUNCTION get_map_data(TEXT, TEXT) SET search_path = public;

-- Fix get_historical_stats
ALTER FUNCTION get_historical_stats(TEXT, TEXT) SET search_path = public;

-- Fix rollup_and_cleanup_checks
ALTER FUNCTION rollup_and_cleanup_checks() SET search_path = public;

-- ==========================================
-- 3. RELOAD SCHEMA CACHE
-- ==========================================
NOTIFY pgrst, reload_schema;
