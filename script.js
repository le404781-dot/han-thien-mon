let members=[], memories=[], timeline=[];
let currentProfile=null;
const $=s=>document.querySelector(s);
const tokenKey='han_thien_token';
const getToken=()=>localStorage.getItem(tokenKey);
const authHeaders=()=>getToken()?{'Authorization':'Bearer '+getToken(),'Content-Type':'application/json'}:{'Content-Type':'application/json'};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleDateString('vi-VN'):'—';

async function api(url,opts={}){
 const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),...(opts.body&&typeof opts.body==='string'?{'Content-Type':'application/json'}:{})}});
 let d={}; try{d=await r.json();}catch{}
 if(!r.ok) throw new Error(d.error||'Có lỗi xảy ra.');
 return d;
}

async function loadData(){
 try{
  const data=await api('/api/data'); members=data.members; memories=data.memories; timeline=data.timeline;
  $('#memberCount').textContent=members.length; $('#memoryCount').textContent=memories.length; $('#userCount').textContent=data.userCount||0;
  renderMembers(); renderGallery(); renderTimeline();
 }catch(e){console.error(e);}
}
function renderMembers(list=members){
 $('#membersGrid').innerHTML=list.length?list.map((m,i)=>`<article class="member-card" data-index="${members.indexOf(m)}"><div class="avatar">${esc(m.emoji)}</div><div class="member-info"><span class="nickname">${esc(m.nick)}</span><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p><div class="tags">${m.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></article>`).join(''):`<p>Không tìm thấy môn nhân phù hợp.</p>`;
 document.querySelectorAll('.member-card').forEach(c=>c.onclick=()=>openMember(+c.dataset.index));
}
function renderGallery(){ $('#galleryGrid').innerHTML=memories.map(m=>`<article class="memory"><div class="pic">${esc(m.icon)}</div><div class="caption">${esc(m.title)}<small>${esc(m.description)}</small></div></article>`).join(''); }
function renderTimeline(){ $('#timelineList').innerHTML=timeline.map(e=>`<article class="event"><i class="dot"></i><span class="date">${esc(e.year)}</span><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p></article>`).join(''); }
function openMember(i){const m=members[i];$('#modalContent').innerHTML=`<div class="modal-avatar">${esc(m.emoji)}</div><div class="modal-content"><span class="nickname">${esc(m.nick)}</span><h2>${esc(m.name)}</h2><p>${esc(m.bio||'Đã ghi danh vào Hàn Thiên Môn.')}</p><div class="facts"><div class="fact"><small>Cảnh giới</small><b>${esc(m.rank||'Luyện Khí')} · ${esc(m.realm_tier||1)}/9</b></div><div class="fact"><small>Linh lực</small><b>${Number(m.spirit_power||0).toLocaleString('vi-VN')}</b></div><div class="fact"><small>Sinh nhật</small><b>${esc(m.birthday||'—')}</b></div><div class="fact"><small>Sở thích</small><b>${esc(m.hobby||'—')}</b></div></div><div class="tags">${m.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div>`;$('#memberModal').showModal();}

