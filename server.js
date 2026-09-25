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

// Cửu Đại Cảnh Giới — mỗi cảnh giới có 9 tầng.
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
const TIERS = ['Nhất Tầng','Nhị Tầng','Tam Tầng','Tứ Tầng','Ngũ Tầng','Lục Tầng','Thất Tầng','Bát Tầng','Cửu Tầng'];
function realmIndexFor(spirit) {
  return RANKS.map(r=>r.min).reduce((idx,min,i)=>spirit>=min?i:idx,0);
}
function stageFor(spirit) {
  const ri=realmIndexFor(spirit);
  const r=RANKS[ri];
  if (!Number.isFinite(r.max)) {
    const tier=Math.min(9, Math.floor((spirit-r.min)/30000)+1);
    return {realm:r.name,tier,stage:`${r.name} ${TIERS[tier-1]}`,realmIndex:ri,tierName:TIERS[tier-1]};
  }
  const span=r.max-r.min+1;
  const tier=Math.min(9, Math.floor(((spirit-r.min)*9)/span)+1);
  return {realm:r.name,tier,stage:`${r.name} ${TIERS[tier-1]}`,realmIndex:ri,tierName:TIERS[tier-1]};
}
function rankFor(spirit) { return RANKS[realmIndexFor(spirit)]; }
function progressFor(spirit) {
  const r=rankFor(spirit), s=stageFor(spirit);
  const nextRealm=RANKS[RANKS.findIndex(x=>x.name===r.name)+1];
  let tierStart=r.min, tierEnd=Number.isFinite(r.max)?r.max:Infinity;
  if (Number.isFinite(r.max)) {
    const span=r.max-r.min+1;
    tierStart=r.min+Math.floor(((s.tier-1)*span)/9);
    tierEnd=r.min+Math.floor((s.tier*span)/9)-1;
  } else {
    tierStart=r.min+(s.tier-1)*30000;
    tierEnd=s.tier<9?r.min+s.tier*30000-1:Infinity;
  }
  const percent=Number.isFinite(tierEnd)?Math.max(0,Math.min(100,Math.round(((spirit-tierStart+1)/(tierEnd-tierStart+1))*100))):Math.min(100,Math.round(((spirit-tierStart+1)/30000)*100));
  return {rank:r.name,tier:s.tier,stage:s.stage,tierName:s.tierName,percent,next:nextRealm?.name||null,remaining:nextRealm?Math.max(0,nextRealm.min-spirit):0};
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
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realm_tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_stone_claim DATE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_root TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_beast TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_capacity INTEGER NOT NULL DEFAULT 30;
    UPDATE profiles SET spirit_stones=COALESCE(spirit_stones,0), realm_tier=COALESCE(realm_tier,1);

    CREATE TABLE IF NOT EXISTS treasure_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0),
      spirit_gain INTEGER NOT NULL DEFAULT 0,
      min_realm INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES treasure_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,item_id)
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
    CREATE TABLE IF NOT EXISTS sect_quests (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL DEFAULT 1,
      reward_stones INTEGER NOT NULL DEFAULT 0 CHECK(reward_stones >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS user_quest_claims (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL REFERENCES sect_quests(id) ON DELETE CASCADE,
      claim_date DATE NOT NULL,
      UNIQUE(user_id, quest_id, claim_date)
    );
    CREATE TABLE IF NOT EXISTS daily_activity (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      train_count INTEGER NOT NULL DEFAULT 0,
      buy_count INTEGER NOT NULL DEFAULT 0,
      stone_claim_count INTEGER NOT NULL DEFAULT 0
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

  const ti = await query('SELECT COUNT(*)::int AS c FROM treasure_items');
  if (!ti.rows[0].c) {
    const items = [
      ['Tụ Linh Đan','Đan dược','Tăng ngay 150 linh lực, thích hợp cho đệ tử mới nhập môn.',80,150,0],
      ['Hàn Tuyết Đan','Đan dược','Tăng ngay 500 linh lực, ngưng tụ hàn khí trong đan điền.',220,500,1],
      ['Kim Đan Ngọc Lộ','Đan dược','Tăng ngay 1200 linh lực, chỉ mở bán từ Kim Đan.',450,1200,2],
      ['Hàn Thiên Kiếm','Pháp bảo','Pháp bảo trấn môn, lưu vào kho bảo vật của đệ tử.',700,0,2],
      ['Ngọc Bội Hộ Tâm','Pháp bảo','Ngọc bội hộ thân, một món pháp bảo quý trong Tàng Bảo Các.',1000,0,3],
      ['Cửu U Tiên Ấn','Pháp bảo','Ấn tín cổ xưa dành cho đại đạo giả.',2500,0,5]
    ];
    for (const item of items) await query('INSERT INTO treasure_items(name,category,description,price,spirit_gain,min_realm) VALUES($1,$2,$3,$4,$5,$6)',item);
  }
  const qCount = await query('SELECT COUNT(*)::int AS c FROM sect_quests');
  if (!qCount.rows[0].c) {
    const quests = [
      ['Vận công nhập môn','Vận công 1 lần trong ngày.','train',1,40],
      ['Tu luyện tinh tiến','Vận công 3 lần trong ngày.','train',3,100],
      ['Thám bảo sơn môn','Mua 1 vật phẩm tại Tàng Bảo Các.','buy',1,60],
      ['Kho báu Hàn Thiên','Mua 3 vật phẩm tại Tàng Bảo Các.','buy',3,180],
      ['Nhận lộc thiên đạo','Nhận linh thạch hằng ngày.','stone_claim',1,50]
    ];
    for (const q of quests) await query('INSERT INTO sect_quests(name,description,requirement_type,requirement_value,reward_stones) VALUES($1,$2,$3,$4,$5)',q);
  }
}

async function touchDailyActivity(userId) {
  const today = `(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
  await query(`INSERT INTO daily_activity(user_id,activity_date) VALUES($1,${today})
    ON CONFLICT(user_id) DO UPDATE SET activity_date=EXCLUDED.activity_date,train_count=CASE WHEN daily_activity.activity_date=EXCLUDED.activity_date THEN daily_activity.train_count ELSE 0 END,buy_count=CASE WHEN daily_activity.activity_date=EXCLUDED.activity_date THEN daily_activity.buy_count ELSE 0 END,stone_claim_count=CASE WHEN daily_activity.activity_date=EXCLUDED.activity_date THEN daily_activity.stone_claim_count ELSE 0 END`,[userId]);
}
async function addDailyActivity(userId, field, amount=1) {
  await touchDailyActivity(userId);
  await query(`UPDATE daily_activity SET ${field}=${field}+$2 WHERE user_id=$1`,[userId,amount]);
}

app.use(express.json({ limit: '200kb' }));
app.use(express.static(__dirname));
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64).toString('hex'); }
function safeUser(user) { return { id:user.id, username:user.username, displayName:user.display_name, createdAt:user.created_at }; }


const SPIRIT_ROOTS = [
  'Thiên Linh Căn','Kim Linh Căn','Mộc Linh Căn','Thủy Linh Căn','Hỏa Linh Căn','Thổ Linh Căn',
  'Băng Linh Căn','Lôi Linh Căn','Phong Linh Căn','Âm Dương Linh Căn','Ngũ Hành Linh Căn','Biến Dị Lôi Hỏa Linh Căn'
];
const SPIRIT_BEASTS = [
  'Hàn Ngọc Hồ','Thanh Vân Hạc','Lôi Ảnh Lang','Xích Viêm Hổ','Huyền Quy','Bạch Vũ Ưng',
  'Cửu U Miêu','Kim Giáp Tê','Tử Điện Điêu','Thanh Mộc Linh Lộc','Huyền Băng Ly','Xích Kim Viên',
  'Phong Linh Hồ','U Minh Lang','Bích Nhãn Xà','Vân Hải Kình'
];
function randomFrom(list){ return list[crypto.randomInt(0,list.length)]; }
function randomCultivationGifts(){ return {root:randomFrom(SPIRIT_ROOTS),beast:randomFrom(SPIRIT_BEASTS)}; }

async function ensureProfile(userId) {
  await query('INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  const p=(await query('SELECT spirit_power,spirit_root,spirit_beast FROM profiles WHERE user_id=$1',[userId])).rows[0];
  const gift=randomCultivationGifts();
  const root=p.spirit_root || gift.root;
  const beast=p.spirit_beast || gift.beast;
  const stage=stageFor(Number(p.spirit_power)||0);
  await query(`UPDATE profiles SET rank=$2, realm_tier=$3, spirit_root=COALESCE(spirit_root,$4), spirit_beast=COALESCE(spirit_beast,$5), storage_capacity=COALESCE(storage_capacity,30), updated_at=NOW() WHERE user_id=$1`,
    [userId, stage.realm, stage.tier, root, beast]);
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
      query(`SELECT u.id,u.display_name AS name,u.username,p.avatar AS emoji,p.title,p.position,p.rank,p.spirit_power,p.bio,p.birthday,p.hobby,p.sect,p.realm_tier
             FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY u.id`),
      query('SELECT icon,title,description FROM memories ORDER BY id'),
      query('SELECT year,title,description FROM timeline ORDER BY id'),
      query('SELECT COUNT(*)::int AS c FROM users')
    ]);
    res.json({members:m.rows.map(x=>({...x,nick:'@'+x.username,role:x.position||x.title,tags:[x.sect,x.rank,`${x.realm_tier}/9 tầng`]})),memories:mem.rows,timeline:t.rows,userCount:u.rows[0].c});
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

function attributesFor(spirit){
  const st=stageFor(Number(spirit)||0); const s=Number(spirit)||0;
  return {congLuc:10+st.realmIndex*35+st.tier*8+Math.floor(s/250),phongThu:10+st.realmIndex*28+st.tier*7+Math.floor(s/300),thanPhap:10+st.realmIndex*22+st.tier*6+Math.floor(s/400),ngoTinh:8+st.realmIndex*5+st.tier*2+Math.floor(s/700),khiVan:5+st.realmIndex*2+Math.floor(st.tier/3)};
}

app.get('/api/profile',auth,async(req,res)=>{
  try {
    await ensureProfile(req.session.user_id);
    const r=await query(`SELECT u.id,u.username,u.display_name,u.created_at,p.*,
      COALESCE((SELECT SUM(points) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_points,
      COALESCE((SELECT COUNT(*) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_count
      FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[req.session.user_id]);
    const p=r.rows[0];
    await ensureAchievements(p.id,p.spirit_power);
    const stage=stageFor(p.spirit_power);
    const today=(new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const last=p.last_stone_claim ? new Date(p.last_stone_claim).toISOString().slice(0,10) : null;
    res.json({profile:{...p,realm:stage.realm,tier:stage.tier,stage:stage.stage,canClaimStones:last!==today,progress:progressFor(p.spirit_power),attributes:attributesFor(p.spirit_power),spiritRoot:p.spirit_root,spiritBeast:p.spirit_beast,storageCapacity:Number(p.storage_capacity)||30}});
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
    const today=(new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const a=await query('SELECT activity_date,train_count FROM daily_activity WHERE user_id=$1',[req.session.user_id]);
    let trainCount=0;
    if(!a.rows.length) await query('INSERT INTO daily_activity(user_id,activity_date,train_count,buy_count,stone_claim_count) VALUES($1,$2,0,0,0)',[req.session.user_id,today]);
    else if(String(a.rows[0].activity_date).slice(0,10)!==today) await query('UPDATE daily_activity SET activity_date=$2,train_count=0,buy_count=0,stone_claim_count=0 WHERE user_id=$1',[req.session.user_id,today]);
    else trainCount=Number(a.rows[0].train_count)||0;
    const prof=(await query('SELECT spirit_power FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const currentStage=stageFor(Number(prof.spirit_power)||0);
    const maxDaily=Math.max(3,10-currentStage.realmIndex);
    if(trainCount>=maxDaily)return res.status(429).json({error:`Hôm nay đã vận công ${trainCount}/${maxDaily} lần. Cảnh giới càng cao càng khó tu luyện; hãy quay lại ngày mai.`,trainCount,maxDaily});
    const baseMax=Math.max(28,72-currentStage.realmIndex*5-currentStage.tier*2);
    const baseMin=Math.max(12,Math.floor(baseMax*0.55));
    const gain=crypto.randomInt(baseMin,baseMax+1);
    const r=await query('UPDATE profiles SET spirit_power=spirit_power+$2, experience=experience+$2, updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power,experience',[req.session.user_id,gain]);
    const spirit=r.rows[0].spirit_power;
    const stage=stageFor(spirit);
    await query('UPDATE profiles SET rank=$2, realm_tier=$3 WHERE user_id=$1',[req.session.user_id,stage.realm,stage.tier]);
    await ensureAchievements(req.session.user_id,spirit);
    await addDailyActivity(req.session.user_id,'train_count',1);
    res.json({gain,spirit,experience:r.rows[0].experience,progress:progressFor(spirit),rank:stage.realm,stage:stage.stage,trainCount:trainCount+1,maxDaily});
  } catch(e){console.error(e);res.status(500).json({error:'Không thể vận công lúc này.'});}
});


app.get('/api/treasure',auth,async(req,res)=>{
  try {
    await ensureProfile(req.session.user_id);
    const p=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const stage=stageFor(p.spirit_power);
    const items=(await query(`SELECT ti.*,COALESCE(i.quantity,0)::int AS quantity
      FROM treasure_items ti LEFT JOIN inventory i ON i.item_id=ti.id AND i.user_id=$1
      ORDER BY ti.min_realm,ti.price,ti.id`,[req.session.user_id])).rows;
    res.json({spiritStones:p.spirit_stones,realm:stage.realm,tier:stage.tier,items});
  } catch(e){res.status(500).json({error:'Không thể mở Tàng Bảo Các.'});}
});

app.post('/api/spirit-stones/claim',auth,async(req,res)=>{
  try {
    const amount=100;
    const r=await query(`UPDATE profiles
      SET spirit_stones=spirit_stones+$2,
          last_stone_claim=(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
          updated_at=NOW()
      WHERE user_id=$1
        AND (last_stone_claim IS NULL OR last_stone_claim < (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
      RETURNING spirit_stones,last_stone_claim`,[req.session.user_id,amount]);
    if(!r.rows.length)return res.status(409).json({error:'Hôm nay bạn đã nhận 100 linh thạch. Mai hãy quay lại nhận tiếp.'});
    await addDailyActivity(req.session.user_id,'stone_claim_count',1);
    res.json({ok:true,amount,spiritStones:r.rows[0].spirit_stones,next:'Ngày mai'});
  } catch(e){res.status(500).json({error:'Không thể nhận linh thạch hằng ngày.'});}
});

app.post('/api/treasure/buy-stones',auth,async(req,res)=>{
  const client=await pool.connect();
  try {
    const amount=100, spiritCost=500;
    await client.query('BEGIN');
    const r=await client.query(`UPDATE profiles SET spirit_power=spirit_power-$2,spirit_stones=spirit_stones+$3,updated_at=NOW() WHERE user_id=$1 AND spirit_power>=$2 RETURNING spirit_power,spirit_stones`,[req.session.user_id,spiritCost,amount]);
    if(!r.rows.length){await client.query('ROLLBACK');return res.status(400).json({error:'Cần 500 linh lực để đổi lấy 100 linh thạch.'});}
    const stage=stageFor(r.rows[0].spirit_power);
    await client.query('UPDATE profiles SET rank=$2,realm_tier=$3 WHERE user_id=$1',[req.session.user_id,stage.realm,stage.tier]);
    await client.query('COMMIT');
    res.json({ok:true,amount,spirit:r.rows[0].spirit_power,spiritStones:r.rows[0].spirit_stones,stage:stage.stage});
  } catch(e){try{await client.query('ROLLBACK')}catch{};res.status(500).json({error:'Không thể đổi linh lực lấy linh thạch.'});}
  finally{client.release();}
});

app.post('/api/treasure/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try {
    const itemId=Number(req.body?.itemId);
    if(!Number.isInteger(itemId) || itemId<1)return res.status(400).json({error:'Vật phẩm không hợp lệ.'});
    await client.query('BEGIN');

    const itemR=await client.query('SELECT id,name,category,price,spirit_gain,min_realm FROM treasure_items WHERE id=$1 FOR UPDATE',[itemId]);
    if(!itemR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy vật phẩm.'});}
    const item=itemR.rows[0];

    const pR=await client.query('SELECT spirit_power,COALESCE(spirit_stones,0)::int AS spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id]);
    if(!pR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ đệ tử.'});}
    const p=pR.rows[0];
    const stage=stageFor(Number(p.spirit_power)||0);

    if(stage.realmIndex < Number(item.min_realm)){
      await client.query('ROLLBACK');
      return res.status(403).json({error:`Vật phẩm này yêu cầu ${RANKS[Number(item.min_realm)].name}. Bạn hiện ở ${stage.stage}.`});
    }
    if(Number(p.spirit_stones) < Number(item.price)){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Linh thạch không đủ. Cần ${Number(item.price).toLocaleString('vi-VN')} 💎, hiện có ${Number(p.spirit_stones).toLocaleString('vi-VN')} 💎.`});
    }

    const capR=await client.query(`SELECT COALESCE(storage_capacity,30)::int AS capacity,
      COALESCE((SELECT SUM(quantity) FROM inventory WHERE user_id=$1),0)::int AS used
      FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    const capacity=Number(capR.rows[0]?.capacity)||30;
    const used=Number(capR.rows[0]?.used)||0;
    if(used>=capacity){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Tụ Di Giới đã đầy (${used}/${capacity}). Hãy dùng vật phẩm hoặc nâng dung lượng.`});
    }

    const newStones=Number(p.spirit_stones)-Number(item.price);
    let newSpirit=Number(p.spirit_power)||0;
    if(Number(item.spirit_gain)>0)newSpirit+=Number(item.spirit_gain);
    const ns=stageFor(newSpirit);

    await client.query(
      `UPDATE profiles SET spirit_stones=$2, spirit_power=$3, experience=experience+$4, rank=$5, realm_tier=$6, updated_at=NOW() WHERE user_id=$1`,
      [req.session.user_id,newStones,newSpirit,Number(item.spirit_gain)||0,ns.realm,ns.tier]
    );
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW())
      ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW()`,[req.session.user_id,itemId]);

    // Ghi nhận tiến độ nhiệm vụ mua vật phẩm trong cùng transaction.
    const today="(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
    await client.query(`INSERT INTO daily_activity(user_id,activity_date,buy_count,train_count,stone_claim_count)
      VALUES($1,${today},1,0,0)
      ON CONFLICT(user_id) DO UPDATE SET
        buy_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.buy_count+1 ELSE 1 END,
        train_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.train_count ELSE 0 END,
        stone_claim_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.stone_claim_count ELSE 0 END,
        activity_date=${today}`,[req.session.user_id]);

    await client.query('COMMIT');
    res.json({ok:true,item:item.name,spiritStones:newStones,spirit:newSpirit,stage:ns.stage,quantityAdded:1});
  } catch(e){
    try{await client.query('ROLLBACK')}catch{}
    console.error('Treasure purchase error:',e);
    res.status(500).json({error:'Không thể mua vật phẩm lúc này. Vui lòng thử lại.'});
  } finally{client.release();}
});

app.get('/api/tu-di-gioi',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query('SELECT storage_capacity,spirit_root,spirit_beast FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const r=await query(`SELECT ti.id,ti.name,ti.category,ti.description,i.quantity
      FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
      WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC`,[req.session.user_id]);
    const count=r.rows.reduce((n,x)=>n+Number(x.quantity||0),0);
    res.json({rows:r.rows,used:count,capacity:Number(p.storage_capacity)||30,spiritRoot:p.spirit_root,spiritBeast:p.spirit_beast});
  }catch(e){res.status(500).json({error:'Không thể mở Tụ Di Giới.'});}
});

app.post('/api/random-gifts',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const gift=randomCultivationGifts();
    const r=await query(`UPDATE profiles SET spirit_root=$2,spirit_beast=$3,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_root,spirit_beast`,[req.session.user_id,gift.root,gift.beast]);
    res.json({ok:true,spiritRoot:r.rows[0].spirit_root,spiritBeast:r.rows[0].spirit_beast});
  }catch(e){res.status(500).json({error:'Không thể ngẫu nhiên linh căn và linh thú.'});}
});

app.get('/api/inventory',auth,async(req,res)=>{
  try{const r=await query(`SELECT ti.name,ti.category,ti.description,i.quantity FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC`,[req.session.user_id]);res.json({rows:r.rows});}
  catch(e){res.status(500).json({error:'Không thể tải túi vật phẩm.'});}
});

app.get('/api/quests',auth,async(req,res)=>{
  try {
    await touchDailyActivity(req.session.user_id);
    const r=await query(`SELECT q.*,COALESCE(a.train_count,0)::int AS train_count,COALESCE(a.buy_count,0)::int AS buy_count,COALESCE(a.stone_claim_count,0)::int AS stone_claim_count,
      EXISTS(SELECT 1 FROM user_quest_claims c WHERE c.user_id=$1 AND c.quest_id=q.id AND c.claim_date=(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS claimed
      FROM sect_quests q LEFT JOIN daily_activity a ON a.user_id=$1 WHERE q.active=true ORDER BY q.id`,[req.session.user_id]);
    const rows=r.rows.map(q=>{
      const progress=q.requirement_type==='train'?q.train_count:q.requirement_type==='buy'?q.buy_count:q.stone_claim_count;
      return {...q,progress:Math.min(progress,q.requirement_value),completed:progress>=q.requirement_value};
    });
    res.json({rows});
  } catch(e){res.status(500).json({error:'Không thể mở Nhiệm Vụ Đường.'});}
});
app.post('/api/quests/:id/claim',auth,async(req,res)=>{
  const client=await pool.connect();
  try {
    const questId=Number(req.params.id);
    if(!Number.isInteger(questId))return res.status(400).json({error:'Nhiệm vụ không hợp lệ.'});
    await client.query('BEGIN');
    const qR=await client.query('SELECT * FROM sect_quests WHERE id=$1 AND active=true FOR UPDATE',[questId]);
    if(!qR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy nhiệm vụ.'});}
    const q=qR.rows[0];
    const aR=await client.query(`SELECT COALESCE(train_count,0)::int AS train_count,COALESCE(buy_count,0)::int AS buy_count,COALESCE(stone_claim_count,0)::int AS stone_claim_count FROM daily_activity WHERE user_id=$1`,[req.session.user_id]);
    const a=aR.rows[0]||{train_count:0,buy_count:0,stone_claim_count:0};
    const progress=q.requirement_type==='train'?a.train_count:q.requirement_type==='buy'?a.buy_count:a.stone_claim_count;
    if(progress<q.requirement_value){await client.query('ROLLBACK');return res.status(400).json({error:`Chưa hoàn thành nhiệm vụ. Tiến độ ${progress}/${q.requirement_value}.`});}
    const c=await client.query(`INSERT INTO user_quest_claims(user_id,quest_id,claim_date) VALUES($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) ON CONFLICT DO NOTHING RETURNING id`,[req.session.user_id,questId]);
    if(!c.rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Hôm nay bạn đã nhận thưởng nhiệm vụ này.'});}
    const p=await client.query('UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_stones',[req.session.user_id,q.reward_stones]);
    await client.query('COMMIT');
    res.json({ok:true,reward:q.reward_stones,spiritStones:p.rows[0].spirit_stones});
  } catch(e){try{await client.query('ROLLBACK')}catch{};res.status(500).json({error:'Không thể nhận thưởng nhiệm vụ.'});}
  finally{client.release();}
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
