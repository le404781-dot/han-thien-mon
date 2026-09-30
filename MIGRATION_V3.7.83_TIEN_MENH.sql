-- Hàn Thiên Môn v3.7.83 — Tiên Mệnh / PostgreSQL
-- Server tự chạy migration tương đương khi khởi động. File này là bản tham chiếu
-- idempotent cho môi trường cần kiểm tra DB thủ công.
BEGIN;

ALTER TABLE tien_menh_games ADD COLUMN IF NOT EXISTS reward_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tien_menh_games_status_created
  ON tien_menh_games(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tien_menh_games_online_lobby_created
  ON tien_menh_games(created_at,id)
  WHERE mode='online' AND status='lobby';
CREATE INDEX IF NOT EXISTS idx_tien_menh_games_online_active_started
  ON tien_menh_games(started_at,id)
  WHERE mode='online' AND status='active';
CREATE INDEX IF NOT EXISTS idx_tien_menh_games_cleanup
  ON tien_menh_games(status,finished_at,id);
CREATE INDEX IF NOT EXISTS idx_tien_menh_players_game
  ON tien_menh_players(game_id,seat);
CREATE INDEX IF NOT EXISTS idx_tien_menh_players_user_game
  ON tien_menh_players(user_id,game_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tien_menh_players_game_alive_seat
  ON tien_menh_players(game_id,alive,seat);
CREATE INDEX IF NOT EXISTS idx_tien_menh_cards_player_location
  ON tien_menh_cards(player_id,location,id);
CREATE INDEX IF NOT EXISTS idx_tien_menh_cards_game_location_id
  ON tien_menh_cards(game_id,location,id);
CREATE INDEX IF NOT EXISTS idx_tien_menh_history_game_id
  ON tien_menh_history(game_id,id DESC);

UPDATE tien_menh_games
SET reward_paid_at=COALESCE(reward_paid_at,finished_at)
WHERE status='completed' AND reward_paid_at IS NULL;

COMMIT;
