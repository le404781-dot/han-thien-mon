# Hàn Thiên Môn v3.7.38 — Stable Khiêu Chiến Online

- Fix Render `Cannot use a pool after calling end on the pool` bằng graceful shutdown: dừng background timers trước `pool.end()`, chặn retry DB sau SIGTERM/SIGINT, chỉ đóng pool một lần.
- Khiêu Chiến Online chỉ đọc `activeBattle` từ request `mode='online'`.
- Tạo migration `v3.7.38-clear-online-challenges-and-repair`: hủy lôi đài online pending/accepted đang tồn tại khi bản mới khởi động lần đầu; hoàn lại toàn bộ cược mở và tạo thông báo hoàn cược.
- Giữ giới hạn 30 lượt / 24 giờ.
- Tăng độ ổn định đồng bộ lượt/HP bằng row lock + điều kiện `turn_user_id` ở UPDATE.
- Nút `🤖 TỰ ĐỘNG ĐÁNH` luôn được render trong khu vực lôi đài online, kể cả khi chưa tới lượt.
- Khi chấp nhận lôi đài, client nhận battle snapshot trực tiếp từ response để hiển thị nút ngay, không phụ thuộc vòng polling đầu tiên.
- Trạng thái tự động đánh được giữ trong phiên trình duyệt bằng localStorage; trận kết thúc sẽ tự tắt.
- Auto attack tiếp tục dùng endpoint server kiểm tra lượt, công pháp và sát thương; request trùng không thể ghi đè lượt.
