# Hàn Thiên Môn v3.7.37 – Audit/Fix Trang Bị

- GET `/api/equipment` không chạy DDL hoặc UPDATE tự sửa dữ liệu.
- Chặn request khi database chưa ready, trả 503 để Safari hiện nút Thử lại.
- Giảm timeout cache client Trang Bị xuống 2 giây để không giữ trạng thái cũ.
- Trả đầy đủ `beast`, `root`, `artifact`, `immortalArtifact`, và các ID Tiên Pháp đang trang bị.
- Sau khi trang bị vật phẩm, tải lại cả hồ sơ và Trang Bị.
- Cache-busting JS/CSS lên v3.7.37.
