# v3.7.75 – Sửa lỗi file nhạc trên Render

- Rebuild audio delivery route with GET + HEAD + HTTP Range.
- Serve both /audio/* and /assets/audio/* through the same verified files.
- Add /api/audio-health for exact asset existence/size diagnostics.
- Disable caching for audio responses.
- Client tries new route first, then legacy route and alternate codecs.
- Audio remains lazy-loaded only after Khởi Nhạc.