function accountUI(user){
 if(user){$('#userBadge').textContent='☯ '+user.displayName;$('#userBadge').classList.remove('hidden');$('#accountBtn').textContent='Hồ sơ';}
 else{$('#userBadge').classList.add('hidden');$('#accountBtn').textContent='☯ Đăng nhập';}
}
async function checkSession(){
 if(!getToken()){accountUI(null);renderGuestAreas();return;}
 try{const d=await api('/api/me',{headers:authHeaders()});accountUI(d.user);await loadProfile();await loadChat();await loadLeaderboard();await loadTreasure();await loadTuDi();await loadQuests();}
 catch{localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}
}
function renderGuestAreas(){
 $('#profileArea').innerHTML=`<div class="empty-state"><div class="empty-seal">寒</div><h3>Đệ tử chưa nhập môn</h3><p>Đăng ký hoặc đăng nhập để mở hồ sơ, linh lực, cảnh giới và thành tích cá nhân.</p><button class="btn primary" onclick="renderAuth('register')">✦ Ghi danh</button></div>`;
 $('#cultivationArea').innerHTML=`<div class="empty-state compact"><h3>Thiên đạo chờ người hữu duyên</h3><p>Đăng nhập để bắt đầu vận công và tích lũy linh lực.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#chatArea').innerHTML=`<div class="empty-state compact"><h3>Truyền âm bị phong</h3><p>Chỉ môn nhân đã nhập môn mới có thể vào Chat tổng.</p><button class="btn primary" onclick="renderAuth('register')">Đăng ký</button></div>`;
 $('#treasureArea').innerHTML=`<div class="empty-state compact"><h3>Tàng Bảo Các đang phong ấn</h3><p>Đăng nhập để nhận linh thạch hằng ngày và mua vật phẩm.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#questsArea').innerHTML=`<div class="empty-state compact"><h3>Nhiệm Vụ Đường đang phong ấn</h3><p>Đăng nhập để nhận nhiệm vụ và linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 loadLeaderboard(); loadSect(); loadCodex();
}

