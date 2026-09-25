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
const POSITION_RULES = [
  {name:'Ngoại môn đệ tử', min:0, max:0},
  {name:'Nội môn đệ tử', min:1, max:2},
  {name:'Chấp sự', min:2, max:4},
  {name:'Hộ pháp', min:4, max:6},
  {name:'Trưởng lão', min:5, max:7},
  {name:'Thái thượng trưởng lão', min:7, max:8},
  {name:'Tông chủ', min:8, max:8}
];
function positionOptionsFor(realmIndex){ return POSITION_RULES.filter(x=>realmIndex>=x.min && realmIndex<=x.max).map(x=>x.name); }
function defaultPositionFor(realmIndex){ const opts=positionOptionsFor(realmIndex); return opts[opts.length-1] || 'Ngoại môn đệ tử'; }

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
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gacha_claimed BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_root_rarity TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_beast_rarity TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_attack INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_defense INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_speed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_spirit INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_skill TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online_spirit_date DATE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS online_spirit_earned INTEGER NOT NULL DEFAULT 0;


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

    CREATE TABLE IF NOT EXISTS market_listings (
      id BIGSERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES treasure_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      price_stones INTEGER NOT NULL CHECK(price_stones > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_market_listings_active ON market_listings(created_at DESC);

    CREATE TABLE IF NOT EXISTS market_trades (
      id BIGSERIAL PRIMARY KEY,
      proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_item_id INTEGER NOT NULL REFERENCES treasure_items(id) ON DELETE CASCADE,
      offer_quantity INTEGER NOT NULL CHECK(offer_quantity > 0),
      want_item_id INTEGER NOT NULL REFERENCES treasure_items(id) ON DELETE CASCADE,
      want_quantity INTEGER NOT NULL CHECK(want_quantity > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_market_trades_recipient_status ON market_trades(recipient_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_market_trades_proposer_status ON market_trades(proposer_id,status,created_at DESC);

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
      reward_item_id INTEGER REFERENCES treasure_items(id) ON DELETE SET NULL,
      reward_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reward_quantity >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS user_quest_claims (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL REFERENCES sect_quests(id) ON DELETE CASCADE,
      claim_date DATE NOT NULL,
      UNIQUE(user_id, quest_id, claim_date)
    );
    CREATE TABLE IF NOT EXISTS user_quest_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL REFERENCES sect_quests(id) ON DELETE CASCADE,
      baseline_train INTEGER NOT NULL DEFAULT 0,
      baseline_buy INTEGER NOT NULL DEFAULT 0,
      baseline_stone_claim INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(user_id, quest_id)
    );
    CREATE TABLE IF NOT EXISTS daily_activity (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      train_count INTEGER NOT NULL DEFAULT 0,
      buy_count INTEGER NOT NULL DEFAULT 0,
      stone_claim_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK(event_type IN ('train','buy','stone_claim')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_events_user_type_time ON activity_events(user_id,event_type,created_at);
  `);

  await query(`ALTER TABLE sect_quests ADD COLUMN IF NOT EXISTS reward_item_id INTEGER REFERENCES treasure_items(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE sect_quests ADD COLUMN IF NOT EXISTS cycle_key TEXT`);
  await query(`ALTER TABLE sect_quests ADD COLUMN IF NOT EXISTS display_name TEXT`);
  await query(`ALTER TABLE sect_quests ADD COLUMN IF NOT EXISTS reward_quantity INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE sect_quests ADD COLUMN IF NOT EXISTS reward_stones INTEGER NOT NULL DEFAULT 0`);

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
  const enhanceItems = [
    ['Linh Phù Cường Hóa','Vật phẩm tăng cường','Linh phù dùng để cường hóa pháp bảo, tăng 3% hiệu quả trong lần cường hóa tiếp theo.',0,0,0],
    ['Tinh Thạch Cường Hóa','Vật phẩm tăng cường','Tinh thạch hiếm, tăng 8% hiệu quả cường hóa pháp bảo.',0,0,2],
    ['Huyền Thiết Cường Hóa','Vật phẩm tăng cường','Huyền thiết tôi luyện từ địa hỏa, tăng 15% hiệu quả cường hóa.',0,0,4],
    ['Thiên Đạo Cường Hóa Thạch','Vật phẩm tăng cường','Cường hóa thạch cực hiếm, tăng 30% hiệu quả cường hóa.',0,0,7]
  ];
  for (const item of enhanceItems) await query('INSERT INTO treasure_items(name,category,description,price,spirit_gain,min_realm) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING',item);
  const qCount = await query('SELECT COUNT(*)::int AS c FROM sect_quests');
  if (!qCount.rows[0].c) {
    const quests = [
      ['Vận công nhập môn','Vận công 1 lần.','train',1,0],
      ['Tu luyện tinh tiến','Vận công 2 lần.','train',2,0],
      ['Thám bảo sơn môn','Mua 1 vật phẩm tại Tàng Bảo Các.','buy',1,0],
      ['Kho báu Hàn Thiên','Mua 2 vật phẩm tại Tàng Bảo Các.','buy',2,0],
      ['Dâng vật vào môn','Mua 3 vật phẩm tại Tàng Bảo Các.','buy',3,0],
      ['Thiên đạo thử luyện','Nhận linh thạch hằng ngày.','stone_claim',1,0]
    ];
    for (const q of quests) await query('INSERT INTO sect_quests(name,description,requirement_type,requirement_value,reward_stones) VALUES($1,$2,$3,$4,$5) ON CONFLICT(name) DO NOTHING',q);
  }
  // Nhiệm Vụ Đường dùng vật phẩm làm phần thưởng; giữ reward_stones cũ để tương thích dữ liệu.
  const rewardMap = [
    ['Vận công nhập môn','Tụ Linh Đan',1],
    ['Tu luyện tinh tiến','Hàn Tuyết Đan',1],
    ['Thám bảo sơn môn','Tụ Linh Đan',1],
    ['Kho báu Hàn Thiên','Ngọc Bội Hộ Tâm',1],
    ['Nhận lộc thiên đạo','Tụ Linh Đan',2]
  ];
  for (const [qname,itemName,qty] of rewardMap) {
    await query(`UPDATE sect_quests SET reward_item_id=(SELECT id FROM treasure_items WHERE name=$2), reward_quantity=$3, reward_stones=0 WHERE name=$1`,[qname,itemName,qty]);
  }
}

async function ensureQuestCycle() {
  const cycle=Math.floor(Date.now()/300000); // 5 phút / chu kỳ
  const cycleKey=String(cycle);
  const exists=await query('SELECT COUNT(*)::int AS c FROM sect_quests WHERE cycle_key=$1',[cycleKey]);
  if(Number(exists.rows[0].c)>=4) return cycleKey;
  const pool=[
    ['Vận công nhập môn','Vận công 1 lần trong chu kỳ.','train',1,'Tụ Linh Đan',1],
    ['Tu luyện tinh tiến','Vận công 2 lần trong chu kỳ.','train',2,'Hàn Tuyết Đan',1],
    ['Thám bảo sơn môn','Mua 1 vật phẩm tại Tàng Bảo Các.','buy',1,'Tụ Linh Đan',1],
    ['Kho báu Hàn Thiên','Mua 2 vật phẩm tại Tàng Bảo Các.','buy',2,'Ngọc Bội Hộ Tâm',1],
    ['Dâng vật vào môn','Mua 3 vật phẩm tại Tàng Bảo Các.','buy',3,'Kim Đan Ngọc Lộ',1],
    ['Nhận lộc thiên đạo','Nhận linh thạch hằng ngày.','stone_claim',1,'Tụ Linh Đan',2]
  ];
  const start=Number(cycle)%pool.length;
  for(let i=0;i<4;i++){
    const q=pool[(start+i)%pool.length];
    const internalName=`${q[0]} · Chu kỳ ${cycleKey}`;
    await query(`INSERT INTO sect_quests(name,description,requirement_type,requirement_value,reward_stones,reward_item_id,reward_quantity,active,cycle_key,display_name)
      VALUES($1,$2,$3,$4,0,(SELECT id FROM treasure_items WHERE name=$5),$6,TRUE,$7,$8) ON CONFLICT(name) DO NOTHING`,
      [internalName,q[1],q[2],q[3],q[4],q[5],cycleKey,q[0]]);
  }
  await query(`UPDATE sect_quests SET active=FALSE WHERE active=TRUE AND COALESCE(cycle_key,'')<>$1`,[cycleKey]);
  return cycleKey;
}

async function logActivityEvent(clientOrPool, userId, eventType) {
  await clientOrPool.query('INSERT INTO activity_events(user_id,event_type) VALUES($1,$2)',[userId,eventType]);
}

async function questCycleStart(cycleKey) {
  return new Date(Number(cycleKey)*300000);
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


const ROOT_POOL = [
  ['Kim Linh Căn','Phàm',16,1.00],['Mộc Linh Căn','Phàm',16,1.00],['Thủy Linh Căn','Phàm',16,1.00],['Hỏa Linh Căn','Phàm',16,1.00],['Thổ Linh Căn','Phàm',16,1.00],
  ['Băng Linh Căn','Hạ Phẩm',7,1.08],['Phong Linh Căn','Hạ Phẩm',6,1.08],['Lôi Linh Căn','Trung Phẩm',5,1.18],
  ['Âm Linh Căn','Trung Phẩm',4,1.20],['Dương Linh Căn','Trung Phẩm',4,1.20],['Ngũ Hành Linh Căn','Thượng Phẩm',3,1.35],
  ['Âm Dương Linh Căn','Hiếm',2,1.55],['Thiên Linh Căn','Sử Thi',1,1.90],['Biến Dị Lôi Hỏa Linh Căn','Thần Thoại',0.3,2.20]
];
const ROOT_NAMES = ['Kim Linh Căn','Mộc Linh Căn','Thủy Linh Căn','Hỏa Linh Căn','Thổ Linh Căn','Băng Linh Căn','Lôi Linh Căn','Phong Linh Căn','Âm Dương Linh Căn','Ngũ Hành Linh Căn','Biến Dị Lôi Hỏa Linh Căn'];
const BEAST_POOL = [
  ['Hàn Ngọc Hồ','Phàm',12,1.00],['Thanh Vân Hạc','Phàm',11,1.00],['Bạch Vũ Ưng','Hạ Phẩm',9,1.10],['Kim Giáp Tê','Hạ Phẩm',8,1.12],
  ['Tử Điện Điêu','Trung Phẩm',7,1.22],['Thanh Mộc Linh Lộc','Trung Phẩm',7,1.20],['Lôi Ảnh Lang','Trung Phẩm',6,1.25],
  ['Phong Linh Hồ','Thượng Phẩm',5,1.40],['Xích Viêm Hổ','Thượng Phẩm',5,1.45],['Huyền Băng Ly','Thượng Phẩm',4,1.50],
  ['Xích Kim Viên','Hiếm',3,1.70],['Huyền Quy','Hiếm',3,1.75],['U Minh Lang','Sử Thi',2,2.00],
  ['Cửu U Miêu','Sử Thi',1.5,2.10],['Bích Nhãn Xà','Sử Thi',1,2.15],['Vân Hải Kình','Thần Thoại',0.3,2.70]
];
const BEAST_NAMES=['Bạch Vũ Ưng','Kim Giáp Tê','Tử Điện Điêu','Thanh Mộc Linh Lộc','Huyền Băng Ly','Xích Kim Viên','Phong Linh Hồ','U Minh Lang','Bích Nhãn Xà'];
function weightedPick(pool){
  const total=pool.reduce((n,x)=>n+Number(x[2]),0); let r=(crypto.randomInt(0,1000000)/1000000)*total;
  for(const x of pool){r-=Number(x[2]); if(r<=0)return x;} return pool[pool.length-1];
}
function randomCultivationGifts(){
  const r=weightedPick(ROOT_POOL), b=weightedPick(BEAST_POOL);
  const rootName=r[0]==='Thiên Linh Căn' ? r[0] : r[0];
  const beastName=b[0];
  const rarity=b[1];
  const mult=Number(b[3]);
  const base=()=>Math.round(50*mult);
  const attrs={
    attack:base()+crypto.randomInt(0,31), defense:Math.round(base()*0.9)+crypto.randomInt(0,26),
    speed:Math.round(base()*0.8)+crypto.randomInt(0,21), spirit:Math.round(base()*0.7)+crypto.randomInt(0,21),
    skill:`${rarity} · ${beastName} — Thiên phú ${rarity==='Thần Thoại'?'Thần Thông':rarity==='Sử Thi'?'Bản Mệnh':'Linh Uy'}`
  };
  return {root:rootName,rootRarity:r[1],rootMult:Number(r[3]),beast:beastName,beastRarity:rarity,beastAttrs:attrs};
}
function rarityBonus(rarity){
  return ({'Phàm':0,'Hạ Phẩm':0.03,'Trung Phẩm':0.08,'Thượng Phẩm':0.15,'Hiếm':0.25,'Sử Thi':0.40,'Thần Thoại':0.60}[rarity]||0);
}
function inferRootRarity(name){
  if(!name)return null;
  if(name.includes('Biến Dị'))return 'Sử Thi';
  if(name.includes('Thiên'))return 'Hiếm';
  if(name.includes('Âm Dương')||name.includes('Ngũ Hành')||name.includes('Băng')||name.includes('Lôi'))return 'Thượng Phẩm';
  return 'Trung Phẩm';
}
function inferBeastRarity(name){
  if(!name)return null;
  if(['Vân Hải Kình'].includes(name))return 'Thần Thoại';
  if(['Cửu U Miêu','Huyền Quy'].includes(name))return 'Sử Thi';
  if(['Xích Viêm Hổ','Huyền Băng Ly','Xích Kim Viên'].includes(name))return 'Thượng Phẩm';
  return 'Trung Phẩm';
}

async function ensureProfile(userId) {
  await query('INSERT INTO profiles(user_id,storage_capacity) VALUES($1,30) ON CONFLICT (user_id) DO UPDATE SET storage_capacity=GREATEST(COALESCE(profiles.storage_capacity,30),30)', [userId]);
  const p=(await query('SELECT spirit_power,spirit_root,spirit_beast,gacha_claimed FROM profiles WHERE user_id=$1',[userId])).rows[0];
  const stage=stageFor(Number(p.spirit_power)||0);
  // Existing accounts from v2.8 already have a roll; lock it. New accounts get one roll only.
  const claimed = Boolean(p.gacha_claimed) || Boolean(p.spirit_root) || Boolean(p.spirit_beast);
  const rootRarity=p.spirit_root ? inferRootRarity(p.spirit_root) : null;
  const beastRarity=p.spirit_beast ? inferBeastRarity(p.spirit_beast) : null;
  const hasOldBeast=Boolean(p.spirit_beast);
  await query(`UPDATE profiles SET rank=$2, realm_tier=$3, storage_capacity=COALESCE(storage_capacity,30),
    gacha_claimed=$4,
    spirit_root_rarity=COALESCE(spirit_root_rarity,$5),
    spirit_beast_rarity=COALESCE(spirit_beast_rarity,$6),
    beast_attack=CASE WHEN $7 THEN GREATEST(beast_attack,50) ELSE beast_attack END,
    beast_defense=CASE WHEN $7 THEN GREATEST(beast_defense,45) ELSE beast_defense END,
    beast_speed=CASE WHEN $7 THEN GREATEST(beast_speed,40) ELSE beast_speed END,
    beast_spirit=CASE WHEN $7 THEN GREATEST(beast_spirit,35) ELSE beast_spirit END,
    beast_skill=CASE WHEN $7 AND (beast_skill IS NULL OR beast_skill='') THEN 'Linh Uy' ELSE beast_skill END,
    updated_at=NOW() WHERE user_id=$1`,
    [userId, stage.realm, stage.tier, claimed, rootRarity, beastRarity, hasOldBeast]);
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
      query(`SELECT id,name,nick,emoji,role,bio,birthday,hobby,tags FROM members ORDER BY id`),
      query('SELECT icon,title,description FROM memories ORDER BY id'),
      query('SELECT year,title,description FROM timeline ORDER BY id'),
      query('SELECT COUNT(*)::int AS c FROM users')
    ]);
    const [accounts] = await Promise.all([
      query(`SELECT u.id,u.display_name AS name,u.username,p.avatar AS emoji,p.title,p.position,p.rank,p.spirit_power,p.bio,p.birthday,p.hobby,p.sect,p.realm_tier
             FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY u.id`)
    ]);
    // Môn nhân hiển thị phải khớp 1:1 với tài khoản đã đăng ký.
    // Danh sách mẫu cũ trong bảng members chỉ là dữ liệu legacy, không tính vào quân số môn nhân.
    const accountMembers=accounts.rows.map(x=>({...x,nick:'@'+x.username,role:x.position||x.title,tags:[x.sect,x.rank,`${x.realm_tier||1}/9 tầng`],_account:true}));
    res.json({members:accountMembers,memories:mem.rows,timeline:t.rows,userCount:u.rows[0].c,memberCount:accountMembers.length});
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
    await touchDailyActivity(p.id);
    const activity=(await query('SELECT activity_date,train_count FROM daily_activity WHERE user_id=$1',[p.id])).rows[0];
    const trainCount=String(activity?.activity_date||'').slice(0,10)===today ? Number(activity.train_count)||0 : 0;
    const maxDaily=Math.max(2,10-stage.realmIndex);
    const inventoryRows=(await query(`SELECT ti.id,ti.name,ti.category,ti.description,ti.price,ti.spirit_gain,ti.min_realm,i.quantity,i.updated_at,
      CASE ti.min_realm WHEN 0 THEN 'Phàm phẩm' WHEN 1 THEN 'Hoàng phẩm' WHEN 2 THEN 'Huyền phẩm' WHEN 3 THEN 'Địa phẩm' WHEN 4 THEN 'Thiên phẩm' WHEN 5 THEN 'Linh phẩm' WHEN 6 THEN 'Tiên phẩm' WHEN 7 THEN 'Thánh phẩm' ELSE 'Đế phẩm' END AS grade
      FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
      WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC,ti.id`,[p.id])).rows;
    const allowedPositions=positionOptionsFor(stage.realmIndex);
    if(!allowedPositions.includes(p.position)){ await query('UPDATE profiles SET position=$2 WHERE user_id=$1',[p.id,defaultPositionFor(stage.realmIndex)]); p.position=defaultPositionFor(stage.realmIndex); }
    res.json({profile:{...p,realm:stage.realm,tier:stage.tier,stage:stage.stage,positionOptions:allowedPositions,canClaimStones:last!==today,progress:progressFor(p.spirit_power),attributes:attributesFor(p.spirit_power),spiritRoot:p.spirit_root,rootRarity:p.spirit_root_rarity,spiritBeast:p.spirit_beast,beastRarity:p.spirit_beast_rarity,beastAttributes:{attack:Number(p.beast_attack)||0,defense:Number(p.beast_defense)||0,speed:Number(p.beast_speed)||0,spirit:Number(p.beast_spirit)||0,skill:p.beast_skill||'—'},gachaClaimed:Boolean(p.gacha_claimed),supportBonus:Math.round((1+rarityBonus(p.spirit_root_rarity))*100-100),inventory:inventoryRows,trainCount,maxDaily}});
  } catch(e){res.status(500).json({error:'Không thể tải hồ sơ.'});}
});

app.patch('/api/profile',auth,async(req,res)=>{
  try {
    const {displayName,title,sect,position,birthday,hobby,bio,avatar}=req.body||{};
    if(displayName!==undefined){const dn=String(displayName).trim().slice(0,40);if(!dn)return res.status(400).json({error:'Danh xưng không được để trống.'});await query('UPDATE users SET display_name=$2 WHERE id=$1',[req.session.user_id,dn]);}
    await ensureProfile(req.session.user_id);
    const pr=(await query('SELECT spirit_power FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const ps=stageFor(Number(pr?.spirit_power)||0);
    let chosenPosition=position?.toString().trim();
    if(chosenPosition){ const allowed=positionOptionsFor(ps.realmIndex); if(!allowed.includes(chosenPosition)) return res.status(400).json({error:`Chức vị ${chosenPosition} không phù hợp với ${ps.stage}.`}); }
    await query(`UPDATE profiles SET title=COALESCE($2,title), sect=COALESCE($3,sect), position=COALESCE($4,position), birthday=COALESCE($5,birthday), hobby=COALESCE($6,hobby), bio=COALESCE($7,bio), avatar=COALESCE($8,avatar), updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,title?.toString().slice(0,60),sect?.toString().slice(0,60),chosenPosition,birthday?.toString().slice(0,30),hobby?.toString().slice(0,100),bio?.toString().slice(0,500),avatar?.toString().slice(0,10)]);
    res.json({ok:true});
  } catch(e){res.status(500).json({error:'Không thể cập nhật hồ sơ.'});}
});

app.post('/api/cultivation/train',auth,async(req,res)=>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const userId=req.session.user_id;
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const aR=await client.query('SELECT activity_date,train_count FROM daily_activity WHERE user_id=$1 FOR UPDATE',[userId]);
    let trainCount=0;
    if(!aR.rows.length) await client.query('INSERT INTO daily_activity(user_id,activity_date,train_count,buy_count,stone_claim_count) VALUES($1,$2,0,0,0)',[userId,today]);
    else if(String(aR.rows[0].activity_date).slice(0,10)!==today) await client.query('UPDATE daily_activity SET activity_date=$2,train_count=0,buy_count=0,stone_claim_count=0 WHERE user_id=$1',[userId,today]);
    else trainCount=Number(aR.rows[0].train_count)||0;
    const prof=(await client.query('SELECT spirit_power,spirit_root_rarity FROM profiles WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
    const currentStage=stageFor(Number(prof.spirit_power)||0);
    const maxDaily=Math.max(2,10-currentStage.realmIndex);
    if(trainCount>=maxDaily){await client.query('ROLLBACK');return res.status(429).json({error:`Hôm nay đã vận công ${trainCount}/${maxDaily} lần. Cảnh giới càng cao càng khó tu luyện; hãy quay lại ngày mai.`,trainCount,maxDaily});}
    const baseMax=Math.max(28,72-currentStage.realmIndex*5-currentStage.tier*2);
    const baseMin=Math.max(12,Math.floor(baseMax*0.55));
    const rawGain=crypto.randomInt(baseMin,baseMax+1); const gain=Math.max(1,Math.round(rawGain*(1+rarityBonus(prof.spirit_root_rarity))));
    const r=await client.query('UPDATE profiles SET spirit_power=spirit_power+$2, experience=experience+$2, updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power,experience',[userId,gain]);
    const spirit=r.rows[0].spirit_power; const stage=stageFor(spirit);
    await client.query('UPDATE profiles SET rank=$2, realm_tier=$3 WHERE user_id=$1',[userId,stage.realm,stage.tier]);
    await client.query(`INSERT INTO daily_activity(user_id,activity_date,train_count,buy_count,stone_claim_count) VALUES($1,$2,1,0,0)
      ON CONFLICT(user_id) DO UPDATE SET activity_date=$2,train_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.train_count+1 ELSE 1 END,
      buy_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.buy_count ELSE 0 END,stone_claim_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.stone_claim_count ELSE 0 END`,[userId,today]);
    await logActivityEvent(client,userId,'train');
    await client.query('COMMIT');
    await ensureAchievements(userId,spirit);
    res.json({gain,spirit,experience:r.rows[0].experience,progress:progressFor(spirit),rank:stage.realm,stage:stage.stage,trainCount:trainCount+1,maxDaily});
  } catch(e){try{await client.query('ROLLBACK')}catch{};console.error(e);res.status(500).json({error:'Không thể vận công lúc này.'});} finally{client.release();}
});

app.post('/api/cultivation/online',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const today=(new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const p=(await client.query(`SELECT spirit_power,last_online_at,online_spirit_date,COALESCE(online_spirit_earned,0)::int AS online_spirit_earned FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id])).rows[0];
      const st=stageFor(Number(p.spirit_power)||0);
      const maxDaily=Math.max(2,10-st.realmIndex);
      const a=(await client.query(`SELECT activity_date,train_count FROM daily_activity WHERE user_id=$1`,[req.session.user_id])).rows[0];
      const trainCount= a && String(a.activity_date).slice(0,10)===today ? Number(a.train_count)||0 : 0;
      if(trainCount<maxDaily){
        await client.query('UPDATE profiles SET last_online_at=NOW(),online_spirit_date=$2,online_spirit_earned=0 WHERE user_id=$1',[req.session.user_id,today]);
        await client.query('COMMIT');
        return res.json({mode:'cultivation',active:false,gain:0,onlineEarned:0});
      }
      let earned=String(p.online_spirit_date||'').slice(0,10)===today ? Number(p.online_spirit_earned)||0 : 0;
      let last=p.last_online_at?new Date(p.last_online_at).getTime():Date.now();
      if(!p.last_online_at || String(p.online_spirit_date||'').slice(0,10)!==today) last=Date.now();
      const elapsed=Math.max(0,Date.now()-last);
      const minutes=Math.floor(elapsed/60000);
      const dailyCap=600;
      const rate=1+st.realmIndex;
      const gain=Math.max(0,Math.min(minutes*rate,dailyCap-earned));
      let spirit=Number(p.spirit_power)||0;
      if(gain>0){
        spirit+=gain; earned+=gain;
        const ns=stageFor(spirit);
        await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,last_online_at=NOW(),online_spirit_date=$6,online_spirit_earned=$7,updated_at=NOW() WHERE user_id=$1`,
          [req.session.user_id,spirit,gain,ns.realm,ns.tier,today,earned]);
      } else {
        await client.query(`UPDATE profiles SET last_online_at=NOW(),online_spirit_date=$2,online_spirit_earned=$3 WHERE user_id=$1`,[req.session.user_id,today,earned]);
      }
      await client.query('COMMIT');
      const ns=stageFor(spirit);
      res.json({mode:'online',active:true,gain,onlineEarned:earned,dailyCap,rate,spirit,stage:ns.stage,nextTickSeconds:60});
    }catch(e){try{await client.query('ROLLBACK')}catch{};throw e}finally{client.release();}
  }catch(e){console.error('online cultivation:',e);res.status(500).json({error:'Không thể cập nhật linh lực trực tuyến.'});}
});


