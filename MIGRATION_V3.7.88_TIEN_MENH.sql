-- Hàn Thiên Môn v3.7.88 · Tiên Mệnh hardening
-- Idempotent: safe to run against an existing PostgreSQL database.
BEGIN;

ALTER TABLE tien_menh_games
  ADD COLUMN IF NOT EXISTS turn_deadline_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tien_menh_turn_deadline
  ON tien_menh_games(status, turn_deadline_at)
  WHERE status='active' AND turn_deadline_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS tien_menh_settings (
  singleton_id INTEGER PRIMARY KEY DEFAULT 1 CHECK(singleton_id=1),
  npc_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tien_menh_settings(singleton_id,npc_enabled)
VALUES(1,TRUE)
ON CONFLICT(singleton_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tien_menh_chat (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES tien_menh_games(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tien_menh_chat_game_id
  ON tien_menh_chat(game_id,id DESC);

UPDATE tien_menh_games
SET turn_deadline_at=NOW()+INTERVAL '30 seconds'
WHERE status='active'
  AND turn_deadline_at IS NULL
  AND turn_user_id IS NOT NULL;

COMMIT;
