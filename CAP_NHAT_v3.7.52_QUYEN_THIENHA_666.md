# Hàn Thiên Môn v3.7.52 — Quyền điều chỉnh cảnh giới

- Chỉ tài khoản `thienha_666` được cấp quyền điều chỉnh cảnh giới môn nhân khác.
- UI điều chỉnh chỉ được tạo trong modal khi username hiện tại chính xác là `thienha_666`.
- Backend kiểm tra lại username trong session; ẩn UI không được xem là cơ chế bảo mật duy nhất.
- Cho phép chọn 19 cảnh giới; cảnh giới thường 9 tầng, Tiên Đế 99 tinh, Chí Cao 9 tầng.
- Khi điều chỉnh, cập nhật đồng bộ `spirit_power`, `rank`, `realm_tier`, `position`.
- Không cho `thienha_666` tự chỉnh chính mình qua endpoint này.
- Xóa cache `/api/data` sau khi cập nhật để Đệ Tử Bảng phản ánh ngay.
- Bump cache frontend lên v3.7.52.