// ─────────────────────────────────────────────────────────────────────────────
// TÀNG BẢO CÁC 2.0 · mua vật phẩm bằng linh lực
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/treasury',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query(`SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1`,[req.session.user_id])).rows[0];
    const stage=stageFor(Number(p?.spirit_power)||0);
    const items=(await query(`SELECT ti.id,ti.name,ti.category,ti.description,ti.price,ti.spirit_gain,ti.min_realm,
      CASE ti.min_realm WHEN 0 THEN 'Phàm phẩm' WHEN 1 THEN 'Hoàng phẩm' WHEN 2 THEN 'Huyền phẩm' WHEN 3 THEN 'Địa phẩm' WHEN 4 THEN 'Thiên phẩm' WHEN 5 THEN 'Linh phẩm' WHEN 6 THEN 'Tiên phẩm' WHEN 7 THEN 'Thánh phẩm' ELSE 'Đế phẩm' END AS grade,
      COALESCE(i.quantity,0)::int AS quantity
      FROM treasure_items ti
      LEFT JOIN inventory i ON i.item_id=ti.id AND i.user_id=$1
      ORDER BY ti.min_realm,ti.price,ti.id`,[req.session.user_id])).rows;
    res.json({spiritPower:Number(p?.spirit_power)||0,spiritStones:Number(p?.spirit_stones)||0,realm:stage.realm,tier:stage.tier,items});
  }catch(e){console.error('treasury:',e);res.status(500).json({error:'Không thể mở Tàng Bảo Các mới.'});}
});

