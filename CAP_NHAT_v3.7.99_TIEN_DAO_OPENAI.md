# v3.7.99 — Tiên Dao dùng OpenAI API + giảm tải PostgreSQL

- Dạ Nguyệt và Bạch Nguyệt trả lời bằng OpenAI Responses API ở server.
- API key chỉ nằm trong biến môi trường `OPENAI_API_KEY`, không gửi xuống trình duyệt.
- Mặc định dùng `gpt-5.6-luna`; có thể đổi bằng `OPENAI_TIEN_DAO_MODEL`.
- Giữ khóa vùng, quyền Đan Chủ và cooldown 15 giây.
- Không ghi `tien_dao_events` cho từng câu chat nữa. Events chỉ còn cho luồng quyền/lời mời.
- Chỉ lưu tối đa 24 dòng chat/NPC (12 lượt) và 30 memory/NPC.
- Chỉ lưu memory khi tin nhắn đủ dài hoặc có dấu hiệu người chơi muốn ghi nhớ.
- OpenAI được gọi ngoài transaction để không giữ connection PostgreSQL trong thời gian chờ AI.
- Nếu OpenAI lỗi, server trả 502 thay vì tự giả mạo như AI.

## Render
Thêm Environment Variables:
`OPENAI_API_KEY` = API key OpenAI của chủ game
`OPENAI_TIEN_DAO_MODEL` = `gpt-5.6-luna` (hoặc model OpenAI mà tài khoản được cấp quyền)
`OPENAI_TIEN_DAO_TIMEOUT_MS` = `25000`
