# Hàn Thiên Môn v3.7.34 — Tối ưu giảm lag

## Client
- Tách tải hồ sơ cơ bản khỏi chuỗi tải module phụ khi đăng nhập.
- Tải các module sau đăng nhập song song bằng Promise.allSettled để giảm thời gian chờ.
- Giảm polling toàn trang từ chu kỳ 180 giây xuống cơ chế 60 giây có điều kiện theo khu vực đang hiển thị.
- Không tải lại Chat, Hòm Thư, Tài Phú, Lôi Đài, Môn Nhân khi khu vực đó không hiển thị.
- Thông báo toàn môn 5 giây/lần thay cho 2 giây/lần.
- Lì Xì chỉ đồng bộ khi Chat Tổng đang hiển thị.
- Bảng Tài Phú không gọi lại /api/profile chỉ để lấy quyền công khai.
- Giữ online cultivation hoạt động sau khi tối ưu bootstrap hồ sơ.
- Thêm hỗ trợ prefers-reduced-motion để giảm animation trên thiết bị yêu cầu giảm chuyển động.
- Mobile bỏ backdrop-filter ở topbar/dialog để giảm tải GPU trên Safari/iPhone.
- Content-visibility/contain cho section trên desktop để giảm chi phí render vùng ngoài màn hình.
- Cache-busting script/style lên v3.7.34.

## Server / PostgreSQL
- Compression giảm từ level 6 xuống level 4, threshold 2 KB để giảm CPU nén response.
- Bảng Thành Tích: thay các correlated subquery SUM/COUNT theo từng môn nhân bằng một aggregate JOIN.
- Cache kết quả leaderboard 5 giây trong process.
- Cache dữ liệu nền Tài Phú 5 giây trong process; quyền công khai vẫn được áp dụng theo từng response.
- Giữ index hiện có cho spirit_stones, chat, red packet và các bảng realtime.

## Kiểm tra
- `node --check server.js` — OK.
- `node --check script.js` — OK.