app.post('/api/treasury/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const itemId=Number(req.body?.itemId);
    if(!Number.isInteger(itemId)||itemId<1)return res.status(400).json({error:'Vật phẩm không hợp lệ.'});
    await client.query('BEGIN');
    const itemR=await client.query(`SELECT id,name,category,description,price,spirit_gain,min_realm
      FROM treasure_items WHERE id=$1 FOR UPDATE`,[itemId]);
    if(!itemR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy vật phẩm.'});}
    const item=itemR.rows[0];
    const pR=await client.query(`SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(!pR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ đệ tử.'});}
    const p=pR.rows[0], stage=stageFor(Number(p.spirit_power)||0);
    if(stage.realmIndex<Number(item.min_realm)){
      await client.query('ROLLBACK');
      return res.status(403).json({error:`Vật phẩm yêu cầu ${RANKS[Number(item.min_realm)]?.name||'cảnh giới cao hơn'}. Bạn hiện ở ${stage.stage}.`});
    }
    const price=Math.max(0,Number(item.price)||0);
    if(Number(p.spirit_power)<price){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Linh lực không đủ. Cần ${price.toLocaleString('vi-VN')} linh lực.`});
    }
    const newSpirit=(Number(p.spirit_power)||0)-price+(Number(item.spirit_gain)||0);
    const ns=stageFor(newSpirit);
    await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,updated_at=NOW() WHERE user_id=$1`,
      [req.session.user_id,newSpirit,Number(item.spirit_gain)||0,ns.realm,ns.tier]);
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW())
      ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW()`,
      [req.session.user_id,itemId]);
    const today="(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
    await client.query(`INSERT INTO daily_activity(user_id,activity_date,buy_count,train_count,stone_claim_count)
      VALUES($1,${today},1,0,0)
      ON CONFLICT(user_id) DO UPDATE SET
      buy_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.buy_count+1 ELSE 1 END,
      train_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.train_count ELSE 0 END,
      stone_claim_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.stone_claim_count ELSE 0 END,
      activity_date=${today}`,[req.session.user_id]);
    await logActivityEvent(client,req.session.user_id,'buy');
    await client.query('COMMIT');
    res.json({ok:true,item:item.name,quantityAdded:1,spirit:newSpirit,spentSpirit:price,stage:ns.stage});
  }catch(e){
    try{await client.query('ROLLBACK')}catch{}
    console.error('treasury buy:',e);res.status(500).json({error:'Giao dịch Tàng Bảo Các thất bại. Vui lòng thử lại.'});
  }finally{client.release();}
});

