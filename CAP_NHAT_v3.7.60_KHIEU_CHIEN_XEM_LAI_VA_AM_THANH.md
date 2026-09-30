# Hàn Thiên Môn v3.7.60

## 1. Xem lại Khiêu Chiến Online
- Thêm mục **🔁 Xem lại Khiêu Chiến** ngay trong khu vực Khiêu Chiến.
- Diễn biến trận online được giữ tối đa **3 phút** để xem lại.
- Hết 3 phút, server tự xóa `battle_log` và các dữ liệu diễn biến lớn; lịch sử tóm tắt vẫn giữ để không làm sai giới hạn lượt khiêu chiến 24 giờ.
- Không tạo bảng mới, hạn chế tăng tải database.

## 2. Chênh từ 2 cảnh giới và Nhổ 1 Ngụm Nước Bọt
- Khi chênh lệch từ **2 cảnh giới trở lên**, hai môn nhân được thông báo rõ.
- Có nút **💦 Nhổ: BẬT/TẮT** trong lời mời; trạng thái lưu chung trên server và đồng bộ giữa hai bên.
- Khi trận bắt đầu, cả hai nhìn thấy cùng trạng thái BẬT/TẮT.
- Nếu BẬT, engine tự dùng Nhổ 1 Ngụm Nước Bọt; nếu TẮT, engine tự quyết đấu bằng chuỗi chiêu bình thường.
- Sau khi đối phương đồng thuận, kết quả vẫn do server tính, không phụ thuộc giao diện.

## 3. Đồng bộ kết quả ngay lập tức
- Bên nhận lời mời được render kết quả ngay từ response.
- Bên gửi tự nhận `recentResult` qua polling 2 giây, không cần chờ mở Hòm Thư.
- Kết quả gần nhất được giữ trong cửa sổ replay 3 phút.

## 4. Sửa nhạc nền
- Nguyên nhân chính: code cũ `await waitForReady()`/`audio.load()` trước `audio.play()` có thể làm Safari/iPhone mất **user activation**, khiến `play()` bị từ chối dù người dùng vừa bấm Khởi Nhạc.
- Đổi sang gọi `audio.play()` trực tiếp trong chuỗi click, để trình duyệt tự buffer sau đó.
- Ưu tiên MP3 44.1 kHz stereo, AAC/M4A làm fallback.
- Giữ loop, volume, Media Session và tự nối lại khi quay lại trang.
- Asset audio đã kiểm tra tồn tại và đọc được: MP3 ~218 giây, AAC/M4A ~218 giây.

## Kiểm tra
- `node --check server.js` ✓
- `node --check script.js` ✓
- MP3/M4A tồn tại và có stream audio hợp lệ ✓
