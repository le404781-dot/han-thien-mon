# Hàn Thiên Môn v3.7.25 – Tối ưu HTTP Responses

## Mục tiêu
Giảm tối đa số request/response HTTP lặp lại trong khi vẫn giữ các chức năng realtime cần thiết.

## Client
- Thêm cache GET ngắn hạn theo endpoint và user token.
- GET trùng trong cùng thời điểm vẫn dùng chung request đang chạy.
- POST/PUT/PATCH/DELETE tự xóa GET cache để dữ liệu sau thao tác được tải mới.
- `/api/data`: cache 10 giây.
- `/api/profile`: 5 giây.
- chat: 4 giây.
- mailbox/challenges: 5 giây.
- arena live: 2,5 giây.
- reward snapshot: 15 giây.
- GET khác: 3 giây.

## Giảm polling
- Tu luyện online: 5s → 15s; UI vẫn chạy đồng hồ cục bộ.
- Theo dõi phần thưởng: 15s → 30s.
- Chat riêng: 4s → 6s và dừng polling khi tab bị ẩn.
- Thú Trường trận đang đánh: 2,5s → 5s và dừng khi tab bị ẩn.
- Thú Trường spectator: 8s → 15s và dừng khi tab bị ẩn.
- Đồng bộ Chat/Tổng/Môn nhân/Hòm thư/Lôi Đài/Nhiệm vụ: 60s → 180s.
- Thông báo khiêu chiến: 10s → 20s.

## Server/cache
- `/api/data` cache private 10 giây + stale-while-revalidate 10 giây.
- Giữ ETag/Last-Modified cho static assets.
- Tăng cache static JS/CSS/ảnh lên 30 ngày; vì file JS/CSS đã có cache-busting `?v=...`, phiên bản mới vẫn được tải ngay khi deploy.
- Giữ keep-alive 120 giây.

## Không thay đổi
- Database/gameplay.
- Tỷ lệ Tiên Bàn.
- Cường Hóa Tiên Khí.
- Căn Cơ/Nội Thương.
- Ngũ Kiếm Kim Tiên.