// ─────────────────────────────────────────────────────────────────────────────
// PHƯỜNG THỊ 1.0 · mua bán và trao đổi vật phẩm giữa các môn nhân
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/market',auth,async(req,res)=>{
  try{
    const listings=(await query(`SELECT ml.id,ml.seller_id,ml.item_id,ml.quantity,ml.price_stones,ml.created_at,
      u.display_name AS seller_name,ti.name AS item_name,ti.category,ti.description
      FROM market_listings ml JOIN users u ON u.id=ml.seller_id JOIN treasure_items ti ON ti.id=ml.item_id
      ORDER BY ml.created_at DESC LIMIT 100`)).rows;
    const users=(await query(`SELECT u.id,u.display_name FROM users u WHERE u.id<>$1 ORDER BY u.display_name,u.id`,[req.session.user_id])).rows;
    const trades=(await query(`SELECT mt.id,mt.proposer_id,mt.recipient_id,mt.offer_item_id,mt.offer_quantity,mt.want_item_id,mt.want_quantity,mt.status,mt.created_at,mt.responded_at,
      pu.display_name AS proposer_name,ru.display_name AS recipient_name,
      oi.name AS offer_item_name,wi.name AS want_item_name
      FROM market_trades mt JOIN users pu ON pu.id=mt.proposer_id JOIN users ru ON ru.id=mt.recipient_id
      JOIN treasure_items oi ON oi.id=mt.offer_item_id JOIN treasure_items wi ON wi.id=mt.want_item_id
      WHERE (mt.proposer_id=$1 OR mt.recipient_id=$1) AND mt.status='pending'
      ORDER BY mt.created_at DESC LIMIT 50`,[req.session.user_id])).rows;
    const inv=(await query(`SELECT ti.id,ti.name,ti.category,i.quantity FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY ti.name`,[req.session.user_id])).rows;
    const catalog=(await query(`SELECT id,name,category FROM treasure_items ORDER BY name,id`)).rows;
    res.json({listings,users,trades,inventory:inv,catalog});
  }catch(e){console.error('market:',e);res.status(500).json({error:'Không thể mở Phường Thị.'});}
});

