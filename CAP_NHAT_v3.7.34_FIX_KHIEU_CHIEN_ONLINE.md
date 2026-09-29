# Hàn Thiên Môn v3.7.34 — Khiêu Chiến Online + Tối Ưu

## 1. Khiêu Chiến Online
- Thêm đồng bộ trạng thái lôi đài nhẹ theo thời gian thực khi đang có trận.
- Sau khi một bên ra chiêu, bên còn lại nhận HP/lượt đánh mới mà không phải chờ chu kỳ tải dữ liệu toàn trang.
- Trạng thái được đọc trực tiếp từ máy chủ, có `Cache-Control: no-store`.
- Tự làm mới dữ liệu Khiêu Chiến khi phát hiện vòng đấu, HP, lượt đánh hoặc hành động cuối thay đổi.
- Giữ lựa chọn `CHỌN RA CHIÊU` trước mỗi lượt.
- Máy chủ tiếp tục xác thực công pháp/chiêu được chọn, lượt đánh và trạng thái trận để tránh client tự sửa dữ liệu.
- Giữ nguyên cơ chế Rời Lôi Đài = thất bại và tùy chọn đặc biệt Nhổ 1 Ngụm Nước Bọt theo điều kiện cảnh giới.

## 2. Giảm lag
- Thêm index PostgreSQL cho các truy vấn Khiêu Chiến theo người thách đấu, đối thủ, trạng thái và chế độ.
- Không dùng polling nặng toàn bộ `/api/challenges` liên tục; chỉ dùng endpoint trạng thái nhẹ khi đang có trận.
- Giảm polling thông báo toàn cục/red packet từ 2 giây xuống 5 giây.
- Khi đồng bộ trận phát hiện thay đổi từ người chơi khác, cache `/api/challenges` được loại bỏ trước khi tải lại để tránh hiển thị dữ liệu cũ.

## 3. Kiểm tra
- `node --check server.js`: OK
- `node --check script.js`: OK

## 4. Tương thích
- Giữ nguyên database và các chức năng khác của bản v3.7.33.
- Index được tạo bằng `CREATE INDEX IF NOT EXISTS`, không xóa dữ liệu cũ.
