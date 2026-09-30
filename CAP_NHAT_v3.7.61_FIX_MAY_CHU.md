# v3.7.61 — FIX LỖI MÁY CHỦ / LÔI ĐÀI ONLINE

## Nguyên nhân kỹ thuật
Worker tự động kết thúc Lôi Đài ở bản trước đọc danh sách `status='accepted'` ngoài transaction. Khi Render có hai vòng worker/restart gần nhau, cùng một trận có thể bị nhiều worker lấy ra xử lý; việc phát thưởng/phạt và cập nhật trận có thể cạnh tranh và tạo lỗi server/transaction.

## Đã sửa
- Claim từng trận bằng `BEGIN` + `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`.
- Giữ khóa trong suốt quá trình tính thưởng/phạt/cược và chuyển `accepted -> completed`.
- Một trận chỉ được worker xử lý một lần tại một thời điểm.
- Lỗi của một trận được rollback và worker tiếp tục trận kế tiếp.
- Giữ nguyên API và giao diện Khiêu Chiến, Xem lại 3 phút, Nhổ 1 Ngụm Nước Bọt và hệ thống nhạc.
- Tăng cache version lên 3.7.61.

## Kiểm tra tĩnh
- `node --check server.js`: PASS
- `node --check script.js`: PASS
