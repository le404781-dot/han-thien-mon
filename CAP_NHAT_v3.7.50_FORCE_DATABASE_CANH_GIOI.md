# Hàn Thiên Môn v3.7.50 — FORCE database cảnh giới

Database `profiles` được sửa trực tiếp mỗi lần server khởi động, không còn phụ thuộc việc migration cũ đã tồn tại hay chưa.

- `ho_linh_15` → Tiên Đế 1 Tinh
- `Reytheon` → Tiên Đế 14 Tinh
- `Cuu_Vi_Ho` → Tiên Đế 5 Tinh
- `wutati` → Thiên Tiên 1 Tầng
- `libais` → Thiên Tiên 1 Tầng

Đồng bộ `spirit_power`, `rank`, `realm_tier`, `spirit_root_foundation` và xóa Nội Thương.
Transaction rollback nếu bất kỳ tài khoản nào không tồn tại.
Xóa cache `/api/data` sau khi cập nhật để giao diện đọc lại dữ liệu database mới.
