# Hàn Thiên Môn v3.7.74 — thay icon PWA hoàn toàn

- Dùng ảnh logo Hàn Thiên Môn mới làm nguồn icon.
- Tạo bộ icon mới với tên file hoàn toàn mới: 180, 192, 512, 1024 và favicon.
- Xóa các icon cũ khỏi thư mục `icons/` của bản deploy.
- Manifest đổi `id` và `start_url` sang `han-thien-mon-3-7-74`.
- Service Worker đổi cache namespace và xóa toàn bộ cache PWA phiên bản cũ khi activate.
- Service Worker không cache manifest/icon để tránh giữ icon cũ.
- Server gửi `no-store` cho thư mục icon.
- HTML chỉ tham chiếu icon v3.7.74.
- Giữ nguyên các chức năng khác, bao gồm trình phát nhạc v3.7.73/74.

## Lưu ý iPhone

Không thể xóa biểu tượng đã nằm trên Màn hình chính của iOS từ phía website. Sau khi Deploy, cần xóa biểu tượng Hàn Thiên Môn cũ trên iPhone rồi thêm lại từ Safari. Bản mới sẽ dùng URL icon hoàn toàn mới và không còn tham chiếu icon cũ.
