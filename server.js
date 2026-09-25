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

// Runtime schema guard: Render/PostgreSQL deployments can keep an older schema
// even after a newer app is deployed. Repair the columns used by profile,
// cultivation and equipment before serving those endpoints.
async function ensureRuntimeSchema() {
  await query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS realm_tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_capacity INTEGER NOT NULL DEFAULT 30;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gacha_claimed BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_root TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_beast TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_root_rarity TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spirit_beast_rarity TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_attack INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_defense INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_speed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_spirit INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_skill TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_realm TEXT NOT NULL DEFAULT 'Nhất Giai';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_realm_tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_beast_id INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_root_id INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_artifact_id INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_until TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_percent INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secret_realm_debuff_until TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secret_realm_debuff_percent INTEGER NOT NULL DEFAULT 0;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS daily_activity (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      activity_date DATE NOT NULL,
      train_count INTEGER NOT NULL DEFAULT 0,
      buy_count INTEGER NOT NULL DEFAULT 0,
      stone_claim_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS realm_breakthrough_rewards (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      realm_index INTEGER NOT NULL,
      realm_name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, realm_index)
    );
    CREATE INDEX IF NOT EXISTS idx_realm_breakthrough_rewards_user ON realm_breakthrough_rewards(user_id, realm_index);
    CREATE TABLE IF NOT EXISTS owned_spirit_beasts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      beast_id INTEGER NOT NULL REFERENCES spirit_beasts_catalog(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,beast_id)
    );
    CREATE TABLE IF NOT EXISTS owned_spirit_roots (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      root_id INTEGER NOT NULL REFERENCES spirit_roots_catalog(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,root_id)
    );
  `);
  await query(`
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    -- v3.6.23: migrate old PostgreSQL schemas used before Tàng Thư Các / Động Phủ.
    -- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS realm_index INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS realm_name TEXT NOT NULL DEFAULT 'Luyện Khí';
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT 'Hạ Phẩm';
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS price_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS training_bonus_percent INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE cultivation_techniques ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    ALTER TABLE user_techniques ADD COLUMN IF NOT EXISTS learned_realm_index INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE user_techniques ADD COLUMN IF NOT EXISTS learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE mansions ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT 'Phàm';
    ALTER TABLE mansions ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE mansions ADD COLUMN IF NOT EXISTS price_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE mansions ADD COLUMN IF NOT EXISTS spirit_per_hour INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE mansions ADD COLUMN IF NOT EXISTS min_realm INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE user_mansions ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE user_mansions ADD COLUMN IF NOT EXISTS last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE user_mansions ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- v3.6.25: repair older Bí Cảnh schemas kept by Render PostgreSQL.
    -- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS required_realm_index INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS required_realm_name TEXT NOT NULL DEFAULT 'Luyện Khí';
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS activation_cost INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS funded_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'funding';
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS active_until TIMESTAMPTZ;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS danger_percent INTEGER NOT NULL DEFAULT 10;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS debuff_percent INTEGER NOT NULL DEFAULT 5;
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS loot_tier INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realm_contributions ADD COLUMN IF NOT EXISTS realm_id INTEGER;
    ALTER TABLE secret_realm_contributions ADD COLUMN IF NOT EXISTS user_id INTEGER;
    ALTER TABLE secret_realm_contributions ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE secret_realm_contributions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT '';
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS reward_item_id INTEGER;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS reward_quantity INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS reward_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS spirit_gain INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS debuff_percent INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS debuff_until TIMESTAMPTZ;
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
    ALTER TABLE secret_realm_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    -- v3.6.26: older Render databases may also have legacy catalog tables
    -- without the columns used when a member enters/receives Bí Cảnh loot.
    ALTER TABLE secret_realms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE secret_realm_contributions ADD COLUMN IF NOT EXISTS id BIGSERIAL;
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Vật phẩm';
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS spirit_gain INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS min_realm INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'Phàm';
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS support TEXT NOT NULL DEFAULT '';
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS price_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS min_realm INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'Phàm';
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS beast_realm TEXT NOT NULL DEFAULT 'Nhất Giai';
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS beast_realm_tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS price_stones INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS min_realm INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS attack INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS defense INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS speed INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS spirit INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS skill TEXT NOT NULL DEFAULT '';
  `);
}

// Cửu Đại Cảnh Giới — mỗi cảnh giới có 9 tầng.
const SPIRIT_TO_STONE_RATE = 100; // 100 linh lực = 1 linh thạch
const RANKS = [
  { name: 'Luyện Khí', min: 0, max: 999 },
  { name: 'Trúc Cơ', min: 1000, max: 2999 },
  { name: 'Kim Đan', min: 3000, max: 6999 },
  { name: 'Nguyên Anh', min: 7000, max: 14999 },
  { name: 'Hóa Thần', min: 15000, max: 29999 },
  { name: 'Luyện Hư', min: 30000, max: 59999 },
  { name: 'Hợp Thể', min: 60000, max: 119999 },
  { name: 'Đại Thừa', min: 120000, max: 239999 },
  { name: 'Độ Kiếp', min: 240000, max: 509999 },
  // Tiên giới: mỗi cảnh giới tiếp tục có 9 tầng, 30.000 linh lực/tầng.
  { name: 'Nhân Tiên', min: 510000, max: 779999, description: 'Cánh cửa đầu tiên bước vào thế giới tiên nhân, bắt đầu thích ứng với tiên khí.' },
  { name: 'Chân Tiên', min: 780000, max: 1049999, description: 'Ổn định tiên thể, củng cố căn cơ tiên đạo.' },
  { name: 'Địa Tiên', min: 1050000, max: 1319999, description: 'Tiên nhân có địa vị cơ bản, làm chủ một vùng nhỏ hoặc động phủ riêng.' },
  { name: 'Thiên Tiên', min: 1320000, max: 1589999, description: 'Tiên lực hòa nhập thiên địa, bước vào tầng trời cao.' },
  { name: 'Huyền Tiên', min: 1590000, max: 1859999, description: 'Lĩnh ngộ pháp tắc sâu hơn, pháp lực ngày càng thâm hậu.' },
  { name: 'Kim Tiên', min: 1860000, max: 2129999, description: 'Thân thể và nguyên thần bất hủ, dung hợp với quy luật thiên địa.' },
  { name: 'Tiên Quân', min: 2130000, max: 2399999, description: 'Bậc thống trị một phương, nắm giữ quyền lực tiên giới.' },
  { name: 'Tiên Tôn', min: 2400000, max: 2669999, description: 'Chạm tới đại đạo chí cao, uy áp một phương tiên vực.' },
  { name: 'Tiên Đế', min: 2670000, max: Infinity, description: 'Cảnh giới tối cao của hệ thống hiện tại, nắm giữ đại đạo chí cao vô thượng.' }
];
const IMMORTAL_REALM_START = 9;
const TRIBULATION_COUNT = 9;
const LEGEND_CHAR_LIMITS = [300,500,800,1200,1600,2200,3000,4000,5000,5500,6000,6500,7000,7500,8000,8500,9000,10000];
const PROFESSION_DEFINITIONS = [
  {code:'alchemy',name:'Luyện Đan Sư',icon:'⚗️',reward:40,description:'Luyện chế đan dược, nhận linh thạch từ các đơn luyện đan.'},
  {code:'formation',name:'Trận Pháp Sư',icon:'🌀',reward:50,description:'Bố trí trận pháp, nhận linh thạch từ các nhiệm vụ hộ tông.'},
  {code:'talisman',name:'Luyện Phù Sư',icon:'🧿',reward:45,description:'Luyện chế linh phù, nhận linh thạch từ các đơn chế phù.'},
  {code:'herbalist',name:'Dược Sư',icon:'🌿',reward:35,description:'Nhận diện và xử lý linh dược, nhận linh thạch từ dược vụ.'}
];
function legendCharLimit(realmIndex){ return LEGEND_CHAR_LIMITS[Math.max(0,Math.min(LEGEND_CHAR_LIMITS.length-1,Number(realmIndex)||0))]||300; }
function professionSlots(realmIndex){ return Math.min(PROFESSION_DEFINITIONS.length,1+Math.floor(Math.max(0,Number(realmIndex)||0)/2)); }
function professionReward(def,realmIndex){ return Number(def.reward||0)+Math.max(0,Number(realmIndex)||0)*10; }
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

const TECHNIQUE_GRADES = ['Hạ Phẩm','Trung Phẩm','Thượng Phẩm'];
function techniqueSlots(realmIndex){ return Math.min(18, 2 + Math.floor(Math.max(0,Number(realmIndex)||0)/2)); }

function techniquePowerFor(rows){ return (rows||[]).reduce((sum,x)=>sum+(Number(x.power_bonus)||0),0); }
function techniqueTrainingBonusFor(rows){ return (rows||[]).reduce((sum,x)=>sum+(Number(x.training_bonus_percent)||0),0); }

const MANSION_SEEDS = [
  ['Tụ Linh Thảo Lư','Phàm','Động phủ sơ cấp, tụ linh khí chậm nhưng ổn định.',500,12,0],
  ['Thanh Vân Động','Hạ Phẩm','Động phủ thanh vân, linh khí dày hơn sơn môn.',1500,30,1],
  ['Hàn Nguyệt Phủ','Trung Phẩm','Hàn nguyệt linh tuyền liên tục hội tụ linh lực.',4000,70,2],
  ['Kim Đan Linh Phủ','Thượng Phẩm','Linh mạch kim đan, tốc độ tích lũy linh lực rõ rệt.',9000,150,3],
  ['Nguyên Anh Thiên Phủ','Hiếm','Thiên địa linh khí hội tụ, thích hợp đại tu sĩ.',20000,320,4],
  ['Hóa Thần Tiên Phủ','Sử Thi','Tiên khí sơ hiện, linh lực tự động tăng mạnh.',45000,700,5],
  ['Luyện Hư Hư Thiên Phủ','Sử Thi','Hư không linh mạch, linh lực cuồn cuộn không ngừng.',90000,1500,6],
  ['Đại Thừa Đạo Phủ','Thần Thoại','Đạo vận bao phủ động phủ, tốc độ tụ linh cực cao.',180000,3200,7],
  ['Độ Kiếp Thiên Phủ','Thần Thoại','Thiên môn linh phủ, linh lực dâng trào như đại kiếp.',360000,7000,8],
  ['Tiên Giới Động Thiên','Tiên Phẩm','Động thiên tiên giới, tiên khí liên tục hội tụ.',700000,15000,9],
  ['Huyền Tiên Đạo Cung','Tiên Phẩm','Đạo cung huyền tiên, tiên khí tinh thuần.',1400000,32000,13],
  ['Tiên Đế Thiên Cung','Chí Tôn','Thiên cung tối cao, tiên khí và đại đạo cùng hội tụ.',3000000,70000,17]
];

// Thưởng đột phá cảnh giới: mỗi lần bước sang một đại cảnh giới mới,
// môn nhân nhận đúng số linh thạch tương ứng với chi phí khởi động bí cảnh của cảnh giới đó.
// Dùng bảng unique để không thể nhận lặp do reload, retry hoặc nhiều request đồng thời.
async function grantRealmBreakthroughRewards(client, userId, oldRealmIndex, newRealmIndex) {
  const from = Number(oldRealmIndex);
  const to = Number(newRealmIndex);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const rewards = [];
  for (let ri = Math.max(1, from + 1); ri <= Math.min(to, RANKS.length - 1); ri++) {
    const realm = RANKS[ri];
    const costR = await client.query('SELECT activation_cost FROM secret_realms WHERE required_realm_index=$1 LIMIT 1',[ri]);
    const amount = Number(costR.rows[0]?.activation_cost) || 0;
    if (amount <= 0) continue;
    const ins = await client.query(`INSERT INTO realm_breakthrough_rewards(user_id,realm_index,realm_name,amount)
      VALUES($1,$2,$3,$4) ON CONFLICT(user_id,realm_index) DO NOTHING RETURNING amount`,[userId,ri,realm.name,amount]);
    if (ins.rows.length) {
      await client.query('UPDATE profiles SET spirit_stones=COALESCE(spirit_stones,0)+$2,updated_at=NOW() WHERE user_id=$1',[userId,amount]);
      rewards.push({realmIndex:ri,realmName:realm.name,amount});
    }
  }
  return rewards;
}
const POSITION_RULES = [
  {name:'Ngoại môn đệ tử', min:0, max:0},
  {name:'Nội môn đệ tử', min:1, max:2},
  {name:'Chấp sự', min:2, max:4},
  {name:'Hộ pháp', min:4, max:6},
  {name:'Trưởng lão', min:5, max:7},
  {name:'Thái thượng trưởng lão', min:7, max:8},
  {name:'Tông chủ', min:8, max:8},
  {name:'Tiên Môn Chí Tôn', min:9, max:17}
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
    CREATE TABLE IF NOT EXISTS legends (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      realm_index INTEGER NOT NULL DEFAULT 0,
      realm_name TEXT NOT NULL DEFAULT 'Luyện Khí',
      realm_tier INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_legends_updated_at ON legends(updated_at DESC);
    CREATE TABLE IF NOT EXISTS cultivation_techniques (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      realm_index INTEGER NOT NULL,
      realm_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      description TEXT NOT NULL,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      power_bonus INTEGER NOT NULL DEFAULT 0,
      training_bonus_percent INTEGER NOT NULL DEFAULT 0,
      ability TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS user_techniques (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      technique_id INTEGER NOT NULL REFERENCES cultivation_techniques(id) ON DELETE CASCADE,
      learned_realm_index INTEGER NOT NULL DEFAULT 0,
      learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,technique_id)
    );
    CREATE TABLE IF NOT EXISTS mansions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      grade TEXT NOT NULL,
      description TEXT NOT NULL,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      spirit_per_hour INTEGER NOT NULL CHECK(spirit_per_hour > 0),
      min_realm INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_mansions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mansion_id INTEGER NOT NULL REFERENCES mansions(id) ON DELETE RESTRICT,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_professions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profession_code TEXT NOT NULL,
      learned_realm_index INTEGER NOT NULL DEFAULT 0,
      learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_claim_at TIMESTAMPTZ,
      UNIQUE(user_id, profession_code)
    );
    CREATE INDEX IF NOT EXISTS idx_user_professions_user ON user_professions(user_id);
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
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_realm TEXT NOT NULL DEFAULT 'Nhất Giai';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beast_realm_tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_beast_id INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_root_id INTEGER;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_artifact_id INTEGER;
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
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS spirit_roots_catalog (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      rarity TEXT NOT NULL,
      description TEXT NOT NULL,
      support TEXT NOT NULL,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      min_realm INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_roots_catalog ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS spirit_beasts_catalog (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      rarity TEXT NOT NULL,
      description TEXT NOT NULL,
      beast_realm TEXT NOT NULL,
      beast_realm_tier INTEGER NOT NULL DEFAULT 1,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      min_realm INTEGER NOT NULL DEFAULT 0,
      attack INTEGER NOT NULL DEFAULT 0,
      defense INTEGER NOT NULL DEFAULT 0,
      speed INTEGER NOT NULL DEFAULT 0,
      spirit INTEGER NOT NULL DEFAULT 0,
      skill TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE spirit_beasts_catalog ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES treasure_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,item_id)
    );
    -- Migration for databases created by older Hàn Thiên Môn versions.
    -- CREATE TABLE IF NOT EXISTS does not modify an existing inventory table.
    ALTER TABLE inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE TABLE IF NOT EXISTS owned_spirit_beasts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      beast_id INTEGER NOT NULL REFERENCES spirit_beasts_catalog(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,beast_id)
    );
    CREATE TABLE IF NOT EXISTS owned_spirit_roots (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      root_id INTEGER NOT NULL REFERENCES spirit_roots_catalog(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,root_id)
    );
    UPDATE inventory SET updated_at=NOW() WHERE updated_at IS NULL;
    -- Repair the inventory -> treasure_items FK on databases migrated from older versions.
    -- Some old deployments retained a stale constraint definition/name. Recreate it safely.
    DELETE FROM inventory i
    WHERE NOT EXISTS (SELECT 1 FROM treasure_items ti WHERE ti.id=i.item_id);
    ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_item_id_fkey;
    ALTER TABLE inventory ADD CONSTRAINT inventory_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES treasure_items(id) ON DELETE CASCADE;

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
    CREATE TABLE IF NOT EXISTS friend_requests (
      id BIGSERIAL PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE(requester_id, addressee_id),
      CHECK(requester_id <> addressee_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee_status ON friend_requests(addressee_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_status ON friend_requests(requester_id,status,created_at DESC);

    CREATE TABLE IF NOT EXISTS private_messages (
      id BIGSERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      CHECK(sender_id <> recipient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_private_messages_conversation ON private_messages(sender_id,recipient_id,id DESC);
    CREATE INDEX IF NOT EXISTS idx_private_messages_recipient ON private_messages(recipient_id,id DESC);

    CREATE TABLE IF NOT EXISTS challenge_requests (
      id BIGSERIAL PRIMARY KEY,
      challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      opponent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode TEXT NOT NULL CHECK(mode IN ('online','offline')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed')),
      winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      loser_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      challenger_damage NUMERIC(8,4) NOT NULL DEFAULT 0,
      opponent_damage NUMERIC(8,4) NOT NULL DEFAULT 0,
      success_chance NUMERIC(6,4) NOT NULL DEFAULT 0,
      reward_spirit INTEGER NOT NULL DEFAULT 0,
      reward_item_id INTEGER REFERENCES treasure_items(id) ON DELETE SET NULL,
      reward_quantity INTEGER NOT NULL DEFAULT 0,
      penalty_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_challenge_opponent_status ON challenge_requests(opponent_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_challenge_challenger_status ON challenge_requests(challenger_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_challenge_history ON challenge_requests(created_at DESC);
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS challenger_hp NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS opponent_hp NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS challenger_max_hp NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS opponent_max_hp NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS turn_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS last_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS last_damage NUMERIC(14,2) NOT NULL DEFAULT 0;
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS last_action TEXT NOT NULL DEFAULT '';
    ALTER TABLE challenge_requests ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS discipleship_requests (
      id BIGSERIAL PRIMARY KEY,
      disciple_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL DEFAULT 'disciple_to_mentor' CHECK(request_type IN ('disciple_to_mentor','mentor_to_disciple')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      UNIQUE(disciple_id, mentor_id, status)
    );
    CREATE INDEX IF NOT EXISTS idx_discipleship_requests_mentor ON discipleship_requests(mentor_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_discipleship_requests_disciple ON discipleship_requests(disciple_id,status,created_at DESC);
    ALTER TABLE discipleship_requests ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'disciple_to_mentor';
    UPDATE discipleship_requests SET request_type='disciple_to_mentor' WHERE request_type IS NULL;
    CREATE INDEX IF NOT EXISTS idx_discipleship_requests_type_status ON discipleship_requests(request_type,status,created_at DESC);

    CREATE TABLE IF NOT EXISTS mentor_disciples (
      id BIGSERIAL PRIMARY KEY,
      mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      disciple_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK(mentor_id <> disciple_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mentor_disciples_mentor ON mentor_disciples(mentor_id,created_at DESC);

    CREATE TABLE IF NOT EXISTS disciple_challenge_permissions (
      id BIGSERIAL PRIMARY KEY,
      disciple_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','used')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_disciple_perm_mentor ON disciple_challenge_permissions(mentor_id,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_disciple_perm_lookup ON disciple_challenge_permissions(disciple_id,challenger_id,status,created_at DESC);

    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_until TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_percent INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_debuff_text TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS secret_realms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      required_realm_index INTEGER NOT NULL UNIQUE,
      required_realm_name TEXT NOT NULL,
      activation_cost INTEGER NOT NULL CHECK(activation_cost > 0),
      funded_stones INTEGER NOT NULL DEFAULT 0 CHECK(funded_stones >= 0),
      status TEXT NOT NULL DEFAULT 'funding' CHECK(status IN ('funding','active','paused')),
      active_until TIMESTAMPTZ,
      paused_until TIMESTAMPTZ,
      danger_percent INTEGER NOT NULL DEFAULT 10,
      debuff_percent INTEGER NOT NULL DEFAULT 5,
      loot_tier INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS secret_realm_contributions (
      id BIGSERIAL PRIMARY KEY,
      realm_id INTEGER NOT NULL REFERENCES secret_realms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK(amount > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_secret_realm_contrib_realm ON secret_realm_contributions(realm_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS secret_realm_runs (
      id BIGSERIAL PRIMARY KEY,
      realm_id INTEGER NOT NULL REFERENCES secret_realms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      outcome TEXT NOT NULL CHECK(outcome IN ('success','failure','broken')),
      reward_type TEXT NOT NULL DEFAULT '',
      reward_item_id INTEGER REFERENCES treasure_items(id) ON DELETE SET NULL,
      reward_quantity INTEGER NOT NULL DEFAULT 0,
      reward_stones INTEGER NOT NULL DEFAULT 0,
      spirit_gain INTEGER NOT NULL DEFAULT 0,
      debuff_percent INTEGER NOT NULL DEFAULT 0,
      debuff_until TIMESTAMPTZ,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_secret_realm_runs_realm ON secret_realm_runs(realm_id,created_at DESC);
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secret_realm_debuff_until TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secret_realm_debuff_percent INTEGER NOT NULL DEFAULT 0;

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
    CREATE TABLE IF NOT EXISTS cultivation_techniques (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      realm_index INTEGER NOT NULL,
      realm_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      description TEXT NOT NULL,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      power_bonus INTEGER NOT NULL DEFAULT 0,
      training_bonus_percent INTEGER NOT NULL DEFAULT 0,
      ability TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_cultivation_techniques_realm ON cultivation_techniques(realm_index,price_stones,id);
    CREATE TABLE IF NOT EXISTS user_techniques (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      technique_id INTEGER NOT NULL REFERENCES cultivation_techniques(id) ON DELETE CASCADE,
      learned_realm_index INTEGER NOT NULL DEFAULT 0,
      learned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id,technique_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_techniques_user ON user_techniques(user_id);
    CREATE TABLE IF NOT EXISTS mansions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      grade TEXT NOT NULL,
      description TEXT NOT NULL,
      price_stones INTEGER NOT NULL CHECK(price_stones >= 0),
      spirit_per_hour INTEGER NOT NULL CHECK(spirit_per_hour > 0),
      min_realm INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_mansions (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mansion_id INTEGER NOT NULL REFERENCES mansions(id) ON DELETE RESTRICT,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      last_tick_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_user_mansions_active ON user_mansions(active);
    CREATE TABLE IF NOT EXISTS ascension_tribulations (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0 AND attempt_count <= 9),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
  `);

  // Chạy migration trước seed để DB cũ có đủ cột cho Tàng Thư Các/Động Phủ.
  await ensureRuntimeSchema();

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
  const items = [
    ['Tụ Linh Đan','Đan dược','Tăng ngay 150 linh lực, thích hợp cho đệ tử mới nhập môn.',80,150,0],
    ['Hàn Tuyết Đan','Đan dược','Tăng ngay 500 linh lực, ngưng tụ hàn khí trong đan điền.',220,500,1],
    ['Kim Đan Ngọc Lộ','Đan dược','Tăng ngay 1200 linh lực, chỉ mở bán từ Kim Đan.',450,1200,2],
    ['Hàn Thiên Kiếm','Pháp bảo','Pháp bảo trấn môn, lưu vào kho bảo vật của đệ tử.',700,0,2],
    ['Ngọc Bội Hộ Tâm','Pháp bảo','Ngọc bội hộ thân, một món pháp bảo quý trong Tàng Bảo Các.',1000,0,3],
    ['Cửu U Tiên Ấn','Pháp bảo','Ấn tín cổ xưa dành cho đại đạo giả.',2500,0,5]
  ];
  for (const item of items) await query('INSERT INTO treasure_items(name,category,description,price,spirit_gain,min_realm) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING',item);
  const enhanceItems = [
    ['Linh Phù Cường Hóa','Vật phẩm tăng cường','Linh phù dùng để cường hóa pháp bảo, tăng 3% hiệu quả trong lần cường hóa tiếp theo.',0,0,0],
    ['Tinh Thạch Cường Hóa','Vật phẩm tăng cường','Tinh thạch hiếm, tăng 8% hiệu quả cường hóa pháp bảo.',0,0,2],
    ['Huyền Thiết Cường Hóa','Vật phẩm tăng cường','Huyền thiết tôi luyện từ địa hỏa, tăng 15% hiệu quả cường hóa.',0,0,4],
    ['Thiên Đạo Cường Hóa Thạch','Vật phẩm tăng cường','Cường hóa thạch cực hiếm, tăng 30% hiệu quả cường hóa.',0,0,7]
  ];
  for (const item of enhanceItems) await query('INSERT INTO treasure_items(name,category,description,price,spirit_gain,min_realm) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING',item);
  await query('ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS power_bonus INTEGER NOT NULL DEFAULT 0');
  await query("ALTER TABLE treasure_items ADD COLUMN IF NOT EXISTS ability TEXT NOT NULL DEFAULT ''");
  const artifactData = {
    'Hàn Thiên Kiếm':[260,'Hàn Thiên Kiếm: +8% công lực khi khiêu chiến.'],
    'Ngọc Bội Hộ Tâm':[320,'Hộ Tâm: giảm 8% sát thương nhận khi khiêu chiến.'],
    'Cửu U Tiên Ấn':[650,'Cửu U Tiên Ấn: +15% công lực và +10% linh lực khi giao chiến.']
  };
  for (const [name,[power,ability]] of Object.entries(artifactData)) await query('UPDATE treasure_items SET power_bonus=$2,ability=$3 WHERE name=$1',[name,power,ability]);
  const beastItems = [
    ['Thanh Vân Lang','Linh thú','Linh thú phong hệ, tăng tốc độ hành động và có thể nuôi dưỡng lâu dài.',900,0,1],
    ['Huyền Băng Hồ','Linh thú','Hồ ly băng linh, sở hữu hàn khí mạnh và khí tức ổn định.',1800,0,3],
    ['Cửu Thiên Long Tước','Linh thú','Linh thú hiếm cấp cao, mang huyết mạch long tước.',5000,0,5]
  ];
  for (const item of beastItems) await query('INSERT INTO treasure_items(name,category,description,price,spirit_gain,min_realm) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING',item);

  // Tàng Thư Các: mỗi đại cảnh giới có 3 phẩm công pháp, chỉ mở đến cảnh giới hiện tại.
  for (let ri=0; ri<RANKS.length; ri++) {
    for (let gi=0; gi<TECHNIQUE_GRADES.length; gi++) {
      const grade=TECHNIQUE_GRADES[gi];
      const suffix=['Nhập Môn','Chân Giải','Đạo Tạng'][gi];
      const base=(ri+1)*50;
      const mult=[1,2,4][gi];
      const price=Math.max(100, (ri+1)*120*mult);
      const training=2+ri+[0,2,5][gi];
      const name=`${RANKS[ri].name} · ${suffix}`;
      const desc=`Công pháp ${grade.toLowerCase()} dành cho ${RANKS[ri].name}. Học thành giúp tăng chiến lực và hiệu quả tu luyện.`;
      const ability=`+${training}% hiệu quả vận công; +${base*mult} chiến lực.`;
      await query(`INSERT INTO cultivation_techniques(name,realm_index,realm_name,grade,description,price_stones,power_bonus,training_bonus_percent,ability)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT(name) DO UPDATE SET realm_index=EXCLUDED.realm_index,realm_name=EXCLUDED.realm_name,grade=EXCLUDED.grade,description=EXCLUDED.description,price_stones=EXCLUDED.price_stones,power_bonus=EXCLUDED.power_bonus,training_bonus_percent=EXCLUDED.training_bonus_percent,ability=EXCLUDED.ability`,
        [name,ri,RANKS[ri].name,grade,desc,price,base*mult,training,ability]);
    }
  }
  for (const m of MANSION_SEEDS) await query(`INSERT INTO mansions(name,grade,description,price_stones,spirit_per_hour,min_realm) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(name) DO UPDATE SET grade=EXCLUDED.grade,description=EXCLUDED.description,price_stones=EXCLUDED.price_stones,spirit_per_hour=EXCLUDED.spirit_per_hour,min_realm=EXCLUDED.min_realm`,m);

  const secretRealmSeeds = [
    ['Thanh Vân Bí Cảnh','Bí cảnh sơ cấp, thích hợp Luyện Khí và Trúc Cơ; nguy hiểm thấp.',0,'Luyện Khí',500,8,5,0],
    ['Hàn Nguyệt Bí Cảnh','Hàn khí dày đặc, thử thách Trúc Cơ.',1,'Trúc Cơ',1200,14,8,1],
    ['Kim Đan Cổ Cảnh','Cổ địa ngưng tụ đan khí, chỉ người từ Kim Đan mới nên bước vào.',2,'Kim Đan',2500,22,12,2],
    ['Nguyên Anh Thiên Uyên','Thiên uyên biến ảo, phần thưởng bắt đầu xuất hiện bảo vật hiếm.',3,'Nguyên Anh',5000,30,16,3],
    ['Hóa Thần Tiên Khư','Tiên khư đổ nát, linh áp mạnh và nguy cơ debuff cao.',4,'Hóa Thần',9000,40,22,4],
    ['Luyện Hư Hư Không','Không gian vặn xoắn, vật phẩm trung-cao cấp có tỷ lệ rơi cao.',5,'Luyện Hư',16000,50,30,5],
    ['Hợp Thể Long Mạch','Long mạch cổ xưa, nguy hiểm lớn nhưng cơ duyên cực mạnh.',6,'Hợp Thể',28000,60,38,6],
    ['Đại Thừa Thần Điện','Thần điện thượng cổ, chỉ đại năng mới chịu được linh áp.',7,'Đại Thừa',45000,72,48,7],
    ['Độ Kiếp Thiên Môn','Thiên môn cuối cùng, nguy hiểm cực cao và phần thưởng tối thượng.',8,'Độ Kiếp',80000,85,60,8]
  ];
  for (const [name,description,requiredIndex,requiredName,cost,danger,debuff,lootTier] of secretRealmSeeds) {
    await query(`INSERT INTO secret_realms(name,description,required_realm_index,required_realm_name,activation_cost,danger_percent,debuff_percent,loot_tier) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(name) DO UPDATE SET description=EXCLUDED.description,required_realm_index=EXCLUDED.required_realm_index,required_realm_name=EXCLUDED.required_realm_name,activation_cost=EXCLUDED.activation_cost,danger_percent=EXCLUDED.danger_percent,debuff_percent=EXCLUDED.debuff_percent,loot_tier=EXCLUDED.loot_tier`,[name,description,requiredIndex,requiredName,cost,danger,debuff,lootTier]);
  }

  const rootCatalog = [
    ['Kim Linh Căn','Phàm','Căn cơ kim hệ, thiên về công kích và luyện khí.','+2% hiệu quả tu luyện',250,0],
    ['Mộc Linh Căn','Phàm','Sinh cơ dồi dào, hồi phục tốt và ổn định căn cơ.','+2% hiệu quả tu luyện',250,0],
    ['Thủy Linh Căn','Phàm','Khí tức mềm dẻo, thích hợp pháp thuật và điều tức.','+2% hiệu quả tu luyện',250,0],
    ['Băng Linh Căn','Hạ Phẩm','Hàn khí ngưng tụ, tăng khả năng khống chế.','+8% hiệu quả tu luyện',700,1],
    ['Phong Linh Căn','Hạ Phẩm','Thân pháp nhẹ như gió, tăng tốc độ vận công.','+8% hiệu quả tu luyện',700,1],
    ['Lôi Linh Căn','Trung Phẩm','Lôi lực bộc phát, công thủ đều mạnh.','+18% hiệu quả tu luyện',1500,2],
    ['Âm Dương Linh Căn','Thượng Phẩm','Âm dương tương sinh, căn cơ cân bằng và sâu dày.','+28% hiệu quả tu luyện',3000,3],
    ['Thiên Linh Căn','Thần Thoại','Tư chất hiếm có, hấp thu linh khí cực nhanh.','+55% hiệu quả tu luyện',12000,5]
  ];
  for (const x of rootCatalog) await query('INSERT INTO spirit_roots_catalog(name,rarity,description,support,price_stones,min_realm) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name) DO NOTHING',x);
  const rootPowers = {
    'Kim Linh Căn':[80,'Kim Nguyên: +2% công lực.'],
    'Mộc Linh Căn':[75,'Mộc Sinh: +3% hồi phục linh lực.'],
    'Thủy Linh Căn':[78,'Thủy Vận: +2% hiệu quả pháp thuật.'],
    'Băng Linh Căn':[180,'Hàn Mạch: +5% khống chế khi khiêu chiến.'],
    'Phong Linh Căn':[190,'Phong Hành: +6% thân pháp.'],
    'Lôi Linh Căn':[300,'Lôi Căn: +8% sát thương khi khiêu chiến.'],
    'Âm Dương Linh Căn':[420,'Âm Dương: +10% công lực và +5% hồi phục.'],
    'Thiên Linh Căn':[700,'Thiên Đạo: +15% hiệu quả tu luyện và +8% công lực.']
  };
  for (const [name,[power,ability]] of Object.entries(rootPowers)) await query('UPDATE spirit_roots_catalog SET power_bonus=$2,ability=$3 WHERE name=$1',[name,power,ability]);
  const beastCatalog = [
    ['Hàn Ngọc Hồ','Phàm','Hồ linh thú hệ băng, hỗ trợ điều tức và cảm nhận linh khí.','Nhất Giai',1,500,0,35,30,55,40,'Linh Uy · Cảm Hàn'],
    ['Thanh Vân Hạc','Hạ Phẩm','Linh cầm tốc độ cao, thiên về thân pháp và né tránh.','Nhị Giai',2,1200,1,45,35,80,50,'Linh Uy · Thanh Vân'],
    ['Lôi Ảnh Lang','Trung Phẩm','Lang thú hệ lôi, bộc phát mạnh trong giao chiến.','Tam Giai',3,2400,2,90,55,85,70,'Linh Uy · Lôi Ảnh'],
    ['Xích Viêm Hổ','Thượng Phẩm','Hổ thú hỏa hệ, công kích áp đảo và khí thế mạnh.','Tứ Giai',4,4500,3,120,95,65,85,'Linh Uy · Viêm Vực'],
    ['Huyền Quy','Hiếm','Linh thú hộ pháp, phòng ngự cực mạnh và bảo vệ chủ nhân.','Ngũ Giai',5,7000,4,70,160,30,100,'Linh Uy · Huyền Giáp'],
    ['Cửu U Miêu','Sử Thi','Linh miêu u minh, tăng thân pháp và cảm nhận nguy hiểm.','Lục Giai',6,11000,5,110,75,150,125,'Bản Mệnh · Cửu U'],
    ['Tử Điện Điêu','Thần Thoại','Điện thú cực hiếm, tốc độ và linh lực đều vượt trội.','Thất Giai',7,18000,6,180,120,210,190,'Thần Thông · Tử Điện']
  ];
  for (const x of beastCatalog) await query('INSERT INTO spirit_beasts_catalog(name,rarity,description,beast_realm,beast_realm_tier,price_stones,min_realm,attack,defense,speed,spirit,skill) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(name) DO NOTHING',x);
  const beastPowers = {
    'Hàn Ngọc Hồ':[160,'Cảm Hàn: +5% hồi phục linh lực khi tu luyện.'],
    'Thanh Vân Hạc':[220,'Thanh Vân: +8% thân pháp khi giao chiến.'],
    'Lôi Ảnh Lang':[360,'Lôi Ảnh: +10% sát thương khi khiêu chiến.'],
    'Xích Viêm Hổ':[500,'Viêm Vực: +12% công lực khi khiêu chiến.'],
    'Huyền Quy':[560,'Huyền Giáp: +12% phòng thủ khi khiêu chiến.'],
    'Cửu U Miêu':[610,'Cửu U: +10% né tránh và +5% sát thương.'],
    'Tử Điện Điêu':[850,'Tử Điện: +15% sát thương và +10% thân pháp.']
  };
  for (const [name,[power,ability]] of Object.entries(beastPowers)) await query('UPDATE spirit_beasts_catalog SET power_bonus=$2,ability=$3 WHERE name=$1',[name,power,ability]);

  // Equipment integrity: remove stale equipped IDs that are no longer owned.
  await query(`UPDATE profiles p SET equipped_beast_id=NULL WHERE equipped_beast_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM owned_spirit_beasts o WHERE o.user_id=p.user_id AND o.beast_id=p.equipped_beast_id AND o.quantity>0)`);
  await query(`UPDATE profiles p SET equipped_root_id=NULL WHERE equipped_root_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM owned_spirit_roots o WHERE o.user_id=p.user_id AND o.root_id=p.equipped_root_id AND o.quantity>0)`);
  await query(`UPDATE profiles p SET equipped_artifact_id=NULL WHERE equipped_artifact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.user_id=p.user_id AND i.item_id=p.equipped_artifact_id AND i.quantity>0)`);

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
  // Migrate legacy equipped beast/root values into owned collections and keep them equipped.
  const legacy=(await query('SELECT spirit_beast,spirit_root,equipped_beast_id,equipped_root_id FROM profiles WHERE user_id=$1',[userId])).rows[0];
  if(legacy?.spirit_beast){ const br=(await query('SELECT id FROM spirit_beasts_catalog WHERE name=$1',[legacy.spirit_beast])).rows[0]; if(br){ await query('INSERT INTO owned_spirit_beasts(user_id,beast_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,beast_id) DO NOTHING',[userId,br.id]); if(!legacy.equipped_beast_id) await query('UPDATE profiles SET equipped_beast_id=$2 WHERE user_id=$1',[userId,br.id]); }}
  if(legacy?.spirit_root){ const rr=(await query('SELECT id FROM spirit_roots_catalog WHERE name=$1',[legacy.spirit_root])).rows[0]; if(rr){ await query('INSERT INTO owned_spirit_roots(user_id,root_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,root_id) DO NOTHING',[userId,rr.id]); if(!legacy.equipped_root_id) await query('UPDATE profiles SET equipped_root_id=$2 WHERE user_id=$1',[userId,rr.id]); }}
}

