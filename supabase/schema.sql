-- Create the connectivity_checks table
CREATE TABLE IF NOT EXISTS connectivity_checks (
    id BIGSERIAL PRIMARY KEY,
    ip TEXT NOT NULL,
    provider TEXT NOT NULL,
    state TEXT NOT NULL, -- New field for state-level grouping
    status TEXT NOT NULL, -- 'online' or 'offline'
    latency INTEGER, -- in milliseconds
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries on IP, provider and state
CREATE INDEX IF NOT EXISTS idx_checks_ip ON connectivity_checks(ip);
CREATE INDEX IF NOT EXISTS idx_checks_timestamp ON connectivity_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_checks_provider ON connectivity_checks(provider);
CREATE INDEX IF NOT EXISTS idx_checks_state ON connectivity_checks(state);

-- Enable RLS
ALTER TABLE connectivity_checks ENABLE ROW LEVEL SECURITY;

-- Simple policy for public access (adjust as needed for production)
CREATE POLICY "Allow service insert" ON connectivity_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON connectivity_checks FOR SELECT USING (true);

-- Table to track scanned BGP prefixes
CREATE TABLE IF NOT EXISTS scanned_prefixes (
    prefix TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    asn INTEGER NOT NULL,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store the inventory of IPs to monitor
CREATE TABLE IF NOT EXISTS monitoring_targets (
    id BIGSERIAL PRIMARY KEY,
    ip TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL,
    asn INTEGER,
    state TEXT NOT NULL,
    city TEXT,
    zip TEXT,
    lat FLOAT8,
    lon FLOAT8,
    timezone TEXT,
    hostname TEXT,
    is_mobile BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    services INTEGER[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ
);

-- Index for state and provider filtering
CREATE INDEX IF NOT EXISTS idx_targets_state ON monitoring_targets(state);
CREATE INDEX IF NOT EXISTS idx_targets_provider ON monitoring_targets(provider);
CREATE INDEX IF NOT EXISTS idx_targets_active ON monitoring_targets(is_active);

-- Enable RLS
ALTER TABLE monitoring_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service manage" ON monitoring_targets;
CREATE POLICY "Allow all management" ON monitoring_targets FOR ALL USING (true) WITH CHECK (true);

-- Geolocation cache to avoid redundant API calls
CREATE TABLE IF NOT EXISTS ip_geolocation_cache (
    ip TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_geo_cache_ip ON ip_geolocation_cache(ip);

-- Enable RLS for cache
ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all manage cache" ON ip_geolocation_cache FOR ALL USING (true) WITH CHECK (true);