app.post('/api/market/list',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const itemId=Number(req.body?.itemId), qty=Math.max(1,Math.floor(Number(req.body?.quantity)||0)), price=Math.max(1,Math.floor(Number(req.body?.priceStones)||0));
    if(!Number.isInteger(itemId)||qty<1||price<1)return res.status(400).json({error:'Vật phẩm, số lượng hoặc giá bán không hợp lệ.'});
    await client.query('BEGIN');
    const ir=await client.query(`SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE`,[req.session.user_id,itemId]);
    if(!ir.rows.length||Number(ir.rows[0].quantity)<qty){await client.query('ROLLBACK');return res.status(400).json({error:'Bạn không có đủ vật phẩm để bán.'});}
    await client.query(`UPDATE inventory SET quantity=quantity-$3,updated_at=NOW() WHERE user_id=$1 AND item_id=$2`,[req.session.user_id,itemId,qty]);
    await client.query(`INSERT INTO market_listings(seller_id,item_id,quantity,price_stones) VALUES($1,$2,$3,$4)`,[req.session.user_id,itemId,qty,price]);
    await client.query('COMMIT');
    res.json({ok:true});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('market list:',e);res.status(500).json({error:'Không thể đăng bán vật phẩm.'});}
  finally{client.release();}
});

app.post('/api/market/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const listingId=Number(req.body?.listingId);
    if(!Number.isInteger(listingId)||listingId<1)return res.status(400).json({error:'Tin bán không hợp lệ.'});
    await client.query('BEGIN');
    const lr=await client.query(`SELECT ml.*,ti.name AS item_name FROM market_listings ml JOIN treasure_items ti ON ti.id=ml.item_id WHERE ml.id=$1 FOR UPDATE`,[listingId]);
    if(!lr.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Tin bán không còn tồn tại.'});}
    const l=lr.rows[0];
    if(Number(l.seller_id)===Number(req.session.user_id)){await client.query('ROLLBACK');return res.status(400).json({error:'Bạn không thể mua vật phẩm của chính mình.'});}
    const buyer=await client.query(`SELECT spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    const seller=await client.query(`SELECT spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE`,[l.seller_id]);
    if(!buyer.rows.length||!seller.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ giao dịch.'});}
    const price=Number(l.price_stones);
    if(Number(buyer.rows[0].spirit_stones)<price){await client.query('ROLLBACK');return res.status(400).json({error:`Cần ${price.toLocaleString('vi-VN')} linh thạch để mua.`});}
    await client.query(`UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,price]);
    await client.query(`UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1`,[l.seller_id,price]);
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[req.session.user_id,l.item_id,l.quantity]);
    await client.query('DELETE FROM market_listings WHERE id=$1',[listingId]);
    await client.query('COMMIT');
    res.json({ok:true,item:l.item_name,quantity:Number(l.quantity),price});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('market buy:',e);res.status(500).json({error:'Không thể mua vật phẩm trên Phường Thị.'});}
  finally{client.release();}
});

