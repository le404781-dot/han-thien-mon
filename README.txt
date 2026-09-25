HÀN THIÊN MÔN — BẢN MỞ RỘNG

Node.js + Express + PostgreSQL.

Tính năng:
- Đăng ký / đăng nhập / đăng xuất
- Hồ sơ đệ tử
- Cảnh giới tu luyện + linh lực + vận công
- Môn phái Hàn Thiên Môn
- Chat tổng lưu trong PostgreSQL
- Ký ức và môn sử
- Bảng thành tích + huy hiệu
- Giao diện tiên hiệp, responsive cho iPhone

Render:
Build Command: npm install
Start Command: npm start
Environment:
DATABASE_URL=<Internal Database URL của PostgreSQL>
NODE_ENV=production

Lưu ý: không đưa DATABASE_URL lên GitHub hoặc chia sẻ công khai.


v2.8 cập nhật: Tụ Di Giới 30 ô chứa vật phẩm; đan dược/pháp bảo mua thành công tự động vào Tụ Di Giới; random Linh Căn + Linh Thú; mua Tàng Bảo Các dùng trực tiếp linh thạch và chặn khi kho đầy.


=== HÀN THIÊN MÔN v2.9 ===
- Tàng Bảo Các: vật phẩm thanh toán trực tiếp bằng LINH LỰC, không dùng linh thạch.
- Gacha Linh Căn/Linh Thú: mỗi tài khoản chỉ được gieo duyên 1 lần.
- Linh Căn có độ hiếm và hệ số phụ trợ tu luyện.
- Linh Thú có độ hiếm và thuộc tính Công kích/Phòng ngự/Thân pháp/Linh lực/Thiên phú.
- Có bảng Phụ Trợ hiển thị ảnh hưởng của Linh Căn và Linh Thú.
- Tu luyện nhận thêm hiệu quả theo độ hiếm Linh Căn.
- Không tạo PostgreSQL mới; initDb tự thêm cột cần thiết.
