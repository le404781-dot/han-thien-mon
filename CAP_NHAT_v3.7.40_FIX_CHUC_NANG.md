# Hàn Thiên Môn v3.7.40

- Gia cố kết nối PostgreSQL bằng `dbConnect()`, chặn truy vấn/`pool.connect()` khi server đang shutdown hoặc pool đã đóng.
- Khóa mua toàn bộ Tiên Đan trong Đan Pháp mặc định.
- Chỉ tài khoản đang giữ vai trò Đan Chủ tại `venue_code='dan-duong'` mới có quyền mở/khóa quầy Tiên Đan.
- Server kiểm tra khóa trước khi trừ linh thạch và ghi inventory; không thể bypass bằng gọi API trực tiếp.
- Giao diện hiển thị trạng thái khóa; chỉ Đan Chủ nhìn thấy nút mở khóa.
- Cache-busting frontend lên v3.7.40.
- Migration `v3.7.40-lock-immortal-pills` khóa quầy một lần khi deploy bản này.
