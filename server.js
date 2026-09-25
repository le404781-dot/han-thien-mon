const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Thiếu DATABASE_URL. Hãy tạo PostgreSQL và thêm biến môi trường DATABASE_URL trên Render.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5
});

async function query(text, params = []) { return pool.query(text, params); }

const RANKS = [
  { name: 'Luyện Khí', min: 0, max: 999 },
  { name: 'Trúc Cơ', min: 1000, max: 2999 },
  { name: 'Kim Đan', min: 3000, max: 6999 },
  { name: 'Nguyên Anh', min: 7000, max: 14999 },
  { name: 'Hóa Thần', min: 15000, max: 29999 },
  { name: 'Luyện Hư', min: 30000, max: 59999 },
  { name: 'Hợp Thể', min: 60000, max: 119999 },
  { name: 'Đại Thừa', min: 120000, max: 239999 },
  { name: 'Độ Kiếp', min: 240000, max: Infinity }
];
function rankFor(spirit) { return RANKS.slice().reverse().find(r => spirit >= r.min) || RANKS[0]; }
function progressFor(spirit) {
  const r = rankFor(spirit);
  if (!Number.isFinite(r.max)) return { rank: r.name, percent: 100, next: null, remaining: 0 };
  const span = r.max - r.min + 1;
  const percent = Math.max(0, Math.min(100, Math.round(((spirit - r.min + 1) / span) * 100)));
  const next = RANKS[RANKS.findIndex(x => x.name === r.name) + 1];
  return { rank: r.name, percent, next: next?.name || null, remaining: next ? Math.max(0, next.min - spirit) : 0 };
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, nick TEXT NOT NULL, emoji TEXT NOT NULL,
      role TEXT NOT NULL, bio TEXT NOT NULL, birthday TEXT NOT NULL, hobby TEXT NOT NULL, tags TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id SERIAL PRIMARY KEY, icon TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timeline (
      id SERIAL PRIMARY KEY, year TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Tân đệ tử',
      sect TEXT NOT NULL DEFAULT 'Hàn Thiên Môn',
      position TEXT NOT NULL DEFAULT 'Ngoại môn đệ tử',
      rank TEXT NOT NULL DEFAULT 'Luyện Khí',
      spirit_power INTEGER NOT NULL DEFAULT 0,
      experience INTEGER NOT NULL DEFAULT 0,
      bio TEXT NOT NULL DEFAULT '',
      birthday TEXT NOT NULL DEFAULT '',
      hobby TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '🧑🏻‍🎓',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, title)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query('INSERT INTO profiles(user_id) SELECT id FROM users ON CONFLICT (user_id) DO NOTHING');
  const existingUsers = await query('SELECT id FROM users');
  for (const u of existingUsers.rows) await ensureAchievements(u.id, 0);

  const mc = await query('SELECT COUNT(*)::int AS c FROM members');
  if (!mc.rows[0].c) {
    const rows = [
      ['Hội','Kính','😎','Người giữ vibe','Luôn xuất hiện với phong thái riêng và chiếc kính quen thuộc.','12/03','Âm nhạc • Đi chơi','Vui tính,Kính,Team chill'],
      ['Phú','Đội trưởng','🧢','Captain của nhóm','Người thường xuyên khởi xướng những cuộc vui bất ngờ.','25/06','Game • Ăn uống','Leader,Năng động,Meme'],
      ['Sương','Bá khí','👑','Nữ hoàng quyền lực','Bá khí hết sức có thể nhưng vẫn rất tình cảm với hội bạn.','09/09','Ảnh • Du lịch','Bá khí,Queen,Cute'],
      ['Phấn','Aura Farming','✨','Chuyên gia tạo aura','Không cần nói nhiều, xuất hiện là đủ thu hút ánh nhìn.','18/11','Anime • Chụp ảnh','Aura,Anime,Cool']
    ];
    for (const r of rows) await query('INSERT INTO members(name,nick,emoji,role,bio,birthday,hobby,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', r);
  }
  const mem = await query('SELECT COUNT(*)::int AS c FROM memories');
  if (!mem.rows[0].c) {
    for (const r of [['📸','Ngày đầu tụ họp','Một ngày đáng nhớ của cả nhóm'],['🍜','Kèo ăn uống','Đói là phải gọi nhau'],['🎮','Đêm game','Thắng thua không quan trọng, vui là chính'],['🌅','Chuyến đi','Một chuyến đi, hàng trăm câu chuyện'],['😂','Khoảnh khắc bất ổn','Không ai biết chuyện gì đang xảy ra'],['🫶','Best friends','Cùng nhau lưu lại thanh xuân']]) await query('INSERT INTO memories(icon,title,description) VALUES($1,$2,$3)', r);
  }
  const tl = await query('SELECT COUNT(*)::int AS c FROM timeline');
  if (!tl.rows[0].c) {
    for (const r of [['2024','Gặp nhau','Những thành viên đầu tiên bắt đầu kết nối.'],['2025','Thân hơn','Từ vài cuộc trò chuyện thành những kèo đi chơi đều đặn.'],['2026','Hàn Thiên Môn khai tông','Thêm nhiều thành viên, nhiều kỷ niệm và nhiều câu chuyện hơn.']]) await query('INSERT INTO timeline(year,title,description) VALUES($1,$2,$3)', r);
  }
}