app.post('/api/market/cancel',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const listingId=Number(req.body?.listingId); await client.query('BEGIN');
    const l=(await client.query(`SELECT * FROM market_listings WHERE id=$1 AND seller_id=$2 FOR UPDATE`,[listingId,req.session.user_id])).rows[0];
    if(!l){await client.query('ROLLBACK');return res.status(404).json({error:'Tin bán không tồn tại hoặc không thuộc về bạn.'});}
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[req.session.user_id,l.item_id,l.quantity]);
    await client.query('DELETE FROM market_listings WHERE id=$1',[listingId]);
    await client.query('COMMIT');res.json({ok:true});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('market cancel:',e);res.status(500).json({error:'Không thể hủy tin bán.'});}
  finally{client.release();}
});

app.post('/api/market/trade',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const recipientId=Number(req.body?.recipientId), offerItemId=Number(req.body?.offerItemId), offerQty=Math.max(1,Math.floor(Number(req.body?.offerQuantity)||0));
    const wantItemId=Number(req.body?.wantItemId), wantQty=Math.max(1,Math.floor(Number(req.body?.wantQuantity)||0));
    if(!Number.isInteger(recipientId)||recipientId===Number(req.session.user_id)||!Number.isInteger(offerItemId)||!Number.isInteger(wantItemId)||offerQty<1||wantQty<1)return res.status(400).json({error:'Thông tin trao đổi không hợp lệ.'});
    await client.query('BEGIN');
    const u=(await client.query('SELECT id FROM users WHERE id=$1',[recipientId])).rows[0];
    if(!u){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy môn nhân nhận trao đổi.'});}
    const ir=(await client.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE',[req.session.user_id,offerItemId])).rows[0];
    if(!ir||Number(ir.quantity)<offerQty){await client.query('ROLLBACK');return res.status(400).json({error:'Bạn không đủ vật phẩm đề nghị trao đổi.'});}
    await client.query(`UPDATE inventory SET quantity=quantity-$3,updated_at=NOW() WHERE user_id=$1 AND item_id=$2`,[req.session.user_id,offerItemId,offerQty]);
    await client.query(`INSERT INTO market_trades(proposer_id,recipient_id,offer_item_id,offer_quantity,want_item_id,want_quantity) VALUES($1,$2,$3,$4,$5,$6)`,[req.session.user_id,recipientId,offerItemId,offerQty,wantItemId,wantQty]);
    await client.query('COMMIT');res.json({ok:true});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('market trade:',e);res.status(500).json({error:'Không thể tạo đề nghị trao đổi.'});}
  finally{client.release();}
});

app.post('/api/market/trade/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const tradeId=Number(req.body?.tradeId), action=String(req.body?.action||'').toLowerCase();
    if(!Number.isInteger(tradeId)||!['accept','reject','cancel'].includes(action))return res.status(400).json({error:'Yêu cầu trao đổi không hợp lệ.'});
    await client.query('BEGIN');
    const tr=(await client.query(`SELECT * FROM market_trades WHERE id=$1 FOR UPDATE`,[tradeId])).rows[0];
    if(!tr){await client.query('ROLLBACK');return res.status(404).json({error:'Đề nghị trao đổi không tồn tại.'});}
    const uid=Number(req.session.user_id);
    if(action==='cancel'){
      if(uid!==Number(tr.proposer_id)){await client.query('ROLLBACK');return res.status(403).json({error:'Chỉ người đề nghị mới có thể hủy.'});}
    }else if(uid!==Number(tr.recipient_id)){await client.query('ROLLBACK');return res.status(403).json({error:'Chỉ người nhận mới có thể phản hồi.'});}
    if(tr.status!=='pending'){await client.query('ROLLBACK');return res.status(409).json({error:'Đề nghị này đã được xử lý.'});}
    if(action==='reject'||action==='cancel'){
      await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[tr.proposer_id,tr.offer_item_id,tr.offer_quantity]);
      await client.query(`UPDATE market_trades SET status=$2,responded_at=NOW() WHERE id=$1`,[tradeId,action==='cancel'?'cancelled':'rejected']);
      await client.query('COMMIT');return res.json({ok:true,status:action==='cancel'?'cancelled':'rejected'});
    }
    if(Number(tr.offer_item_id)===Number(tr.want_item_id)){
      await client.query('ROLLBACK');return res.status(400).json({error:'Không thể trao đổi cùng một loại vật phẩm.'});
    }
    const want=(await client.query(`SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE`,[tr.recipient_id,tr.want_item_id])).rows[0];
    if(!want||Number(want.quantity)<Number(tr.want_quantity)){await client.query('ROLLBACK');return res.status(400).json({error:'Bạn không đủ vật phẩm để chấp nhận trao đổi.'});}
    await client.query(`UPDATE inventory SET quantity=quantity-$3,updated_at=NOW() WHERE user_id=$1 AND item_id=$2`,[tr.recipient_id,tr.want_item_id,tr.want_quantity]);
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[tr.recipient_id,tr.offer_item_id,tr.offer_quantity]);
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[tr.proposer_id,tr.want_item_id,tr.want_quantity]);
    await client.query(`UPDATE market_trades SET status='accepted',responded_at=NOW() WHERE id=$1`,[tradeId]);
    await client.query('COMMIT');res.json({ok:true,status:'accepted'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('market trade respond:',e);res.status(500).json({error:'Không thể xử lý trao đổi.'});}
  finally{client.release();}
});

