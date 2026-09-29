# Hàn Thiên Môn v3.7.49 — Fix lỗi tồn tại + chuẩn hóa cảnh giới

- Chuẩn hóa chính xác cảnh giới 5 môn nhân:
  - `ho_linh_15` → Tiên Đế 1 Tinh
  - `Reytheon` → Tiên Đế 14 Tinh
  - `Cuu_Vi_Ho` → Tiên Đế 5 Tinh
  - `wutati` → Thiên Tiên
  - `libais` → Thiên Tiên
- Dùng mốc linh lực đúng theo hệ thống hiện tại và tầng/tinh tương ứng.
- Đồng bộ lại thanh Căn Cơ theo cảnh giới mới, xóa trạng thái Nội Thương cũ để tránh dữ liệu lệch.
- Migration chạy một lần, có transaction và chỉ ghi nhận hoàn tất sau khi toàn bộ cập nhật thành công.
- Kiểm tra cú pháp `server.js` và `script.js`.
