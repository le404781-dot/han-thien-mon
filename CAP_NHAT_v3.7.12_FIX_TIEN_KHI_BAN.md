# v3.7.12 – Fix lỗi không bán/ thanh lý được Tiên Khí

## Nguyên nhân xác định từ log Render
- Log báo `integer out of range` và PostgreSQL routine `int4pl`. Đây là phép cộng của kiểu `integer` (INT4).
- `profiles.spirit_stones` của bản cũ là `INTEGER`, giới hạn 2.147.483.647. Khi số linh thạch hiện có + tiền bán Tiên Khí vượt giới hạn, PostgreSQL rollback giao dịch nên người chơi thấy Tiên Khí không bán được.

## Đã sửa
- Tự động chuyển `profiles.spirit_stones` từ `INTEGER` → `BIGINT` khi server khởi động, giữ nguyên dữ liệu hiện có.
- Các route cộng linh thạch sau bán/thu mua dùng phép cộng BIGINT rõ ràng.
- `treasure_items.price` và `buyback_price` cũng được nâng lên `BIGINT` để không khóa các Tiên Khí giá trị cao trong tương lai.
- Giữ nguyên giá bán/giá thanh lý của Tiên Khí; không giảm giá vì bản sửa lỗi.
- Không cho bán bản Tiên Khí đang trang bị; nếu có nhiều bản thì vẫn bán được các bản chưa trang bị.
