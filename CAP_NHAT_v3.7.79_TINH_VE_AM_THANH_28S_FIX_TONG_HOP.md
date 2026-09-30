# Hàn Thiên Môn v3.7.79

## 1. Hiển thị tên nhạc
- Đổi tên hiển thị `Tĩnh Về` thành `Tinh Vệ`.

## 2. Hiệu ứng âm thanh giao diện
- Thêm bộ hiệu ứng Web Audio API ngắn, không cần tải thêm file.
- Phân loại âm thanh cho thao tác mở/chạm, thành công, cảnh báo, khóa màn hình và khiêu chiến.
- Chỉ khởi tạo AudioContext sau thao tác người dùng để phù hợp Safari/iPhone.
- Không ảnh hưởng trình phát nhạc nền.

## 3. Khiêu chiến online: countdown 28 giây
- Khi đối phương bấm Đồng thuận, trận chuyển sang `accepted` và lưu `countdown_until = NOW() + 28 seconds`.
- Trong 28 giây: HP/trang bị/trận đã được khóa, không thể ra chiêu.
- Server không tính thưởng/phạt/kết quả trước khi countdown kết thúc.
- Background resolver kiểm tra thời hạn và tự động chạy cùng engine chiến đấu sau countdown.
- Countdown hiển thị thời gian thực trên giao diện.
- Khi hết 28 giây, hệ thống tự động tính toàn bộ trận và ghi kết quả trong transaction.
- Thêm `countdown_until` vào schema và các endpoint trạng thái.
- Resolver dùng `FOR UPDATE SKIP LOCKED` để tránh xử lý trùng khi có nhiều worker.

## 4. Sửa lỗi tồn đọng đã phát hiện trong mã nguồn
- Xóa block `battleHtml` bị render trùng 2 lần.
- Loại bỏ nhánh `else if(realmGap<0)` bị lặp trong tính sát thương.
- Cập nhật version frontend/PWA lên 3.7.79 để tránh cache code cũ.
- JSON manifest/package được kiểm tra hợp lệ.
- `server.js` và `script.js` qua `node --check`.