async function settleMansionIncome(client, userId){
  const row=(await client.query(`SELECT um.active,um.last_tick_at,m.spirit_per_hour,m.name,m.grade
    FROM user_mansions um JOIN mansions m ON m.id=um.mansion_id WHERE um.user_id=$1 FOR UPDATE`,[userId])).rows[0];
  if(!row) return {gain:0,active:false};
  if(!row.active){ await client.query(`UPDATE user_mansions SET last_tick_at=NOW() WHERE user_id=$1`,[userId]); return {gain:0,active:false,name:row.name,grade:row.grade,rate:Number(row.spirit_per_hour)||0}; }
  const elapsed=Math.max(0,Date.now()-new Date(row.last_tick_at).getTime());
  const hours=Math.floor(elapsed/3600000);
  if(hours<=0) return {gain:0,active:true,name:row.name,grade:row.grade,rate:Number(row.spirit_per_hour)||0};
  const gain=hours*(Number(row.spirit_per_hour)||0);
  const oldPower=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[userId])).rows[0]?.spirit_power||0;
  const oldStage=stageFor(Number(oldPower));
  const newPower=Number(oldPower)+gain;
  const newStage=stageFor(newPower);
  await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,updated_at=NOW() WHERE user_id=$1`,[userId,newPower,gain,newStage.realm,newStage.tier]);
  const breakthroughRewards=await grantRealmBreakthroughRewards(client,userId,oldStage.realmIndex,newStage.realmIndex);
  await client.query(`UPDATE user_mansions SET last_tick_at=last_tick_at+($2 * INTERVAL '1 hour') WHERE user_id=$1`,[userId,hours]);
  return {gain,active:true,name:row.name,grade:row.grade,rate:Number(row.spirit_per_hour)||0,breakthroughRewards};
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

// ─────────────────────────────────────────────────────────────────────────────
// TRUYỀN KỲ · mỗi môn nhân có một mục truyền kỳ công khai toàn tông môn
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/legends',async(req,res)=>{
  try{
    const r=await query(`SELECT l.id,l.user_id,l.title,l.content,l.realm_index,l.realm_name,l.realm_tier,l.created_at,l.updated_at,
      u.display_name AS author_name,u.username,p.avatar,p.position
      FROM legends l JOIN users u ON u.id=l.user_id JOIN profiles p ON p.user_id=u.id
      ORDER BY l.updated_at DESC,l.id DESC LIMIT 200`);
    res.json({rows:r.rows.map(x=>({...x,charLimit:legendCharLimit(x.realm_index)}))});
  }catch(e){console.error('legends load:',e);res.status(500).json({error:'Không thể mở Truyền Kỳ.'});}
});

app.post('/api/legends',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query('SELECT spirit_power FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const st=stageFor(Number(p?.spirit_power)||0);
    const limit=legendCharLimit(st.realmIndex);
    const title=String(req.body?.title||'').trim().slice(0,60);
    const content=String(req.body?.content||'').trim();
    if(!title)return res.status(400).json({error:'Tên mục Truyền Kỳ không được để trống.'});
    if(!content)return res.status(400).json({error:'Nội dung Truyền Kỳ không được để trống.'});
    if([...content].length>limit)return res.status(400).json({error:`Cảnh giới ${st.stage} chỉ được nhập tối đa ${limit.toLocaleString('vi-VN')} ký tự.`});
    const r=await query(`INSERT INTO legends(user_id,title,content,realm_index,realm_name,realm_tier,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,NOW())
      ON CONFLICT(user_id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,realm_index=EXCLUDED.realm_index,realm_name=EXCLUDED.realm_name,realm_tier=EXCLUDED.realm_tier,updated_at=NOW()
      RETURNING id,user_id,title,content,realm_index,realm_name,realm_tier,created_at,updated_at`,
      [req.session.user_id,title,content,st.realmIndex,st.realm,st.tier]);
    res.status(201).json({ok:true,legend:{...r.rows[0],charLimit:limit},message:'Truyền Kỳ đã được thông cáo cho toàn tông môn.'});
  }catch(e){console.error('legend save:',e);res.status(500).json({error:'Không thể lưu Truyền Kỳ.'});}
});

// ─────────────────────────────────────────────────────────────────────────────
// NGHIỆP VỤ · nghề chính + nghề phụ mở khóa theo cảnh giới
// 2 cảnh giới mới mở thêm 1 ô nghề phụ. Mỗi nghề có thù lao linh thạch riêng.
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/professions',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    const st=stageFor(Number(p?.spirit_power)||0);
    const slots=professionSlots(st.realmIndex);
    const owned=(await query('SELECT * FROM user_professions WHERE user_id=$1 ORDER BY id',[req.session.user_id])).rows;
    const rows=PROFESSION_DEFINITIONS.map(d=>{
      const o=owned.find(x=>x.profession_code===d.code);
      const reward=professionReward(d,st.realmIndex);
      return {...d,reward,learned:Boolean(o),learnedAt:o?.learned_at||null,lastClaimAt:o?.last_claim_at||null,primary:o?Number(o.id)===Number(owned[0]?.id):false};
    });
    res.json({rows,stage:st.stage,realmIndex:st.realmIndex,slots,used:owned.length,spiritStones:Number(p?.spirit_stones)||0});
  }catch(e){console.error('professions load:',e);res.status(500).json({error:'Không thể mở Nghiệp Vụ.'});}
});

app.post('/api/professions/learn',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const code=String(req.body?.code||'').trim();
    const def=PROFESSION_DEFINITIONS.find(x=>x.code===code);
    if(!def)return res.status(400).json({error:'Nghề nghiệp không hợp lệ.'});
    await client.query('BEGIN');
    const p=(await client.query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ.'});}
    const st=stageFor(Number(p.spirit_power)||0);
    const slots=professionSlots(st.realmIndex);
    const existing=(await client.query('SELECT * FROM user_professions WHERE user_id=$1 ORDER BY id FOR UPDATE',[req.session.user_id])).rows;
    if(existing.some(x=>x.profession_code===code)){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã tiếp nhận nghề này.'});}
    if(existing.length>=slots){await client.query('ROLLBACK');return res.status(400).json({error:`${st.stage} chỉ mở ${slots} ô nghề. Cần đạt thêm cảnh giới để học nghề phụ.`});}
    const reward=professionReward(def,st.realmIndex);
    await client.query(`INSERT INTO user_professions(user_id,profession_code,learned_realm_index) VALUES($1,$2,$3)`,[req.session.user_id,code,st.realmIndex]);
    const nr=await client.query(`UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_stones`,[req.session.user_id,reward]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,profession:def.name,reward,spiritStones:Number(nr.rows[0].spirit_stones),message:`Tiếp nhận ${def.name} thành công. Nhận ${reward.toLocaleString('vi-VN')} linh thạch nhập nghiệp.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('profession learn:',e);res.status(500).json({error:'Không thể tiếp nhận nghề nghiệp.'});}
  finally{client.release();}
});

