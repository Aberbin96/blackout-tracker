-- 1. Create a table to store daily aggregated historical data
CREATE TABLE IF NOT EXISTS daily_regional_stats (
    date DATE NOT NULL,
    state TEXT NOT NULL,
    provider TEXT NOT NULL,
    total_checks BIGINT,
    online_checks BIGINT,
    avg_latency FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (date, state, provider)
);

-- Enable RLS on the new table
ALTER TABLE daily_regional_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated select on daily_stats" ON daily_regional_stats FOR SELECT USING (true);

-- 2. Create a function to perform the rollup and then delete old data
CREATE OR REPLACE FUNCTION rollup_and_cleanup_checks()
RETURNS void AS $$
BEGIN
  -- A. Aggregate yesterday's data into the daily_regional_stats table
  -- We use ON CONFLICT DO NOTHING in case the function runs twice for the same day
  INSERT INTO daily_regional_stats (date, state, provider, total_checks, online_checks, avg_latency)
  SELECT 
    (timestamp AT TIME ZONE 'UTC')::DATE as date,
    state,
    provider,
    COUNT(*)::BIGINT as total_checks,
    COUNT(*) FILTER (WHERE status = 'online')::BIGINT as online_checks,
    AVG(latency)::FLOAT as avg_latency
  FROM connectivity_checks
  WHERE timestamp >= (CURRENT_DATE - INTERVAL '1 day')
    AND timestamp < CURRENT_DATE
  GROUP BY 1, 2, 3
  ON CONFLICT (date, state, provider) DO NOTHING;

  -- B. Delete raw rows that are older than 14 days to free up space
  DELETE FROM connectivity_checks
  WHERE timestamp < (CURRENT_DATE - INTERVAL '14 days');

END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. (Optional) Instructions for pg_cron setup in Supabase:
-- To run this automatically every night at 1:00 AM UTC, you would run:
-- 
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'rollup-and-cleanup-nightly',
--   '0 1 * * *', -- Everyday at 1:00 AM
--   $$SELECT rollup_and_cleanup_checks()$$
-- );