async function loadProfile(){
 try{const d=await api('/api/profile',{headers:authHeaders()});currentProfile=d.profile;renderProfile(currentProfile);renderCultivation(currentProfile);if(Number(currentProfile.trainCount)>=Number(currentProfile.maxDaily))startOnlineCultivation();else if(onlineTimer){clearInterval(onlineTimer);onlineTimer=null;}loadAchievements();loadTreasure();loadQuests();}
 catch(e){if(e.message.includes('đăng nhập')){localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}}
}
function renderProfile(p){
 $('#profileArea').innerHTML=`<div class="profile-grid">
 <article class="profile-card profile-main"><div class="profile-avatar">${esc(p.avatar)}</div><div class="profile-copy"><span class="eyebrow">${esc(p.position||'Ngoại môn đệ tử')}</span><h3>${esc(p.display_name)}</h3><p class="profile-title">${esc(p.stage)} · ${esc(p.title)}</p><p class="muted">@${esc(p.username)} · Gia nhập ${fmtDate(p.created_at)}</p><div class="tags"><span class="tag">🌿 Linh căn: ${esc(p.spiritRoot||'Chưa định')} · ${esc(p.rootRarity||'—')}</span><span class="tag">🐉 Linh thú: ${esc(p.spiritBeast||'Chưa định')} · ${esc(p.beastRarity||'—')}</span></div><p>${esc(p.bio||'Chưa viết lời tựa cho đạo tâm của mình.')}</p><div class="tags"><span class="tag">${esc(p.sect)}</span><span class="tag">${esc(p.hobby||'Đang tu hành')}</span></div></div><button class="btn small edit-profile" id="editProfileBtn">Sửa hồ sơ</button></article>
 <article class="profile-card profile-stats"><div><span>Linh lực</span><b>${Number(p.spirit_power).toLocaleString('vi-VN')}</b></div><div><span>Linh thạch</span><b class="stone-value">💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></div><div><span>Thành tích</span><b>${p.achievement_points}</b></div></article></div><div class="attribute-panel"><div class="attribute-head"><span class="eyebrow">☯ THUỘC TÍNH ĐỆ TỬ</span><h3>Bảng thuộc tính</h3><small>Thuộc tính tăng theo linh lực, cảnh giới và tầng.</small></div><div class="attribute-grid">${[['Công lực','⚔',p.attributes?.congLuc],['Phòng thủ','🛡',p.attributes?.phongThu],['Thân pháp','💨',p.attributes?.thanPhap],['Ngộ tính','☯',p.attributes?.ngoTinh],['Khí vận','✦',p.attributes?.khiVan]].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${Number(x[2]||0).toLocaleString('vi-VN')}</strong></div></div>`).join('')}</div></div><div class="random-gifts-panel"><div><span class="eyebrow">🎲 DUYÊN NGẪU NHIÊN · 1 LẦN</span><h3>Gieo duyên Linh Căn & Linh Thú</h3><p>Mỗi đệ tử chỉ được gieo duyên <b>1 lần duy nhất</b>. Độ hiếm quyết định sức mạnh và hiệu quả phụ trợ.</p></div><button class="btn small primary" id="randomGiftsBtn" ${p.gachaClaimed?'disabled':''}>${p.gachaClaimed?'✓ Đã gieo duyên':'🎲 Gieo duyên'}</button><div id="randomGiftsMsg" class="train-msg"></div></div>
 <div class="spirit-companion-panel"><div class="attribute-head"><span class="eyebrow">🐉 THUỘC TÍNH LINH THÚ · PHỤ TRỢ</span><h3>${esc(p.spiritBeast||'Chưa có linh thú')}</h3><small>Linh thú hỗ trợ chiến lực và tu luyện theo độ hiếm.</small></div><div class="attribute-grid">${[['Công kích','⚔',p.beastAttributes?.attack],['Phòng ngự','🛡',p.beastAttributes?.defense],['Thân pháp','💨',p.beastAttributes?.speed],['Linh lực','☯',p.beastAttributes?.spirit],['Thiên phú','✦',p.beastAttributes?.skill||'—']].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${typeof x[2]==='number'?Number(x[2]).toLocaleString('vi-VN'):esc(x[2])}</strong></div></div>`).join('')}</div><p class="muted">Phụ trợ linh căn: +${Number(p.supportBonus||0)}% hiệu quả tu luyện cơ bản.</p></div>`;
 $('#editProfileBtn').onclick=openProfileEditor;
 $('#randomGiftsBtn').onclick=async()=>{const b=$('#randomGiftsBtn');const msg=$('#randomGiftsMsg');b.disabled=true;try{const x=await api('/api/random-gifts',{method:'POST',headers:authHeaders(),body:'{}'});msg.textContent=`🎲 ${x.spiritRoot} [${x.rootRarity}] · 🐉 ${x.spiritBeast} [${x.beastRarity}] · ${x.beastAttributes.skill}`;await loadProfile();}catch(e){msg.textContent='❌ '+e.message;}};

}
function openProfileEditor(){
 const p=currentProfile;
 $('#accountContent').innerHTML=`<div class="auth-title">Đệ tử lục · 修身</div><div class="auth-sub">Chỉnh sửa dấu ấn cá nhân trong sơn môn</div><form id="profileForm" class="auth-form"><div class="field"><label>Danh xưng</label><input id="pDisplay" value="${esc(p.display_name)}" maxlength="40" required></div><div class="field"><label>Đạo hiệu / danh hiệu</label><input id="pTitle" value="${esc(p.title)}" maxlength="60"></div><div class="field"><label>Chức Vị</label><select id="pPosition">${(p.positionOptions||[]).map(o=>`<option value="${esc(o)}" ${o===p.position?"selected":""}>${esc(o)}</option>`).join("")}</select><small>Chỉ được chọn chức vị phù hợp với cảnh giới hiện tại.</small></div><div class="field"><label>Ảnh đại diện</label><input id="pAvatar" value="${esc(p.avatar)}" maxlength="4"></div><div class="field"><label>Ngày sinh</label><input id="pBirthday" value="${esc(p.birthday)}" maxlength="30" placeholder="DD/MM/YYYY"></div><div class="field"><label>Sở thích</label><input id="pHobby" value="${esc(p.hobby)}" maxlength="100"></div><div class="field"><label>Tiểu sử</label><textarea id="pBio" maxlength="500" rows="4">${esc(p.bio)}</textarea></div><button class="btn primary" type="submit">Lưu hồ sơ</button><div id="profileMsg" class="auth-msg"></div></form>`;
 $('#profileForm').onsubmit=async e=>{e.preventDefault();const msg=$('#profileMsg');try{await api('/api/profile',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({displayName:$('#pDisplay').value,title:$('#pTitle').value,position:$('#pPosition').value,avatar:$('#pAvatar').value,birthday:$('#pBirthday').value,hobby:$('#pHobby').value,bio:$('#pBio').value})});$('#accountModal').close();await loadProfile();await loadLeaderboard();msg.textContent='';}catch(err){msg.textContent=err.message;}};
 $('#accountModal').showModal();
}
let onlineTimer=null;
async function onlineCultivationTick(){
  if(!getToken()||!currentProfile)return;
  try{
    const d=await api('/api/cultivation/online',{method:'POST',headers:authHeaders(),body:'{}'});
    if(d.mode==='online' && d.gain>0){
      const msg=$('#trainMsg'); if(msg)msg.textContent=`☁ Trực tuyến: +${d.gain} linh lực. Tích lũy online hôm nay ${d.onlineEarned}/${d.dailyCap}. Tốc độ ${d.rate} linh lực/phút.`;
      await loadProfile();
    }
  }catch{}
}
function startOnlineCultivation(){
  if(onlineTimer)clearInterval(onlineTimer);
  onlineTimer=setInterval(onlineCultivationTick,30000);
  onlineCultivationTick();
}
function renderCultivation(p){
 const prog=p.progress;
 const maxDaily=Number(p.maxDaily||10), trainCount=Number(p.trainCount||0);
 const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp'];
 $('#cultivationArea').innerHTML=`<div class="cultivation-grid">
 <article class="cultivation-card"><div class="rank-emblem">${esc(p.avatar)}</div><div><span class="eyebrow">CẢNH GIỚI HIỆN TẠI</span><h3>${esc(p.stage)}</h3><p class="muted">${esc(p.title)} · ${esc(p.sect)}</p><div class="tier-badge">Tầng ${p.tier}/9 · ${esc(p.realm)}</div></div><button class="btn primary train-btn" id="trainBtn" ${trainCount>=maxDaily?'disabled':''}>${trainCount>=maxDaily?'☁ Đã đủ lượt':'⚔ Vận công'}</button></article>
 <article class="power-card"><div class="power-head"><div><span>Linh lực</span><strong>${Number(p.spirit_power).toLocaleString('vi-VN')}</strong></div><span>${prog.next?`Còn ${prog.remaining.toLocaleString('vi-VN')} để tiến vào ${esc(prog.next)}`:'Đã đạt cảnh giới tối cao'}</span></div><div class="progress"><i style="width:${prog.percent}%"></i></div><div class="rank-ladder">${realms.map(r=>`<span class="${r===p.realm?'on':''}">${r}</span>`).join('')}</div></article>
 </div>
 <div class="daily-stone-card"><div><span class="eyebrow">💎 LINH THẠCH HẰNG NGÀY</span><h3>Kho linh thạch: <b id="stoneCount">${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></h3><p>Mỗi ngày nhận <b>100 linh thạch</b> để sử dụng tại Tàng Bảo Các.</p></div><button class="btn primary" id="claimStoneBtn" ${p.canClaimStones?'':'disabled'}>${p.canClaimStones?'💎 Nhận 100 linh thạch':'✓ Đã nhận hôm nay'}</button></div>
 <p id="trainMsg" class="train-msg">Lượt tu luyện hôm nay: <b>${trainCount}/${maxDaily}</b>. ${trainCount>=maxDaily?'Đã mở chế độ tích lũy linh lực theo thời gian trực tuyến.':'Sau khi hết lượt, linh lực sẽ được tính theo thời gian online trên web.'}</p>`;
 $('#trainBtn').onclick=async()=>{const b=$('#trainBtn');b.disabled=true;b.textContent='☁ Đang vận công...';try{const d=await api('/api/cultivation/train',{method:'POST',headers:authHeaders(),body:'{}'});$('#trainMsg').textContent=`+${d.gain} linh lực → ${d.stage} · Lượt hôm nay ${d.trainCount}/${d.maxDaily}. ${d.progress.next?`Còn ${d.progress.remaining} linh lực để tiến vào ${d.progress.next}.`:'Đã đạt cảnh giới tối cao.'}`;await loadProfile();await loadLeaderboard();}catch(e){$('#trainMsg').textContent=e.message;}finally{b.disabled=false;b.textContent='⚔ Vận công';}};
 $('#claimStoneBtn').onclick=async()=>{const b=$('#claimStoneBtn');b.disabled=true;try{const d=await api('/api/spirit-stones/claim',{method:'POST',headers:authHeaders(),body:'{}'});$('#trainMsg').textContent=`💎 ${d.amount} linh thạch đã nhập kho. Có thể dùng tại Tàng Bảo Các.`;await loadProfile();await loadTreasure();}catch(e){$('#trainMsg').textContent=e.message;b.disabled=false;}};
}
async function loadAchievements(){
 try{const d=await api('/api/achievements',{headers:authHeaders()});$('#achievementList')?.replaceChildren(...d.rows.map(a=>{const el=document.createElement('div');el.className='achievement-item';el.innerHTML=`<span>✦</span><div><b>${esc(a.title)}</b><small>${esc(a.description)}</small></div><strong>+${a.points}</strong>`;return el;}));}
 catch{}
}


