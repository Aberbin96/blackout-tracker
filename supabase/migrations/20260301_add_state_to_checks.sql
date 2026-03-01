-- Migration: Add state column to connectivity_checks
-- Description: The MonitoringService includes 'state' in its results for faster analytics without JOINs.

ALTER TABLE connectivity_checks ADD COLUMN IF NOT EXISTS state TEXT;

-- Index for querying outages/status by state quickly
CREATE INDEX IF NOT EXISTS idx_checks_state ON connectivity_checks(state);

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, reload_schema;
