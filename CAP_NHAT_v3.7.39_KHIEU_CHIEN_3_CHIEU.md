# Hàn Thiên Môn v3.7.39

- Hủy toàn bộ lôi đài online cũ khi migration v3.7.39 chạy lần đầu và hoàn cược đang mở.
- Làm lại luồng chiêu online bằng 3 chiêu cố định: Hàn Phong Trảm, Thiên Lôi Phá, Cửu Thiên Diệt.
- Sát thương được tính deterministic tại lúc khai mở lôi đài, tăng theo cảnh giới/tầng và chênh lệch cảnh giới; số damage hiển thị trên 3 nút khớp server.
- Nút 🤖 Tự động đánh luôn hiển thị trong khung trận; khi bật sẽ tự chọn chiêu có damage cao nhất khi tới lượt.
- Cache-bust frontend lên v3.7.39 để iPhone không dùng script cũ.
- Bổ sung guard shutdown DB để tránh request khởi tạo/retry chạm pool sau khi pool.end().
- Giữ giới hạn 30 lượt khiêu chiến / 24 giờ.