app.post('/api/professions/claim',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const code=String(req.body?.code||'').trim();
    const def=PROFESSION_DEFINITIONS.find(x=>x.code===code);
    if(!def)return res.status(400).json({error:'Nghề nghiệp không hợp lệ.'});
    await client.query('BEGIN');
    const p=(await client.query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    const own=(await client.query(`SELECT * FROM user_professions WHERE user_id=$1 AND profession_code=$2 FOR UPDATE`,[req.session.user_id,code])).rows[0];
    if(!p||!own){await client.query('ROLLBACK');return res.status(403).json({error:'Bạn chưa tiếp nhận nghề này.'});}
    const st=stageFor(Number(p.spirit_power)||0);
    const reward=professionReward(def,st.realmIndex);
    if(own.last_claim_at){
      const dayCheck=(await client.query(`SELECT (($1::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS claimed_today`,[own.last_claim_at])).rows[0];
      if(dayCheck?.claimed_today){await client.query('ROLLBACK');return res.status(400).json({error:'Nghiệp vụ này đã nhận thù lao hôm nay. Hãy quay lại ngày mai.'});}
    }
    const nr=await client.query(`UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_stones`,[req.session.user_id,reward]);
    await client.query(`UPDATE user_professions SET last_claim_at=NOW() WHERE id=$1`,[own.id]);
    await client.query('COMMIT');
    res.json({ok:true,profession:def.name,reward,spiritStones:Number(nr.rows[0].spirit_stones),message:`Nghiệp vụ hoàn thành. Nhận ${reward.toLocaleString('vi-VN')} linh thạch.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('profession claim:',e);res.status(500).json({error:'Không thể nhận thù lao nghề nghiệp.'});}
  finally{client.release();}
});

app.get('/api/data',async(req,res)=>{
  try {
    const [m,t,u] = await Promise.all([
      query(`SELECT id,name,nick,emoji,role,bio,birthday,hobby,tags FROM members ORDER BY id`),
      query('SELECT year,title,description FROM timeline ORDER BY id'),
      query('SELECT COUNT(*)::int AS c FROM users')
    ]);
    const legends=(await query(`SELECT l.id,l.user_id,l.title,l.content,l.realm_index,l.realm_name,l.realm_tier,l.created_at,l.updated_at,u.display_name AS author_name,u.username,p.avatar,p.position
      FROM legends l JOIN users u ON u.id=l.user_id JOIN profiles p ON p.user_id=u.id ORDER BY l.updated_at DESC,l.id DESC LIMIT 200`)).rows.map(x=>({...x,charLimit:legendCharLimit(x.realm_index)}));
    const [accounts] = await Promise.all([
      query(`SELECT u.id,u.display_name AS name,u.username,p.avatar AS emoji,p.title,p.position,p.rank,p.spirit_power,p.bio,p.birthday,p.hobby,p.sect,p.realm_tier
             FROM users u JOIN profiles p ON p.user_id=u.id ORDER BY u.id`)
    ]);
    // Môn nhân hiển thị phải khớp 1:1 với tài khoản đã đăng ký.
    // Danh sách mẫu cũ trong bảng members chỉ là dữ liệu legacy, không tính vào quân số môn nhân.
    const accountMembers=accounts.rows.map(x=>({...x,nick:'@'+x.username,role:x.position||x.title,tags:[x.sect,x.rank,`${x.realm_tier||1}/9 tầng`],_account:true}));
    res.json({members:accountMembers,memories:legends,timeline:t.rows,userCount:u.rows[0].c,memberCount:accountMembers.length});
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
    await ensureRuntimeSchema();
    await ensureProfile(req.session.user_id);
    const mansionClient=await pool.connect();
    try{await mansionClient.query('BEGIN');await settleMansionIncome(mansionClient,req.session.user_id);await mansionClient.query('COMMIT');}catch(e){try{await mansionClient.query('ROLLBACK')}catch{};throw e;}finally{mansionClient.release();}
    const r=await query(`SELECT u.id,u.username,u.display_name,u.created_at,p.*,
      COALESCE((SELECT SUM(points) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_points,
      COALESCE((SELECT COUNT(*) FROM achievements a WHERE a.user_id=u.id),0)::int AS achievement_count
      FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[req.session.user_id]);
    const p=r.rows[0];
    await ensureAchievements(p.id,p.spirit_power);
    const stage=stageFor(p.spirit_power);
    const eq=(await query(`SELECT p.equipped_beast_id,p.equipped_root_id,p.equipped_artifact_id,
      b.name AS beast_name,b.power_bonus AS beast_power,b.ability AS beast_ability,
      r.name AS root_name,r.power_bonus AS root_power,r.ability AS root_ability,
      a.name AS artifact_name,a.power_bonus AS artifact_power,a.ability AS artifact_ability
      FROM profiles p
      LEFT JOIN spirit_beasts_catalog b ON b.id=p.equipped_beast_id
      LEFT JOIN spirit_roots_catalog r ON r.id=p.equipped_root_id
      LEFT JOIN treasure_items a ON a.id=p.equipped_artifact_id
      WHERE p.user_id=$1`,[p.id])).rows[0]||{};
    const techniqueRows=(await query(`SELECT ct.power_bonus,ct.training_bonus_percent,ct.name,ct.grade,ct.ability
      FROM user_techniques ut JOIN cultivation_techniques ct ON ct.id=ut.technique_id WHERE ut.user_id=$1 ORDER BY ct.realm_index,ct.id`,[p.id])).rows;
    const mansion=(await query(`SELECT um.active,m.id,m.name,m.grade,m.spirit_per_hour,um.last_tick_at FROM user_mansions um JOIN mansions m ON m.id=um.mansion_id WHERE um.user_id=$1`,[p.id])).rows[0]||null;
    const baseAttr=attributesFor(p.spirit_power);
    const equipmentPower=(Number(eq.beast_power)||0)+(Number(eq.root_power)||0)+(Number(eq.artifact_power)||0);
    const techniquePower=techniquePowerFor(techniqueRows);
    const secretDebuffActive=p.secret_realm_debuff_until && new Date(p.secret_realm_debuff_until)>new Date();
    const secretDebuffPct=secretDebuffActive?Math.max(0,Number(p.secret_realm_debuff_percent)||0):0;
    const combatPower=Math.max(1,Math.round((Object.values(baseAttr).reduce((n,v)=>n+(Number(v)||0),0)+equipmentPower+techniquePower)*(1-secretDebuffPct/100)));
    const today=(new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const last=p.last_stone_claim ? new Date(p.last_stone_claim).toISOString().slice(0,10) : null;
    await touchDailyActivity(p.id);
    const activity=(await query('SELECT activity_date,train_count FROM daily_activity WHERE user_id=$1',[p.id])).rows[0];
    const trainCount=String(activity?.activity_date||'').slice(0,10)===today ? Number(activity.train_count)||0 : 0;
    const maxDaily=Math.max(2,10-stage.realmIndex);
    const allowedPositions=positionOptionsFor(stage.realmIndex);
    const activeBattle=(await query(`SELECT id,challenger_id,opponent_id,challenger_hp,opponent_hp,challenger_max_hp,opponent_max_hp,turn_user_id,round_number,last_actor_id,last_damage,last_action,started_at FROM challenge_requests WHERE status='accepted' AND (challenger_id=$1 OR opponent_id=$1) ORDER BY id DESC LIMIT 1`,[p.id])).rows[0]||null;
    const healthMax=challengeHealth({...p,equipment_power:equipmentPower});
    const healthCurrent=activeBattle ? (Number(activeBattle.challenger_id)===Number(p.id)?Number(activeBattle.challenger_hp):Number(activeBattle.opponent_hp)) : healthMax;

    if(!allowedPositions.includes(p.position)){ await query('UPDATE profiles SET position=$2 WHERE user_id=$1',[p.id,defaultPositionFor(stage.realmIndex)]); p.position=defaultPositionFor(stage.realmIndex); }
    res.json({profile:{...p,secretRealmDebuffActive:secretDebuffActive,secretRealmDebuffPercent:secretDebuffPct,realm:stage.realm,tier:stage.tier,stage:stage.stage,positionOptions:allowedPositions,canClaimStones:last!==today,progress:progressFor(p.spirit_power),attributes:{...baseAttr,combatPower,equipmentPower,techniquePower,health:Math.max(0,Math.round(healthCurrent)),healthMax:Math.max(1,Math.round(activeBattle?(Number(activeBattle.challenger_id)===Number(p.id)?Number(activeBattle.challenger_max_hp):Number(activeBattle.opponent_max_hp)):healthMax))},activeBattle:activeBattle?battleSnapshot(activeBattle,p.id):null,techniques:techniqueRows,techniqueCount:techniqueRows.length,techniqueSlots:techniqueSlots(stage.realmIndex),mansion:mansion?{active:Boolean(mansion.active),id:mansion.id,name:mansion.name,grade:mansion.grade,spiritPerHour:Number(mansion.spirit_per_hour)||0,lastTickAt:mansion.last_tick_at}:null,equipment:{beast:eq.equipped_beast_id?{id:eq.equipped_beast_id,name:eq.beast_name,power:Number(eq.beast_power)||0,ability:eq.beast_ability}:null,root:eq.equipped_root_id?{id:eq.equipped_root_id,name:eq.root_name,power:Number(eq.root_power)||0,ability:eq.root_ability}:null,artifact:eq.equipped_artifact_id?{id:eq.equipped_artifact_id,name:eq.artifact_name,power:Number(eq.artifact_power)||0,ability:eq.artifact_ability}:null},spiritRoot:p.spirit_root,rootRarity:p.spirit_root_rarity,spiritBeast:p.spirit_beast,beastRarity:p.spirit_beast_rarity,beastAttributes:{attack:Number(p.beast_attack)||0,defense:Number(p.beast_defense)||0,speed:Number(p.beast_speed)||0,spirit:Number(p.beast_spirit)||0,skill:p.beast_skill||'—'},beastRealm:p.beast_realm||'Nhất Giai',beastRealmTier:Number(p.beast_realm_tier)||1,gachaClaimed:Boolean(p.gacha_claimed),supportBonus:Math.round((1+rarityBonus(p.spirit_root_rarity))*100-100),storageCapacity:Number(p.storage_capacity)||30,trainCount,maxDaily}});
  } catch(e){console.error('profile load:', e);res.status(500).json({error:'Không thể tải hồ sơ. Hãy thử lại sau khi tải lại trang.'});}
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


// ─────────────────────────────────────────────────────────────────────────────
// TÀNG THƯ CÁC · Công pháp theo cảnh giới
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/codex',auth,async(req,res)=>{
  try{
    // Tàng Thư Các chỉ đọc dữ liệu công pháp; không phụ thuộc vào Động Phủ.
    // Điều này tránh làm hỏng Tàng Thư Các nếu schema Động Phủ của DB cũ chưa được migrate.
    const p=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    if(!p)return res.status(404).json({error:'Không tìm thấy hồ sơ.'});
    const st=stageFor(Number(p.spirit_power)||0);
    const rows=(await query(`SELECT ct.id,ct.name,ct.realm_index,ct.realm_name,ct.grade,ct.description,ct.price_stones,ct.power_bonus,ct.training_bonus_percent,ct.ability,
      EXISTS(SELECT 1 FROM user_techniques ut WHERE ut.user_id=$1 AND ut.technique_id=ct.id) AS learned
      FROM cultivation_techniques ct
      WHERE ct.realm_index <= $2
      ORDER BY ct.realm_index ASC, CASE ct.grade WHEN 'Hạ Phẩm' THEN 1 WHEN 'Trung Phẩm' THEN 2 WHEN 'Thượng Phẩm' THEN 3 ELSE 9 END, ct.price_stones ASC, ct.id ASC`,[req.session.user_id,st.realmIndex])).rows;
    const used=rows.filter(x=>x.learned).length;
    res.json({rows,stage:st.stage,realmIndex:st.realmIndex,slots:techniqueSlots(st.realmIndex),used,spiritStones:Number(p.spirit_stones)||0});
  }catch(e){console.error('codex load:',e);res.status(500).json({error:'Không thể mở Tàng Thư Các: '+(e?.message||'lỗi cơ sở dữ liệu')});}
});

app.post('/api/codex/learn',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const id=Number(req.body?.id); if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Công pháp không hợp lệ.'});
    await client.query('BEGIN');
    await settleMansionIncome(client,req.session.user_id);
    const p=(await client.query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    const st=stageFor(Number(p?.spirit_power)||0);
    const tech=(await client.query('SELECT * FROM cultivation_techniques WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!tech){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy công pháp.'});}
    if(st.realmIndex<Number(tech.realm_index)){await client.query('ROLLBACK');return res.status(403).json({error:`Công pháp yêu cầu ${tech.realm_name}. Bạn hiện ở ${st.stage}.`});}
    const learned=(await client.query('SELECT COUNT(*)::int AS c FROM user_techniques WHERE user_id=$1',[req.session.user_id])).rows[0].c;
    if(learned>=techniqueSlots(st.realmIndex)){await client.query('ROLLBACK');return res.status(400).json({error:`${st.stage} chỉ được học tối đa ${techniqueSlots(st.realmIndex)} công pháp.`});}
    if((await client.query('SELECT 1 FROM user_techniques WHERE user_id=$1 AND technique_id=$2',[req.session.user_id,id])).rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã học công pháp này.'});}
    const price=Number(tech.price_stones)||0, stones=Number(p.spirit_stones)||0;
    if(stones<price){await client.query('ROLLBACK');return res.status(400).json({error:`Linh thạch không đủ. Cần ${price.toLocaleString('vi-VN')} linh thạch.`});}
    await client.query('UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1',[req.session.user_id,price]);
    await client.query('INSERT INTO user_techniques(user_id,technique_id,learned_realm_index) VALUES($1,$2,$3)',[req.session.user_id,id,st.realmIndex]);
    await client.query('COMMIT');
    res.json({ok:true,name:tech.name,price,powerBonus:Number(tech.power_bonus)||0,trainingBonus:Number(tech.training_bonus_percent)||0,ability:tech.ability,slots:techniqueSlots(st.realmIndex),used:learned+1,message:`Đã mua và học ${tech.name}. Chiến lực +${Number(tech.power_bonus||0).toLocaleString('vi-VN')}.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('codex learn:',e);res.status(500).json({error:'Không thể mua và học công pháp.'});}finally{client.release();}
});

// ─────────────────────────────────────────────────────────────────────────────
// ĐỘNG PHỦ · mua theo phẩm cấp, tự động tích linh lực khi khởi động
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/mansion',auth,async(req,res)=>{
  try{
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const settled=await settleMansionIncome(client,req.session.user_id);
      await client.query('COMMIT');
      const p=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
      const st=stageFor(Number(p?.spirit_power)||0);
      const owned=(await query(`SELECT um.mansion_id,um.active,um.last_tick_at,m.name,m.grade,m.description,m.price_stones,m.spirit_per_hour,m.min_realm FROM user_mansions um JOIN mansions m ON m.id=um.mansion_id WHERE um.user_id=$1`,[req.session.user_id])).rows[0]||null;
      const mansions=(await query('SELECT * FROM mansions ORDER BY id')).rows;
      res.json({mansions,owned,stage:st.stage,realmIndex:st.realmIndex,spiritPower:Number(p?.spirit_power)||0,spiritStones:Number(p?.spirit_stones)||0,settledGain:settled.gain||0});
    }finally{client.release();}
  }catch(e){console.error('mansion load:',e);res.status(500).json({error:'Không thể mở Động Phủ.'});}
});

app.post('/api/mansion/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const id=Number(req.body?.id); if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Động phủ không hợp lệ.'});
    await client.query('BEGIN');
    const settled=await settleMansionIncome(client,req.session.user_id);
    const p=(await client.query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    const m=(await client.query('SELECT * FROM mansions WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!m){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy động phủ.'});}
    const st=stageFor(Number(p?.spirit_power)||0);
    if(st.realmIndex<Number(m.min_realm)){await client.query('ROLLBACK');return res.status(403).json({error:`Động phủ yêu cầu ${RANKS[m.min_realm]?.name||'cảnh giới cao hơn'}.`});}
    const owned=(await client.query('SELECT mansion_id FROM user_mansions WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(owned){if(Number(owned.mansion_id)>=Number(m.id)){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã sở hữu động phủ này hoặc phẩm cấp cao hơn.'});} if(Number(m.id)!==Number(owned.mansion_id)+1){await client.query('ROLLBACK');return res.status(400).json({error:'Phải mua động phủ theo thứ tự phẩm cấp từ thấp lên cao.'});}}
    const price=Number(m.price_stones)||0, stones=Number(p.spirit_stones)||0;
    if(stones<price){await client.query('ROLLBACK');return res.status(400).json({error:`Linh thạch không đủ. Cần ${price.toLocaleString('vi-VN')} linh thạch.`});}
    await client.query('UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1',[req.session.user_id,price]);
    if(owned) await client.query('UPDATE user_mansions SET mansion_id=$2,active=FALSE,last_tick_at=NOW() WHERE user_id=$1',[req.session.user_id,id]);
    else await client.query('INSERT INTO user_mansions(user_id,mansion_id,active,last_tick_at) VALUES($1,$2,FALSE,NOW())',[req.session.user_id,id]);
    await client.query('COMMIT');
    res.json({ok:true,mansion:m.name,grade:m.grade,price,spiritPerHour:Number(m.spirit_per_hour),message:`Mua ${m.name} thành công. Hãy khởi động động phủ để bắt đầu tự động tích linh lực.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('mansion buy:',e);res.status(500).json({error:'Không thể mua động phủ.'});}finally{client.release();}
});

app.post('/api/mansion/toggle',auth,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN'); const owned=(await client.query(`SELECT um.active,m.name FROM user_mansions um JOIN mansions m ON m.id=um.mansion_id WHERE um.user_id=$1 FOR UPDATE`,[req.session.user_id])).rows[0]; if(!owned){await client.query('ROLLBACK');return res.status(404).json({error:'Bạn chưa mua động phủ.'});} const settled=await settleMansionIncome(client,req.session.user_id); const active=!Boolean(owned.active); await client.query('UPDATE user_mansions SET active=$2,last_tick_at=NOW() WHERE user_id=$1',[req.session.user_id,active]); await client.query('COMMIT'); res.json({ok:true,active,gain:settled.gain||0,message:active?`Đã khởi động ${owned.name}. Vận công bị khóa hoàn toàn.`:`Đã ngưng ${owned.name}. Có thể vận công trở lại.`});}
  catch(e){try{await client.query('ROLLBACK')}catch{};console.error('mansion toggle:',e);res.status(500).json({error:'Không thể thay đổi trạng thái động phủ.'});}finally{client.release();}
});

app.get('/api/ascension',auth,async(req,res)=>{
  try{
    const p=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0];
    if(!p)return res.status(404).json({error:'Không tìm thấy hồ sơ.'});
    const st=stageFor(Number(p.spirit_power)||0);
    const row=(await query('SELECT attempt_count,started_at,completed_at FROM ascension_tribulations WHERE user_id=$1',[req.session.user_id])).rows[0];
    const attempts=Math.min(TRIBULATION_COUNT,Number(row?.attempt_count)||0);
    const unlocked=st.realmIndex===8 && st.tier===9;
    res.json({unlocked,attempts,maxAttempts:TRIBULATION_COUNT,stage:st,nextRealm:RANKS[IMMORTAL_REALM_START].name,nextRealmDescription:RANKS[IMMORTAL_REALM_START].description||'',preserveCombatPower:true,spiritPower:Number(p.spirit_power)||0});
  }catch(e){console.error('ascension load:',e);res.status(500).json({error:'Không thể mở Phi Thăng - Độ Kiếp.'});}
});

app.post('/api/ascension/tribulation',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const uid=req.session.user_id;
    const p=(await client.query('SELECT spirit_power,experience,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE',[uid])).rows[0];
    if(!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ.'});}
    const st=stageFor(Number(p.spirit_power)||0);
    if(st.realmIndex!==8 || st.tier!==9){await client.query('ROLLBACK');return res.status(403).json({error:'Chỉ khi đạt Độ Kiếp Cửu Tầng mới có thể mở Phi Thăng - Độ Kiếp.'});}
    const row=(await client.query('SELECT attempt_count FROM ascension_tribulations WHERE user_id=$1 FOR UPDATE',[uid])).rows[0];
    let attempts=Math.min(TRIBULATION_COUNT,Number(row?.attempt_count)||0);
    if(attempts>=TRIBULATION_COUNT){await client.query('ROLLBACK');return res.status(409).json({error:'Cửu Trọng Thiên Kiếp đã hoàn tất. Hãy tải lại hồ sơ để nhận cảnh giới mới.'});}
    attempts+=1;
    if(row){
      await client.query('UPDATE ascension_tribulations SET attempt_count=$2,started_at=COALESCE(started_at,NOW()),completed_at=CASE WHEN $2=$3 THEN NOW() ELSE completed_at END WHERE user_id=$1',[uid,attempts,TRIBULATION_COUNT]);
    }else{
      await client.query('INSERT INTO ascension_tribulations(user_id,attempt_count,started_at,completed_at) VALUES($1,$2,NOW(),CASE WHEN $2=$3 THEN NOW() ELSE NULL END)',[uid,attempts,TRIBULATION_COUNT]);
    }
    let ascended=false, stage=st;
    if(attempts===TRIBULATION_COUNT){
      const next=RANKS[IMMORTAL_REALM_START];
      await client.query('UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=1,updated_at=NOW() WHERE user_id=$1',[uid,next.min,Math.max(0,next.min-Number(p.spirit_power)),next.name]);
      stage=stageFor(next.min); ascended=true;
    }
    await client.query('COMMIT');
    res.json({ok:true,attempts,maxAttempts:TRIBULATION_COUNT,ascended,stage,message:ascended?`🌌 Cửu Trọng Thiên Kiếp đã vượt qua! Phi thăng thành ${stage.stage}. Chiến lực, trang bị và bảo vật không bị xóa.`:`⚡ Độ kiếp lần ${attempts}/${TRIBULATION_COUNT} thành công. Chiến lực không bị xóa; tiếp tục vượt ${TRIBULATION_COUNT-attempts} lần.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('ascension tribulation:',e);res.status(500).json({error:'Độ kiếp thất bại do lỗi hệ thống, dữ liệu không bị trừ.'});}finally{client.release();}
});

app.post('/api/cultivation/train',auth,async(req,res)=>{
  await ensureRuntimeSchema();
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const userId=req.session.user_id;
    const mansionState=await settleMansionIncome(client,userId);
    if(mansionState.active){await client.query('ROLLBACK');return res.status(423).json({error:`Động phủ ${mansionState.name} đang khởi động. Vận công bị khóa hoàn toàn cho đến khi bạn ngưng động phủ.`});}
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
    const techRows=(await client.query(`SELECT ct.training_bonus_percent FROM user_techniques ut JOIN cultivation_techniques ct ON ct.id=ut.technique_id WHERE ut.user_id=$1`,[userId])).rows;
    const techniqueTrainingBonus=techniqueTrainingBonusFor(techRows);
    const baseMax=Math.max(28,72-currentStage.realmIndex*5-currentStage.tier*2);
    const baseMin=Math.max(12,Math.floor(baseMax*0.55));
    const rawGain=crypto.randomInt(baseMin,baseMax+1); const gain=Math.max(1,Math.round(rawGain*(1+rarityBonus(prof.spirit_root_rarity)+techniqueTrainingBonus/100)));
    const r=await client.query('UPDATE profiles SET spirit_power=spirit_power+$2, experience=experience+$2, updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power,experience',[userId,gain]);
    const spirit=r.rows[0].spirit_power; const stage=stageFor(spirit);
    const breakthroughRewards=await grantRealmBreakthroughRewards(client,userId,currentStage.realmIndex,stage.realmIndex);
    await client.query('UPDATE profiles SET rank=$2, realm_tier=$3 WHERE user_id=$1',[userId,stage.realm,stage.tier]);
    await client.query(`INSERT INTO daily_activity(user_id,activity_date,train_count,buy_count,stone_claim_count) VALUES($1,$2,1,0,0)
      ON CONFLICT(user_id) DO UPDATE SET activity_date=$2,train_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.train_count+1 ELSE 1 END,
      buy_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.buy_count ELSE 0 END,stone_claim_count=CASE WHEN daily_activity.activity_date=$2 THEN daily_activity.stone_claim_count ELSE 0 END`,[userId,today]);
    await logActivityEvent(client,userId,'train');
    await client.query('COMMIT');
    await ensureAchievements(userId,spirit);
    const stoneReward=breakthroughRewards.reduce((sum,x)=>sum+Number(x.amount||0),0);
    res.json({gain,spirit,experience:r.rows[0].experience,progress:progressFor(spirit),rank:stage.realm,stage:stage.stage,trainCount:trainCount+1,maxDaily,breakthroughRewards,stoneReward,message:stoneReward?`Đột phá ${stage.realm}! Nhận ${stoneReward.toLocaleString('vi-VN')} linh thạch để mở bí cảnh.`:undefined});
  } catch(e){try{await client.query('ROLLBACK')}catch{};console.error(e);res.status(500).json({error:'Không thể vận công lúc này.'});} finally{client.release();}
});

app.post('/api/cultivation/online',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const today=(new Date()).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const mansionState=await settleMansionIncome(client,req.session.user_id);
      if(mansionState.active){await client.query('COMMIT');return res.json({mode:'mansion',active:true,gain:mansionState.gain,mansion:mansionState.name,message:`Động phủ ${mansionState.name} đang hoạt động; vận công online bị khóa.`});}
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
      const techRows=(await client.query(`SELECT ct.training_bonus_percent FROM user_techniques ut JOIN cultivation_techniques ct ON ct.id=ut.technique_id WHERE ut.user_id=$1`,[req.session.user_id])).rows;
      const rate=(1+st.realmIndex)*(1+techniqueTrainingBonusFor(techRows)/100);
      const gain=Math.max(0,Math.min(minutes*rate,dailyCap-earned));
      let spirit=Number(p.spirit_power)||0;
      let breakthroughRewards=[];
      if(gain>0){
        spirit+=gain; earned+=gain;
        const ns=stageFor(spirit);
        breakthroughRewards=await grantRealmBreakthroughRewards(client,req.session.user_id,st.realmIndex,ns.realmIndex);
        await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,last_online_at=NOW(),online_spirit_date=$6,online_spirit_earned=$7,updated_at=NOW() WHERE user_id=$1`,
          [req.session.user_id,spirit,gain,ns.realm,ns.tier,today,earned]);
      } else {
        await client.query(`UPDATE profiles SET last_online_at=NOW(),online_spirit_date=$2,online_spirit_earned=$3 WHERE user_id=$1`,[req.session.user_id,today,earned]);
      }
      await client.query('COMMIT');
      const ns=stageFor(spirit);
      const stoneReward=breakthroughRewards.reduce((sum,x)=>sum+Number(x.amount||0),0);
      res.json({mode:'online',active:true,gain,onlineEarned:earned,dailyCap,rate,spirit,stage:ns.stage,nextTickSeconds:60,breakthroughRewards,stoneReward,message:stoneReward?`Đột phá ${ns.realm}! Nhận ${stoneReward.toLocaleString('vi-VN')} linh thạch để mở bí cảnh.`:undefined});
    }catch(e){try{await client.query('ROLLBACK')}catch{};throw e}finally{client.release();}
  }catch(e){console.error('online cultivation:',e);res.status(500).json({error:'Không thể cập nhật linh lực trực tuyến.'});}
});


