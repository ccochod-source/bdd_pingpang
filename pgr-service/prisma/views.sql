-- pgr_current_ratings — latest PGR snapshot per player
--
-- Uses DISTINCT ON (PostgreSQL) to keep only the most recent snapshot per player.
-- Join with pgr_players to get display info in one query.
--
-- Run once in Supabase SQL Editor, or via: npm run db:views

CREATE OR REPLACE VIEW pgr_current_ratings AS
SELECT DISTINCT ON (s.player_id)
  s.id                    AS snapshot_id,
  s.player_id,
  p.display_name,
  p.first_name,
  p.last_name,
  p.country_code,
  p.gender,
  p.category,
  s.rating,
  s.rating_deviation,
  s.volatility,
  s.match_count,
  s.confidence_status,
  s.is_provisional,
  s.initialization_source,
  s.algorithm_version,
  s.snapshot_date,
  s.trigger,
  s.created_at
FROM pgr_snapshots s
JOIN pgr_players p ON p.id = s.player_id
ORDER BY s.player_id, s.snapshot_date DESC;
