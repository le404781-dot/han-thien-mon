# v3.7.86 – Quyền hủy bàn Tiên Mệnh cho thienha_666

- Chỉ username `thienha_666` được gọi endpoint `/api/tien-menh/admin/cancel-lobbies`.
- Hủy toàn bộ bàn Tiên Mệnh online đang ở trạng thái `lobby`.
- Hoàn lại toàn bộ Linh Thạch đã đặt cho từng Môn Nhân trong cùng transaction.
- Khóa các lobby bằng `FOR UPDATE` trước khi hoàn tiền/xóa, tránh race với join/cleanup.
- UI chỉ hiển thị nút quản trị cho `thienha_666`; server vẫn kiểm tra quyền độc lập.
- Không ảnh hưởng bàn `active` hoặc bàn đã kết thúc.