// ─────────────────────────────────────────────────────────────────────────────
// TÀNG BẢO CÁC 2.1 · mua vật phẩm bằng linh thạch
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/treasury',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query(`SELECT spirit_power,spirit_stones,storage_capacity FROM profiles WHERE user_id=$1`,[req.session.user_id])).rows[0];
    const stage=stageFor(Number(p?.spirit_power)||0);
    const items=(await query(`SELECT ti.id,ti.name,ti.category,ti.description,ti.price,ti.spirit_gain,ti.min_realm,ti.power_bonus,ti.ability,
      COALESCE(i.quantity,0)::int AS quantity
      FROM treasure_items ti
      LEFT JOIN inventory i ON i.item_id=ti.id AND i.user_id=$1
      ORDER BY ti.min_realm,ti.price,ti.id`,[req.session.user_id])).rows;
    res.json({spiritPower:Number(p?.spirit_power)||0,spiritStones:Number(p?.spirit_stones)||0,
      storageCapacity:Number(p?.storage_capacity)||30,realm:stage.realm,tier:stage.tier,items});
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
    const pR=await client.query(`SELECT spirit_power,spirit_stones,storage_capacity FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(!pR.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ đệ tử.'});}
    const p=pR.rows[0], stage=stageFor(Number(p.spirit_power)||0);
    if(stage.realmIndex<Number(item.min_realm)){
      await client.query('ROLLBACK');
      return res.status(403).json({error:`Vật phẩm yêu cầu ${RANKS[Number(item.min_realm)]?.name||'cảnh giới cao hơn'}. Bạn hiện ở ${stage.stage}.`});
    }
    const price=Math.max(0,Number(item.price)||0);
    const stones=Number(p.spirit_stones)||0;
    if(stones<price){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Linh thạch không đủ. Cần ${price.toLocaleString('vi-VN')} linh thạch, hiện có ${stones.toLocaleString('vi-VN')}.`});
    }
    const capR=await client.query(`SELECT
      COALESCE(storage_capacity,30)::int AS capacity,
      COALESCE((SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0),0)::int AS used_slots,
      COALESCE((SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2),0)::int AS owned_qty
      FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id,itemId]);
    const cap=Math.max(1,Number(capR.rows[0].capacity)||30);
    const used=Number(capR.rows[0].used_slots)||0, owned=Number(capR.rows[0].owned_qty)||0;
    if(used>=cap&&owned<=0){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Tu Di Giới đã đầy (${used}/${cap}). Hãy dùng vật phẩm hoặc nâng dung lượng.`});
    }
    await client.query(`UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1`,
      [req.session.user_id,price]);
    // Use the locked catalog row's id, not the client-supplied id, for the FK write.
    // This also makes the purchase resilient to stale frontend/catalog data.
    const catalogId=Number(item.id);
    const existsR=await client.query('SELECT 1 FROM treasure_items WHERE id=$1 FOR KEY SHARE',[catalogId]);
    if(!existsR.rowCount){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'Vật phẩm trong Tàng Bảo Các đã thay đổi. Hãy tải lại trang rồi mua lại.'});
    }
    const invWrite=await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at)
      VALUES($1,$2,1,NOW())
      ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW()`,
      [req.session.user_id,catalogId]);
    if(invWrite.rowCount!==1){
      await client.query('ROLLBACK');
      return res.status(500).json({error:'Không thể ghi vật phẩm vào kho. Linh thạch chưa bị trừ.'});
    }
    const today="(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date";
    await client.query(`INSERT INTO daily_activity(user_id,activity_date,buy_count,train_count,stone_claim_count)
      VALUES($1,${today},1,0,0)
      ON CONFLICT(user_id) DO UPDATE SET
      buy_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.buy_count+1 ELSE 1 END,
      train_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.train_count ELSE 0 END,
      stone_claim_count=CASE WHEN daily_activity.activity_date=${today} THEN daily_activity.stone_claim_count ELSE 0 END,
      activity_date=${today}`,[req.session.user_id]);
    await logActivityEvent(client,req.session.user_id,'buy');
    const remaining=stones-price;
    await client.query('COMMIT');
    res.json({ok:true,item:item.name,category:item.category,quantityAdded:1,spiritStones:remaining,spentStones:price,stage:stage.stage,message:'Vật Phẩm đã được chuyển về bảng thuộc tính - mở bảng để xem'});
  }catch(e){
    try{await client.query('ROLLBACK')}catch{}
    console.error('treasury buy:',e);res.status(500).json({error:'Giao dịch Tàng Bảo Các thất bại. Vui lòng thử lại.'});
  }finally{client.release();}
});

app.post('/api/currency/exchange',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const stonesToBuy=Math.max(1,Math.min(100000,Number(req.body?.stones)||0));
    if(!Number.isInteger(stonesToBuy)||stonesToBuy<1)return res.status(400).json({error:'Số linh thạch trao đổi không hợp lệ.'});
    const spiritCost=stonesToBuy*SPIRIT_TO_STONE_RATE;
    await client.query('BEGIN');
    const r=await client.query(`SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(!r.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ đệ tử.'});}
    const spirit=Number(r.rows[0].spirit_power)||0;
    const stones=Number(r.rows[0].spirit_stones)||0;
    if(spirit<spiritCost){
      await client.query('ROLLBACK');
      return res.status(400).json({error:`Không đủ linh lực. Cần ${spiritCost.toLocaleString('vi-VN')} linh lực để đổi ${stonesToBuy.toLocaleString('vi-VN')} linh thạch.`});
    }
    const nr=await client.query(`UPDATE profiles SET spirit_power=spirit_power-$2,spirit_stones=spirit_stones+$3,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power,spirit_stones`,
      [req.session.user_id,spiritCost,stonesToBuy]);
    await client.query('COMMIT');
    res.json({ok:true,rate:SPIRIT_TO_STONE_RATE,spentSpirit:spiritCost,receivedStones:stonesToBuy,spirit:Number(nr.rows[0].spirit_power),spiritStones:Number(nr.rows[0].spirit_stones)});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('currency exchange:',e);res.status(500).json({error:'Không thể trao đổi linh lực sang linh thạch.'});}
  finally{client.release();}
});

// ─────────────────────────────────────────────────────────────────────────────
// TU DI GIỚI 2.0 · kho vật phẩm, dùng vật phẩm và nâng dung lượng
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/storage',auth,async(req,res)=>{
  try{
    await ensureProfile(req.session.user_id);
    const p=(await query(`SELECT storage_capacity,spirit_root,spirit_beast,spirit_power FROM profiles WHERE user_id=$1`,[req.session.user_id])).rows[0];
    const r=await query(`SELECT ti.id,ti.name,ti.category,ti.description,ti.spirit_gain,ti.power_bonus,ti.ability,i.quantity
      FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
      WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC,ti.id`,[req.session.user_id]);
    const beasts=(await query(`SELECT o.beast_id,o.quantity,c.name,c.rarity,c.description,c.beast_realm,c.beast_realm_tier,c.attack,c.defense,c.speed,c.spirit,c.power_bonus,c.ability FROM owned_spirit_beasts o JOIN spirit_beasts_catalog c ON c.id=o.beast_id WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.beast_realm_tier DESC,c.id`,[req.session.user_id])).rows;
    const roots=(await query(`SELECT o.root_id,o.quantity,c.name,c.rarity,c.description,c.support,c.power_bonus,c.ability FROM owned_spirit_roots o JOIN spirit_roots_catalog c ON c.id=o.root_id WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.power_bonus DESC,c.id`,[req.session.user_id])).rows;
    const used=r.rows.length+beasts.length+roots.length, capacity=Math.max(1,Number(p?.storage_capacity)||30);
    res.json({rows:r.rows,beasts,roots,used,capacity,spiritRoot:p?.spirit_root||null,spiritBeast:p?.spirit_beast||null,spiritPower:Number(p?.spirit_power)||0});
  }catch(e){console.error('storage:',e);res.status(500).json({error:'Không thể mở Tu Di Giới mới.'});}
});

app.post('/api/storage/use',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const itemId=Number(req.body?.itemId);
    const qty=Math.max(1,Math.min(99,Number(req.body?.quantity)||1));
    if(!Number.isInteger(itemId)||itemId<1)return res.status(400).json({error:'Vật phẩm không hợp lệ.'});
    await client.query('BEGIN');
    const r=await client.query(`SELECT ti.id,ti.name,ti.description,ti.spirit_gain,i.quantity
      FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
      WHERE i.user_id=$1 AND ti.id=$2 FOR UPDATE`,[req.session.user_id,itemId]);
    if(!r.rows.length||Number(r.rows[0].quantity)<qty){await client.query('ROLLBACK');return res.status(400).json({error:'Số lượng vật phẩm trong Tu Di Giới không đủ.'});}
    const item=r.rows[0], gain=Number(item.spirit_gain)||0;
    if(gain<=0){await client.query('ROLLBACK');return res.status(400).json({error:'Vật phẩm này không thể sử dụng trực tiếp.'});}
    const nr=await client.query(`UPDATE profiles SET spirit_power=spirit_power+$2,experience=experience+$2,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power`,
      [req.session.user_id,gain*qty]);
    await client.query(`UPDATE inventory SET quantity=quantity-$3,updated_at=NOW() WHERE user_id=$1 AND item_id=$2`,
      [req.session.user_id,itemId,qty]);
    await client.query('COMMIT');
    res.json({ok:true,item:item.name,quantityUsed:qty,gained:gain*qty,spirit:Number(nr.rows[0].spirit_power)});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('storage use:',e);res.status(500).json({error:'Không thể sử dụng vật phẩm.'});}
  finally{client.release();}
});

app.post('/api/storage/upgrade',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const r=await client.query(`SELECT storage_capacity,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(!r.rows.length){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ.'});}
    const cap=Number(r.rows[0].storage_capacity)||30, stones=Number(r.rows[0].spirit_stones)||0;
    const cost=100, add=5;
    if(cap>=100){await client.query('ROLLBACK');return res.status(400).json({error:'Tu Di Giới đã đạt dung lượng tối đa 100 ô.'});}
    if(stones<cost){await client.query('ROLLBACK');return res.status(400).json({error:`Cần ${cost} linh thạch để mở thêm ${add} ô.`});}
    const nr=await client.query(`UPDATE profiles SET storage_capacity=LEAST(100,storage_capacity+$2),spirit_stones=spirit_stones-$3,updated_at=NOW() WHERE user_id=$1 RETURNING storage_capacity,spirit_stones`,
      [req.session.user_id,add,cost]);
    await client.query('COMMIT');
    res.json({ok:true,capacity:Number(nr.rows[0].storage_capacity),spiritStones:Number(nr.rows[0].spirit_stones)});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('storage upgrade:',e);res.status(500).json({error:'Không thể nâng dung lượng Tu Di Giới.'});}
  finally{client.release();}
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
    const equipped=await client.query(`SELECT equipped_artifact_id FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(Number(equipped.rows[0]?.equipped_artifact_id)===itemId){await client.query('ROLLBACK');return res.status(400).json({error:'Pháp khí đang trang bị. Hãy tháo trang bị trước khi bán.'});}
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
    const capR=await client.query(`SELECT storage_capacity,COALESCE((SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0),0)::int AS used,COALESCE((SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2),0)::int AS owned FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id,l.item_id]);
    if(Number(capR.rows[0].used)>=Number(capR.rows[0].storage_capacity)&&Number(capR.rows[0].owned)<=0){await client.query('ROLLBACK');return res.status(400).json({error:'Tu Di Giới của người mua đã đầy.'});}
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
    const equipped=await client.query(`SELECT equipped_artifact_id FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id]);
    if(Number(equipped.rows[0]?.equipped_artifact_id)===offerItemId){await client.query('ROLLBACK');return res.status(400).json({error:'Pháp khí đang trang bị. Hãy tháo trang bị trước khi trao đổi.'});}
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
    const cap=(await client.query(`SELECT storage_capacity,COALESCE((SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0),0)::int AS used,COALESCE((SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2),0)::int AS owned FROM profiles WHERE user_id=$1 FOR UPDATE`,[tr.recipient_id,tr.offer_item_id])).rows[0];
    if(Number(cap.used)>=Number(cap.storage_capacity)&&Number(cap.owned)<=0){
      await client.query('ROLLBACK');return res.status(400).json({error:'Tu Di Giới của bạn đã đầy, không thể nhận vật phẩm trao đổi.'});
    }
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
app.get('/api/tu-di-gioi',auth,async(req,res)=>{ req.url='/api/storage'; return res.redirect(307,'/api/storage'); });

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
    const rootRow=(await client.query('SELECT id FROM spirit_roots_catalog WHERE name=$1',[gift.root])).rows[0];
    const beastRow=(await client.query('SELECT id FROM spirit_beasts_catalog WHERE name=$1',[gift.beast])).rows[0];
    if(rootRow) await client.query('INSERT INTO owned_spirit_roots(user_id,root_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,root_id) DO NOTHING',[req.session.user_id,rootRow.id]);
    if(beastRow) await client.query('INSERT INTO owned_spirit_beasts(user_id,beast_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,beast_id) DO NOTHING',[req.session.user_id,beastRow.id]);
    await client.query('UPDATE profiles SET equipped_root_id=COALESCE(equipped_root_id,$2),equipped_beast_id=COALESCE(equipped_beast_id,$3) WHERE user_id=$1',[req.session.user_id,rootRow?.id||null,beastRow?.id||null]);
    await client.query('COMMIT');
    res.json({ok:true,once:true,spiritRoot:r.rows[0].spirit_root,rootRarity:r.rows[0].spirit_root_rarity,
      spiritBeast:r.rows[0].spirit_beast,beastRarity:r.rows[0].spirit_beast_rarity,beastAttributes:{
        attack:r.rows[0].beast_attack,defense:r.rows[0].beast_defense,speed:r.rows[0].beast_speed,spirit:r.rows[0].beast_spirit,skill:r.rows[0].beast_skill}});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('Gacha error:',e);res.status(500).json({error:'Không thể ngẫu nhiên linh căn và linh thú.'});}
  finally{client.release();}
});

