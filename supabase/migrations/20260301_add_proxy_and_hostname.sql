-- Migration: Add hostname and is_proxy columns to monitoring_targets
-- Description: These columns are needed for the enhanced IP discovery and classification.

ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false;

-- Add an index for is_proxy if we ever want to filter out proxies quickly
CREATE INDEX IF NOT EXISTS idx_targets_is_proxy ON monitoring_targets(is_proxy);
