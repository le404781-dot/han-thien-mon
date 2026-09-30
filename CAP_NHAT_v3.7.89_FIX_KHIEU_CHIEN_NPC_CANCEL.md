# Hàn Thiên Môn v3.7.89 — Fix Khiêu Chiến Online + Hủy trận NPC

## 1. Khiêu Chiến Online
- Tách rõ 28 giây chuẩn bị khai chiến khỏi timer lượt.
- Sau countdown, server đặt lượt đầu cho bên khiêu chiến.
- Mỗi lượt có tối đa 30 giây.
- Người chơi đánh thủ công dùng cùng engine transaction với worker timeout.
- Hết 30 giây, worker tự chọn chiêu có sát thương cao nhất và xử lý đúng một lượt, không tự kết thúc toàn bộ trận.
- Mỗi lượt thành công tự đặt deadline 30 giây cho đối thủ.
- Kết thúc trận luôn xóa `turn_user_id` và `countdown_until`.
- Dùng `FOR UPDATE SKIP LOCKED` để tránh nhiều worker xử lý trùng cùng một lượt.
- Chặn thao tác thủ công sau khi deadline đã hết để tránh race với worker.
- Đồng bộ countdown trên client: 28 giây chỉ dùng cho chuẩn bị; 30 giây dùng cho lượt hiện tại.

## 2. Hủy trận Tiên Mệnh Offline NPC
- Người chơi đang có trận `mode='offline'` được nút `🛑 Hủy trận NPC`.
- Hủy trực tiếp từ server, không phụ thuộc trạng thái trình duyệt.
- Hoàn đúng stake một lần trong transaction.
- Chuyển trận sang `cancelled`, xóa lượt đang hoạt động và deadline.
- Ghi lịch sử hủy trận.
- NPC không thể gọi endpoint hủy.
- Không ảnh hưởng luồng rời bàn Tiên Mệnh Online.

## 3. Kiểm tra
- `node --check server.js`: OK
- `node --check script.js`: OK
- Kiểm tra consistency `countdown_until`: OK
- Kiểm tra completion clearing deadline: OK
- Kiểm tra route `/api/tien-menh/leave` phân nhánh offline/online: OK
- Runtime Express/PostgreSQL chưa chạy được trong môi trường đóng gói vì ZIP không chứa `node_modules`; không có dữ liệu production để test giao dịch thật.