app.get('/api/inventory',auth,async(req,res)=>{
  try{const r=await query(`SELECT ti.id,ti.name,ti.category,ti.description,ti.power_bonus,ti.ability,i.quantity FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY i.updated_at DESC`,[req.session.user_id]);res.json({rows:r.rows});}
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
    // Lock only the quest row. PostgreSQL does not allow FOR UPDATE on the nullable side
    // of a LEFT JOIN; reward item name is fetched with a scalar subquery instead.
    const qR=await client.query(`SELECT q.*,COALESCE(q.display_name,q.name) AS visible_name,
      (SELECT ti.name FROM treasure_items ti WHERE ti.id=q.reward_item_id) AS reward_item_name
      FROM sect_quests q
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

app.get('/api/beast-house',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id;
    const [catalog,profile]=await Promise.all([
      query('SELECT id,name,rarity,description,beast_realm,beast_realm_tier,price_stones,min_realm,attack,defense,speed,spirit,skill,power_bonus,ability FROM spirit_beasts_catalog ORDER BY beast_realm_tier,price_stones,id'),
      query('SELECT spirit_stones,spirit_power,rank,realm_tier,spirit_beast,spirit_beast_rarity,beast_realm,beast_realm_tier,equipped_beast_id FROM profiles WHERE user_id=$1',[uid])
    ]);
    res.json({catalog:catalog.rows,profile:profile.rows[0]||{}});
  }catch(e){console.error('beast house load:',e);res.status(500).json({error:'Không thể mở Thú Đường.'});}
});
app.post('/api/beast-house/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');
    const id=Number(req.body?.id);
    if(!Number.isInteger(id)||id<1){await client.query('ROLLBACK');return res.status(400).json({error:'Linh thú không hợp lệ.'});}
    const item=(await client.query('SELECT * FROM spirit_beasts_catalog WHERE id=$1 FOR UPDATE',[id])).rows[0];
    const p=(await client.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(!item||!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy linh thú hoặc hồ sơ.'});}
    const ri=realmIndexFor(Number(p.spirit_power)||0);
    if(ri<Number(item.min_realm)) {await client.query('ROLLBACK');return res.status(400).json({error:`Linh thú ${item.name} yêu cầu từ ${RANKS[item.min_realm]?.name||'cảnh giới cao hơn'}.`});}
    if(Number(p.spirit_stones)<Number(item.price_stones)){await client.query('ROLLBACK');return res.status(400).json({error:`Không đủ linh thạch. Cần ${Number(item.price_stones).toLocaleString('vi-VN')}, hiện có ${Number(p.spirit_stones).toLocaleString('vi-VN')}.`});}
    const usedSlots=Number((await client.query(`SELECT (SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_beasts WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_roots WHERE user_id=$1 AND quantity>0) AS used`,[req.session.user_id])).rows[0].used)||0;
    if(usedSlots>=Number(p.storage_capacity||30)){await client.query('ROLLBACK');return res.status(400).json({error:`Tu Di Giới đã đầy (${usedSlots}/${Number(p.storage_capacity||30)}). Hãy nâng dung lượng trước khi nhận Linh Thú.`});}
    const ns=Number(p.spirit_stones)-Number(item.price_stones);
    await client.query(`UPDATE profiles SET spirit_stones=$2,updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,ns]);
    await client.query(`INSERT INTO owned_spirit_beasts(user_id,beast_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,beast_id) DO UPDATE SET quantity=owned_spirit_beasts.quantity+1`,[req.session.user_id,item.id]);
    await client.query('COMMIT');
    res.json({ok:true,item:item.name,rarity:item.rarity,realm:item.beast_realm,tier:item.beast_realm_tier,price:Number(item.price_stones),spiritStones:ns,message:'Linh thú đã chuyển vào Tu Di Giới. Vào Trang Bị để triệu hồi.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('beast house buy:',e);res.status(500).json({error:'Mua linh thú thất bại. Giao dịch đã được hoàn tác.'});}finally{client.release();}
});
app.get('/api/linh-phap',auth,async(req,res)=>{
  try{const [catalog,profile]=await Promise.all([query('SELECT id,name,rarity,description,support,price_stones,min_realm,power_bonus,ability FROM spirit_roots_catalog ORDER BY min_realm,price_stones,id'),query('SELECT spirit_stones,spirit_power,rank,realm_tier,spirit_root,spirit_root_rarity,equipped_root_id FROM profiles WHERE user_id=$1',[req.session.user_id])]);res.json({catalog:catalog.rows,profile:profile.rows[0]||{}});}
  catch(e){console.error('linh phap load:',e);res.status(500).json({error:'Không thể mở Linh Pháp.'});}
});
app.post('/api/linh-phap/buy',auth,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');
    const id=Number(req.body?.id);
    if(!Number.isInteger(id)||id<1){await client.query('ROLLBACK');return res.status(400).json({error:'Linh căn không hợp lệ.'});}
    const item=(await client.query('SELECT * FROM spirit_roots_catalog WHERE id=$1 FOR UPDATE',[id])).rows[0];
    const p=(await client.query('SELECT * FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(!item||!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy linh căn hoặc hồ sơ.'});}
    const ri=realmIndexFor(Number(p.spirit_power)||0);
    if(ri<Number(item.min_realm)){await client.query('ROLLBACK');return res.status(400).json({error:`Linh căn ${item.name} yêu cầu từ ${RANKS[item.min_realm]?.name||'cảnh giới cao hơn'}.`});}
    if(Number(p.spirit_stones)<Number(item.price_stones)){await client.query('ROLLBACK');return res.status(400).json({error:`Không đủ linh thạch. Cần ${Number(item.price_stones).toLocaleString('vi-VN')}, hiện có ${Number(p.spirit_stones).toLocaleString('vi-VN')}.`});}
    const usedSlots=Number((await client.query(`SELECT (SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_beasts WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_roots WHERE user_id=$1 AND quantity>0) AS used`,[req.session.user_id])).rows[0].used)||0;
    if(usedSlots>=Number(p.storage_capacity||30)){await client.query('ROLLBACK');return res.status(400).json({error:`Tu Di Giới đã đầy (${usedSlots}/${Number(p.storage_capacity||30)}). Hãy nâng dung lượng trước khi nhận Linh Căn.`});}
    const ns=Number(p.spirit_stones)-Number(item.price_stones);
    await client.query(`UPDATE profiles SET spirit_stones=$2,gacha_claimed=TRUE,updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,ns]);
    await client.query(`INSERT INTO owned_spirit_roots(user_id,root_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,root_id) DO UPDATE SET quantity=owned_spirit_roots.quantity+1`,[req.session.user_id,item.id]);
    await client.query('COMMIT');
    res.json({ok:true,item:item.name,rarity:item.rarity,support:item.support,price:Number(item.price_stones),spiritStones:ns,message:'Linh căn đã chuyển vào Tu Di Giới. Vào Trang Bị để kích hoạt.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('linh phap buy:',e);res.status(500).json({error:'Mua linh căn thất bại. Giao dịch đã được hoàn tác.'});}finally{client.release();}
});

// TRANG BỊ · quản lý Linh Thú, Linh Căn và Pháp Khí sở hữu
app.get('/api/equipment',auth,async(req,res)=>{
  try{
    const userId=req.session.user_id;
    await ensureProfile(userId);
    // Heal stale equipment before reading it. This also handles items removed by older migrations.
    await query(`UPDATE profiles p SET equipped_beast_id=NULL
      WHERE p.user_id=$1 AND p.equipped_beast_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM owned_spirit_beasts o WHERE o.user_id=p.user_id AND o.beast_id=p.equipped_beast_id AND o.quantity>0)`,[userId]);
    await query(`UPDATE profiles p SET equipped_root_id=NULL
      WHERE p.user_id=$1 AND p.equipped_root_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM owned_spirit_roots o WHERE o.user_id=p.user_id AND o.root_id=p.equipped_root_id AND o.quantity>0)`,[userId]);
    await query(`UPDATE profiles p SET equipped_artifact_id=NULL
      WHERE p.user_id=$1 AND p.equipped_artifact_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
        WHERE i.user_id=p.user_id AND i.item_id=p.equipped_artifact_id AND i.quantity>0)`,[userId]);

    const [p,b,r,a]=await Promise.all([
      query(`SELECT p.equipped_beast_id,p.equipped_root_id,p.equipped_artifact_id,
        COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0) +
        COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0) +
        COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power
        FROM profiles p WHERE p.user_id=$1`,[userId]),
      query(`SELECT o.id,o.beast_id,o.quantity,c.name,c.rarity,c.description,c.beast_realm,c.beast_realm_tier,c.attack,c.defense,c.speed,c.spirit,c.skill,c.power_bonus,c.ability,c.min_realm
        FROM owned_spirit_beasts o JOIN spirit_beasts_catalog c ON c.id=o.beast_id
        WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.beast_realm_tier DESC,c.power_bonus DESC,c.id`,[userId]),
      query(`SELECT o.id,o.root_id,o.quantity,c.name,c.rarity,c.description,c.support,c.power_bonus,c.ability,c.min_realm
        FROM owned_spirit_roots o JOIN spirit_roots_catalog c ON c.id=o.root_id
        WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.power_bonus DESC,c.id`,[userId]),
      query(`SELECT i.item_id AS id,i.quantity,ti.name,ti.category,ti.description,ti.min_realm,ti.power_bonus,ti.ability
        FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id
        WHERE i.user_id=$1 AND i.quantity>0
          AND LOWER(TRIM(ti.category)) IN ('pháp bảo','pháp khí')
        ORDER BY ti.power_bonus DESC,ti.id`,[userId])
    ]);
    res.json({ok:true,equipped:p.rows[0]||{equipped_beast_id:null,equipped_root_id:null,equipped_artifact_id:null,equipment_power:0},beasts:b.rows,roots:r.rows,artifacts:a.rows});
  }catch(e){console.error('equipment:',e);res.status(500).json({error:'Không thể mở Trang Bị: '+(e?.message||'lỗi cơ sở dữ liệu')});}
});
app.post('/api/equipment/equip',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN'); const type=String(req.body?.type||''); const id=Number(req.body?.id);
    if(!['beast','root','artifact'].includes(type)||!Number.isInteger(id)||id<1){await client.query('ROLLBACK');return res.status(400).json({error:'Trang bị không hợp lệ.'});}
    const p=(await client.query(`SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE`,[req.session.user_id])).rows[0]; if(!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ.'});}
    const ri=realmIndexFor(Number(p.spirit_power)||0); let name='',power=0,ability='',col='';
    if(type==='beast'){
      const x=(await client.query(`SELECT c.* FROM owned_spirit_beasts o JOIN spirit_beasts_catalog c ON c.id=o.beast_id WHERE o.user_id=$1 AND o.beast_id=$2 AND o.quantity>0 FOR UPDATE`,[req.session.user_id,id])).rows[0];
      if(!x){await client.query('ROLLBACK');return res.status(404).json({error:'Linh thú này không nằm trong Tu Di Giới của bạn.'});}
      if(ri<Number(x.min_realm)){await client.query('ROLLBACK');return res.status(403).json({error:`Linh thú yêu cầu ${RANKS[Number(x.min_realm)]?.name||'cảnh giới cao hơn'}.`});}
      name=x.name;power=Number(x.power_bonus)||0;ability=x.ability||'';col='equipped_beast_id';
    } else if(type==='root'){
      const x=(await client.query(`SELECT c.* FROM owned_spirit_roots o JOIN spirit_roots_catalog c ON c.id=o.root_id WHERE o.user_id=$1 AND o.root_id=$2 AND o.quantity>0 FOR UPDATE`,[req.session.user_id,id])).rows[0];
      if(!x){await client.query('ROLLBACK');return res.status(404).json({error:'Linh căn này không nằm trong Tu Di Giới của bạn.'});}
      if(ri<Number(x.min_realm)){await client.query('ROLLBACK');return res.status(403).json({error:`Linh căn yêu cầu ${RANKS[Number(x.min_realm)]?.name||'cảnh giới cao hơn'}.`});}
      name=x.name;power=Number(x.power_bonus)||0;ability=x.ability||'';col='equipped_root_id';
    } else {
      const x=(await client.query(`SELECT ti.* FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.item_id=$2 AND i.quantity>0 AND LOWER(TRIM(ti.category)) IN ('pháp bảo','pháp khí') FOR UPDATE`,[req.session.user_id,id])).rows[0];
      if(!x){await client.query('ROLLBACK');return res.status(404).json({error:'Pháp khí này không nằm trong Tu Di Giới của bạn.'});}
      if(ri<Number(x.min_realm)){await client.query('ROLLBACK');return res.status(403).json({error:`Pháp khí yêu cầu ${RANKS[Number(x.min_realm)]?.name||'cảnh giới cao hơn'}.`});}
      name=x.name;power=Number(x.power_bonus)||0;ability=x.ability||'';col='equipped_artifact_id';
    }
    await client.query(`UPDATE profiles SET ${col}=$2,updated_at=NOW() WHERE user_id=$1`,[req.session.user_id,id]);
    await client.query('COMMIT'); res.json({ok:true,type,id,name,power,ability,message:`Đã trang bị ${name}. Chiến lực +${power}.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('equipment equip:',e);res.status(500).json({error:'Không thể trang bị vật phẩm.'});}finally{client.release();}
});
app.post('/api/equipment/unequip',auth,async(req,res)=>{
  try{const type=String(req.body?.type||''); const col={beast:'equipped_beast_id',root:'equipped_root_id',artifact:'equipped_artifact_id'}[type]; if(!col)return res.status(400).json({error:'Ô trang bị không hợp lệ.'}); await query(`UPDATE profiles SET ${col}=NULL,updated_at=NOW() WHERE user_id=$1`,[req.session.user_id]); res.json({ok:true});}
  catch(e){res.status(500).json({error:'Không thể tháo trang bị.'});}
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
  try{const r=await query(`SELECT p.spirit_beast AS name,COALESCE(p.spirit_beast_rarity,'Phàm') AS rarity,COALESCE(MAX(p.beast_realm_tier),1)::int AS beast_realm_tier,COALESCE(MAX(p.beast_realm),'Nhất Giai') AS beast_realm,COUNT(*)::int AS owner_count,STRING_AGG(u.display_name, ', ' ORDER BY u.display_name) AS owners FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.spirit_beast IS NOT NULL AND p.spirit_beast<>'' GROUP BY p.spirit_beast,p.spirit_beast_rarity`);
    const map=new Map(BEAST_CODEX.map(x=>[x[0],x])); const rows=r.rows.map(x=>{const c=map.get(x.name)||[x.name,x.rarity,'',''];return {...x,description:c[2],attributes:c[3]};}).sort((a,b)=>(Number(b.beast_realm_tier)||0)-(Number(a.beast_realm_tier)||0)||(rarityScore[b.rarity]||0)-(rarityScore[a.rarity]||0)||b.owner_count-a.owner_count); res.json({rows});
  }catch(e){res.status(500).json({error:'Không thể tải Linh Thú Bảng.'});}
});

app.post('/api/enhance/roll',auth,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN'); const cost=300; const p=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[req.session.user_id])).rows[0];
    if(Number(p.spirit_power)<cost){await client.query('ROLLBACK');return res.status(400).json({error:`Cần ${cost} linh lực để quay vật phẩm tăng cường.`});}
    const poolItems=[['Linh Phù Cường Hóa',55],['Tinh Thạch Cường Hóa',28],['Huyền Thiết Cường Hóa',12],['Thiên Đạo Cường Hóa Thạch',5]];
    const total=poolItems.reduce((n,x)=>n+x[1],0); let n=crypto.randomInt(1,total+1), chosen=poolItems[0][0]; for(const x of poolItems){n-=x[1];if(n<=0){chosen=x[0];break;}}
    const item=(await client.query('SELECT id,name,description FROM treasure_items WHERE name=$1',[chosen])).rows[0];
    const used=Number((await client.query('SELECT COUNT(*)::int AS used FROM inventory WHERE user_id=$1 AND quantity>0',[req.session.user_id])).rows[0].used); const cap=Number((await client.query('SELECT storage_capacity FROM profiles WHERE user_id=$1',[req.session.user_id])).rows[0].storage_capacity)||30;
    if(used>=cap){await client.query('ROLLBACK');return res.status(400).json({error:`Tu Di Giới đã đầy (${used}/${cap}).`});}
    const nr=(await client.query(`UPDATE profiles SET spirit_power=spirit_power-$2,updated_at=NOW() WHERE user_id=$1 RETURNING spirit_power`,[req.session.user_id,cost])).rows[0];
    const ir=await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW() RETURNING quantity`,[req.session.user_id,item.id]);
    await client.query('COMMIT'); res.json({ok:true,item:item.name,description:item.description,quantity:ir.rows[0].quantity,spirit:Number(nr.spirit_power)});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('enhance roll:',e);res.status(500).json({error:'Không thể quay vật phẩm tăng cường.'});}finally{client.release();}
});

// ─────────────────────────────────────────────────────────────────────────────
// BÍ CẢNH · Cửu đại bí cảnh, đồng góp linh thạch + tham gia cơ duyên
// ─────────────────────────────────────────────────────────────────────────────
async function syncSecretRealm(realmId){
  const r=(await query(`SELECT * FROM secret_realms WHERE id=$1`,[realmId])).rows[0];
  if(!r) return null;
  const now=Date.now();
  if(r.status==='active' && r.active_until && new Date(r.active_until).getTime()<=now){
    await query(`UPDATE secret_realms SET status='funding',funded_stones=0,active_until=NULL WHERE id=$1`,[realmId]);
    return (await query(`SELECT * FROM secret_realms WHERE id=$1`,[realmId])).rows[0];
  }
  if(r.status==='paused' && r.paused_until && new Date(r.paused_until).getTime()<=now){
    await query(`UPDATE secret_realms SET status='funding',funded_stones=0,paused_until=NULL WHERE id=$1`,[realmId]);
    return (await query(`SELECT * FROM secret_realms WHERE id=$1`,[realmId])).rows[0];
  }
  return r;
}

async function secretRealmLoot(client,userId,realm){
  const tier=Number(realm.loot_tier)||0;
  const roll=crypto.randomInt(1,101);
  if(roll<=18){
    const stones=Math.max(30,Math.floor((tier+1)*crypto.randomInt(40,91)));
    await client.query(`UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1`,[userId,stones]);
    return {type:'stones',stones,quantity:0};
  }
  if(roll<=42){
    const root=(await client.query(`SELECT id,name,rarity,description,support,power_bonus,ability FROM spirit_roots_catalog WHERE min_realm <= $1 ORDER BY (min_realm + power_bonus/100.0) DESC, RANDOM() LIMIT 1`,[tier])).rows[0];
    if(root){
      await client.query(`INSERT INTO owned_spirit_roots(user_id,root_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,root_id) DO UPDATE SET quantity=owned_spirit_roots.quantity+1`,[userId,root.id]);
      return {type:'root',item:root,quantity:1};
    }
  }
  if(roll<=66){
    const beast=(await client.query(`SELECT id,name,rarity,description,beast_realm,beast_realm_tier,attack,defense,speed,spirit,skill,power_bonus,ability FROM spirit_beasts_catalog WHERE min_realm <= $1 ORDER BY (min_realm + beast_realm_tier) DESC, RANDOM() LIMIT 1`,[tier])).rows[0];
    if(beast){
      await client.query(`INSERT INTO owned_spirit_beasts(user_id,beast_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,beast_id) DO UPDATE SET quantity=owned_spirit_beasts.quantity+1`,[userId,beast.id]);
      return {type:'beast',item:beast,quantity:1};
    }
  }
  const item=(await client.query(`SELECT id,name,category,description,price,spirit_gain,min_realm,power_bonus,ability FROM treasure_items WHERE min_realm <= $1 ORDER BY (min_realm + power_bonus/100.0) DESC, RANDOM() LIMIT 1`,[tier])).rows[0];
  if(item){
    await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW()`,[userId,item.id]);
    return {type:'item',item,quantity:1};
  }
  return {type:'stones',stones:50,quantity:0};
}

app.get('/api/bicanh',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id;
    const me=(await query(`SELECT spirit_power,spirit_stones,secret_realm_debuff_until,secret_realm_debuff_percent FROM profiles WHERE user_id=$1`,[uid])).rows[0];
    if(!me) return res.status(404).json({error:'Không tìm thấy hồ sơ môn nhân.'});
    const stage=stageFor(Number(me.spirit_power)||0);
    // Repair expired realms before returning the list. All parameters are explicit.
    await query(`UPDATE secret_realms SET status='funding',funded_stones=0,active_until=NULL WHERE status='active' AND active_until IS NOT NULL AND active_until<=NOW()`);
    await query(`UPDATE secret_realms SET status='funding',funded_stones=0,paused_until=NULL WHERE status='paused' AND paused_until IS NOT NULL AND paused_until<=NOW()`);
    const raw=(await query(`
      SELECT sr.id,sr.name,sr.description,sr.required_realm_index,sr.required_realm_name,
             sr.activation_cost,sr.funded_stones,sr.status,sr.active_until,sr.paused_until,
             sr.danger_percent,sr.debuff_percent,sr.loot_tier,sr.created_at,
             COALESCE((SELECT SUM(src.amount) FROM secret_realm_contributions src WHERE src.realm_id=sr.id),0)::int AS contributed_total
      FROM secret_realms sr
      ORDER BY sr.required_realm_index ASC, sr.id ASC
    `)).rows;
    const realms=raw.map(r=>({...r,
      funded_stones:Number(r.funded_stones)||0,
      contributed_total:Number(r.contributed_total)||0,
      canEnter:stage.realmIndex>=Number(r.required_realm_index),
      realm:stageFor(Number(RANKS[Number(r.required_realm_index)]?.min||0)).realm
    }));
    res.json({realms,me:{...me,stage:stage.stage,realmIndex:stage.realmIndex}});
  }catch(e){
    console.error('bicanh load:',{message:e?.message,code:e?.code,detail:e?.detail,hint:e?.hint,position:e?.position,where:e?.where,query:e?.query});
    res.status(500).json({error:`Không thể mở Bí Cảnh: ${e?.message||'Lỗi cơ sở dữ liệu.'}`});
  }
});

