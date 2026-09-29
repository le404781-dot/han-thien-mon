# Hàn Thiên Môn v3.7.27

- Thêm compression middleware với ngưỡng 1 KB, tự đàm phán Brotli/Gzip.
- Giữ ETag/Last-Modified và Cache-Control hiện có; static assets production cache 30 ngày.
- Giữ Keep-Alive 120s hiện tại.
- Không minify runtime/source để tránh tăng CPU và rủi ro lỗi; JSON của Express vốn đã compact.
- Không ép pagination cho endpoint nhỏ; chỉ nên áp dụng khi danh sách thực tế lớn.
- Thanh thông báo nhận thưởng hiển thị 3,5 giây.
