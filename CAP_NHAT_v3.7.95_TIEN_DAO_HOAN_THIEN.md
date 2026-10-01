# Hàn Thiên Môn v3.7.95 — Hoàn thiện Tiên Dao

- Hội thoại Dạ Nguyệt/Bạch Nguyệt được mở rộng theo chủ đề, mức thân mật, tin tưởng và mạch hội thoại gần nhất.
- Thêm gợi ý câu hỏi nhanh sau mỗi lượt.
- Giữ ký ức theo từng NPC/từng môn nhân và giới hạn dữ liệu để tránh phình DB.
- Bỏ phụ thuộc khóa vùng Tiên Dao vào khóa vùng Đan Đường; Tiên Dao dùng khóa vùng riêng.
- Làm sạch index hội thoại cũ và thêm index truy vấn sự kiện.
- Giữ kiểm soát quyền ở server, không tin dữ liệu từ client.
- Giới hạn nội dung 600 ký tự, chống gửi lặp quá nhanh và giữ transaction toàn vẹn.
- Cache-busting lên 3.7.95.
