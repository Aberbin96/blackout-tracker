-- 1. Dashboard Stats (Aggregate totals)
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  total_nodes BIGINT,
  online_nodes BIGINT,
  avg_latency FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_checks AS (
    SELECT DISTINCT ON (c.ip) c.ip, c.status, c.latency
    FROM connectivity_checks c
    WHERE c.timestamp > NOW() - INTERVAL '15 minutes'
    ORDER BY c.ip, c.timestamp DESC
  )
  SELECT 
    COUNT(t.ip)::BIGINT AS total_nodes,
    COUNT(c.ip) FILTER (WHERE c.status = 'online')::BIGINT AS online_nodes,
    COALESCE(AVG(c.latency) FILTER (WHERE c.status = 'online'), 0)::FLOAT AS avg_latency
  FROM monitoring_targets t
  LEFT JOIN recent_checks c ON t.ip = c.ip
  WHERE t.is_active = true
    AND (p_state IS NULL OR p_state = '' OR t.state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR t.provider = p_provider);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Regional Stats
CREATE OR REPLACE FUNCTION get_regional_stats(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  state TEXT,
  city TEXT,
  total_nodes BIGINT,
  online_nodes BIGINT,
  avg_latency FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_checks AS (
    SELECT DISTINCT ON (c.ip) c.ip, c.status, c.latency
    FROM connectivity_checks c
    WHERE c.timestamp > NOW() - INTERVAL '15 minutes'
    ORDER BY c.ip, c.timestamp DESC
  )
  SELECT 
    t.state,
    t.city,
    COUNT(t.ip)::BIGINT AS total_nodes,
    COUNT(c.ip) FILTER (WHERE c.status = 'online')::BIGINT AS online_nodes,
    COALESCE(AVG(c.latency) FILTER (WHERE c.status = 'online'), 0)::FLOAT AS avg_latency
  FROM monitoring_targets t
  LEFT JOIN recent_checks c ON t.ip = c.ip
  WHERE t.is_active = true
    AND (p_state IS NULL OR p_state = '' OR t.state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR t.provider = p_provider)
  GROUP BY t.state, t.city
  ORDER BY t.state;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Provider Stats (Node Composition)
CREATE OR REPLACE FUNCTION get_provider_stats(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  provider TEXT,
  total_nodes BIGINT,
  online_nodes BIGINT,
  avg_latency FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_checks AS (
    SELECT DISTINCT ON (c.ip) c.ip, c.status, c.latency
    FROM connectivity_checks c
    WHERE c.timestamp > NOW() - INTERVAL '15 minutes'
    ORDER BY c.ip, c.timestamp DESC
  )
  SELECT 
    t.provider,
    COUNT(t.ip)::BIGINT AS total_nodes,
    COUNT(c.ip) FILTER (WHERE c.status = 'online')::BIGINT AS online_nodes,
    COALESCE(AVG(c.latency) FILTER (WHERE c.status = 'online'), 0)::FLOAT AS avg_latency
  FROM monitoring_targets t
  LEFT JOIN recent_checks c ON t.ip = c.ip
  WHERE t.is_active = true
    AND (p_state IS NULL OR p_state = '' OR t.state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR t.provider = p_provider)
  GROUP BY t.provider
  ORDER BY online_nodes DESC;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Map Data
CREATE OR REPLACE FUNCTION get_map_data(p_state TEXT DEFAULT NULL, p_provider TEXT DEFAULT NULL)
RETURNS TABLE (
  ip TEXT,
  lat FLOAT,
  lon FLOAT,
  provider TEXT,
  state TEXT,
  city TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_checks AS (
    SELECT DISTINCT ON (c.ip) c.ip, c.status
    FROM connectivity_checks c
    WHERE c.timestamp > NOW() - INTERVAL '15 minutes'
    ORDER BY c.ip, c.timestamp DESC
  )
  SELECT 
    t.ip,
    t.lat::FLOAT,
    t.lon::FLOAT,
    t.provider,
    t.state,
    t.city,
    COALESCE(c.status, 'unknown') AS status
  FROM monitoring_targets t
  LEFT JOIN recent_checks c ON t.ip = c.ip
  WHERE t.is_active = true
    AND t.lat IS NOT NULL
    AND (p_state IS NULL OR p_state = '' OR t.state = p_state)
    AND (p_provider IS NULL OR p_provider = '' OR t.provider = p_provider);
END;
$$ LANGUAGE plpgsql SET search_path = public;