app.use(express.json({ limit: '200kb' }));
app.use(express.static(__dirname));
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeUser(user) { return { id:user.id, username:user.username, displayName:user.display_name, createdAt:user.created_at }; }

async function ensureProfile(userId) {
  await query('INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  await query(`UPDATE profiles SET rank=$2, updated_at=NOW() WHERE user_id=$1`, [userId, rankFor((await query('SELECT spirit_power FROM profiles WHERE user_id=$1',[userId])).rows[0].spirit_power).name]);
}
async function ensureAchievements(userId, spirit) {
  await query(`INSERT INTO achievements(user_id,title,description,points) VALUES($1,'Nhập môn Hàn Thiên','Đã ghi danh và bước qua sơn môn.',10) ON CONFLICT (user_id,title) DO NOTHING`, [userId]);
  const milestones = [
    [100,'Linh lực sơ thành','Tích lũy 100 điểm linh lực.',20],
    [1000,'Trúc Cơ nhập cảnh','Đột phá cảnh giới Trúc Cơ.',50],
    [3000,'Kim Đan thành tựu','Kết thành Kim Đan.',100],
    [7000,'Nguyên Anh xuất thế','Bước vào cảnh giới Nguyên Anh.',200],
    [15000,'Hóa Thần đại đạo','Chạm tới cảnh giới Hóa Thần.',400]
  ];
  for (const [need,title,desc,points] of milestones) if (spirit >= need) await query('INSERT INTO achievements(user_id,title,description,points) VALUES($1,$2,$3,$4) ON CONFLICT (user_id,title) DO NOTHING',[userId,title,desc,points]);
}

async function auth(req,res,next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({error:'Bạn chưa đăng nhập.'});
    const r = await query('SELECT s.*, u.username, u.display_name, u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>$2',[token,Date.now()]);
    if (!r.rows.length) return res.status(401).json({error:'Phiên đăng nhập đã hết hạn.'});
    req.session = r.rows[0]; req.token = token; next();
  } catch(e) { res.status(500).json({error:'Lỗi máy chủ.'}); }
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'Hàn Thiên Môn'}));
app.get('/api/data',async(req,res)=>{
  try {
    const [m,mem,t,u] = await Promise.all([
      query('SELECT * FROM members ORDER BY id'),
      query('SELECT icon,title,description FROM memories ORDER BY id'),
      query('SELECT year,title,description FROM timeline ORDER BY id'),
      query('SELECT COUNT(*)::int AS c FROM users')
    ]);
    res.json({members:m.rows.map(x=>({...x,tags:x.tags.split(',')})),memories:mem.rows,timeline:t.rows,userCount:u.rows[0].c});
  } catch(e) { res.status(500).json({error:'Không thể tải dữ liệu.'}); }
});

