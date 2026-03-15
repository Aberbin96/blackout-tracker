-- Migration: Add stability tracking to monitoring_targets
-- Description: Adds columns to identify reliable anchor nodes (Fixed IPs)

ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS stability_score INTEGER DEFAULT 0;
ALTER TABLE monitoring_targets ADD COLUMN IF NOT EXISTS last_ip_change_at TIMESTAMPTZ DEFAULT NOW();

-- Index for stability-based filtering
CREATE INDEX IF NOT EXISTS idx_targets_stability ON monitoring_targets(stability_score);

COMMENT ON COLUMN monitoring_targets.stability_score IS 'Score from 0 to 100 indicating IP stability (Fixed IP probability)';
COMMENT ON COLUMN monitoring_targets.last_ip_change_at IS 'Timestamp of the last known IP change for this specific record identity';
