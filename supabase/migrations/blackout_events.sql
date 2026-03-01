-- Create the blackout_events table
CREATE TABLE IF NOT EXISTS blackout_events (
    id BIGSERIAL PRIMARY KEY,
    state TEXT NOT NULL,
    nodes_total INTEGER NOT NULL,
    nodes_offline INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup of active blackouts per state
CREATE INDEX IF NOT EXISTS idx_blackout_active_state ON blackout_events(state) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_blackout_started ON blackout_events(started_at);

-- Enable RLS
ALTER TABLE blackout_events ENABLE ROW LEVEL SECURITY;

-- Simple policy for public access
CREATE POLICY "Allow service manage" ON blackout_events FOR ALL USING (true) WITH CHECK (true);
