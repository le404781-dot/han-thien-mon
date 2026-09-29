# Hàn Thiên Môn v3.7.44

- Xóa toàn bộ Tiên Đế Đan (`category` Tiên Đan, `min_realm=17`) khỏi Tu Di Giới của mọi môn nhân trừ Đan Chủ.
- Hủy toàn bộ Khiêu Chiến Online đang `pending` hoặc `accepted`; hoàn lại cược mở.
- Đặt linh thạch chính xác:
  - Cuu_Vi_Ho: 229,147,161,840
  - Reytheon: 150,896,940,297
- Migration chạy một lần, trong transaction; nếu thiếu tài khoản mục tiêu thì rollback toàn bộ.
