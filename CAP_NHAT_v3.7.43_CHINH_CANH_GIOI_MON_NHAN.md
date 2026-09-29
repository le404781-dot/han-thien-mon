# Hàn Thiên Môn v3.7.43 — Chỉnh cảnh giới môn nhân

Migration `v3.7.43_set_member_realms_exact` chạy một lần khi server khởi động.

- `ho_linh_15` → Tiên Tôn 8 Tầng
- `Reytheon` → Tiên Đế 11 Tinh
- `Cuu_Vi_Ho` → Tiên Đế 5 Tinh
- `wutati` → Thiên Tiên (Nhất Tầng)
- `libais` → Thiên Tiên (Nhất Tầng)

Migration đặt lại `spirit_power`, `rank` và `realm_tier` đúng theo mốc cảnh giới, không dùng `GREATEST`, nên sẽ điều chỉnh cả trường hợp dữ liệu cũ đang cao hơn mức yêu cầu.
