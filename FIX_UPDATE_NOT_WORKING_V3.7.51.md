# Hàn Thiên Môn v3.7.51 — Fix chức năng/cập nhật mới không hoạt động

## Lỗi chính đã xác định

### 1. Cache JS/CSS production giữ mã cũ
`server.js` từng đặt JS/CSS là `immutable` trong 30 ngày, trong khi URL asset vẫn có thể giữ cùng query version. Khi Render deploy mã mới, Safari/iPhone có thể tiếp tục chạy `script.js`/`style.css` cũ.

**Đã sửa:**
- JS/CSS dùng `Cache-Control: no-cache, must-revalidate` để luôn revalidate.
- HTML đổi asset version từ `3.7.50` → `3.7.51`.
- Audio source cũng đổi version `3.7.28` → `3.7.51` để tránh giữ file media cũ.

### 2. Frontend gọi API quá sớm khi PostgreSQL còn đang migration
Render mở HTTP port trước khi `initializeDatabaseWithRetry()` hoàn tất. Các API đầu tiên có thể trả HTTP 503 trong lúc DB đang khởi tạo. Frontend trước đây chỉ thử một lần ở nhiều luồng, khiến chức năng mới có thể hiện lỗi cho tới lần tải lại/chu kỳ dài tiếp theo.

**Đã sửa:**
- `api()` tự retry các lỗi 502/503/504 với backoff: 0ms, 700ms, 1400ms, 2500ms.
- Không retry các lỗi nghiệp vụ 400/401/403/404.
- Chu kỳ đồng bộ nền chính giảm từ 180 giây xuống 30 giây.

### 3. Kiểm tra lại syntax sau patch
- `node --check server.js`: OK
- `node --check script.js`: OK

## Giới hạn
Không có `DATABASE_URL`/quyền truy cập PostgreSQL Render trong môi trường kiểm tra nên không thể thực hiện giao dịch thật trên database production. Các sửa đổi DB hiện có vẫn được giữ nguyên; bản này tập trung sửa lỗi khiến code mới không được tải/chạy hoặc bị gọi đúng lúc DB chưa sẵn sàng.
