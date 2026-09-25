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
function openMember(i){const m=members[i];$('#modalContent').innerHTML=`<div class="modal-avatar">${esc(m.emoji)}</div><div class="modal-content"><span class="nickname">${esc(m.nick)}</span><h2>${esc(m.name)}</h2><p>${esc(m.bio)}</p><div class="facts"><div class="fact"><small>Sinh nhật</small><b>${esc(m.birthday||'—')}</b></div><div class="fact"><small>Sở thích</small><b>${esc(m.hobby||'—')}</b></div></div><div class="tags">${m.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div>`;$('#memberModal').showModal();}

function accountUI(user){
 if(user){$('#userBadge').textContent='☯ '+user.displayName;$('#userBadge').classList.remove('hidden');$('#accountBtn').textContent='Hồ sơ';}
 else{$('#userBadge').classList.add('hidden');$('#accountBtn').textContent='☯ Đăng nhập';}
}
async function checkSession(){
 if(!getToken()){accountUI(null);renderGuestAreas();return;}
 try{const d=await api('/api/me',{headers:authHeaders()});accountUI(d.user);await loadProfile();await loadChat();await loadLeaderboard();}
 catch{localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}
}
function renderGuestAreas(){
 $('#profileArea').innerHTML=`<div class="empty-state"><div class="empty-seal">寒</div><h3>Đệ tử chưa nhập môn</h3><p>Đăng ký hoặc đăng nhập để mở hồ sơ, linh lực, cảnh giới và thành tích cá nhân.</p><button class="btn primary" onclick="renderAuth('register')">✦ Ghi danh</button></div>`;
 $('#cultivationArea').innerHTML=`<div class="empty-state compact"><h3>Thiên đạo chờ người hữu duyên</h3><p>Đăng nhập để bắt đầu vận công và tích lũy linh lực.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#chatArea').innerHTML=`<div class="empty-state compact"><h3>Truyền âm bị phong</h3><p>Chỉ môn nhân đã nhập môn mới có thể vào Chat tổng.</p><button class="btn primary" onclick="renderAuth('register')">Đăng ký</button></div>`;
 loadLeaderboard(); loadSect();
}

async function loadProfile(){
 try{const d=await api('/api/profile',{headers:authHeaders()});currentProfile=d.profile;renderProfile(currentProfile);renderCultivation(currentProfile);loadAchievements();}
 catch(e){if(e.message.includes('đăng nhập')){localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}}
}
function renderProfile(p){
 $('#profileArea').innerHTML=`<div class="profile-grid"><article class="profile-card profile-main"><div class="profile-avatar">${esc(p.avatar)}</div><div class="profile-copy"><span class="eyebrow">${esc(p.position)}</span><h3>${esc(p.display_name)}</h3><p class="profile-title">${esc(p.title)} · ${esc(p.rank)}</p><p class="muted">@${esc(p.username)} · Gia nhập ${fmtDate(p.created_at)}</p><p>${esc(p.bio||'Chưa viết lời tựa cho đạo tâm của mình.')}</p><div class="tags"><span class="tag">${esc(p.sect)}</span><span class="tag">${esc(p.hobby||'Đang tu hành')}</span></div></div><button class="btn small edit-profile" id="editProfileBtn">Sửa hồ sơ</button></article><article class="profile-card profile-stats"><div><span>Linh lực</span><b>${p.spirit_power.toLocaleString('vi-VN')}</b></div><div><span>Thành tích</span><b>${p.achievement_points}</b></div><div><span>Huy hiệu</span><b>${p.achievement_count}</b></div></article></div>`;
 $('#editProfileBtn').onclick=openProfileEditor;
}
function openProfileEditor(){
 const p=currentProfile;
 $('#accountContent').innerHTML=`<div class="auth-title">Đệ tử lục · 修身</div><div class="auth-sub">Chỉnh sửa dấu ấn cá nhân trong sơn môn</div><form id="profileForm" class="auth-form"><div class="field"><label>Danh xưng</label><input id="pDisplay" value="${esc(p.display_name)}" maxlength="40" required></div><div class="field"><label>Đạo hiệu / danh hiệu</label><input id="pTitle" value="${esc(p.title)}" maxlength="60"></div><div class="field"><label>Ảnh đại diện</label><input id="pAvatar" value="${esc(p.avatar)}" maxlength="4"></div><div class="field"><label>Ngày sinh</label><input id="pBirthday" value="${esc(p.birthday)}" maxlength="30" placeholder="DD/MM/YYYY"></div><div class="field"><label>Sở thích</label><input id="pHobby" value="${esc(p.hobby)}" maxlength="100"></div><div class="field"><label>Tiểu sử</label><textarea id="pBio" maxlength="500" rows="4">${esc(p.bio)}</textarea></div><button class="btn primary" type="submit">Lưu hồ sơ</button><div id="profileMsg" class="auth-msg"></div></form>`;
 $('#profileForm').onsubmit=async e=>{e.preventDefault();const msg=$('#profileMsg');try{await api('/api/profile',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({displayName:$('#pDisplay').value,title:$('#pTitle').value,avatar:$('#pAvatar').value,birthday:$('#pBirthday').value,hobby:$('#pHobby').value,bio:$('#pBio').value})});$('#accountModal').close();await loadProfile();await loadLeaderboard();msg.textContent='';}catch(err){msg.textContent=err.message;}};
 $('#accountModal').showModal();
}
function renderCultivation(p){
 const prog=p.progress;
 $('#cultivationArea').innerHTML=`<div class="cultivation-grid"><article class="cultivation-card"><div class="rank-emblem">${esc(p.avatar)}</div><div><span class="eyebrow">CẢNH GIỚI HIỆN TẠI</span><h3>${esc(p.rank)}</h3><p class="muted">${esc(p.title)} · ${esc(p.sect)}</p></div><button class="btn primary train-btn" id="trainBtn">⚔ Vận công</button></article><article class="power-card"><div class="power-head"><div><span>Linh lực</span><strong>${p.spirit_power.toLocaleString('vi-VN')}</strong></div><span>${prog.next?`Còn ${prog.remaining.toLocaleString('vi-VN')} để đột phá`:'Đã đạt cảnh giới tối cao'}</span></div><div class="progress"><i style="width:${prog.percent}%"></i></div><div class="rank-ladder">${['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp'].map(r=>`<span class="${r===p.rank?'on':''}">${r}</span>`).join('')}</div></article></div><p id="trainMsg" class="train-msg">Mỗi lần vận công nhận ngẫu nhiên 35–80 linh lực. Hãy tu hành điều độ.</p>`;
 $('#trainBtn').onclick=async()=>{const b=$('#trainBtn');b.disabled=true;b.textContent='☁ Đang vận công...';try{const d=await api('/api/cultivation/train',{method:'POST',headers:authHeaders(),body:'{}'});$('#trainMsg').textContent=`+${d.gain} linh lực. ${d.rank}${d.progress.next?` · Còn ${d.progress.remaining} linh lực để đột phá.`:' · Đã đạt cảnh giới tối cao.'}`;await loadProfile();await loadLeaderboard();}catch(e){$('#trainMsg').textContent=e.message;}finally{b.disabled=false;b.textContent='⚔ Vận công';}};
}
async function loadAchievements(){
 try{const d=await api('/api/achievements',{headers:authHeaders()});$('#achievementList')?.replaceChildren(...d.rows.map(a=>{const el=document.createElement('div');el.className='achievement-item';el.innerHTML=`<span>✦</span><div><b>${esc(a.title)}</b><small>${esc(a.description)}</small></div><strong>+${a.points}</strong>`;return el;}));}
 catch{}
}

async function loadSect(){
 try{const d=await api('/api/sect');$('#sectArea').innerHTML=`<div class="sect-banner"><div class="sect-seal">寒</div><div><span class="eyebrow">${esc(d.han)}</span><h3>${esc(d.name)}</h3><p>“${esc(d.motto)}”</p><div class="sect-count">${d.count} đạo hữu đã ghi danh</div></div></div><div class="positions-grid">${d.positions.map(x=>`<div class="position-card"><span>☯</span><b>${esc(x[0])}</b><small>${esc(x[1])}</small></div>`).join('')}</div>`;}
 catch{}
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
 $('#accountContent').innerHTML=`<div class="account-box"><div class="avatar-mini">${esc(currentProfile.avatar)}</div><span class="eyebrow">ĐÃ NHẬP MÔN</span><h3>${esc(currentProfile.display_name)}</h3><p>${esc(currentProfile.title)} · ${esc(currentProfile.rank)}</p><p>Linh lực: <b>${currentProfile.spirit_power.toLocaleString('vi-VN')}</b></p><div class="account-actions"><button id="profileEditQuick" class="btn primary">Hồ sơ đệ tử</button><button id="logoutBtn" class="btn ghost">Rời phiên</button></div></div>`;
 $('#accountModal').showModal();$('#profileEditQuick').onclick=()=>{ $('#accountModal').close();openProfileEditor(); };$('#logoutBtn').onclick=logout;
}
function openAccount(){if(getToken())accountSummary();else renderAuth('login');}
function renderAuth(mode){
 const register=mode==='register';
 $('#accountContent').innerHTML=`<div class="auth-title">寒天門</div><div class="auth-sub">Ghi danh môn nhân · Dữ liệu được lưu trong PostgreSQL</div><div class="tabs"><button class="tab ${!register?'active':''}" data-mode="login">Đăng nhập</button><button class="tab ${register?'active':''}" data-mode="register">Đăng ký</button></div><form id="authForm" class="auth-form"><div class="field ${register?'':'hidden'}"><label>Danh xưng</label><input id="displayName" maxlength="40" ${register?'required':''} placeholder="Tên hiển thị"></div><div class="field"><label>Tên tài khoản</label><input id="username" required minlength="3" maxlength="24" autocomplete="username" placeholder="tu_tien_01"></div><div class="field"><label>Mật khẩu</label><input id="password" type="password" required minlength="6" autocomplete="current-password" placeholder="Ít nhất 6 ký tự"></div><button class="btn primary" type="submit">${register?'Ghi danh vào sơn môn':'Nhập môn'}</button><div id="authMsg" class="auth-msg"></div></form>`;
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>renderAuth(b.dataset.mode));
 $('#authForm').onsubmit=async e=>{e.preventDefault();const msg=$('#authMsg');msg.textContent='Đang xử lý...';const body={username:$('#username').value.trim(),password:$('#password').value};if(register)body.displayName=$('#displayName').value.trim();try{if(register){await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});msg.textContent='Ghi danh thành công. Đang mở cổng nhập môn...';setTimeout(()=>renderAuth('login'),500);}else{const d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});localStorage.setItem(tokenKey,d.token);accountUI(d.user);$('#accountModal').close();await loadProfile();await loadChat();await loadLeaderboard();await loadData();}}catch(err){msg.textContent=err.message;}};
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