app.post('/api/bicanh/contribute',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id, realmId=Number(req.body?.realmId), amount=Math.floor(Number(req.body?.amount));
    if(!Number.isInteger(realmId)||realmId<1||!Number.isInteger(amount)||amount<1)return res.status(400).json({error:'Số linh thạch đóng góp không hợp lệ.'});
    await client.query('BEGIN');
    const realm=(await client.query(`SELECT * FROM secret_realms WHERE id=$1 FOR UPDATE`,[realmId])).rows[0];
    const p=(await client.query(`SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1 FOR UPDATE`,[uid])).rows[0];
    if(!realm||!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy Bí Cảnh hoặc hồ sơ.'});}
    if(realm.status!=='funding'){await client.query('ROLLBACK');return res.status(409).json({error:realm.status==='active'?'Bí Cảnh đã khởi động.':'Bí Cảnh đang tạm hoãn.'});}
    const st=stageFor(Number(p.spirit_power)||0);
    if(st.realmIndex<Number(realm.required_realm_index)){await client.query('ROLLBACK');return res.status(403).json({error:`Cần ${realm.required_realm_name} trở lên để đóng góp vào Bí Cảnh này.`});}
    if(Number(p.spirit_stones)<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Không đủ linh thạch.'});}
    const remaining=Math.max(0,Number(realm.activation_cost)-Number(realm.funded_stones));
    const pay=Math.min(amount,remaining);
    await client.query(`UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1`,[uid,pay]);
    await client.query(`INSERT INTO secret_realm_contributions(realm_id,user_id,amount) VALUES($1,$2,$3)`,[realmId,pay]);
    const funded=Number(realm.funded_stones)+pay;
    if(funded>=Number(realm.activation_cost)){
      await client.query(`UPDATE secret_realms SET funded_stones=0,status='active',active_until=NOW()+INTERVAL '60 minutes' WHERE id=$1`,[realmId]);
      await client.query('COMMIT');
      return res.json({ok:true,activated:true,paid:pay,message:`${realm.name} đã được khởi động! Mở cửa trong 60 phút.`});
    }
    await client.query(`UPDATE secret_realms SET funded_stones=$2 WHERE id=$1`,[realmId,funded]);
    await client.query('COMMIT');
    res.json({ok:true,activated:false,paid:pay,funded,remaining:Number(realm.activation_cost)-funded,message:`Đã đóng ${pay} linh thạch. Còn ${Number(realm.activation_cost)-funded} linh thạch để khởi động.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('bicanh contribute:',{message:e?.message,code:e?.code,detail:e?.detail,hint:e?.hint});res.status(500).json({error:`Đóng góp Bí Cảnh thất bại: ${e?.message||'Lỗi cơ sở dữ liệu.'}`});}finally{client.release();}
});

app.post('/api/bicanh/enter',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id, realmId=Number(req.body?.realmId);
    if(!Number.isInteger(realmId)||realmId<1)return res.status(400).json({error:'Bí Cảnh không hợp lệ.'});
    await client.query('BEGIN');
    const realm=(await client.query(`SELECT * FROM secret_realms WHERE id=$1 FOR UPDATE`,[realmId])).rows[0];
    const p=(await client.query(`SELECT p.*,COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0)+COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0)+COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power FROM profiles p WHERE p.user_id=$1 FOR UPDATE`,[uid])).rows[0];
    if(!realm||!p){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy Bí Cảnh hoặc hồ sơ.'});}
    if(realm.status!=='active'||!realm.active_until||new Date(realm.active_until)<=new Date()){await client.query('ROLLBACK');return res.status(409).json({error:'Bí Cảnh chưa được khởi động hoặc đã đóng.'});}
    const st=stageFor(Number(p.spirit_power)||0);
    if(st.realmIndex<Number(realm.required_realm_index)){await client.query('ROLLBACK');return res.status(403).json({error:`Cần ${realm.required_realm_name} trở lên mới có thể bước vào.`});}
    const gap=st.realmIndex-Number(realm.required_realm_index);
    const breakChance=Math.min(65,Math.max(0,gap*12-4));
    if(gap>=2 && crypto.randomInt(1,101)<=breakChance){
      const pauseMinutes=Math.min(90,20+gap*10);
      await client.query(`UPDATE secret_realms SET status='paused',paused_until=NOW() + ($2::double precision * INTERVAL '1 minute'),active_until=NULL,funded_stones=0 WHERE id=$1`,[realmId,String(pauseMinutes)]);
      await client.query(`INSERT INTO secret_realm_runs(realm_id,user_id,outcome,reward_type,note) VALUES($1,$2,'broken','','Cảnh giới cao phá vỡ linh áp, Bí Cảnh tạm hoãn ${pauseMinutes} phút.')`,[realmId,uid]);
      await client.query('COMMIT');
      return res.json({ok:true,outcome:'broken',message:`Thiên uy của ${st.stage} áp đảo ${realm.name}, Bí Cảnh bị phá vỡ và tạm hoãn ${pauseMinutes} phút.`});
    }
    const successChance=Math.max(18,100-Number(realm.danger_percent));
    const success=crypto.randomInt(1,101)<=successChance;
    if(success){
      const spiritGain=Math.max(80,Math.floor((Number(p.spirit_power)||0)*(0.08+Number(realm.loot_tier)*0.015)));
      const loot=await secretRealmLoot(client,uid,realm);
      const newSpirit=(Number(p.spirit_power)||0)+spiritGain;
      const ns=stageFor(newSpirit);
      await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,secret_realm_debuff_until=NULL,secret_realm_debuff_percent=0,updated_at=NOW() WHERE user_id=$1`,[uid,newSpirit,spiritGain,ns.realm,ns.tier]);
      const itemId=loot.item?.id||null;
      await client.query(`INSERT INTO secret_realm_runs(realm_id,user_id,outcome,reward_type,reward_item_id,reward_quantity,reward_stones,spirit_gain,note) VALUES($1,$2,'success',$3,$4,$5,$6,$7,$8)`,[realmId,uid,loot.type,itemId,loot.quantity||0,loot.stones||0,spiritGain,`Thành công tại ${realm.name}.`]);
      await client.query('COMMIT');
      const rewardText=loot.type==='stones'?`+${loot.stones} linh thạch`:loot.type==='root'?`Linh Căn ${loot.item.name}`:loot.type==='beast'?`Linh Thú ${loot.item.name}`:`${loot.item?.name||'Vật phẩm'} ×1`;
      return res.json({ok:true,outcome:'success',successChance,spiritGain,newSpirit,stage:ns.stage,reward:loot,message:`Bí Cảnh thành công! +${spiritGain} linh lực, nhận ${rewardText}.`});
    }
    const debuff=Number(realm.debuff_percent)||5;
    const duration=Math.min(180,20+Number(realm.loot_tier)*15);
    const loss=Math.max(10,Math.floor((Number(p.spirit_power)||0)*(0.03+Number(realm.loot_tier)*0.01)));
    const newSpirit=Math.max(0,(Number(p.spirit_power)||0)-loss);
    const ns=stageFor(newSpirit);
    await client.query(`UPDATE profiles SET spirit_power=$2,experience=GREATEST(0,experience-$3),rank=$4,realm_tier=$5,secret_realm_debuff_until=NOW() + ($6::double precision * INTERVAL '1 minute'),secret_realm_debuff_percent=$7,updated_at=NOW() WHERE user_id=$1`,[uid,newSpirit,Math.floor(loss/2),ns.realm,ns.tier,String(duration),debuff]);
    const note=`Bí Cảnh thất bại: mất ${loss} linh lực, debuff -${debuff}% trong ${duration} phút.`;
    await client.query(`INSERT INTO secret_realm_runs(realm_id,user_id,outcome,debuff_percent,debuff_until,note) VALUES($1,$2,'failure',$3,NOW() + ($4::double precision * INTERVAL '1 minute'),$5)`,[realmId,uid,debuff,String(duration),note]);
    await client.query('COMMIT');
    res.json({ok:true,outcome:'failure',successChance,lossSpirit:loss,newSpirit,stage:ns.stage,debuffPercent:debuff,debuffMinutes:duration,message:note});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('bicanh enter:',{message:e?.message,code:e?.code,detail:e?.detail,hint:e?.hint});res.status(500).json({error:`Tham gia Bí Cảnh thất bại: ${e?.message||'Lỗi cơ sở dữ liệu.'}`});}finally{client.release();}
});

