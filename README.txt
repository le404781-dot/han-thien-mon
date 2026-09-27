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


Bản v3.0: đổi linh lực nhận vật phẩm, Tu Di Giới, Hàn Thiên Ký Sự, Chức Vị theo cảnh giới, Tông chủ: Thiên Gia Đạo.


=== HÀN THIÊN MÔN v3.6.74 · TU DI / TIÊN QUÂN / ĐAN ĐƯỜNG ===
- Web server bind 0.0.0.0 và đọc PORT từ Render (mặc định 10000).
- HTTP listener mở trước khi chạy PostgreSQL schema initialization, tránh lỗi Port scan timeout khi startup/migration lâu.
- Thêm GET /health: 503 khi đang khởi động/chưa sẵn sàng DB; 200 khi PostgreSQL sẵn sàng.
- render.yaml đặt healthCheckPath: /health.
- Giữ /api/health để tương thích client cũ.
- Thêm graceful shutdown cho SIGTERM/SIGINT và đóng PostgreSQL pool.
- Keep-alive/header timeout được cấu hình để phù hợp web service Node.js.
- Mục tiêu vận hành khoảng 50 người dùng đồng thời ở mức tải thông thường; không phải cam kết 50 người spam realtime/combat/chat liên tục.


=== v3.6.75 · MỞ TOÀN TÔNG + CHỨC CHỦ + TỐI ƯU DB ===
- Mở Tửu Lâu, Đan Đường, Chợ Đen cho toàn bộ môn nhân đã đăng nhập.
- Ngộ Túy tại Tửu Lâu: nhận túy phẩm và dùng Ngộ Túy để tăng linh lực theo khoảng buff.
- Chợ Đen Chi Chủ: ứng chức nhanh nhất, duy nhất, có cơ chế nhường vị; nhận 20% giá trị mỗi lần thu mua thành công; aura hắc sắc động.
- Đan Chủ: ứng chức nhanh nhất, duy nhất, có cơ chế nhường vị; nhận 20% giá trị mỗi lần đổi thành công tại Đan Đường; aura bạch sắc động.
- Ghim nhanh Chợ Đen, Dược Đường, Tửu Lâu bằng nút 📌 và thanh ghim lưu trong trình duyệt.
- Tối ưu PostgreSQL: giảm pool mặc định, thêm partial index cho kho đang có vật phẩm, dọn session/mailbox/kho 0 định kỳ, giới hạn lưu lịch sử Chợ Đen 90 ngày.
