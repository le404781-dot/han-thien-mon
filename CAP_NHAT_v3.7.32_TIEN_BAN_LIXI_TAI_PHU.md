# Hàn Thiên Môn v3.7.32

## 1. Tiên Bàn
- Giới hạn server-side tối đa 50 lượt/ngày/môn nhân.
- Quay 1 lần tính 1 lượt; quay 10 lần tính 10 lượt.
- Giới hạn tính theo ngày Việt Nam (Asia/Ho_Chi_Minh).
- Kiểm tra và khóa đồng thời bằng PostgreSQL transaction/upsert, chống vượt giới hạn khi bấm song song.
- Hiển thị số lượt đã dùng/còn lại trên giao diện.
- Bảng `tien_ban_daily_usage` có khóa chính `(user_id, usage_date)` và tự dọn dữ liệu cũ.

## 2. Lì Xì Chat Tổng
- Hóa Thần trở lên mới được phát Lì Xì.
- Tổng giá trị: 10.000 → 10.000.000 linh thạch.
- Số người nhận: 1 → 100, không vượt số môn nhân khác hiện có.
- Người phát bị trừ toàn bộ linh thạch ngay trong transaction.
- Người phát không tự nhận Lì Xì của mình.
- Mỗi môn nhân chỉ nhận một lần/packet.
- Phần thưởng được chia ngẫu nhiên nhưng luôn bảo đảm chia đủ 100% tổng linh thạch cho đúng số người nhận thành công; người nhận cuối cùng nhận phần còn lại.
- Packet tồn tại tối đa 10 phút; thông báo toàn server hiển thị 10 giây.
- Thêm danh sách Lì Xì đang mở ngay trong Chat Tổng.
- Thông báo toàn server dùng bảng `global_announcements`, có index và maintenance tự dọn.

## 3. Bảng Tài Phú
- Môn nhân đứng hạng #1 được hiệu ứng vàng động lấy cảm hứng từ ảnh tham chiếu: hào quang xoay, vòng sáng, ánh kim và hiệu ứng đồng xu quanh avatar.
- Không thay đổi thứ hạng hay quyền riêng tư số linh thạch.

## 4. Database
- Thêm index `idx_profiles_spirit_stones_desc` cho truy vấn xếp hạng Tài Phú.
- Thêm index cho Lì Xì active/sender và lịch sử nhận.
- Thêm bảng sử dụng Tiên Bàn theo ngày.
- Thêm bảng packet + claim với khóa chính chống nhận trùng.
- Maintenance tự dọn announcement hết hạn, packet hết hạn và usage Tiên Bàn quá 7 ngày.
- Các thao tác trừ/phát/nhận linh thạch đều dùng transaction và khóa hàng PostgreSQL.

## Kiểm tra
- `node --check server.js` OK
- `node --check script.js` OK