// Backward-compatible aliases are intentionally removed from the old UI;
// these routes are only kept as redirects for clients with a cached page.
app.get('/api/treasure',auth,async(req,res)=>{ req.url='/api/treasury'; return res.redirect(307,'/api/treasury'); });
app.post('/api/treasure/buy',auth,async(req,res)=>{ req.url='/api/treasury/buy'; return res.redirect(307,'/api/treasury/buy'); });

app.post('/api/random-gifts',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const p=(await client.query(`SELECT gacha_claimed,spirit_root FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id])).rows[0];
    if(!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ đệ tử.'});}
    if(p.gacha_claimed || p.spirit_root){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'Duyên Ngẫu Nhiên chỉ được sử dụng 1 lần duy nhất.'});
    }
    const gift=randomCultivationGifts();
    const a=gift.beastAttrs;
    const r=await client.query(`UPDATE profiles SET spirit_root=$2,spirit_root_rarity=$3,spirit_beast=$4,spirit_beast_rarity=$5,
      beast_attack=$6,beast_defense=$7,beast_speed=$8,beast_spirit=$9,beast_skill=$10,gacha_claimed=TRUE,updated_at=NOW()
      WHERE user_id=$1 RETURNING spirit_root,spirit_root_rarity,spirit_beast,spirit_beast_rarity,beast_attack,beast_defense,beast_speed,beast_spirit,beast_skill`,
      [req.session.user_id,gift.root,gift.rootRarity,gift.beast,gift.beastRarity,a.attack,a.defense,a.speed,a.spirit,a.skill]);
    await client.query('COMMIT');
    res.json({ok:true,once:true,spiritRoot:r.rows[0].spirit_root,rootRarity:r.rows[0].spirit_root_rarity,
      spiritBeast:r.rows[0].spirit_beast,beastRarity:r.rows[0].spirit_beast_rarity,beastAttributes:{
        attack:r.rows[0].beast_attack,defense:r.rows[0].beast_defense,speed:r.rows[0].beast_speed,spirit:r.rows[0].beast_spirit,skill:r.rows[0].beast_skill}});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('Gacha error:',e);res.status(500).json({error:'Không thể ngẫu nhiên linh căn và linh thú.'});}
  finally{client.release();}
});

app.get('/api/inventory',auth,async(req,res)=>{
  try{const r=await query(`SELECT ti.name,ti.category,ti.description,i.quantity FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC`,[req.session.user_id]);res.json({rows:r.rows});}
  catch(e){res.status(500).json({error:'Không thể tải túi vật phẩm.'});}
});

app.get('/api/quests',auth,async(req,res)=>{
  try {
    const cycleKey=await ensureQuestCycle();
    const cycleStart=new Date(Number(cycleKey)*300000);
    const rr=(await query(`SELECT q.*,COALESCE(q.display_name,q.name) AS visible_name,ti.name AS reward_item_name,
      COALESCE((SELECT COUNT(*) FROM activity_events e WHERE e.user_id=$1 AND e.event_type=q.requirement_type AND e.created_at >= to_timestamp($2)),0)::int AS event_progress,
      EXISTS(SELECT 1 FROM user_quest_claims c WHERE c.user_id=$1 AND c.quest_id=q.id AND c.claim_date=(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS claimed
      FROM sect_quests q LEFT JOIN treasure_items ti ON ti.id=q.reward_item_id
      WHERE q.active=true AND q.cycle_key=$3 ORDER BY q.id`,[req.session.user_id,Number(cycleKey)*300,cycleKey])).rows;
    const rows=rr.map(q=>{
      const progress=Math.max(0,Math.min(Number(q.event_progress)||0,q.requirement_value));
      return {...q,name:q.visible_name,progress,completed:progress>=q.requirement_value,rewardItem:q.reward_item_id?{id:q.reward_item_id,name:q.reward_item_name,quantity:Number(q.reward_quantity)||0}:null};
    });
    res.json({cycleKey,cycleStart, nextRefreshMs:300000-(Date.now()%300000),rows});
  } catch(e){console.error('quests:',e);res.status(500).json({error:'Không thể mở Nhiệm Vụ Đường.'});}
});

app.post('/api/quests/:id/claim',auth,async(req,res)=>{
  const client=await pool.connect();
  try {
    const questId=Number(req.params.id); if(!Number.isInteger(questId))return res.status(400).json({error:'Nhiệm vụ không hợp lệ.'});
    const cycleKey=String(Math.floor(Date.now()/300000));
    await client.query('BEGIN');
    const qR=await client.query(`SELECT q.*,COALESCE(q.display_name,q.name) AS visible_name,ti.name AS reward_item_name
      FROM sect_quests q LEFT JOIN treasure_items ti ON ti.id=q.reward_item_id
      WHERE q.id=$1 AND q.active=true AND q.cycle_key=$2 FOR UPDATE`,[questId,cycleKey]);
    if(!qR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Nhiệm vụ đã hết chu kỳ. Hãy tải lại Nhiệm Vụ Đường.'});}
    const q=qR.rows[0];
    const progressR=await client.query(`SELECT COUNT(*)::int AS c FROM activity_events WHERE user_id=$1 AND event_type=$2 AND created_at >= to_timestamp($3)`,[req.session.user_id,q.requirement_type,Number(cycleKey)*300]);
    const progress=Number(progressR.rows[0].c)||0;
    if(progress<q.requirement_value){await client.query('ROLLBACK');return res.status(400).json({error:`Chưa hoàn thành nhiệm vụ. Tiến độ ${progress}/${q.requirement_value}.`});}
    const c=await client.query(`INSERT INTO user_quest_claims(user_id,quest_id,claim_date) VALUES($1,$2,(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) ON CONFLICT DO NOTHING RETURNING id`,[req.session.user_id,questId]);
    if(!c.rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã nhận thưởng nhiệm vụ này.'});}
    let rewardItem=null;
    if(q.reward_item_id && Number(q.reward_quantity)>0){
      const ir=await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW() RETURNING quantity`,[req.session.user_id,q.reward_item_id,Number(q.reward_quantity)]);
      rewardItem={name:q.reward_item_name,quantity:Number(q.reward_quantity),total:Number(ir.rows[0].quantity)};
    }
    await client.query('COMMIT');
    res.json({ok:true,rewardItem,progress});
  } catch(e){try{await client.query('ROLLBACK')}catch{};console.error('quest claim:',e);res.status(500).json({error:'Không thể nhận thưởng nhiệm vụ.'});}
  finally{client.release();}
});

const ROOT_CODEX = [
  ['Kim Linh Căn','Phàm','Tăng độ sắc bén của công lực, thiên về công kích và luyện khí.','+2% hiệu quả tu luyện'],
  ['Mộc Linh Căn','Phàm','Sinh cơ dồi dào, hồi phục tốt và ổn định căn cơ.','+2% hiệu quả tu luyện'],
  ['Thủy Linh Căn','Phàm','Khí tức mềm dẻo, thích hợp pháp thuật và điều tức.','+2% hiệu quả tu luyện'],
  ['Hỏa Linh Căn','Phàm','Nhiệt lực mạnh, công kích bộc phát cao.','+2% hiệu quả tu luyện'],
  ['Thổ Linh Căn','Phàm','Căn cơ vững chắc, thiên về phòng ngự.','+2% hiệu quả tu luyện'],
  ['Băng Linh Căn','Hạ Phẩm','Hàn khí ngưng tụ, tăng khả năng khống chế.','+8% hiệu quả tu luyện'],
  ['Phong Linh Căn','Hạ Phẩm','Thân pháp nhẹ như gió, tăng tốc độ vận công.','+8% hiệu quả tu luyện'],
  ['Lôi Linh Căn','Trung Phẩm','Lôi lực bộc phát, công thủ đều mạnh.','+18% hiệu quả tu luyện'],
  ['Âm Linh Căn','Thượng Phẩm','Khí tức u minh, giỏi che giấu và cảm ứng linh khí.','+28% hiệu quả tu luyện'],
  ['Dương Linh Căn','Thượng Phẩm','Dương khí thuần hậu, tăng sức sống và công lực.','+28% hiệu quả tu luyện'],
  ['Thiên Linh Căn','Thần Thoại','Tư chất hiếm có, hấp thu linh khí cực nhanh.','+55% hiệu quả tu luyện']
];
const BEAST_CODEX = [
  ['Hàn Ngọc Hồ','Phàm','Hồ linh thú hệ băng, hỗ trợ điều tức và cảm nhận linh khí.','Công 35 · Phòng 30 · Thân 55 · Linh 40'],
  ['Thanh Vân Hạc','Hạ Phẩm','Linh cầm tốc độ cao, thiên về thân pháp và né tránh.','Công 45 · Phòng 35 · Thân 80 · Linh 50'],
  ['Lôi Ảnh Lang','Trung Phẩm','Lang thú hệ lôi, bộc phát mạnh trong giao chiến.','Công 90 · Phòng 55 · Thân 85 · Linh 70'],
  ['Xích Viêm Hổ','Thượng Phẩm','Hổ thú hỏa hệ, công kích áp đảo và khí thế mạnh.','Công 120 · Phòng 95 · Thân 65 · Linh 85'],
  ['Huyền Quy','Hiếm','Linh thú hộ pháp, phòng ngự cực mạnh và bảo vệ chủ nhân.','Công 70 · Phòng 160 · Thân 30 · Linh 100'],
  ['Cửu U Miêu','Sử Thi','Linh miêu u minh, tăng thân pháp và cảm nhận nguy hiểm.','Công 110 · Phòng 75 · Thân 150 · Linh 125'],
  ['Tử Điện Điêu','Thần Thoại','Điện thú cực hiếm, tốc độ và linh lực đều vượt trội.','Công 180 · Phòng 120 · Thân 210 · Linh 190']
];
const rarityScore={'Phàm':1,'Hạ Phẩm':2,'Trung Phẩm':3,'Thượng Phẩm':4,'Hiếm':5,'Sử Thi':6,'Thần Thoại':7};
app.get('/api/linh-can-bang',async(req,res)=>{
  try{const r=await query(`SELECT p.spirit_root AS name,COALESCE(p.spirit_root_rarity,'Phàm') AS rarity,COUNT(*)::int AS owner_count,STRING_AGG(u.display_name, ', ' ORDER BY u.display_name) AS owners FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.spirit_root IS NOT NULL AND p.spirit_root<>'' GROUP BY p.spirit_root,p.spirit_root_rarity`);
    const map=new Map(ROOT_CODEX.map(x=>[x[0],x])); const rows=r.rows.map(x=>{const c=map.get(x.name)||[x.name,x.rarity,'',''];return {...x,description:c[2],support:c[3]};}).sort((a,b)=>(rarityScore[b.rarity]||0)-(rarityScore[a.rarity]||0)||b.owner_count-a.owner_count); res.json({rows});
  }catch(e){res.status(500).json({error:'Không thể tải Linh Căn Bảng.'});}
});
app.get('/api/linh-thu-bang',async(req,res)=>{
  try{const r=await query(`SELECT p.spirit_beast AS name,COALESCE(p.spirit_beast_rarity,'Phàm') AS rarity,COUNT(*)::int AS owner_count,STRING_AGG(u.display_name, ', ' ORDER BY u.display_name) AS owners FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.spirit_beast IS NOT NULL AND p.spirit_beast<>'' GROUP BY p.spirit_beast,p.spirit_beast_rarity`);
    const map=new Map(BEAST_CODEX.map(x=>[x[0],x])); const rows=r.rows.map(x=>{const c=map.get(x.name)||[x.name,x.rarity,'',''];return {...x,description:c[2],attributes:c[3]};}).sort((a,b)=>(rarityScore[b.rarity]||0)-(rarityScore[a.rarity]||0)||b.owner_count-a.owner_count); res.json({rows});
  }catch(e){res.status(500).json({error:'Không thể tải Linh Thú Bảng.'});}
});

app.post('/api/enhance/roll',auth,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN'); const cost=300; const p=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(Number(p.spirit_power)<cost){await client.query('ROLLBACK');return res.status(400).json({error:`Cần ${cost} linh lực để quay vật phẩm tăng cường.`});}
    const poolItems=[['Linh Phù Cường Hóa',55],['Tinh Thạch Cường Hóa',28],['Huyền Thiết Cường Hóa',12],['Thiên Đạo Cường Hóa Thạch',5]];
    const total=poolItems.reduce((n,x)=>n+x[1],0); let n=crypto.randomInt(1,total+1), chosen=poolItems[0][0]; for(const x of poolItems){n-=x[1];if(n<=0){chosen=x[0];break;}}
    const item=(await client.query('SELECT id,name,description FROM treasure_items WHERE name=$1',[chosen])).rows[0];
    const ir=await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW() RETURNING quantity`,[req.session.user_id,item.id]);
    await client.query('COMMIT'); res.json({ok:true,item:item.name,description:item.description,quantity:ir.rows[0].quantity,spirit:Number(nr.spirit_power)});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('enhance roll:',e);res.status(500).json({error:'Không thể quay vật phẩm tăng cường.'});}finally{client.release();}
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
    res.json({name:'Hàn Thiên Môn',han:'寒天門',motto:'Giữ đạo tâm · Giữ tình bằng hữu',count:count.rows[0].c,positions:[['Tông chủ · Thiên Gia Đạo','Chưởng môn sơn môn'],['Thái thượng trưởng lão','Trấn thủ đạo thống'],['Trưởng lão · Hộ pháp','Giữ luật và hộ sơn'],['Nội môn đệ tử','Đệ tử đã lập đạo cơ'],['Ngoại môn đệ tử','Môn nhân mới nhập môn']]});
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