app.post('/api/register',async(req,res)=>{
  try {
    const {username,password,displayName}=req.body||{};
    if(!username||!password||!displayName)return res.status(400).json({error:'Vui lòng nhập đầy đủ thông tin.'});
    if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Tên đăng nhập 3–24 ký tự, chỉ gồm chữ, số và _.'});
    if(String(password).length<6)return res.status(400).json({error:'Mật khẩu cần ít nhất 6 ký tự.'});
    const salt=crypto.randomBytes(16).toString('hex');
    const dn=displayName.trim().slice(0,40);
    if(!dn)return res.status(400).json({error:'Danh xưng không được để trống.'});
    const r=await query('INSERT INTO users(username,password_hash,salt,display_name) VALUES($1,$2,$3,$4) RETURNING id,username,display_name,created_at',[username.toLowerCase(),hashPassword(password,salt),salt,dn]);
    const user=r.rows[0];
    await ensureProfile(user.id);
    await ensureAchievements(user.id, 0);
    res.status(201).json({user:safeUser(user)});
  } catch(e){if(e.code==='23505')return res.status(409).json({error:'Tên đăng nhập đã tồn tại.'});res.status(500).json({error:'Không thể tạo tài khoản.'});}
});

app.post('/api/login',async(req,res)=>{
  try{
    const {username,password}=req.body||{};
    const r=await query('SELECT * FROM users WHERE username=$1',[String(username||'').toLowerCase()]);
    const user=r.rows[0];
    if(!user||hashPassword(String(password||''),user.salt)!==user.password_hash)return res.status(401).json({error:'Tên đăng nhập hoặc mật khẩu không đúng.'});
    await ensureProfile(user.id);
    const token=crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)',[token,user.id,Date.now()+1000*60*60*24*30]);
    res.json({token,user:safeUser(user)});
  }catch(e){res.status(500).json({error:'Không thể đăng nhập.'});}
});
app.get('/api/me',auth,async(req,res)=>res.json({user:{id:req.session.user_id,username:req.session.username,displayName:req.session.display_name,createdAt:req.session.created_at}}));
app.post('/api/logout',auth,async(req,res)=>{await query('DELETE FROM sessions WHERE token=$1',[req.token]);res.json({ok:true});});

app.get('/api/profile',auth,async(req,res)=>{
  try {
    await ensureProfile(req.session.user_id);
    const r=await query(`SELECT u.id,u.username,u.display_name,u.created_at,p.*,
      COALESCE((SELECT SUM(points) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_points,
      COALESCE((SELECT COUNT(*) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_count
      FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[req.session.user_id]);
    const p=r.rows[0];
    await ensureAchievements(p.id,p.spirit_power);
    res.json({profile:{...p,progress:progressFor(p.spirit_power)}});
  } catch(e){res.status(500).json({error:'Không thể tải hồ sơ.'});}
});

app.patch('/api/profile',auth,async(req,res)=>{
  try {
    const {displayName,title,sect,birthday,hobby,bio,avatar}=req.body||{};
    if(displayName!==undefined){const dn=String(displayName).trim().slice(0,40);if(!dn)return res.status(400).json({error:'Danh xưng không được để trống.'});await query('UPDATE users SET display_name=$2 WHERE id=$1',[req.session.user_id,dn]);}
    await ensureProfile(req.session.user_id);
    await query(`UPDATE profiles SET title=COALESCE($2,title), sect=COALESCE($3,sect), birthday=COALESCE($4,birthday), hobby=COALESCE($5,hobby), bio=COALESCE($6,bio), avatar=COALESCE($7,avatar), updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,title?.toString().slice(0,60),sect?.toString().slice(0,60),birthday?.toString().slice(0,30),hobby?.toString().slice(0,100),bio?.toString().slice(0,500),avatar?.toString().slice(0,10)]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:'Không thể cập nhật hồ sơ.'});}
});

