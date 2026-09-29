# Hàn Thiên Môn v3.7.24

## Tiên Bàn
- Tỷ lệ vật phẩm thường được tính theo giá trị `price` của vật phẩm.
- Giá trị càng cao thì trọng số càng thấp.
- Trọng số dùng nghịch đảo căn bậc hai của giá trị để vật phẩm giá cao vẫn còn cơ hội nhận được nhưng khó hơn rõ rệt.
- Cửu Vĩ Thiên Hồ và Tiên Phẩm 0,002% vẫn giữ cơ chế tỷ lệ đặc biệt đã thiết lập; khi chọn vật phẩm trong nhóm Tiên Phẩm, cũng áp dụng trọng số theo giá trị.

## Ngũ Kiếm Kim Tiên
- Chỉ kích hoạt cho cảnh giới `Kim Tiên` (realm index 14).
- 5 thanh kiếm ánh sáng xanh xoay quanh viền ngoài ảnh đại diện.
- Kiếm có hình CSS, kim quang xanh và chuyển động orbit liên tục.
- Wrapper không đặt width/height cố định nên không làm thay đổi bố cục/kích thước ảnh đại diện cũ.
- Các cảnh giới Tiên Quân trở lên không bị áp dụng Ngũ Kiếm; hiệu ứng riêng của Tiên Đế/Chí Cao được giữ nguyên.
- Cache busting CSS/JS lên v3.7.24.
