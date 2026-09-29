# Hàn Thiên Môn v3.7.42

## Thu hồi Tiên Đan về Tu Di Giới Đan Chủ

- Khi deploy lần đầu, migration `v3.7.42-recall-immortal-pills-to-dan-master` chạy một lần.
- Tìm Đan Chủ hiện tại trong `venue_roles` với `venue_code='dan-duong'`.
- Thu hồi toàn bộ stack trong `inventory` được phân loại `Tiên Đan` của các môn nhân khác, chuyển vào `inventory` của Đan Chủ.
- Không thu hồi stack của chính Đan Chủ.
- Nếu Tu Di Giới Đan Chủ thiếu ô, hệ thống tăng `storage_capacity` đúng số ô cần thiết để không làm mất Tiên Đan.
- Không hoàn linh thạch trong migration thu hồi.
- Schema hiện tại không lưu nguồn gốc của từng stack vật phẩm, nên migration thu hồi toàn bộ Tiên Đan hiện có của môn nhân khác; điều này bao phủ cả các stack mua trước đó.
- Nếu database chưa có Đan Chủ tại thời điểm deploy, migration không đánh dấu hoàn tất và sẽ thử lại ở lần khởi động tiếp theo.
