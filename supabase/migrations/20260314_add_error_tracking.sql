-- Migration: Add error tracking columns to connectivity_checks
-- Description: Adds error_type and timeout_ms to track offline nodes more effectively.

ALTER TABLE connectivity_checks ADD COLUMN IF NOT EXISTS error_type TEXT;
ALTER TABLE connectivity_checks ADD COLUMN IF NOT EXISTS timeout_ms INTEGER;

-- Update RLS if necessary (though usually policies on FOR ALL or FOR INSERT cover new columns automatically)
-- FORCE POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, reload_schema;