async function loadTreasure(){
 try{
  const d=await api('/api/treasure',{headers:authHeaders()});
  const area=$('#treasureArea'); if(!area)return;
  area.innerHTML=`<div class="treasure-wallet"><span>☯ Linh lực hiện có</span><strong>${Number(d.spiritPower).toLocaleString('vi-VN')}</strong><small>${esc(d.realm)} · ${d.tier}/9 · Thanh toán bằng linh lực</small></div>
  <div class="stone-exchange"><div><span class="eyebrow">⚙ QUY TẮC TÀNG BẢO CÁC</span><h3>Đổi linh lực → Nhận bảo vật</h3><p>Mỗi vật phẩm là một lần đổi linh lực để nhận bảo vật. Linh lực sẽ được trừ khi giao dịch thành công; vật phẩm lập tức vào Tu Di Giới.</p></div><span class="tag">☯ Dùng Linh lực</span></div>
  <div class="enhance-panel"><div><span class="eyebrow">🎲 CƯỜNG HÓA · 增強</span><h3>Quay vật phẩm tăng cường</h3><p>Dùng <b>300 linh lực</b> cho mỗi lượt quay. Vật phẩm nhận được sẽ tự động vào Tu Di Giới.</p></div><button id="enhanceRollBtn" class="btn primary">🎲 Quay 300 linh lực</button><div id="enhanceMsg" class="train-msg"></div></div>
  <div class="treasure-grid">${d.items.map(i=>{
    const spirit=Number(d.spiritPower||0), price=Number(i.price||0);
    const realmNames=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp'];
    const currentIndex=realmNames.indexOf(d.realm);
    const isLocked=currentIndex<Number(i.min_realm);
    const canBuy=!isLocked&&spirit>=price;
    const buttonText=isLocked?'🔒 Cần '+esc(realmNames[Number(i.min_realm)]):canBuy?'☯ Đổi linh lực nhận vật phẩm':'Thiếu '+Number(Math.max(0,price-spirit)).toLocaleString('vi-VN')+' linh lực';
    return `<article class="treasure-card ${isLocked?'locked':''}"><span class="item-seal">${i.category==='Đan dược'?'◈':'⚔'}</span><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><small>Đã sở hữu: ${Number(i.quantity||0)} · Giá: ☯ ${price.toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary buy-item" data-id="${i.id}" ${isLocked||!canBuy?'disabled':''}>${buttonText}</button></article>`;
  }).join('')}</div><div id="treasureMsg" class="train-msg"></div>`;
  $('#enhanceRollBtn').onclick=async()=>{const b=$('#enhanceRollBtn');const msg=$('#enhanceMsg');b.disabled=true;try{const x=await api('/api/enhance/roll',{method:'POST',headers:authHeaders(),body:'{}'});msg.textContent=`🎁 Nhận ${x.item} · ${x.description} · Còn ${Number(x.spirit).toLocaleString('vi-VN')} linh lực.`;await loadProfile();await loadTuDi();}catch(e){msg.textContent='❌ '+e.message;}finally{b.disabled=false;}};
  document.querySelectorAll('.buy-item').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{
      const x=await api('/api/treasure/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id)})});
      $('#treasureMsg').textContent=`✅ Đã mua ${x.item}. Trừ ${Number(x.spentSpirit||0).toLocaleString('vi-VN')} linh lực. Còn ${Number(x.spirit).toLocaleString('vi-VN')} linh lực.`;
      await loadProfile();await loadTreasure();await loadTuDi();
    }catch(e){$('#treasureMsg').textContent='❌ '+e.message;b.disabled=false;}
  });
 }catch(e){const area=$('#treasureArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}
async function loadTuDi(){
 try{
  const d=await api('/api/tu-di-gioi',{headers:authHeaders()});
  const area=$('#sumeruArea'); if(!area)return;
  const rows=d.rows||[];
  area.innerHTML=`<div class="treasure-wallet"><span>◈ Tu Di Giới · 🔓 Đã mở khóa</span><strong>${d.used}/${d.capacity}</strong><small>🌿 ${esc(d.spiritRoot||'—')} · 🐉 ${esc(d.spiritBeast||'—')}</small></div>
  <div class="inventory-grid">${rows.length?rows.map(i=>`<article class="inventory-card"><span class="item-seal">${i.category==='Đan dược'?'◈':'⚔'}</span><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><b>Số lượng: ${Number(i.quantity||0)}</b></div></article>`).join(''):`<div class="empty-state compact"><h3>Tu Di Giới đang trống</h3><p>Vật phẩm và đan dược mua thành công tại Tàng Bảo Các sẽ tự động được cất vào đây.</p></div>`}</div>`;
 }catch(e){const area=$('#sumeruArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}
async function loadQuests(){
 try{
  const d=await api('/api/quests',{headers:authHeaders()});
  const area=$('#questsArea'); if(!area)return;
  area.innerHTML=`<div class="quest-grid">${d.rows.map(q=>`<article class="quest-card ${q.claimed?'claimed':''}"><div class="quest-seal">✦</div><div><span class="eyebrow">NHIỆM VỤ ĐƯỜNG</span><h3>${esc(q.name)}</h3><p>${esc(q.description)}</p><div class="quest-progress"><i style="width:${Math.min(100,Math.round(q.progress/q.requirement_value*100))}%"></i></div><small>Tiến độ: ${q.progress}/${q.requirement_value} · Thưởng: 🎁 ${q.rewardItem?`${esc(q.rewardItem.name)} ×${q.rewardItem.quantity}`:'Không có'}</small></div><button class="btn small primary quest-claim" data-id="${q.id}" ${q.claimed||!q.completed?'disabled':''}>${q.claimed?'✓ Đã nhận':q.completed?'Nhận thưởng':'Chưa hoàn thành'}</button></article>`).join('')}</div><p id="questMsg" class="train-msg">Hoàn thành nhiệm vụ để nhận vật phẩm trực tiếp vào Tu Di Giới.</p>`;
  document.querySelectorAll('.quest-claim').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/quests/'+b.dataset.id+'/claim',{method:'POST',headers:authHeaders(),body:'{}'});$('#questMsg').textContent=x.rewardItem?`🎁 Nhận ${x.rewardItem.name} ×${x.rewardItem.quantity}. Vật phẩm đã vào Tu Di Giới.`:'Đã nhận thưởng.';await loadProfile();await loadQuests();await loadTuDi();}catch(e){$('#questMsg').textContent='❌ '+e.message;b.disabled=false;}});
  clearTimeout(window.questRefreshTimer); window.questRefreshTimer=setTimeout(loadQuests,Math.max(1000,Number(d.nextRefreshMs||300000)+300));
 }catch(e){const area=$('#questsArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadSect(){
 try{const d=await api('/api/sect');$('#sectArea').innerHTML=`<div class="sect-banner"><div class="sect-seal">寒</div><div><span class="eyebrow">${esc(d.han)}</span><h3>${esc(d.name)}</h3><p>“${esc(d.motto)}”</p><div class="sect-count">${d.count} đạo hữu đã ghi danh</div></div></div><div class="positions-grid">${d.positions.map(x=>`<div class="position-card"><span>☯</span><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div>`).join('')}</div>`;}
 catch{}
}

async function loadCodex(){
 try{
  const [r,b]=await Promise.all([api('/api/linh-can-bang',{headers:authHeaders()}),api('/api/linh-thu-bang',{headers:authHeaders()})]);
  const cr=$('#linhCanBangArea'), br=$('#linhThuBangArea');
  if(cr)cr.innerHTML=r.rows.length?r.rows.map((x,i)=>`<article class="codex-card ranked-codex"><span class="codex-rank">#${i+1}</span><span class="codex-icon">🌿</span><div><span class="eyebrow">${esc(x.rarity)} · ${Number(x.owner_count||0)} người sở hữu</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Phụ trợ: ${esc(x.support)}</small><small class="owners">Đạo hữu: ${esc(x.owners||'—')}</small></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có đệ tử sở hữu linh căn.</p></div>`;
  if(br)br.innerHTML=b.rows.length?b.rows.map((x,i)=>`<article class="codex-card ranked-codex"><span class="codex-rank">#${i+1}</span><span class="codex-icon">🐉</span><div><span class="eyebrow">${esc(x.rarity)} · ${Number(x.owner_count||0)} người sở hữu</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Thuộc tính: ${esc(x.attributes)}</small><small class="owners">Đạo hữu: ${esc(x.owners||'—')}</small></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có đệ tử sở hữu linh thú.</p></div>`;
 }catch(e){}
}

