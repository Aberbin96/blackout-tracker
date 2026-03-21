-- Create the get_historical_stats RPC for server-side aggregation
-- Fixed: Removed 'AT TIME ZONE' which was causing a type mismatch (TIMESTAMPTZ vs TIMESTAMP)
CREATE OR REPLACE FUNCTION get_historical_stats(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL, p_min_score INTEGER DEFAULT 0)
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  granularity TEXT,
  online_count BIGINT,
  total_count BIGINT
) AS $$
BEGIN
  -- 1. Daily stats (last 7 days) from the summary table
  RETURN QUERY
  SELECT 
    date::TIMESTAMPTZ as bucket,
    'day'::TEXT as granularity,
    SUM(online_checks)::BIGINT as online_count,
    SUM(total_checks)::BIGINT as total_count
  FROM daily_regional_stats
  WHERE date >= (CURRENT_DATE - INTERVAL '7 days')
    AND (p_state IS NULL OR p_state = '' OR state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR provider = p_provider)
  GROUP BY 1, 2
  ORDER BY 1 ASC;

  -- 2. Hourly stats (last 24 hours) from raw checks
  RETURN QUERY
  SELECT 
    date_trunc('hour', c.timestamp)::TIMESTAMPTZ as bucket,
    'hour'::TEXT as granularity,
    COUNT(*) FILTER (WHERE c.status = 'online')::BIGINT as online_count,
    COUNT(*)::BIGINT as total_count
  FROM connectivity_checks c
  INNER JOIN monitoring_targets t ON c.ip = t.ip
  WHERE c.timestamp >= (NOW() - INTERVAL '24 hours')
    AND (p_state IS NULL OR p_state = '' OR c.state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR c.provider = p_provider)
    AND (t.stability_score >= p_min_score)
  GROUP BY 1, 2
  ORDER BY 1 ASC;
END;
$$ LANGUAGE plpgsql SET search_path = public;
