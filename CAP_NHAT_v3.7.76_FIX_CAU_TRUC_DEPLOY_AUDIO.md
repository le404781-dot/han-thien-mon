HÀN THIÊN MÔN v3.7.76

Sửa lỗi audio Render do gói v3.7.75 bị đóng gói bên trong thư mục htm775audio/.
Render đang chạy __dirname=/opt/render/project/src nên assets/audio không nằm đúng tại /opt/render/project/src/assets/audio.

v3.7.76 đóng gói FLAT: package.json, server.js, index.html, assets/, icons/, ... nằm ngay ở thư mục gốc ZIP.

Kiểm tra bắt buộc sau Deploy:
GET /api/audio-health -> ok:true và exists:true cho MP3/M4A/OGG/WebM.
GET /audio/tinh-ve-background.mp3 -> HTTP 200 hoặc 206, Content-Type audio/mpeg, có Accept-Ranges: bytes.
