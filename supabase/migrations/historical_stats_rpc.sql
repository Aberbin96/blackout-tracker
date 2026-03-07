-- Create the get_historical_stats RPC for server-side aggregation
-- Fixed: Removed 'AT TIME ZONE' which was causing a type mismatch (TIMESTAMPTZ vs TIMESTAMP)
CREATE OR REPLACE FUNCTION get_historical_stats(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  granularity TEXT,
  online_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  -- 1. Daily stats (last 7 days)
  RETURN QUERY
  SELECT 
    date_trunc('day', timestamp)::TIMESTAMPTZ as bucket,
    'day'::TEXT as granularity,
    COUNT(*) FILTER (WHERE status = 'online')::BIGINT as online_count,
    COUNT(*)::BIGINT as total_count
  FROM connectivity_checks
  WHERE timestamp >= (CURRENT_DATE - INTERVAL '7 days')
    AND (p_state IS NULL OR p_state = '' OR state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR provider = p_provider)
  GROUP BY 1, 2
  ORDER BY 1 ASC;

  -- 2. Hourly stats (last 24 hours)
  RETURN QUERY
  SELECT 
    date_trunc('hour', timestamp)::TIMESTAMPTZ as bucket,
    'hour'::TEXT as granularity,
    COUNT(*) FILTER (WHERE status = 'online')::BIGINT as online_count,
    COUNT(*)::BIGINT as total_count
  FROM connectivity_checks
  WHERE timestamp >= (NOW() - INTERVAL '24 hours')
    AND (p_state IS NULL OR p_state = '' OR state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR provider = p_provider)
  GROUP BY 1, 2
  ORDER BY 1 ASC;
END;
$$ LANGUAGE plpgsql;
