# Hàn Thiên Môn v3.7.88 — Tiên Mệnh: NPC / 30s / Chat / Smooth

## 1. Quyền riêng `thienha_666`
- Thêm nút `🔓 Khóa đánh với NPC` / `🔒 Mở đánh với NPC` trong khu quản trị Tiên Mệnh.
- Server kiểm tra username `thienha_666`, không chỉ ẩn nút ở giao diện.
- Trạng thái được lưu ở `tien_menh_settings.npc_enabled`.
- Khi khóa, ván offline NPC mới bị từ chối; các ván đang chạy không bị cưỡng bức dừng.

## 2. Giới hạn lượt 30 giây
- Thêm `turn_deadline_at`.
- Mỗi lượt người thật có tối đa 30 giây.
- Đồng hồ đếm ngược chạy ở client mỗi 250ms, không render lại bàn.
- Server kiểm tra deadline để chặn thao tác đến muộn.
- Background server xử lý lượt hết giờ độc lập với trình duyệt:
  - Có lời tuyên bố đang chờ Bắt Vọng: tự động Bắt Vọng.
  - Chưa có tuyên bố: tự động đặt 1 Linh Bài đầu tiên.
- Sau xử lý tự động, lượt mới lại được cấp tối đa 30 giây.
- NPC không bị chờ 30 giây; NPC tiếp tục xử lý ngay.

## 3. Chat riêng trong bàn
- Thêm bảng `tien_menh_chat`, xóa cascade theo bàn.
- Chỉ người đang ở bàn mới đọc/gửi được chat bàn.
- Chat chỉ mở khi bàn `active`.
- Giới hạn 240 ký tự.
- Chỉ tải tối đa 30 tin gần nhất.
- Poll Tiên Mệnh 5 giây chỉ rerender khi state/chat thực sự đổi.

## 4. Tối ưu mượt
- Không dùng timer đếm ngược để rerender DOM.
- Countdown chỉ cập nhật text/class của đồng hồ.
- Polling vẫn một vòng Tiên Mệnh duy nhất.
- Không tăng polling khi mở chat bàn.
- Chat bàn dùng bảng riêng, không truy vấn 100 tin Chat Tổng.

## 5. An toàn database
- Migration idempotent.
- Index deadline phục vụ worker hết giờ.
- Transaction + row lock giữ nguyên cho thao tác game.
- Chat tự xóa theo `ON DELETE CASCADE` khi bàn bị cleanup.
