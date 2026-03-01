-- Migration: Add is_mobile column and reload schema cache
-- Description: Fixes PostgREST schema cache issues during IP discovery inserts.

ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN DEFAULT false;

-- Add an index for is_mobile for faster filtering of mobile vs residential IPs
CREATE INDEX IF NOT EXISTS idx_targets_is_mobile ON monitoring_targets(is_mobile);
