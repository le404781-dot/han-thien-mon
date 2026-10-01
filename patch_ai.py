from pathlib import Path
p=Path('/mnt/data/v399/server.js')
s=p.read_text()
# Add OpenAI config after pool declaration block
needle="let pool = null;\nlet poolClosed = false;"
insert="""let pool = null;
let poolClosed = false;
// Tiên Dao AI: gọi OpenAI từ server בלבד; tuyệt đối không đưa API key xuống trình duyệt.
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_TIEN_DAO_MODEL = String(process.env.OPENAI_TIEN_DAO_MODEL || 'gpt-5.6-luna').trim();
const OPENAI_TIEN_DAO_TIMEOUT_MS = Math.max(8000, Math.min(45000, Number(process.env.OPENAI_TIEN_DAO_TIMEOUT_MS || 25000)));
"""
assert needle in s
s=s.replace(needle,insert,1)
# Insert AI helper before tienDaoReply
needle="function tienDaoReply(npc, message, rel, memories, other, recentMessages=[]){"
helper=r'''function tienDaoSystemPrompt(npc){
  const common = `
Ngươi đang đóng vai một nhân vật trong game tiên hiệp Hàn Thiên Môn.
Đây là đối thoại nhập vai với một môn nhân. Không nói rằng ngươi là AI, mô hình, ChatGPT, API hay hệ thống.
Giữ tính liên tục với ký ức được cung cấp nhưng không bịa ra ký ức không có trong ngữ cảnh.
Trả lời bằng tiếng Việt tự nhiên, giàu cảm xúc vừa phải, như một người thật đang trò chuyện; không trả lời máy móc theo mẫu.
Không dùng markdown dài, không liệt kê vô cớ, không lặp lại nguyên văn lời người chơi.
Ưu tiên 1-4 câu, thường dưới 120 từ. Khi người chơi tâm sự, hãy phản hồi cảm xúc trước rồi mới góp ý.
Không tự ý thay đổi số liệu game, vật phẩm, cảnh giới hoặc quy tắc hệ thống. Nếu thiếu dữ liệu game, nói rõ cần biết thêm.
`;
  if(npc.code==='da_nguyet') return common + `
Nhân vật: Dạ Nguyệt.
Vai trò: Chưởng quầy Đan Đường.
Tính cách: đáng yêu, tinh nghịch, thân thiện, tinh tế; đôi lúc trêu nhẹ nhưng không lố.
Cách nói: mềm mại, tự nhiên, có chút tiên hiệp nhưng không cổ văn nặng. Khi thân thiết, có thể gọi người chơi là đạo hữu hoặc dùng cách xưng hô gần gũi hơn.`;
  return common + `
Nhân vật: Bạch Nguyệt.
Vai trò: Chưởng quầy Đan Pháp.
Tính cách: nghiêm khắc, điềm tĩnh, uyên bác, quan sát tinh tế; bên ngoài lạnh nhưng không vô cảm.
Cách nói: ngắn gọn, chính xác, bình tĩnh. Khi đã có lòng tin, thể hiện sự quan tâm kín đáo thay vì đột ngột trở nên sến súa.`;
}
function extractOpenAIText(data){
  if(typeof data?.output_text==='string' && data.output_text.trim()) return data.output_text.trim();
  const chunks=[];
  for(const item of (Array.isArray(data?.output)?data.output:[])){
    for(const part of (Array.isArray(item?.content)?item.content:[])){
      if(typeof part?.text==='string' && part.text.trim()) chunks.push(part.text.trim());
    }
  }
  return chunks.join('\n').trim();
}
async function tienDaoOpenAIReply(npc, message, rel, memories, other, recentMessages=[]){
  if(!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY chưa được cấu hình.');
  const memoryLines=(memories||[]).slice(0,6).map(x=>`- ${String(x.memory_value||'').slice(0,160)}`).filter(Boolean);
  const recent=(recentMessages||[]).slice(-6).map(x=>`${x.role==='user'?'Môn nhân':'Nhân vật'}: ${String(x.content||'').slice(0,700)}`);
  const context = [
    `Quan hệ hiện tại: thân mật ${Number(rel?.intimacy||0)}/100, tin tưởng ${Number(rel?.trust||0)}/100, cảm xúc ${String(rel?.emotion||'bình thản')}.`,
    `Mối quan hệ giữa hai chưởng quầy: ${Number(other?.affinity||50)}/100.`,
    memoryLines.length ? `Ký ức ngắn hạn đã lưu:\n${memoryLines.join('\n')}` : 'Chưa có ký ức dài hạn đáng kể.',
    recent.length ? `Một vài lượt gần đây:\n${recent.join('\n')}` : 'Đây là lượt đầu tiên trong mạch hội thoại hiện tại.',
    `Tin nhắn mới của môn nhân: ${String(message).slice(0,600)}`
  ].join('\n\n');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),OPENAI_TIEN_DAO_TIMEOUT_MS);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:OPENAI_TIEN_DAO_MODEL,
        instructions:tienDaoSystemPrompt(npc),
        input:context,
        max_output_tokens:300
      }),
      signal:controller.signal
    });
    const raw=await response.text();
    let data={}; try{data=JSON.parse(raw)}catch{}
    if(!response.ok) throw new Error(`OpenAI ${response.status}: ${String(data?.error?.message||raw).slice(0,500)}`);
    const reply=extractOpenAIText(data);
    if(!reply) throw new Error('OpenAI trả về nội dung rỗng.');
    return reply.slice(0,1800);
  }finally{clearTimeout(timer);}
}
function tienDaoReply(npc, message, rel, memories, other, recentMessages=[]){'''
assert needle in s
s=s.replace(needle,helper,1)
# GET message retention 24
s=s.replace("ORDER BY id DESC LIMIT 40`,[uid,code])).rows.reverse();","ORDER BY id DESC LIMIT 24`,[uid,code])).rows.reverse();",1)
# Replace route from post to before next let
start=s.index("app.post('/api/tien-dao/conversation/:npc'")
end=s.index("let __ensureRedPacketSchemaPromise=null;", start)
new_route=r'''app.post('/api/tien-dao/conversation/:npc',auth,async(req,res)=>{
  const client=await dbConnect();
  try{
    await ensureTienDaoSchema();
    const uid=req.session.user_id;
    if(!(await tienDaoRegionAccessFor(client,uid))) return res.status(403).json({error:tienDaoRegionLockMessage(),regionLocked:true});
    if(!OPENAI_API_KEY) return res.status(503).json({error:'Tiên Dao AI chưa được cấu hình OPENAI_API_KEY trên máy chủ.',aiNotConfigured:true});
    const code=req.params.npc==='bach_nguyet'?'bach_nguyet':'da_nguyet';
    const message=String(req.body?.message||'').trim().slice(0,600);
    if(!message) return res.status(400).json({error:'Nội dung đối thoại không được trống.'});

    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[`tien-dao:${uid}:${code}`]);
    const access=(await client.query(`
      SELECT s.open,
        EXISTS(SELECT 1 FROM venue_roles vr WHERE vr.venue_code='dan-duong' AND vr.user_id=$1) AS is_owner,
        EXISTS(SELECT 1 FROM tien_dao_events e WHERE e.user_id=$1 AND e.npc_code=$2 AND e.event_key LIKE 'access_granted:%' AND e.created_at>NOW()-INTERVAL '30 minutes') AS granted
      FROM tien_dao_settings s WHERE s.singleton_id=1
    `,[uid,code])).rows[0]||{open:true,is_owner:false,granted:false};
    if(!(access.open!==false||access.is_owner||access.granted)){
      await client.query('ROLLBACK');
      return res.status(403).json({error:'Quầy đang đóng. Hãy gửi lời mời Đan Chủ trước.',needsInvite:true});
    }
    const latest=(await client.query(`SELECT created_at FROM tien_dao_conversations WHERE user_id=$1 AND npc_code=$2 ORDER BY id DESC LIMIT 1`,[uid,code])).rows[0];
    if(latest?.created_at){
      const elapsed=Date.now()-new Date(latest.created_at).getTime();
      if(elapsed<15000){
        await client.query('ROLLBACK');
        const remain=Math.max(1,Math.ceil((15000-elapsed)/1000));
        return res.status(429).json({error:`Đối thoại đang hồi. Hãy chờ ${remain}s rồi nói tiếp.`,cooldown:remain});
      }
    }
    const rel=(await client.query(`
      INSERT INTO tien_dao_relationships(user_id,npc_code) VALUES($1,$2)
      ON CONFLICT(user_id,npc_code) DO UPDATE SET updated_at=NOW()
      RETURNING intimacy,trust,emotion,interaction_count
    `,[uid,code])).rows[0];
    const [memRes,otherRes,recentRes]=await Promise.all([
      client.query(`SELECT memory_key,memory_value,importance FROM tien_dao_memory WHERE user_id=$1 AND npc_code=$2 ORDER BY importance DESC,updated_at DESC LIMIT 6`,[uid,code]),
      client.query(`SELECT affinity FROM tien_dao_npc_relationships WHERE npc_a=$1 AND npc_b=$2`,[code,code==='da_nguyet'?'bach_nguyet':'da_nguyet']),
      client.query(`SELECT role,content FROM tien_dao_conversations WHERE user_id=$1 AND npc_code=$2 ORDER BY id DESC LIMIT 6`,[uid,code])
    ]);
    const memories=memRes.rows, other=otherRes.rows[0]||{affinity:50}, recentMessages=recentRes.rows.reverse();
    const npc=tienDaoNpc(code), low=message.toLowerCase();
    const intimacy=Math.min(100,Number(rel.intimacy||0)+(message.length>12?2:1));
    const trust=Math.min(100,Number(rel.trust||0)+(/cảm ơn|tin|giúp|giúp đỡ|xin lỗi/.test(low)?2:1));
    const emotion=/cảm ơn|vui|hạnh phúc|haha|đùa/.test(low)?'vui':/buồn|xin lỗi|thất vọng|lo lắng|mệt/.test(low)?'trầm':'bình thản';

    // AI được gọi ngoài transaction để không giữ connection DB trong lúc chờ OpenAI.
    await client.query('COMMIT');
    let reply;
    try{
      reply=await tienDaoOpenAIReply(npc,message,{...rel,intimacy,trust},memories,other,recentMessages);
    }catch(aiErr){
      console.error('tien-dao OpenAI:',aiErr);
      return res.status(502).json({error:'Không thể kết nối Tiên Dao AI lúc này. Hãy thử lại sau.',aiUnavailable:true});
    }

    // Chỉ ghi tối thiểu sau khi AI trả lời thành công: 2 message + tối đa 1 memory quan trọng.
    await client.query('BEGIN');
    await client.query(`INSERT INTO tien_dao_conversations(user_id,npc_code,role,content,emotion,intimacy,trust) VALUES($1,$2,'user',$3,$4,$5,$6),($1,$2,'npc',$7,$4,$5,$6)`,[uid,code,message,emotion,intimacy,trust,reply]);
    await client.query(`UPDATE tien_dao_relationships SET intimacy=$3,trust=$4,emotion=$5,interaction_count=interaction_count+1,updated_at=NOW() WHERE user_id=$1 AND npc_code=$2`,[uid,code,intimacy,trust,emotion]);
    // Chỉ lưu memory nếu người chơi gửi nội dung đủ ý nghĩa; không tạo event cho từng câu chat.
    const shouldRemember=message.length>=28 || /nhớ|ghi nhớ|ta thích|ta ghét|mục tiêu|ước mơ|sợ|lo lắng|quan trọng|đừng quên/.test(low);
    if(shouldRemember){
      const key=`memory_${Date.now()}`;
      await client.query(`INSERT INTO tien_dao_memory(npc_code,user_id,memory_key,memory_value,importance) VALUES($1,$2,$3,$4,$5)`,[code,uid,key,message.slice(0,180),Math.min(10,2+(message.length>80?2:0))]);
    }
    // DB footprint nhỏ: giữ tối đa 12 lượt tin nhắn (24 dòng) và 30 ký ức/NPC.
    await client.query(`DELETE FROM tien_dao_conversations c WHERE c.user_id=$1 AND c.npc_code=$2 AND c.id IN (SELECT id FROM tien_dao_conversations WHERE user_id=$1 AND npc_code=$2 ORDER BY id DESC OFFSET 24)`,[uid,code]);
    await client.query(`DELETE FROM tien_dao_memory m WHERE m.user_id=$1 AND m.npc_code=$2 AND m.memory_key IN (SELECT memory_key FROM tien_dao_memory WHERE user_id=$1 AND npc_code=$2 ORDER BY importance DESC,updated_at DESC OFFSET 30)`,[uid,code]);
    await client.query('COMMIT');
    const thought=code==='da_nguyet'
      ?(trust>=55?'“Dạ Nguyệt cảm thấy hai người đã khá hiểu nhau, nên đáp lại chân thành hơn.”':'“Dạ Nguyệt muốn lắng nghe thêm trước khi trêu chọc.”')
      :(trust>=55?'“Bạch Nguyệt đã có đủ tin tưởng để luận sâu hơn.”':'“Bạch Nguyệt vẫn đang quan sát và tìm hiểu người đối diện.”');
    res.json({ok:true,reply,thought,relationship:{intimacy,trust,emotion},npc,suggestions:tienDaoSuggestions(npc,message,{intimacy,trust,emotion}),cooldown:15,ai:true,model:OPENAI_TIEN_DAO_MODEL});
  }catch(e){
    try{await client.query('ROLLBACK')}catch{}
    console.error('tien-dao dialogue:',e);
    res.status(500).json({error:'Đối thoại Tiên Dao thất bại.'});
  }finally{client.release();}
});
'''
s=s[:start]+new_route+s[end:]
# version
p.write_text(s)

