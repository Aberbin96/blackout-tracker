-- Migration: Add device classification columns to monitoring_targets
-- Created: 2026-03-01

ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'unknown';
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS network_type TEXT DEFAULT 'fixed';
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS classification_metadata JSONB DEFAULT '{}';

-- Index for faster filtering by device type and network type
CREATE INDEX IF NOT EXISTS idx_targets_device_type ON monitoring_targets(device_type);
CREATE INDEX IF NOT EXISTS idx_targets_network_type ON monitoring_targets(network_type);
