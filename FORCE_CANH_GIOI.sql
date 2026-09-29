-- Hàn Thiên Môn v3.7.50
-- Có thể chạy trực tiếp trên PostgreSQL nếu muốn sửa DB ngay.
-- Không phụ thuộc migration cũ.
BEGIN;

-- Tiên Đế 1 Tinh
UPDATE profiles p SET
  spirit_power=1026690000,
  rank='Tiên Đế',
  realm_tier=1,
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
  spirit_root_foundation=340,
  spirit_root_injury_until=NULL,
  updated_at=NOW()
FROM users u
WHERE u.id=p.user_id AND LOWER(u.username)=LOWER('libais');

COMMIT;

-- Kiểm tra kết quả:
SELECT u.username,p.rank,p.realm_tier,p.spirit_power
FROM users u JOIN profiles p ON p.user_id=u.id
WHERE LOWER(u.username) IN ('ho_linh_15','reytheon','cuu_vi_ho','wutati','libais')
ORDER BY u.username;
