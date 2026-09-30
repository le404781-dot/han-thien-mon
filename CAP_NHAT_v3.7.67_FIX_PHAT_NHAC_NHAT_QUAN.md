# v3.7.67 — Cơ chế phát nhạc nền kiểu trình phát web

## Thay đổi
- Dùng một HTMLAudioElement duy nhất xuyên suốt trang.
- Không còn thay `<audio>` mới khi bấm Khởi Nhạc.
- Không gọi `/api/audio-health`, `fetch`, `setTimeout` hay thao tác bất đồng bộ nào trước `audio.play()`.
- Không gọi `load()` lặp lại.
- Trình duyệt tự chọn codec qua `<source>`: MP3 → AAC/M4A → OGG/Opus → WebM/Opus.
- `preload="auto"` để trình duyệt có thể chuẩn bị dữ liệu nhạc trước khi người dùng bấm phát.
- Nút Khởi Nhạc gọi `audio.play()` trực tiếp trong chính thao tác chạm/click.
- Trình phát native vẫn hiển thị trên trang.
- Vẫn có loop, âm lượng, Media Session và nút dừng.
- Không tự động gọi `play()` chỉ vì localStorage từng lưu trạng thái đang phát; người dùng cần chạm Khởi Nhạc/▶ một lần.

## Mục tiêu
Cơ chế này để browser tự xử lý media như các trình phát nhạc web thông thường, giảm tối đa JavaScript trung gian có thể làm mất user activation hoặc làm audio bị reload liên tục.

## Lưu ý
Không thể ép trình duyệt/OS phát âm thanh tự động khi chính sách autoplay hoặc thiết bị chặn âm thanh. Sau một lần chạm Khởi Nhạc/▶, audio được phát trực tiếp trong trang.
