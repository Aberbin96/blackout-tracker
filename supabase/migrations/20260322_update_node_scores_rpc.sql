-- RPC to efficiently update stability scores in bulk based on ping results
CREATE OR REPLACE FUNCTION update_node_scores(online_ips TEXT[], offline_ips TEXT[])
RETURNS VOID AS $$
BEGIN
  -- Reward online nodes: +1 point per successful ping, capped at 100
  UPDATE monitoring_targets
  SET 
    stability_score = LEAST(100, COALESCE(stability_score, 0) + 1),
    last_online_at = NOW()
  WHERE ip = ANY(online_ips);

  -- Punish offline nodes: -1 points per failed ping, floored at 0 (allows survival during blackouts)
  UPDATE monitoring_targets
  SET 
    stability_score = GREATEST(0, COALESCE(stability_score, 0) - 1)
  WHERE ip = ANY(offline_ips);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