import json
pkg=Path('/mnt/data/v399/package.json')
data=json.loads(pkg.read_text()); data['version']='3.7.99'; pkg.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
idx=Path('/mnt/data/v399/index.html'); t=idx.read_text().replace('v=3.7.98','v=3.7.99'); idx.write_text(t)

# Add env example + changelog
Path('/mnt/data/v399/.env.example').write_text('''# Tiên Dao AI - đặt trên Render Environment, KHÔNG commit API key thật\nOPENAI_API_KEY=sk-...\nOPENAI_TIEN_DAO_MODEL=gpt-5.6-luna\nOPENAI_TIEN_DAO_TIMEOUT_MS=25000\n''')
Path('/mnt/data/v399/CAP_NHAT_v3.7.99_TIEN_DAO_OPENAI.md').write_text('''# v3.7.99 — Tiên Dao dùng OpenAI API + giảm tải PostgreSQL\n\n- Dạ Nguyệt và Bạch Nguyệt trả lời bằng OpenAI Responses API ở server.\n- API key chỉ nằm trong biến môi trường `OPENAI_API_KEY`, không gửi xuống trình duyệt.\n- Mặc định dùng `gpt-5.6-luna`; có thể đổi bằng `OPENAI_TIEN_DAO_MODEL`.\n- Giữ khóa vùng, quyền Đan Chủ và cooldown 15 giây.\n- Không ghi `tien_dao_events` cho từng câu chat nữa. Events chỉ còn cho luồng quyền/lời mời.\n- Chỉ lưu tối đa 24 dòng chat/NPC (12 lượt) và 30 memory/NPC.\n- Chỉ lưu memory khi tin nhắn đủ dài hoặc có dấu hiệu người chơi muốn ghi nhớ.\n- OpenAI được gọi ngoài transaction để không giữ connection PostgreSQL trong thời gian chờ AI.\n- Nếu OpenAI lỗi, server trả 502 thay vì tự giả mạo như AI.\n\n## Render\nThêm Environment Variables:\n`OPENAI_API_KEY` = API key OpenAI của chủ game\n`OPENAI_TIEN_DAO_MODEL` = `gpt-5.6-luna` (hoặc model OpenAI mà tài khoản được cấp quyền)\n`OPENAI_TIEN_DAO_TIMEOUT_MS` = `25000`\n''')
