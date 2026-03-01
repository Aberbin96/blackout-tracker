-- Comprehensive Migration: Add all missing geolocation and enrichment columns
-- Description: Ensures the monitoring_targets table has all columns expected by the updated discover-ips.ts script.

-- 1. Geolocation columns
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS lat NUMERIC;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS lon NUMERIC;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS timezone TEXT;

-- 2. Ensure these previous ones exist too (just in case they were missed)
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN DEFAULT false;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS network_type TEXT DEFAULT 'fixed';
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'unknown';
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS classification_metadata JSONB DEFAULT '{}';

-- 3. Add Useful Indexes
CREATE INDEX IF NOT EXISTS idx_targets_geo ON monitoring_targets(lat, lon);
CREATE INDEX IF NOT EXISTS idx_targets_is_mobile ON monitoring_targets(is_mobile);
CREATE INDEX IF NOT EXISTS idx_targets_is_proxy ON monitoring_targets(is_proxy);

-- 4. FORCE POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, reload_schema;
