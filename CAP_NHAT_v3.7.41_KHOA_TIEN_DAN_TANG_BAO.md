# Hàn Thiên Môn v3.7.41 — Khóa Tiên Đan Tàng Bảo Các

- Tàng Bảo Các dùng chung `alchemy_shop_settings.immortal_pills_unlocked` với Đan Pháp.
- Khi khóa, mọi vật phẩm có category kết thúc bằng `Tiên Đan` không thể mua từ `/api/treasury/buy`.
- Kiểm tra khóa nằm phía server trước khi trừ linh thạch và thêm vật phẩm vào Tu Di Giới.
- `/api/treasury` trả về `immortalPillsUnlocked` để frontend hiển thị trạng thái.
- Frontend vô hiệu hóa nút mua và số lượng của mọi Tiên Đan khi khóa.
- Chỉ endpoint `/api/dan-phap/tien-dan-lock` mới có quyền thay đổi khóa; endpoint này tiếp tục yêu cầu đúng Đan Chủ.
- Không reset trạng thái mở khóa khi restart/deploy; migration v3.7.41 chỉ bảo đảm bảng/setting tồn tại.
- Các Tiên Đan đã sở hữu không bị xóa.
