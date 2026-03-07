-- Index for Historical Charts (24H and 7D)
-- This covers the exact columns used by `get_historical_stats` and `rollup_and_cleanup_checks`
CREATE INDEX IF NOT EXISTS idx_connectivity_checks_timestamp_state_provider 
ON public.connectivity_checks (timestamp DESC, state, provider);

-- Secondary index specifically for active blackout evaluation or fast regional filtering
CREATE INDEX IF NOT EXISTS idx_connectivity_checks_state_status
ON public.connectivity_checks (state, status);