app.get('/api/bicanh/history',auth,async(req,res)=>{
  try{const r=await query(`SELECT r.id,r.outcome,r.reward_type,r.reward_quantity,r.reward_stones,r.spirit_gain,r.debuff_percent,r.note,r.created_at,sr.name AS realm_name,ti.name AS reward_item_name FROM secret_realm_runs r JOIN secret_realms sr ON sr.id=r.realm_id LEFT JOIN treasure_items ti ON ti.id=r.reward_item_id WHERE r.user_id=$1 ORDER BY r.id DESC LIMIT 30`,[req.session.user_id]);res.json({rows:r.rows});}
  catch(e){res.status(500).json({error:'Không thể tải lịch sử Bí Cảnh.'});}
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


// ─────────────────────────────────────────────────────────────────────────────
// KHIÊU CHIẾN · Lôi đài online / mô phỏng offline
// ─────────────────────────────────────────────────────────────────────────────
function challengePower(row){
  const spirit=Math.max(0,Number(row.spirit_power)||0);
  const st=stageFor(spirit);
  const beast=(Number(row.beast_attack)||0)+(Number(row.beast_defense)||0)+(Number(row.beast_speed)||0)+(Number(row.beast_spirit)||0);
  const challengeDebuffActive=row.challenge_debuff_until && new Date(row.challenge_debuff_until)>new Date();
  const secretDebuffActive=row.secret_realm_debuff_until && new Date(row.secret_realm_debuff_until)>new Date();
  const challengeDebuff=challengeDebuffActive?Math.max(0,Number(row.challenge_debuff_percent)||0):0;
  const secretDebuff=secretDebuffActive?Math.max(0,Number(row.secret_realm_debuff_percent)||0):0;
  const debuffPct=Math.min(90,challengeDebuff+secretDebuff);
  const equipment=Number(row.equipment_power)||0;
  const base=spirit*1.15+st.realmIndex*850+st.tier*120+beast*2+equipment;
  return Math.max(1,base*(1-debuffPct/100));
}

function challengeOdds(attacker, defender){
  const aStage=stageFor(Number(attacker.spirit_power)||0);
  const dStage=stageFor(Number(defender.spirit_power)||0);
  const gap=Math.max(0,dStage.realmIndex-aStage.realmIndex);
  const reverseGap=Math.max(0,aStage.realmIndex-dStage.realmIndex);
  const tierGap=dStage.realmIndex===aStage.realmIndex?Math.max(0,dStage.tier-aStage.tier):0;
  const aPower=challengePower(attacker), dPower=challengePower(defender);
  let chance=aPower/(aPower+dPower);
  // Cảnh giới thấp đánh cảnh giới cao: sát thương giảm và tỷ lệ thất bại tăng rõ rệt.
  const damageMultiplier=Math.max(0.12,1-gap*0.22-tierGap*0.035);
  chance-=gap*0.11+tierGap*0.018;
  // Người có cảnh giới cao hơn vẫn có lợi thế, nhưng không biến trận đấu thành 100% chắc thắng.
  chance+=reverseGap*0.035;
  chance=Math.max(0.08,Math.min(0.92,chance));
  return {chance,damageMultiplier,aPower,dPower,gap,tierGap,aStage,dStage};
}

function challengeHealth(row){
  const spirit=Math.max(0,Number(row.spirit_power)||0);
  const st=stageFor(spirit);
  const base=attributesFor(spirit);
  const equipment=Number(row.equipment_power)||0;
  return Math.max(1200,Math.round(1200 + spirit*0.045 + base.phongThu*30 + base.congLuc*8 + st.realmIndex*700 + st.tier*120 + equipment*2));
}

function ultimateDamage(attacker, defender){
  const aSpirit=Math.max(0,Number(attacker.spirit_power)||0);
  const dSpirit=Math.max(0,Number(defender.spirit_power)||0);
  const aStage=stageFor(aSpirit), dStage=stageFor(dSpirit);
  const aAttr=attributesFor(aSpirit), dAttr=attributesFor(dSpirit);
  const equipment=Number(attacker.equipment_power)||0;
  const baseDamage=70 + aAttr.congLuc*2.4 + aSpirit*0.012 + equipment*0.55;
  const realmGap=aStage.realmIndex-dStage.realmIndex;
  let realmMultiplier=1;
  if(realmGap>0){
    realmMultiplier=1 + Math.min(1.6,realmGap*0.22);
  }else if(realmGap<0){
    realmMultiplier=Math.max(0.22,1-Math.min(0.78,Math.abs(realmGap)*0.26));
  }else{
    realmMultiplier=1 + Math.max(0,dStage.tier-aStage.tier)*0.035;
  }
  const defenseReduction=Math.max(0.35,1-(dAttr.phongThu/(dAttr.phongThu+900)));
  const variance=0.92+Math.random()*0.16;
  return Math.max(1,Math.round(baseDamage*realmMultiplier*defenseReduction*variance));
}

function battleSnapshot(row,viewerId){
  const challengerTurn=Number(row.turn_user_id)===Number(row.challenger_id);
  const viewerIsChallenger=Number(viewerId)===Number(row.challenger_id);
  return {
    id:Number(row.id),
    status:row.status,
    challengerId:Number(row.challenger_id),
    opponentId:Number(row.opponent_id),
    challengerHp:Number(row.challenger_hp)||0,
    opponentHp:Number(row.opponent_hp)||0,
    challengerMaxHp:Number(row.challenger_max_hp)||0,
    opponentMaxHp:Number(row.opponent_max_hp)||0,
    turnUserId:row.turn_user_id==null?null:Number(row.turn_user_id),
    yourTurn:row.status==='accepted' && Number(row.turn_user_id)===Number(viewerId),
    round:Number(row.round_number)||0,
    lastActorId:row.last_actor_id==null?null:Number(row.last_actor_id),
    lastDamage:Number(row.last_damage)||0,
    lastAction:row.last_action||'',
    startedAt:row.started_at
  };
}

async function randomChallengeReward(client,userId,mode){
  const profile=(await client.query('SELECT storage_capacity FROM profiles WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
  const cap=Math.max(1,Number(profile?.storage_capacity)||30);
  const used=Number((await client.query('SELECT COUNT(*)::int AS c FROM inventory WHERE user_id=$1 AND quantity>0',[userId])).rows[0].c)||0;
  let item;
  if(used>=cap){
    item=(await client.query(`SELECT ti.id,ti.name,ti.category,ti.description FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY RANDOM() LIMIT 1`,[userId])).rows[0];
  } else {
    item=(await client.query(`SELECT id,name,category,description FROM treasure_items ORDER BY RANDOM() LIMIT 1`)).rows[0];
  }
  if(!item)return null;
  await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,1,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+1,updated_at=NOW()`,[userId,item.id]);
  return {...item,quantity:1,mode};
}

async function applyChallengeLoss(client,userId,mode,stage){
  const p=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
  const spirit=Math.max(0,Number(p?.spirit_power)||0);
  const current=stageFor(spirit);
  let newSpirit=spirit;
  let text='';
  const pct=mode==='online'?25:10;
  const duration=mode==='online'?'2 hours':'30 minutes';
  if(current.realmIndex>0){
    const previous=RANKS[current.realmIndex-1];
    newSpirit=Math.max(previous.min,Math.min(previous.max,previous.min+Math.floor((current.tier-1)*Math.max(1,(previous.max-previous.min+1)/9))));
    text=`Thất bại: hạ 1 cảnh giới về ${stageFor(newSpirit).stage}, nhận debuff -${pct}% chiến lực trong ${duration}.`;
  } else {
    newSpirit=Math.max(0,Math.floor(spirit*(mode==='online'?0.85:0.95)));
    text=`Thất bại: cảnh giới đã ở mức thấp nhất, linh lực bị tổn hao và nhận debuff -${pct}% chiến lực trong ${duration}.`;
  }
  await client.query(`UPDATE profiles SET spirit_power=$2,rank=$3,realm_tier=$4,challenge_debuff_until=NOW()+$5::interval,challenge_debuff_percent=$6,challenge_debuff_text=$7,updated_at=NOW() WHERE user_id=$1`,[userId,newSpirit,stageFor(newSpirit).realm,stageFor(newSpirit).tier,duration,pct,text]);
  return {newSpirit,debuffPercent:pct,text};
}

async function applyChallengeWin(client,userId,mode,odds){
  const p=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
  const spirit=Math.max(0,Number(p?.spirit_power)||0);
  const gain=Math.max(mode==='online'?180:80,Math.floor(spirit*(mode==='online'?0.30:0.12))+ (odds.gap>0?odds.gap*50:0));
  const item=await randomChallengeReward(client,userId,mode);
  const ns=spirit+gain;
  const st=stageFor(ns);
  await client.query(`UPDATE profiles SET spirit_power=$2,experience=experience+$3,rank=$4,realm_tier=$5,challenge_debuff_until=NULL,challenge_debuff_percent=0,challenge_debuff_text='',updated_at=NOW() WHERE user_id=$1`,[userId,ns,gain,st.realm,st.tier]);
  return {gain,spiritPower:ns,stage:st,item};
}

// ─────────────────────────────────────────────────────────────────────────────
// SƯ ĐỒ · Bảo hộ + nhận đệ tử
// ─────────────────────────────────────────────────────────────────────────────
async function activeMentor(client,userId){
  return (await client.query(`SELECT md.mentor_id,u.display_name AS mentor_name,p.rank,p.spirit_power
    FROM mentor_disciples md JOIN users u ON u.id=md.mentor_id JOIN profiles p ON p.user_id=md.mentor_id
    WHERE md.disciple_id=$1`,[userId])).rows[0]||null;
}
async function mentorCanTakeMore(client,mentorId){
  const p=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[mentorId])).rows[0];
  if(!p)return {ok:false,error:'Không tìm thấy hồ sơ sư phụ.'};
  const st=stageFor(Number(p.spirit_power)||0);
  if(st.realmIndex<5)return {ok:false,error:'Chỉ từ Luyện Hư mới được nhận đệ tử.'};
  const c=Number((await client.query('SELECT COUNT(*)::int AS c FROM mentor_disciples WHERE mentor_id=$1',[mentorId])).rows[0].c)||0;
  if(c>=2)return {ok:false,error:'Sư phụ đã đủ tối đa 2 đệ tử.'};
  return {ok:true,stage:st,count:c};
}
async function consumeDiscipleChallengePermission(client,challengerId,targetId,consume=true){
  const mentor=(await client.query(`SELECT md.mentor_id,mp.spirit_power AS mentor_spirit,mu.display_name AS mentor_name
    FROM mentor_disciples md JOIN profiles mp ON mp.user_id=md.mentor_id JOIN users mu ON mu.id=md.mentor_id
    WHERE md.disciple_id=$1`,[targetId])).rows[0];
  if(!mentor)return {allowed:true};
  const attacker=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1',[challengerId])).rows[0];
  if(!attacker)return {allowed:false,error:'Không tìm thấy hồ sơ người khiêu chiến.'};
  const aStage=stageFor(Number(attacker.spirit_power)||0), mStage=stageFor(Number(mentor.mentor_spirit)||0);
  if(aStage.realmIndex>=mStage.realmIndex)return {allowed:true,mentor};
  const perm=(await client.query(`SELECT id FROM disciple_challenge_permissions
    WHERE disciple_id=$1 AND challenger_id=$2 AND mentor_id=$3 AND status='approved'
    ORDER BY responded_at DESC NULLS LAST,id DESC LIMIT 1 FOR UPDATE`,[targetId,challengerId,mentor.mentor_id])).rows[0];
  if(!perm){
    return {allowed:false,mentor,protected:true,error:`${mentor.mentor_name} đang bảo hộ đệ tử. Bạn phải gửi truyền tin xin sư phụ chấp thuận trước khi khiêu chiến.`};
  }
  if(consume) await client.query(`UPDATE disciple_challenge_permissions SET status='used',used_at=NOW() WHERE id=$1`,[perm.id]);
  return {allowed:true,mentor,permissionUsed:consume};
}

app.get('/api/disciples',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id;
    const [mentor,disciples,incoming,outgoing,permissions,users,giftArtifacts,giftBeasts,giftRoots]=await Promise.all([
      query(`SELECT md.mentor_id,u.display_name AS mentor_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,p.title FROM mentor_disciples md JOIN users u ON u.id=md.mentor_id JOIN profiles p ON p.user_id=md.mentor_id WHERE md.disciple_id=$1`,[uid]),
      query(`SELECT md.disciple_id,u.display_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,p.title FROM mentor_disciples md JOIN users u ON u.id=md.disciple_id JOIN profiles p ON p.user_id=md.disciple_id WHERE md.mentor_id=$1 ORDER BY md.created_at`,[uid]),
      query(`SELECT dr.id,dr.disciple_id,dr.mentor_id,dr.request_type,u.display_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,p.title
        FROM discipleship_requests dr JOIN users u ON u.id=dr.disciple_id JOIN profiles p ON p.user_id=u.id
        WHERE dr.mentor_id=$1 AND dr.status='pending' ORDER BY dr.created_at DESC`,[uid]),
      query(`SELECT dr.id,dr.disciple_id,dr.mentor_id,dr.request_type,u.display_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,p.title
        FROM discipleship_requests dr JOIN users u ON u.id=dr.mentor_id JOIN profiles p ON p.user_id=u.id
        WHERE dr.disciple_id=$1 AND dr.status='pending' ORDER BY dr.created_at DESC`,[uid]),
      query(`SELECT cp.id,cp.disciple_id,cp.challenger_id,cp.mentor_id,cp.status,cp.created_at,du.display_name AS disciple_name,cu.display_name AS challenger_name FROM disciple_challenge_permissions cp JOIN users du ON du.id=cp.disciple_id JOIN users cu ON cu.id=cp.challenger_id WHERE cp.mentor_id=$1 AND cp.status='pending' ORDER BY cp.created_at DESC`,[uid]),
      query(`SELECT u.id,u.display_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,p.title FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id<>$1 ORDER BY p.spirit_power DESC,u.id`,[uid]),
      query(`SELECT ti.id,ti.name,ti.category,i.quantity,'artifact'::text AS gift_type FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 ORDER BY ti.category,ti.name`,[uid]),
      query(`SELECT o.beast_id AS id,c.name,c.rarity,c.beast_realm,c.beast_realm_tier,o.quantity,'beast'::text AS gift_type FROM owned_spirit_beasts o JOIN spirit_beasts_catalog c ON c.id=o.beast_id WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.beast_realm_tier DESC,c.name`,[uid]),
      query(`SELECT o.root_id AS id,c.name,c.rarity,o.quantity,'root'::text AS gift_type FROM owned_spirit_roots o JOIN spirit_roots_catalog c ON c.id=o.root_id WHERE o.user_id=$1 AND o.quantity>0 ORDER BY c.name`,[uid])
    ]);
    const me=(await query('SELECT spirit_power,spirit_stones FROM profiles WHERE user_id=$1',[uid])).rows[0];
    const st=stageFor(Number(me?.spirit_power)||0);
    const mentorCandidates=users.rows.map(x=>({...x,realmIndex:stageFor(Number(x.spirit_power)||0).realmIndex}));
    res.json({eligible:st.realmIndex>=5,stage:st,mentor:mentor.rows[0]||null,disciples:disciples.rows,incoming:incoming.rows,outgoing:outgoing.rows,permissions:permissions.rows,users:mentorCandidates,giftInventory:{stones:Number(me?.spirit_stones||0),artifacts:giftArtifacts.rows,beasts:giftBeasts.rows,roots:giftRoots.rows}});
  }catch(e){console.error('disciples load:',e);res.status(500).json({error:'Không thể mở Sư Đồ.'});}
});

app.post('/api/disciples/request',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,mentorId=Number(req.body?.mentorId);
    if(!Number.isInteger(mentorId)||mentorId<1||mentorId===uid)return res.status(400).json({error:'Sư phụ không hợp lệ.'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      if((await client.query('SELECT 1 FROM mentor_disciples WHERE disciple_id=$1',[uid])).rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã có sư phụ.'});}
      const cap=await mentorCanTakeMore(client,mentorId);
      if(!cap.ok){await client.query('ROLLBACK');return res.status(400).json({error:cap.error});}
      const exists=(await client.query('SELECT id FROM users WHERE id=$1',[mentorId])).rows[0];
      if(!exists){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy môn nhân.'});}
      await client.query(`UPDATE discipleship_requests SET status='cancelled',responded_at=NOW() WHERE disciple_id=$1 AND status='pending'`,[uid]);
      const r=await client.query(`INSERT INTO discipleship_requests(disciple_id,mentor_id,status) VALUES($1,$2,'pending') RETURNING id`,[uid,mentorId]);
      await client.query('COMMIT');res.status(201).json({ok:true,id:r.rows[0].id,message:'Đã gửi truyền tin bái sư. Chờ sư phụ chấp thuận.'});
    }catch(e){try{await client.query('ROLLBACK')}catch{};throw e;}finally{client.release();}
  }catch(e){console.error('disciples request:',e);res.status(500).json({error:'Không thể gửi lời bái sư.'});}
});

app.post('/api/disciples/invite',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,discipleId=Number(req.body?.discipleId);
    if(!Number.isInteger(discipleId)||discipleId<1||discipleId===uid)return res.status(400).json({error:'Đệ tử được mời không hợp lệ.'});
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const me=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[uid])).rows[0];
      const target=(await client.query('SELECT u.id,u.display_name,p.spirit_power FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1 FOR UPDATE',[discipleId])).rows[0];
      if(!me||!target){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy môn nhân.'});}
      const ms=stageFor(Number(me.spirit_power)||0), ts=stageFor(Number(target.spirit_power)||0);
      if(ms.realmIndex<5){await client.query('ROLLBACK');return res.status(403).json({error:'Chỉ từ Luyện Hư mới có thể gửi lời mời nhận đệ tử.'});}
      if(ts.realmIndex>=ms.realmIndex){await client.query('ROLLBACK');return res.status(400).json({error:'Chỉ có thể mời môn nhân có cảnh giới thấp hơn sư phụ.'});}
      const cap=await mentorCanTakeMore(client,uid);
      if(!cap.ok){await client.query('ROLLBACK');return res.status(400).json({error:cap.error});}
      if((await client.query('SELECT 1 FROM mentor_disciples WHERE disciple_id=$1',[discipleId])).rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Môn nhân này đã có sư phụ.'});}
      const existing=(await client.query(`SELECT id,status,request_type FROM discipleship_requests WHERE disciple_id=$1 AND mentor_id=$2 AND status='pending'`,[discipleId,uid])).rows[0];
      if(existing){await client.query('ROLLBACK');return res.status(409).json({error:'Đã có lời mời nhập môn đang chờ đối phương chấp thuận.'});}
      const r=await client.query(`INSERT INTO discipleship_requests(disciple_id,mentor_id,request_type,status) VALUES($1,$2,'mentor_to_disciple','pending') RETURNING id`,[discipleId,uid]);
      await client.query('COMMIT');
      res.status(201).json({ok:true,id:r.rows[0].id,message:`Đã gửi lời mời nhận ${target.display_name} làm đệ tử. Chờ đối phương chấp thuận.`});
    }catch(e){try{await client.query('ROLLBACK')}catch{};throw e;}finally{client.release();}
  }catch(e){console.error('disciples invite:',e);res.status(500).json({error:'Không thể gửi lời mời nhập môn.'});}
});

app.post('/api/disciples/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,id=Number(req.body?.requestId),action=String(req.body?.action||'');
    if(!Number.isInteger(id)||!['accept','reject'].includes(action))return res.status(400).json({error:'Yêu cầu không hợp lệ.'});
    await client.query('BEGIN');
    const r=(await client.query(`SELECT * FROM discipleship_requests WHERE id=$1 AND mentor_id=$2 AND status='pending' FOR UPDATE`,[id,uid])).rows[0];
    if(!r){await client.query('ROLLBACK');return res.status(404).json({error:'Lời bái sư không còn hiệu lực.'});}
    if(action==='reject'){await client.query(`UPDATE discipleship_requests SET status='rejected',responded_at=NOW() WHERE id=$1`,[id]);await client.query('COMMIT');return res.json({ok:true,message:'Đã từ chối lời bái sư.'});}
    const cap=await mentorCanTakeMore(client,uid);
    if(!cap.ok){await client.query('ROLLBACK');return res.status(400).json({error:cap.error});}
    if((await client.query('SELECT 1 FROM mentor_disciples WHERE disciple_id=$1',[r.disciple_id])).rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Môn nhân này đã có sư phụ.'});}
    await client.query(`INSERT INTO mentor_disciples(mentor_id,disciple_id) VALUES($1,$2)`,[uid,r.disciple_id]);
    await client.query(`UPDATE discipleship_requests SET status='accepted',responded_at=NOW() WHERE id=$1`,[id]);
    await client.query(`UPDATE discipleship_requests SET status='cancelled',responded_at=NOW() WHERE disciple_id=$1 AND id<>$2 AND status='pending'`,[r.disciple_id,id]);
    await client.query('COMMIT');res.json({ok:true,message:'Đã nhận môn nhân làm đệ tử. Đệ tử nhận bảo hộ của sư phụ.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('disciples respond:',e);res.status(500).json({error:'Không thể xử lý lời bái sư.'});}finally{client.release();}
});

app.post('/api/disciples/invite/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,id=Number(req.body?.requestId),action=String(req.body?.action||'');
    if(!Number.isInteger(id)||!['accept','reject'].includes(action))return res.status(400).json({error:'Yêu cầu không hợp lệ.'});
    await client.query('BEGIN');
    const r=(await client.query(`SELECT * FROM discipleship_requests WHERE id=$1 AND disciple_id=$2 AND request_type='mentor_to_disciple' AND status='pending' FOR UPDATE`,[id,uid])).rows[0];
    if(!r){await client.query('ROLLBACK');return res.status(404).json({error:'Lời mời nhập môn không còn hiệu lực.'});}
    if(action==='reject'){
      await client.query(`UPDATE discipleship_requests SET status='rejected',responded_at=NOW() WHERE id=$1`,[id]);
      await client.query('COMMIT');return res.json({ok:true,message:'Đã từ chối lời mời nhập môn.'});
    }
    if((await client.query('SELECT 1 FROM mentor_disciples WHERE disciple_id=$1',[uid])).rows.length){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã có sư phụ.'});}
    const cap=await mentorCanTakeMore(client,r.mentor_id);
    if(!cap.ok){await client.query('ROLLBACK');return res.status(400).json({error:cap.error});}
    const mp=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[r.mentor_id])).rows[0];
    const dp=(await client.query('SELECT spirit_power FROM profiles WHERE user_id=$1 FOR UPDATE',[uid])).rows[0];
    if(!mp||!dp){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ sư phụ hoặc đệ tử.'});}
    const ms=stageFor(Number(mp.spirit_power)||0), ds=stageFor(Number(dp.spirit_power)||0);
    if(ms.realmIndex<5||ds.realmIndex>=ms.realmIndex){await client.query('ROLLBACK');return res.status(400).json({error:'Cảnh giới không còn phù hợp để xác lập quan hệ sư đồ.'});}
    await client.query(`INSERT INTO mentor_disciples(mentor_id,disciple_id) VALUES($1,$2)`,[r.mentor_id,uid]);
    await client.query(`UPDATE discipleship_requests SET status='accepted',responded_at=NOW() WHERE id=$1`,[id]);
    await client.query(`UPDATE discipleship_requests SET status='cancelled',responded_at=NOW() WHERE disciple_id=$1 AND id<>$2 AND status='pending'`,[uid,id]);
    await client.query('COMMIT');res.json({ok:true,message:'Đã chấp thuận nhập môn. Bạn nhận bảo hộ của sư phụ.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('disciples invite respond:',e);res.status(500).json({error:'Không thể xử lý lời mời nhập môn.'});}finally{client.release();}
});

app.post('/api/disciples/permission',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,discipleId=Number(req.body?.discipleId),mentorId=Number(req.body?.mentorId);
    if(!Number.isInteger(discipleId)||!Number.isInteger(mentorId))return res.status(400).json({error:'Thông tin xin phép không hợp lệ.'});
    const ok=(await query('SELECT 1 FROM mentor_disciples WHERE mentor_id=$1 AND disciple_id=$2',[mentorId,discipleId])).rows[0];
    if(!ok)return res.status(404).json({error:'Không tìm thấy quan hệ sư đồ.'});
    const existing=(await query(`SELECT id FROM disciple_challenge_permissions WHERE disciple_id=$1 AND challenger_id=$2 AND mentor_id=$3 AND status='pending'`,[discipleId,uid,mentorId])).rows[0];
    if(existing)return res.status(409).json({error:'Bạn đã gửi truyền tin xin phép, đang chờ sư phụ phê chuẩn.'});
    const r=await query(`INSERT INTO disciple_challenge_permissions(disciple_id,challenger_id,mentor_id,status) VALUES($1,$2,$3,'pending') RETURNING id`,[discipleId,uid,mentorId]);
    res.status(201).json({ok:true,id:r.rows[0].id,message:'Đã gửi truyền tin xin sư phụ chấp thuận.'});
  }catch(e){console.error('disciples permission:',e);res.status(500).json({error:'Không thể gửi truyền tin xin phép.'});}
});

app.post('/api/disciples/permission/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,id=Number(req.body?.requestId),action=String(req.body?.action||'');
    if(!Number.isInteger(id)||!['approve','reject'].includes(action))return res.status(400).json({error:'Yêu cầu không hợp lệ.'});
    await client.query('BEGIN');
    const r=(await client.query(`SELECT * FROM disciple_challenge_permissions WHERE id=$1 AND mentor_id=$2 AND status='pending' FOR UPDATE`,[id,uid])).rows[0];
    if(!r){await client.query('ROLLBACK');return res.status(404).json({error:'Truyền tin không còn hiệu lực.'});}
    await client.query(`UPDATE disciple_challenge_permissions SET status=$2,responded_at=NOW() WHERE id=$1`,[id,action==='approve'?'approved':'rejected']);
    await client.query('COMMIT');res.json({ok:true,message:action==='approve'?'Đã chấp thuận khiêu chiến đối với đệ tử.':'Đã từ chối khiêu chiến đối với đệ tử.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};res.status(500).json({error:'Không thể phê chuẩn truyền tin.'});}finally{client.release();}
});

app.post('/api/disciples/gift',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id;
    const target=Number(req.body?.discipleId);
    const giftType=String(req.body?.giftType||'').toLowerCase();
    const itemId=Number(req.body?.itemId);
    const qty=Math.floor(Number(req.body?.quantity)||0);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đệ tử không hợp lệ.'});
    if(!['stones','artifact','beast','root'].includes(giftType))return res.status(400).json({error:'Loại vật phẩm tặng không hợp lệ.'});
    if(!Number.isInteger(qty)||qty<1)return res.status(400).json({error:'Số lượng tặng phải lớn hơn 0.'});
    if(giftType!=='stones' && (!Number.isInteger(itemId)||itemId<1))return res.status(400).json({error:'Vật phẩm tặng không hợp lệ.'});

    await client.query('BEGIN');
    const relation=(await client.query(`SELECT 1 FROM mentor_disciples WHERE mentor_id=$1 AND disciple_id=$2`,[uid,target])).rows[0];
    if(!relation){await client.query('ROLLBACK');return res.status(403).json({error:'Chỉ có thể tặng vật phẩm cho đệ tử trực thuộc.'});}

    // Khóa hồ sơ hai bên để không thể tặng vượt số dư khi gửi nhiều lần cùng lúc.
    const profiles=(await client.query(`SELECT user_id,spirit_stones,storage_capacity FROM profiles WHERE user_id IN ($1,$2) ORDER BY user_id FOR UPDATE`,[uid,target])).rows;
    const sender=profiles.find(x=>Number(x.user_id)===uid), receiver=profiles.find(x=>Number(x.user_id)===target);
    if(!sender||!receiver){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ sư phụ hoặc đệ tử.'});}

    if(giftType==='stones'){
      if(Number(sender.spirit_stones)<qty){await client.query('ROLLBACK');return res.status(400).json({error:`Sư phụ không đủ linh thạch. Hiện có ${Number(sender.spirit_stones).toLocaleString('vi-VN')}.`});}
      await client.query(`UPDATE profiles SET spirit_stones=spirit_stones-$2,updated_at=NOW() WHERE user_id=$1`,[uid,qty]);
      await client.query(`UPDATE profiles SET spirit_stones=spirit_stones+$2,updated_at=NOW() WHERE user_id=$1`,[target,qty]);
      await client.query('COMMIT');
      return res.json({ok:true,giftType,quantity:qty,message:`Đã ban tặng 💎 ${qty.toLocaleString('vi-VN')} linh thạch cho đệ tử.`});
    }

    const used=Number((await client.query(`SELECT COUNT(*)::int AS c FROM inventory WHERE user_id=$1 AND quantity>0`,[target])).rows[0].c)||0;
    const capacity=Math.max(1,Number(receiver.storage_capacity)||30);
    if(giftType==='artifact'){
      const senderItem=(await client.query(`SELECT i.quantity,ti.name FROM inventory i JOIN treasure_items ti ON ti.id=i.item_id WHERE i.user_id=$1 AND i.item_id=$2 FOR UPDATE`,[uid,itemId])).rows[0];
      if(!senderItem||Number(senderItem.quantity)<qty){await client.query('ROLLBACK');return res.status(400).json({error:'Sư phụ không đủ số lượng pháp khí/vật phẩm này.'});}
      const targetItem=(await client.query(`SELECT quantity FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE`,[target,itemId])).rows[0];
      if(!targetItem && used>=capacity){await client.query('ROLLBACK');return res.status(400).json({error:'Tu Di Giới của đệ tử đã đầy.'});}
      await client.query(`UPDATE inventory SET quantity=quantity-$3,updated_at=NOW() WHERE user_id=$1 AND item_id=$2`,[uid,itemId,qty]);
      await client.query(`INSERT INTO inventory(user_id,item_id,quantity,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,updated_at=NOW()`,[target,itemId,qty]);
      await client.query('COMMIT');
      return res.json({ok:true,giftType,quantity:qty,itemName:senderItem.name,message:`Đã ban tặng ${senderItem.name} ×${qty} cho đệ tử.`});
    }

    if(giftType==='beast'){
      const senderItem=(await client.query(`SELECT o.quantity,c.name FROM owned_spirit_beasts o JOIN spirit_beasts_catalog c ON c.id=o.beast_id WHERE o.user_id=$1 AND o.beast_id=$2 FOR UPDATE`,[uid,itemId])).rows[0];
      if(!senderItem||Number(senderItem.quantity)<qty){await client.query('ROLLBACK');return res.status(400).json({error:'Sư phụ không đủ số lượng linh thú này.'});}
      const targetItem=(await client.query(`SELECT quantity FROM owned_spirit_beasts WHERE user_id=$1 AND beast_id=$2 FOR UPDATE`,[target,itemId])).rows[0];
      const usedAll=Number((await client.query(`SELECT (SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_beasts WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_roots WHERE user_id=$1 AND quantity>0) AS c`,[target])).rows[0].c)||0;
      if(!targetItem && usedAll>=capacity){await client.query('ROLLBACK');return res.status(400).json({error:'Kho vật phẩm của đệ tử đã đầy.'});}
      await client.query(`UPDATE owned_spirit_beasts SET quantity=quantity-$3 WHERE user_id=$1 AND beast_id=$2`,[uid,itemId,qty]);
      await client.query(`INSERT INTO owned_spirit_beasts(user_id,beast_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,beast_id) DO UPDATE SET quantity=owned_spirit_beasts.quantity+EXCLUDED.quantity`,[target,itemId,qty]);
      await client.query('COMMIT');
      return res.json({ok:true,giftType,quantity:qty,itemName:senderItem.name,message:`Đã ban tặng 🐉 ${senderItem.name} ×${qty} cho đệ tử.`});
    }

    const senderItem=(await client.query(`SELECT o.quantity,c.name FROM owned_spirit_roots o JOIN spirit_roots_catalog c ON c.id=o.root_id WHERE o.user_id=$1 AND o.root_id=$2 FOR UPDATE`,[uid,itemId])).rows[0];
    if(!senderItem||Number(senderItem.quantity)<qty){await client.query('ROLLBACK');return res.status(400).json({error:'Sư phụ không đủ số lượng linh căn này.'});}
    const targetItem=(await client.query(`SELECT quantity FROM owned_spirit_roots WHERE user_id=$1 AND root_id=$2 FOR UPDATE`,[target,itemId])).rows[0];
    const usedAll=Number((await client.query(`SELECT (SELECT COUNT(*) FROM inventory WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_beasts WHERE user_id=$1 AND quantity>0)+(SELECT COUNT(*) FROM owned_spirit_roots WHERE user_id=$1 AND quantity>0) AS c`,[target])).rows[0].c)||0;
    if(!targetItem && usedAll>=capacity){await client.query('ROLLBACK');return res.status(400).json({error:'Kho vật phẩm của đệ tử đã đầy.'});}
    await client.query(`UPDATE owned_spirit_roots SET quantity=quantity-$3 WHERE user_id=$1 AND root_id=$2`,[uid,itemId,qty]);
    await client.query(`INSERT INTO owned_spirit_roots(user_id,root_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,root_id) DO UPDATE SET quantity=owned_spirit_roots.quantity+EXCLUDED.quantity`,[target,itemId,qty]);
    await client.query('COMMIT');
    res.json({ok:true,giftType,quantity:qty,itemName:senderItem.name,message:`Đã ban tặng 🌿 ${senderItem.name} ×${qty} cho đệ tử.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('disciple gift:',e);res.status(500).json({error:'Không thể tặng vật phẩm.'});}
  finally{client.release();}
});

// ─────────────────────────────────────────────────────────────────────────────
// BẰNG HỮU · Kết giao + chat riêng
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/challenges',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id;
    const [users,pending,history,activeRows]=await Promise.all([
      query(`SELECT u.id,u.display_name,u.username,p.avatar,p.title,p.rank,p.spirit_power,p.realm_tier,p.challenge_debuff_until,p.challenge_debuff_percent,COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0)+COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0)+COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power
             FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id<>$1 ORDER BY u.display_name,u.id`,[uid]),
      query(`SELECT cr.id,cr.challenger_id,cr.opponent_id,cr.mode,cr.created_at,u.display_name AS challenger_name,p.avatar,p.rank,p.spirit_power,p.realm_tier,COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0)+COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0)+COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power
             FROM challenge_requests cr JOIN users u ON u.id=cr.challenger_id JOIN profiles p ON p.user_id=u.id
             WHERE cr.opponent_id=$1 AND cr.status='pending' AND cr.mode='online' ORDER BY cr.created_at DESC LIMIT 20`,[uid]),
      query(`SELECT cr.*,cu.display_name AS challenger_name,ou.display_name AS opponent_name,
             ri.name AS reward_item_name
             FROM challenge_requests cr JOIN users cu ON cu.id=cr.challenger_id JOIN users ou ON ou.id=cr.opponent_id
             LEFT JOIN treasure_items ri ON ri.id=cr.reward_item_id
             WHERE cr.challenger_id=$1 OR cr.opponent_id=$1 ORDER BY cr.id DESC LIMIT 30`,[uid]),
      query(`SELECT cr.id,cr.challenger_id,cr.opponent_id,cr.status,cr.challenger_hp,cr.opponent_hp,cr.challenger_max_hp,cr.opponent_max_hp,cr.turn_user_id,cr.round_number,cr.last_actor_id,cr.last_damage,cr.last_action,cr.started_at,
                    cu.display_name AS challenger_name,cu.avatar AS challenger_avatar,cp.rank AS challenger_rank,cp.spirit_power AS challenger_spirit,
                    ou.display_name AS opponent_name,ou.avatar AS opponent_avatar,op.rank AS opponent_rank,op.spirit_power AS opponent_spirit
             FROM challenge_requests cr
             JOIN users cu ON cu.id=cr.challenger_id JOIN profiles cp ON cp.user_id=cu.id
             JOIN users ou ON ou.id=cr.opponent_id JOIN profiles op ON op.user_id=ou.id
             WHERE cr.status='accepted' AND (cr.challenger_id=$1 OR cr.opponent_id=$1) ORDER BY cr.id DESC LIMIT 1`,[uid])
    ]);
    const me=(await query(`SELECT spirit_power,spirit_stones,challenge_debuff_until,challenge_debuff_percent,challenge_debuff_text FROM profiles WHERE user_id=$1`,[uid])).rows[0];
    const active=activeRows.rows[0]||null;
    res.json({users:users.rows,pending:pending.rows,history:history.rows,me,activeBattle:active?{...battleSnapshot(active,uid),challengerName:active.challenger_name,challengerAvatar:active.challenger_avatar,challengerRank:active.challenger_rank,challengerSpirit:Number(active.challenger_spirit)||0,opponentName:active.opponent_name,opponentAvatar:active.opponent_avatar,opponentRank:active.opponent_rank,opponentSpirit:Number(active.opponent_spirit)||0}:null});
  }catch(e){console.error('challenges load:',e);res.status(500).json({error:'Không thể mở Khiêu Chiến.'});}
});