app.post('/api/cultivation/train',auth,async(req,res)=>{
  try {
    await ensureProfile(req.session.user_id);
    const gain = crypto.randomInt(35, 81);
    const r=await query('UPDATE profiles SET spirit_power=spirit_power+$2, experience=experience+$2, updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power,experience',[req.session.user_id,gain]);
    const spirit=r.rows[0].spirit_power;
    const rank=rankFor(spirit);
    await query('UPDATE profiles SET rank=$2 WHERE user_id=$1',[req.session.user_id,rank.name]);
    await ensureAchievements(req.session.user_id,spirit);
    res.json({gain,spirit,experience:r.rows[0].experience,progress:progressFor(spirit),rank:rank.name});
  } catch(e){res.status(500).json({error:'Không thể vận công lúc này.'});}
});

app.get('/api/leaderboard',async(req,res)=>{
  try {
    const r=await query(`SELECT u.id,u.display_name,p.title,p.rank,p.spirit_power,p.position,
      COALESCE((SELECT SUM(points) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_points,
      COALESCE((SELECT COUNT(*) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_count
      FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY (p.spirit_power + COALESCE((SELECT SUM(points) FROM achievements a WHERE a.user_id=u.id),0)*10) DESC, u.id ASC LIMIT 50`);
    res.json({rows:r.rows});
  } catch(e){res.status(500).json({error:'Không thể tải bảng thành tích.'});}
});

app.get('/api/achievements',auth,async(req,res)=>{
  try { const r=await query('SELECT title,description,points,created_at FROM achievements WHERE user_id=$1 ORDER BY points DESC,id',[req.session.user_id]); res.json({rows:r.rows}); }
  catch(e){res.status(500).json({error:'Không thể tải thành tích.'});}
});

app.get('/api/sect',async(req,res)=>{
  try {
    const count=await query('SELECT COUNT(*)::int AS c FROM profiles WHERE sect=$1',['Hàn Thiên Môn']);
    res.json({name:'Hàn Thiên Môn',han:'寒天門',motto:'Giữ đạo tâm · Giữ tình bằng hữu',count:count.rows[0].c,positions:[['Tông chủ','Chưởng môn sơn môn'],['Hộ pháp','Giữ luật và hộ sơn'],['Nội môn đệ tử','Đệ tử đã lập đạo cơ'],['Ngoại môn đệ tử','Môn nhân mới nhập môn']]});
  } catch(e){res.status(500).json({error:'Không thể tải môn phái.'});}
});

app.get('/api/chat',auth,async(req,res)=>{
  try {
    const r=await query(`SELECT c.id,c.message,c.created_at,u.display_name,p.title,p.rank,p.avatar FROM chat_messages c JOIN users u ON u.id=c.user_id JOIN profiles p ON p.user_id=u.id ORDER BY c.id DESC LIMIT 60`);
    res.json({rows:r.rows.reverse()});
  } catch(e){res.status(500).json({error:'Không thể tải chat tổng.'});}
});
app.post('/api/chat',auth,async(req,res)=>{
  try {
    const message=String(req.body?.message||'').trim().slice(0,500);
    if(!message)return res.status(400).json({error:'Tin nhắn không được để trống.'});
    const r=await query('INSERT INTO chat_messages(user_id,message) VALUES($1,$2) RETURNING id,created_at',[req.session.user_id,message]);
    res.status(201).json({ok:true,...r.rows[0]});
  } catch(e){res.status(500).json({error:'Không thể gửi tin nhắn.'});}
});

app.post('/api/members',auth,async(req,res)=>{
  try{const {name,nick,emoji='🧑‍🎨',role='Đệ tử',bio='',birthday='',hobby='',tags=[]}=req.body||{};if(!name||!nick)return res.status(400).json({error:'Thiếu tên hoặc biệt danh.'});const r=await query('INSERT INTO members(name,nick,emoji,role,bio,birthday,hobby,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[name,nick,emoji,role,bio,birthday,hobby,Array.isArray(tags)?tags.join(','):String(tags)]);res.status(201).json({id:r.rows[0].id});}catch(e){res.status(500).json({error:'Không thể thêm môn nhân.'});}
});

initDb().then(()=>app.listen(PORT,()=>console.log(`Hàn Thiên Môn đang chạy trên cổng ${PORT}`))).catch(err=>{console.error('Không khởi tạo được database:',err);process.exit(1);});
