# v3.8.06 — Fix bổ nhiệm Hội Trưởng + đồng bộ ảnh Đế Thú

- `thienha_666` có thể bãi nhiệm/bổ nhiệm Hội Trưởng bằng userId hoặc username.
- `/api/auction` trả danh sách môn nhân cho admin để giao diện không phụ thuộc endpoint đơn cấp phép.
- Đồng bộ cưỡng bức ảnh Lục Túc Phi Vũ Xà cho treasure item và phiên đấu giá đang active.
- Ảnh chuẩn: `/assets/images/luc-tuc-phi-vu-xa.jpeg?v=3.8.06`.
- Thêm fallback `onerror` để mọi môn nhân vẫn thấy đúng ảnh.
- Bust cache index/style/script/service worker lên v3.8.06.
