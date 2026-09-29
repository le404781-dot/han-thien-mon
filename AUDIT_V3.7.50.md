HÀN THIÊN MÔN v3.7.50 — KIỂM TRA/SỬA LỖI

Đã kiểm tra:
- Cú pháp server.js: OK (node --check)
- Cú pháp script.js: OK (node --check)
- package.json/render.yaml: tồn tại và nhất quán với Node + PostgreSQL + Render
- Asset JS/CSS/audio được tham chiếu từ index.html đều tồn tại
- Rà soát route API và các nhóm chức năng DB/schema
- Kiểm tra luồng FORCE cảnh giới v3.7.50

Sửa trong bản này:
1. FORCE cảnh giới v3.7.50:
   - Khi ép cảnh giới, đồng bộ luôn `position` theo cảnh giới mới.
   - Vẫn cập nhật `spirit_power`, `rank`, `realm_tier`, `spirit_root_foundation`.
   - Xóa `spirit_root_injury_until`.
   - Transaction rollback nếu thiếu tài khoản/hồ sơ mục tiêu.
   - Xóa cache /api/data sau khi sửa.
2. FORCE_CANH_GIOI.sql:
   - Tự bổ sung các cột cần thiết trước khi UPDATE.
   - Kiểm tra đủ cả users và profiles của 5 tài khoản trước khi COMMIT.
   - Nếu thiếu dữ liệu mục tiêu, PostgreSQL ROLLBACK toàn bộ thay vì cập nhật dở dang.
   - Đồng bộ chức vị `Tiên Môn Chí Tôn` cho 5 tài khoản được ép lên Thiên Tiên/Tiên Đế.

Giới hạn kiểm thử:
- Không có DATABASE_URL/PostgreSQL runtime của deployment trong file ZIP nên không thể chạy giao dịch thật trên DB của Render.
- Không tự ý thay đổi dữ liệu khác của người chơi ngoài 5 tài khoản đã được cấu hình trong FORCE v3.7.50.