async function loadLeaderboard(){
 try{const d=await api('/api/leaderboard');$('#leaderboardArea').innerHTML=d.rows.length?`<div class="leader-table"><div class="leader-head"><span>#</span><span>Đệ tử</span><span>Cảnh giới</span><span>Linh lực</span><span>Điểm</span></div>${d.rows.map((x,i)=>`<div class="leader-row"><span class="leader-no ${i<3?'medal':''}">${i+1}</span><div class="leader-name"><span class="mini-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.title)}</small></div></div><span class="rank-chip">${esc(x.rank)}</span><b>${Number(x.spirit_power).toLocaleString('vi-VN')}</b><b>${x.achievement_points}</b></div>`).join('')}</div>`:`<div class="empty-state compact"><h3>Thiên bảng còn trống</h3><p>Hãy là người đầu tiên ghi danh.</p></div>`;}
 catch(e){$('#leaderboardArea').innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadChat(){
 if(!getToken())return;
 try{const d=await api('/api/chat',{headers:authHeaders()});renderChat(d.rows);}catch(e){if(getToken())$('#chatArea').innerHTML=`<div class="empty-state compact"><p>${esc(e.message)}</p></div>`;}
}
function renderChat(rows){
 $('#chatArea').innerHTML=`<div class="chat-window" id="chatWindow">${rows.length?rows.map(x=>`<article class="chat-msg ${x.user_id===currentProfile?.user_id?'mine':''}"><span class="chat-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><div class="chat-meta"><b>${esc(x.display_name)}</b><span>${esc(x.rank)}</span><time>${new Date(x.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${esc(x.message)}</p></div></article>`).join(''):`<div class="chat-empty">Sơn môn còn tĩnh lặng. Hãy gửi lời chào đầu tiên.</div>`}</div><form id="chatForm" class="chat-form"><input id="chatInput" maxlength="500" autocomplete="off" placeholder="Truyền âm tới toàn môn..." required><button class="btn primary">Gửi</button></form><p id="chatMsg" class="train-msg"></p>`;
 const w=$('#chatWindow');w.scrollTop=w.scrollHeight;
 $('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatInput');const msg=$('#chatMsg');try{await api('/api/chat',{method:'POST',headers:authHeaders(),body:JSON.stringify({message:input.value})});input.value='';await loadChat();}catch(err){msg.textContent=err.message;}};
}

function accountSummary(){
 if(!currentProfile)return renderAuth('login');
 $('#accountContent').innerHTML=`<div class="account-box"><div class="avatar-mini">${esc(currentProfile.avatar)}</div><span class="eyebrow">ĐÃ NHẬP MÔN</span><h3>${esc(currentProfile.display_name)}</h3><p>${esc(currentProfile.stage||currentProfile.rank)} · ${esc(currentProfile.title)}</p><p>Linh lực: <b>${Number(currentProfile.spirit_power).toLocaleString('vi-VN')}</b></p><p>Linh thạch: <b>💎 ${Number(currentProfile.spirit_stones||0).toLocaleString('vi-VN')}</b></p><div class="account-actions"><button id="profileEditQuick" class="btn primary">Hồ sơ đệ tử</button><button id="logoutBtn" class="btn ghost">Rời phiên</button></div></div>`;
 $('#accountModal').showModal();$('#profileEditQuick').onclick=()=>{ $('#accountModal').close();openProfileEditor(); };$('#logoutBtn').onclick=logout;
}
function openAccount(){if(getToken())accountSummary();else renderAuth('login');}
function renderAuth(mode){
 const register=mode==='register';
 $('#accountContent').innerHTML=`<div class="auth-title">寒天門</div><div class="auth-sub">Ghi danh môn nhân · Dữ liệu được lưu trong PostgreSQL</div><div class="tabs"><button class="tab ${!register?'active':''}" data-mode="login">Đăng nhập</button><button class="tab ${register?'active':''}" data-mode="register">Đăng ký</button></div><form id="authForm" class="auth-form"><div class="field ${register?'':'hidden'}"><label>Danh xưng</label><input id="displayName" maxlength="40" ${register?'required':''} placeholder="Tên hiển thị"></div><div class="field"><label>Tên tài khoản</label><input id="username" required minlength="3" maxlength="24" autocomplete="username" placeholder="tu_tien_01"></div><div class="field"><label>Mật khẩu</label><input id="password" type="password" required minlength="6" autocomplete="current-password" placeholder="Ít nhất 6 ký tự"></div><button class="btn primary" type="submit">${register?'Ghi danh vào sơn môn':'Nhập môn'}</button><div id="authMsg" class="auth-msg"></div></form>`;
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>renderAuth(b.dataset.mode));
 $('#authForm').onsubmit=async e=>{e.preventDefault();const msg=$('#authMsg');msg.textContent='Đang xử lý...';const body={username:$('#username').value.trim(),password:$('#password').value};if(register)body.displayName=$('#displayName').value.trim();try{if(register){await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});msg.textContent='Ghi danh thành công. Đang mở cổng nhập môn...';setTimeout(()=>renderAuth('login'),500);}else{const d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});localStorage.setItem(tokenKey,d.token);accountUI(d.user);$('#accountModal').close();await loadProfile();await loadChat();await loadLeaderboard();await loadTreasure();await loadData();}}catch(err){msg.textContent=err.message;}};
 $('#accountModal').showModal();
}
async function logout(){try{await api('/api/logout',{method:'POST',headers:authHeaders()});}catch{}finally{localStorage.removeItem(tokenKey);currentProfile=null;accountUI(null);$('#accountModal').close();renderGuestAreas();}}

$('#modalClose').onclick=()=>$('#memberModal').close();$('#accountClose').onclick=()=>$('#accountModal').close();
$('#memberModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#accountModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};
$('#searchInput').oninput=e=>{const q=e.target.value.toLowerCase().trim();renderMembers(members.filter(m=>[m.name,m.nick,m.role,...m.tags].join(' ').toLowerCase().includes(q)));};
$('#accountBtn').onclick=openAccount;$('#joinBtn').onclick=()=>getToken()?accountSummary():renderAuth('register');
$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');$('#themeBtn').textContent=dark?'☀':'☾';localStorage.setItem('theme',dark?'dark':'light');};
$('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));$('#topBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});
if(localStorage.getItem('theme')==='dark'){document.body.classList.add('dark');$('#themeBtn').textContent='☀';}

loadData();loadSect();checkSession();
setInterval(()=>{if(getToken())loadChat();},5000);
