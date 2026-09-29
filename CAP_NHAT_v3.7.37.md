# Hàn Thiên Môn v3.7.37

- Fix lỗi PostgreSQL `inconsistent types deduced for parameter $4` trong Đan Pháp (Tiên Đan seed).
- Khiêu Chiến Online: giới hạn 30 lượt / 24 giờ.
- Thêm nút `🤖 TỰ ĐỘNG ĐÁNH` cho Lôi Đài Online; tự ra chiêu khi tới lượt, dùng công pháp đang trang bị mặc định.
- Hủy một lần các lôi đài Online cũ khi migration v3.7.37 chạy; hoàn lại cược mở.
- Giữ transaction/khóa lượt để tránh đánh trùng.