app.post('/api/challenges/offline',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,target=Number(req.body?.userId);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đối thủ không hợp lệ.'});
    await client.query('BEGIN');
    const rows=(await client.query(`SELECT u.id,u.display_name,p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id IN ($1,$2) ORDER BY u.id FOR UPDATE`,[uid,target])).rows;
    const me=rows.find(x=>Number(x.id)===uid), opp=rows.find(x=>Number(x.id)===target);
    if(!me||!opp){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy đối thủ.'});}
    const protection=await consumeDiscipleChallengePermission(client,uid,target);
    if(!protection.allowed){await client.query('ROLLBACK');return res.status(403).json({error:protection.error,protected:true,mentorId:protection.mentor?.mentor_id,mentorName:protection.mentor?.mentor_name,discipleId:target});}
    const odds=challengeOdds(me,opp);
    const roll=Math.random();
    const win=roll<odds.chance;
    let winnerId=win?uid:target, loserId=win?target:uid, reward=null, loss=null;
    if(win) reward=await applyChallengeWin(client,uid,'offline',odds); else loss=await applyChallengeLoss(client,uid,'offline',odds.aStage);
    const row=await client.query(`INSERT INTO challenge_requests(challenger_id,opponent_id,mode,status,winner_id,loser_id,challenger_damage,opponent_damage,success_chance,reward_spirit,reward_item_id,reward_quantity,penalty_text,responded_at)
      VALUES($1,$2,'offline','completed',$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING id`,[uid,target,winnerId,loserId,win?odds.damageMultiplier:odds.damageMultiplier*0.55,win?1:Math.max(0.1,odds.damageMultiplier*0.35),odds.chance,reward?.gain||0,reward?.item?.id||null,reward?.item?.quantity||0,loss?.text||'']);
    await client.query('COMMIT');
    res.json({ok:true,mode:'offline',win,opponent:opp.display_name,successChance:Math.round(odds.chance*100),damageMultiplier:Math.round(odds.damageMultiplier*100),reward,rewardText:reward?`Linh lực bạo tăng +${reward.gain}. Vật phẩm ngẫu nhiên: ${reward.item?.name||'—'} ×1.`:null,penalty:loss?.text||null,stageAfter:stageFor(win?reward.spiritPower:loss.newSpirit).stage});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('offline challenge:',e);res.status(500).json({error:'Khiêu chiến offline thất bại. Không có tài nguyên nào bị trừ.'});}
  finally{client.release();}
});

app.post('/api/challenges/online/request',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,target=Number(req.body?.userId);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đối thủ không hợp lệ.'});
    await client.query('BEGIN');
    const exists=(await client.query('SELECT id FROM users WHERE id=$1',[target])).rows[0];
    if(!exists){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy môn nhân.'});}
    const protection=await consumeDiscipleChallengePermission(client,uid,target,false);
    if(!protection.allowed){await client.query('ROLLBACK');return res.status(403).json({error:protection.error,protected:true,mentorId:protection.mentor?.mentor_id,mentorName:protection.mentor?.mentor_name,discipleId:target});}
    const activeEither=(await client.query(`SELECT id FROM challenge_requests WHERE status='accepted' AND (challenger_id IN ($1,$2) OR opponent_id IN ($1,$2)) LIMIT 1`,[uid,target])).rows[0];
    if(activeEither){await client.query('ROLLBACK');return res.status(409).json({error:'Một trong hai môn nhân đang ở trong lôi đài khác.'});}
    const pending=(await client.query(`SELECT id FROM challenge_requests WHERE challenger_id=$1 AND opponent_id=$2 AND mode='online' AND status='pending'`,[uid,target])).rows[0];
    if(pending){await client.query('ROLLBACK');return res.status(409).json({error:'Bạn đã mở lôi đài và đang chờ đối phương đồng thuận.'});}
    const incoming=(await client.query(`SELECT id FROM challenge_requests WHERE challenger_id=$2 AND opponent_id=$1 AND mode='online' AND status='pending'`,[uid,target])).rows[0];
    if(incoming){await client.query('ROLLBACK');return res.status(409).json({error:'Đối phương đã mở lôi đài với bạn. Hãy vào Khiêu Chiến để đồng thuận.'});}
    const r=await client.query(`INSERT INTO challenge_requests(challenger_id,opponent_id,mode,status) VALUES($1,$2,'online','pending') RETURNING id,created_at`,[uid,target]);
    await client.query('COMMIT');
    res.status(201).json({ok:true,...r.rows[0],message:'Đã mở lôi đài. Chờ đối phương đồng thuận.'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('online challenge request:',e);res.status(500).json({error:'Không thể mở lôi đài.'});}
  finally{client.release();}
});

app.post('/api/challenges/online/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,requestId=Number(req.body?.requestId),action=String(req.body?.action||'');
    if(!Number.isInteger(requestId)||!['accept','reject'].includes(action))return res.status(400).json({error:'Yêu cầu lôi đài không hợp lệ.'});
    await client.query('BEGIN');
    const reqRow=(await client.query(`SELECT * FROM challenge_requests WHERE id=$1 AND opponent_id=$2 AND mode='online' AND status='pending' FOR UPDATE`,[requestId,uid])).rows[0];
    if(!reqRow){await client.query('ROLLBACK');return res.status(404).json({error:'Lời mời lôi đài không còn hiệu lực.'});}
    if(action==='reject'){
      await client.query(`UPDATE challenge_requests SET status='rejected',responded_at=NOW() WHERE id=$1`,[requestId]);
      await client.query('COMMIT');
      return res.json({ok:true,status:'rejected',message:'Đã từ chối lôi đài.'});
    }
    const ids=[Number(reqRow.challenger_id),Number(reqRow.opponent_id)].sort((a,b)=>a-b);
    const rows=(await client.query(`SELECT u.id,u.display_name,p.* FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id IN ($1,$2) ORDER BY u.id FOR UPDATE`,[ids[0],ids[1]])).rows;
    const challenger=rows.find(x=>Number(x.id)===Number(reqRow.challenger_id)), opponent=rows.find(x=>Number(x.id)===Number(reqRow.opponent_id));
    if(!challenger||!opponent){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hồ sơ chiến đấu.'});}
    const activeA=(await client.query(`SELECT 1 FROM challenge_requests WHERE status='accepted' AND (challenger_id=$1 OR opponent_id=$1) LIMIT 1`,[challenger.id])).rows[0];
    const activeB=(await client.query(`SELECT 1 FROM challenge_requests WHERE status='accepted' AND (challenger_id=$1 OR opponent_id=$1) LIMIT 1`,[opponent.id])).rows[0];
    if(activeA||activeB){await client.query('ROLLBACK');return res.status(409).json({error:'Một trong hai môn nhân đang ở trong lôi đài khác.'});}
    const protection=await consumeDiscipleChallengePermission(client,Number(reqRow.challenger_id),Number(reqRow.opponent_id),true);
    if(!protection.allowed){await client.query('ROLLBACK');return res.status(403).json({error:protection.error,protected:true,mentorId:protection.mentor?.mentor_id,mentorName:protection.mentor?.mentor_name,discipleId:Number(reqRow.opponent_id)});}
    const challengerMax=challengeHealth(challenger), opponentMax=challengeHealth(opponent);
    await client.query(`UPDATE challenge_requests SET status='accepted',challenger_hp=$2,opponent_hp=$3,challenger_max_hp=$4,opponent_max_hp=$5,turn_user_id=$6,round_number=0,last_actor_id=NULL,last_damage=0,last_action='',started_at=NOW(),responded_at=NOW() WHERE id=$1`,[requestId,challengerMax,opponentMax,challengerMax,opponentMax,challenger.id]);
    await client.query('COMMIT');
    res.json({ok:true,status:'accepted',battle:{id:requestId,challengerId:Number(challenger.id),opponentId:Number(opponent.id),challengerHp:challengerMax,opponentHp:opponentMax,challengerMaxHp:challengerMax,opponentMaxHp:opponentMax,turnUserId:Number(challenger.id),yourTurn:Number(challenger.id)===uid,round:0,lastDamage:0,lastAction:'',challengerName:challenger.display_name,opponentName:opponent.display_name},message:`Lôi đài đã khai mở. ${challenger.display_name} ra chiêu trước.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('online challenge respond:',e);res.status(500).json({error:'Lôi đài online thất bại. Giao dịch đã được hoàn tác.'});}
  finally{client.release();}
});

app.post('/api/challenges/online/action',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id,requestId=Number(req.body?.requestId);
    if(!Number.isInteger(requestId)||requestId<1)return res.status(400).json({error:'Lôi đài không hợp lệ.'});
    await client.query('BEGIN');
    const battle=(await client.query(`SELECT cr.*,cu.display_name AS challenger_name,ou.display_name AS opponent_name
      FROM challenge_requests cr JOIN users cu ON cu.id=cr.challenger_id JOIN users ou ON ou.id=cr.opponent_id
      WHERE cr.id=$1 AND cr.mode='online' AND cr.status='accepted' AND (cr.challenger_id=$2 OR cr.opponent_id=$2) FOR UPDATE`,[requestId,uid])).rows[0];
    if(!battle){await client.query('ROLLBACK');return res.status(404).json({error:'Lôi đài không còn hoạt động.'});}
    if(Number(battle.turn_user_id)!==uid){await client.query('ROLLBACK');return res.status(409).json({error:'Chưa tới lượt bạn tung tuyệt chiêu.'});}
    const rows=(await client.query(`SELECT u.id,u.display_name,p.*
      FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id IN ($1,$2) ORDER BY u.id FOR UPDATE`,[battle.challenger_id,battle.opponent_id])).rows;
    const attacker=rows.find(x=>Number(x.id)===uid), defender=rows.find(x=>Number(x.id)!==uid);
    if(!attacker||!defender){await client.query('ROLLBACK');return res.status(404).json({error:'Không tìm thấy hai hồ sơ chiến đấu.'});}
    const attackerEq=(await client.query(`SELECT COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0)+COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0)+COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power FROM profiles p WHERE p.user_id=$1`,[uid])).rows[0];
    const defenderEq=(await client.query(`SELECT COALESCE((SELECT power_bonus FROM spirit_beasts_catalog WHERE id=p.equipped_beast_id),0)+COALESCE((SELECT power_bonus FROM spirit_roots_catalog WHERE id=p.equipped_root_id),0)+COALESCE((SELECT power_bonus FROM treasure_items WHERE id=p.equipped_artifact_id),0) AS equipment_power FROM profiles p WHERE p.user_id=$1`,[defender.id])).rows[0];
    attacker.equipment_power=Number(attackerEq?.equipment_power)||0; defender.equipment_power=Number(defenderEq?.equipment_power)||0;
    const damage=ultimateDamage(attacker,defender);
    const attackerIsChallenger=Number(attacker.id)===Number(battle.challenger_id);
    const oldDefHp=attackerIsChallenger?Number(battle.opponent_hp):Number(battle.challenger_hp);
    const newDefHp=Math.max(0,oldDefHp-damage);
    const newRound=Number(battle.round_number||0)+1;
    const actionName='⚡ Tuyệt Chiêu · Hàn Thiên Phá';
    const realmGap=stageFor(Number(attacker.spirit_power)||0).realmIndex-stageFor(Number(defender.spirit_power)||0).realmIndex;
    if(newDefHp<=0){
      const winner=attacker, loser=defender;
      const reward=await applyChallengeWin(client,Number(winner.id),'online',challengeOdds(winner,loser));
      const loss=await applyChallengeLoss(client,Number(loser.id),'online',challengeOdds(loser,winner).dStage);
      const challengerDamage=attackerIsChallenger?damage:Number(battle.challenger_damage||0);
      const opponentDamage=attackerIsChallenger?Number(battle.opponent_damage||0):damage;
      await client.query(`UPDATE challenge_requests SET status='completed',winner_id=$2,loser_id=$3,challenger_hp=$4,opponent_hp=$5,turn_user_id=NULL,round_number=$6,last_actor_id=$7,last_damage=$8,last_action=$9,challenger_damage=$10,opponent_damage=$11,success_chance=1,reward_spirit=$12,reward_item_id=$13,reward_quantity=$14,penalty_text=$15,responded_at=NOW() WHERE id=$1`,[requestId,winner.id,loser.id,attackerIsChallenger?Number(battle.challenger_hp):newDefHp,attackerIsChallenger?newDefHp:Number(battle.opponent_hp),newRound,attacker.id,damage,actionName,challengerDamage,opponentDamage,reward.gain,reward.item?.id||null,reward.item?.quantity||0,loss.text]);
      await client.query('COMMIT');
      return res.json({ok:true,status:'completed',winnerId:Number(winner.id),winner:winner.display_name,loser:loser.display_name,damage,realmGap,round:newRound,reward,penalty:loss,message:`${winner.display_name} tung ${actionName}, gây ${damage.toLocaleString('vi-VN')} sát thương và kết thúc lôi đài.`});
    }
    const challengerHp=attackerIsChallenger?Number(battle.challenger_hp):newDefHp;
    const opponentHp=attackerIsChallenger?newDefHp:Number(battle.opponent_hp);
    const nextTurn=Number(defender.id);
    await client.query(`UPDATE challenge_requests SET challenger_hp=$2,opponent_hp=$3,turn_user_id=$4,round_number=$5,last_actor_id=$6,last_damage=$7,last_action=$8,challenger_damage=challenger_damage+$9,opponent_damage=opponent_damage+$10 WHERE id=$1`,[requestId,challengerHp,opponentHp,nextTurn,newRound,attacker.id,damage,actionName,attackerIsChallenger?damage:0,attackerIsChallenger?0:damage]);
    await client.query('COMMIT');
    res.json({ok:true,status:'accepted',damage,realmGap,round:newRound,turnUserId:nextTurn,yourTurn:false,challengerHp,opponentHp,challengerMaxHp:Number(battle.challenger_max_hp),opponentMaxHp:Number(battle.opponent_max_hp),lastActorId:uid,lastAction:actionName,message:`${attacker.display_name} tung ${actionName}, gây ${damage.toLocaleString('vi-VN')} sát thương. Đến lượt ${defender.display_name}.`});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('online challenge action:',e);res.status(500).json({error:'Không thể tung tuyệt chiêu. Giao dịch đã được hoàn tác.'});}
  finally{client.release();}
});

app.get('/api/friends',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id;
    const [friends,pendingIn,pendingOut]=await Promise.all([
      query(`SELECT u.id,u.display_name,u.username,p.avatar,p.title,p.rank,p.spirit_power,p.realm_tier
             FROM friend_requests fr
             JOIN users u ON u.id=CASE WHEN fr.requester_id=$1 THEN fr.addressee_id ELSE fr.requester_id END
             JOIN profiles p ON p.user_id=u.id
             WHERE (fr.requester_id=$1 OR fr.addressee_id=$1) AND fr.status='accepted'
             ORDER BY u.display_name,u.id`,[uid]),
      query(`SELECT fr.id,fr.requester_id,u.display_name,u.username,p.avatar,p.title,p.rank,p.realm_tier,fr.created_at
             FROM friend_requests fr JOIN users u ON u.id=fr.requester_id JOIN profiles p ON p.user_id=u.id
             WHERE fr.addressee_id=$1 AND fr.status='pending' ORDER BY fr.created_at DESC`,[uid]),
      query(`SELECT fr.id,fr.addressee_id,u.display_name,u.username,p.avatar,p.title,p.rank,p.realm_tier,fr.created_at
             FROM friend_requests fr JOIN users u ON u.id=fr.addressee_id JOIN profiles p ON p.user_id=u.id
             WHERE fr.requester_id=$1 AND fr.status='pending' ORDER BY fr.created_at DESC`,[uid])
    ]);
    res.json({friends:friends.rows,incoming:pendingIn.rows,outgoing:pendingOut.rows});
  }catch(e){console.error('friends:',e);res.status(500).json({error:'Không thể tải ô bằng hữu.'});}
});

app.post('/api/friends/request',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id, target=Number(req.body?.userId);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đạo hữu không hợp lệ.'});
    const exists=(await query('SELECT id FROM users WHERE id=$1',[target])).rows[0];
    if(!exists)return res.status(404).json({error:'Không tìm thấy môn nhân.'});
    const old=(await query(`SELECT id,requester_id,addressee_id,status FROM friend_requests
      WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)
      ORDER BY id DESC LIMIT 1`,[uid,target])).rows[0];
    if(old?.status==='accepted')return res.status(409).json({error:'Hai người đã là bằng hữu.'});
    if(old?.status==='pending'){
      if(Number(old.requester_id)===target)return res.status(409).json({error:'Đạo hữu này đã gửi lời mời cho bạn. Hãy mở ô bằng hữu để chấp nhận.'});
      return res.status(409).json({error:'Đã gửi lời mời kết bằng hữu.'});
    }
    if(old?.status==='rejected') await query('DELETE FROM friend_requests WHERE id=$1',[old.id]);
    const r=await query(`INSERT INTO friend_requests(requester_id,addressee_id,status) VALUES($1,$2,'pending') RETURNING id,created_at`,[uid,target]);
    res.status(201).json({ok:true,...r.rows[0],message:'Đã gửi lời mời kết bằng hữu.'});
  }catch(e){console.error('friend request:',e);res.status(500).json({error:'Không thể gửi lời mời bằng hữu.'});}
});

app.post('/api/friends/respond',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const uid=req.session.user_id, requestId=Number(req.body?.requestId), action=String(req.body?.action||'');
    if(!Number.isInteger(requestId)||!['accept','reject'].includes(action))return res.status(400).json({error:'Yêu cầu không hợp lệ.'});
    await client.query('BEGIN');
    const r=(await client.query(`SELECT * FROM friend_requests WHERE id=$1 AND addressee_id=$2 AND status='pending' FOR UPDATE`,[requestId,uid])).rows[0];
    if(!r){await client.query('ROLLBACK');return res.status(404).json({error:'Lời mời bằng hữu không còn hiệu lực.'});}
    await client.query(`UPDATE friend_requests SET status=$2,responded_at=NOW() WHERE id=$1`,[requestId,action==='accept'?'accepted':'rejected']);
    await client.query('COMMIT');
    res.json({ok:true,status:action==='accept'?'accepted':'rejected'});
  }catch(e){try{await client.query('ROLLBACK')}catch{};console.error('friend respond:',e);res.status(500).json({error:'Không thể xử lý lời mời bằng hữu.'});}
  finally{client.release();}
});

app.post('/api/friends/remove',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,target=Number(req.body?.userId);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đạo hữu không hợp lệ.'});
    const r=await query(`DELETE FROM friend_requests WHERE status='accepted' AND ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)) RETURNING id`,[uid,target]);
    if(!r.rows.length)return res.status(404).json({error:'Hai người chưa phải bằng hữu.'});
    res.json({ok:true});
  }catch(e){console.error('friend remove:',e);res.status(500).json({error:'Không thể hủy kết bằng hữu.'});}
});

async function areFriends(a,b){
  const r=await query(`SELECT 1 FROM friend_requests WHERE status='accepted' AND ((requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)) LIMIT 1`,[a,b]);
  return r.rows.length>0;
}

app.get('/api/friends/:userId/messages',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,target=Number(req.params.userId);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đạo hữu không hợp lệ.'});
    if(!(await areFriends(uid,target)))return res.status(403).json({error:'Chỉ có thể chat riêng với bằng hữu đã kết giao.'});
    const r=await query(`SELECT pm.id,pm.sender_id,pm.recipient_id,pm.message,pm.created_at,u.display_name,p.avatar,p.rank
      FROM private_messages pm JOIN users u ON u.id=pm.sender_id JOIN profiles p ON p.user_id=u.id
      WHERE (pm.sender_id=$1 AND pm.recipient_id=$2) OR (pm.sender_id=$2 AND pm.recipient_id=$1)
      ORDER BY pm.id DESC LIMIT 100`,[uid,target]);
    await query(`UPDATE private_messages SET read_at=NOW() WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL`,[uid,target]);
    res.json({rows:r.rows.reverse()});
  }catch(e){console.error('private chat load:',e);res.status(500).json({error:'Không thể tải chat riêng.'});}
});

app.post('/api/friends/:userId/messages',auth,async(req,res)=>{
  try{
    const uid=req.session.user_id,target=Number(req.params.userId),message=String(req.body?.message||'').trim().slice(0,1000);
    if(!Number.isInteger(target)||target<1||target===uid)return res.status(400).json({error:'Đạo hữu không hợp lệ.'});
    if(!message)return res.status(400).json({error:'Tin nhắn không được để trống.'});
    if(!(await areFriends(uid,target)))return res.status(403).json({error:'Chỉ có thể chat riêng với bằng hữu đã kết giao.'});
    const r=await query(`INSERT INTO private_messages(sender_id,recipient_id,message) VALUES($1,$2,$3) RETURNING id,created_at`,[uid,target,message]);
    res.status(201).json({ok:true,...r.rows[0]});
  }catch(e){console.error('private chat send:',e);res.status(500).json({error:'Không thể gửi tin nhắn riêng.'});}
});

app.post('/api/members',auth,async(req,res)=>{
  try{const {name,nick,emoji='🧑‍🎨',role='Đệ tử',bio='',birthday='',hobby='',tags=[]}=req.body||{};if(!name||!nick)return res.status(400).json({error:'Thiếu tên hoặc biệt danh.'});const r=await query('INSERT INTO members(name,nick,emoji,role,bio,birthday,hobby,tags) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[name,nick,emoji,role,bio,birthday,hobby,Array.isArray(tags)?tags.join(','):String(tags)]);res.status(201).json({id:r.rows[0].id});}catch(e){res.status(500).json({error:'Không thể thêm môn nhân.'});}
});

initDb().then(()=>app.listen(PORT,()=>console.log(`Hàn Thiên Môn đang chạy trên cổng ${PORT}`))).catch(err=>{console.error('Không khởi tạo được database:',err);process.exit(1);});
