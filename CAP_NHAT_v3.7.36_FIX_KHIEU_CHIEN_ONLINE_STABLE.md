# Hàn Thiên Môn v3.7.36 — Ổn định Khiêu Chiến Online

- Sửa luồng HP khi đối thủ ra chiêu: server là nguồn trạng thái duy nhất.
- Chặn sát thương/HP NaN hoặc không hợp lệ để không làm hỏng trạng thái trận.
- UPDATE lượt đánh yêu cầu đúng `turn_user_id` ngay tại câu lệnh ghi DB.
- Giữ transaction + `FOR UPDATE` để chống hai request cùng đánh một lượt.
- Poll trạng thái online mỗi 2 giây bằng endpoint nhẹ `/api/challenges/online/state`.
- Không còn dựng lại toàn bộ khu vực Khiêu Chiến chỉ vì HP thay đổi; HP, thanh máu, người đang có lượt và nhật ký chiêu được cập nhật trực tiếp.
- Chỉ tải lại toàn bộ Khiêu Chiến khi đổi lượt, đổi trận, đổi trạng thái hoặc DOM trận không còn tồn tại.
- Giảm truy vấn PostgreSQL và giảm lag trên iPhone/mạng di động.
- Giữ nguyên chọn ra chiêu, công pháp, Nhổ 1 ngụm nước bọt, rời lôi đài, cược và phần thưởng.
- `server.js` và `script.js` đã qua kiểm tra cú pháp Node.js.
