-- Hàn Thiên Môn v3.7.50 — FORCE cảnh giới an toàn
-- Chạy trực tiếp trên PostgreSQL của Hàn Thiên Môn.
-- Bản này tự bảo đảm các cột cần thiết tồn tại trước khi UPDATE.
BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS spirit_power BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank TEXT NOT NULL DEFAULT 'Luyện Khí',
  ADD COLUMN IF NOT EXISTS realm_tier INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT 'Ngoại môn đệ tử',
  ADD COLUMN IF NOT EXISTS spirit_root_foundation INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS spirit_root_injury_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Tiên Đế 1 Tinh
UPDATE profiles p SET
  spirit_power=1026690000,
  rank='Tiên Đế',
  realm_tier=1,
  position='Tiên Môn Chí Tôn',
  spirit_root_foundation=440,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('ho_linh_15');

-- Tiên Đế 14 Tinh
UPDATE profiles p SET
  spirit_power=2509686671,
  rank='Tiên Đế',
  realm_tier=14,
  position='Tiên Môn Chí Tôn',
  spirit_root_foundation=440,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('Reytheon');

-- Tiên Đế 5 Tinh
UPDATE profiles p SET
  spirit_power=1482996668,
  rank='Tiên Đế',
  realm_tier=5,
  position='Tiên Môn Chí Tôn',
  spirit_root_foundation=440,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('Cuu_Vi_Ho');

-- Thiên Tiên 1 Tầng
UPDATE profiles p SET
  spirit_power=101250000,
  rank='Thiên Tiên',
  realm_tier=1,
  position='Tiên Môn Chí Tôn',
  spirit_root_foundation=340,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('wutati');

-- Thiên Tiên 1 Tầng
UPDATE profiles p SET
  spirit_power=101250000,
  rank='Thiên Tiên',
  realm_tier=1,
  position='Tiên Môn Chí Tôn',
  spirit_root_foundation=340,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('libais');

DO $$
DECLARE missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM (VALUES
    ('ho_linh_15'),('Reytheon'),('Cuu_Vi_Ho'),('wutati'),('libais')
  ) AS required(username)
  WHERE NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN profiles p ON p.user_id=u.id
    WHERE LOWER(u.username)=LOWER(required.username)
  );
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Thiếu % tài khoản mục tiêu; giao dịch được rollback để không cập nhật dở dang.', missing_count;
  END IF;
END $$;

COMMIT;

-- Kiểm tra kết quả:
SELECT u.username,p.rank,p.realm_tier,p.spirit_power
FROM users u JOIN profiles p ON p.user_id=u.id
WHERE LOWER(u.username) IN ('ho_linh_15','reytheon','cuu_vi_ho','wutati','libais')
ORDER BY u.username;
