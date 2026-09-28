let members=[], memories=[], timeline=[];
let currentProfile=null, currentUser=null;
const $=s=>document.querySelector(s);
const tokenKey='han_thien_token';
const getToken=()=>localStorage.getItem(tokenKey);
const authHeaders=()=>getToken()?{'Authorization':'Bearer '+getToken(),'Content-Type':'application/json'}:{'Content-Type':'application/json'};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const avatarHtml=(v,cls='',realmIndex=null,auraRank=0)=>{const x=String(v??'').trim();let inner=/^data:image\//i.test(x)?`<img class="avatar-img ${cls}" src="${esc(x)}" alt="Ảnh đại diện" loading="lazy">`:esc(x||'🧑🏻‍🎓');const rank=Math.max(0,Math.min(3,Number(auraRank)||0));const hasRealm=realmIndex!==null&&realmIndex!==undefined&&!Number.isNaN(Number(realmIndex));const ri=hasRealm?Math.max(0,Math.min(17,Number(realmIndex)||0)):0;if(hasRealm&&ri===17)return `<span class="immortal-emperor-aura ${rank>0?`sect-top-aura sect-top-aura-${rank}`:''}">${inner}<span class="immortal-emperor-crown" aria-label="Tiên Đế Nhất Tinh">♛</span><span class="immortal-emperor-orbit immortal-orbit-one"></span><span class="immortal-emperor-orbit immortal-orbit-two"></span></span>`;if(rank>0)return `<span class="sect-top-aura sect-top-aura-${rank}">${inner}</span>`;if(!hasRealm)return inner;return `<span class="avatar-aura realm-aura-${ri}">${inner}</span>`;};
const itemAvatarHtml=(v)=>avatarHtml(v);
const beastAvatarHtml=(v,tier=1,cls='',name='')=>{const x=String(v??'').trim();const inner=/^data:image\//i.test(x)?`<img class="avatar-img ${cls}" src="${esc(x)}" alt="Ảnh linh thú" loading="lazy">`:`<span class="beast-glyph">${esc(x||'🐉')}</span>`;const immortal=Number(tier)>=10||/Tiên Thú|Cửu Vĩ Thiên Hồ|Kỳ Lân|Thần Long/i.test(String(name||''));const t=Math.max(1,Math.min(18,Number(tier)||1));return `<span class="beast-avatar-frame ${immortal?'beast-immortal':''} beast-tier-${t}">${inner}</span>`;};

const fmtDate=v=>v?new Date(v).toLocaleDateString('vi-VN'):'—';
const REALM_NAMES=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
const realmIndexOf=name=>Math.max(0,REALM_NAMES.indexOf(String(name||'')));

async function api(url,opts={}){
 const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),...(opts.body&&typeof opts.body==='string'?{'Content-Type':'application/json'}:{})}});
 let d={}; try{d=await r.json();}catch{}
 if(!r.ok){const e=new Error(d.error||'Có lỗi xảy ra.');e.status=r.status;throw e;}
 if(d&&typeof d==='object')d._status=r.status;
 return d;
}

async function sendPresenceHeartbeat(){
 if(!getToken())return;
 try{await api('/api/presence/heartbeat',{method:'POST',headers:authHeaders(),body:'{}'});}catch(e){}
}
let presenceTimer=null;
function startPresenceHeartbeat(){
 if(presenceTimer)clearInterval(presenceTimer);
 if(!getToken())return;
 sendPresenceHeartbeat();
 presenceTimer=setInterval(()=>{if(getToken()){if(!document.hidden)sendPresenceHeartbeat();}else{clearInterval(presenceTimer);presenceTimer=null;}},45000);
}
startPresenceHeartbeat();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sendPresenceHeartbeat();});
async function loadData(){
 try{
  const data=await api('/api/data'); members=data.members; memories=data.memories; timeline=data.timeline;
  $('#memberCount').textContent=members.length; $('#memoryCount').textContent=memories.length; $('#userCount').textContent=data.userCount||0;
  renderMembers(); renderXuatQuan(); renderGallery(); renderTimeline(); renderLegendEditor();
 }catch(e){console.error(e);}
}
function renderMembers(list=members){
 $('#membersGrid').innerHTML=list.length?list.map((m)=>`<article class="member-card" data-index="${members.indexOf(m)}"><div class="avatar">${avatarHtml(m.emoji,'',m.realmIndex,m.auraRank)}</div><div class="member-info"><span class="nickname">${esc(m.nick||'')}</span><h3>${esc(m.name)}</h3><p>${esc(m.role||'Đệ tử')}</p><div class="presence-status ${m.online?'online':'offline'}"><span class="presence-dot"></span>${esc(m.presenceLabel||'Đã bế quan')}</div><div class="tags">${(Array.isArray(m.tags)?m.tags:[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>${m.equipped_beast_name?`<div class="member-beast-badge"><span class="member-beast-avatar">${beastAvatarHtml(m.equipped_beast_avatar,m.equipped_beast_realm_tier,'',m.equipped_beast_name)}</span> ${esc(m.equipped_beast_name)} · ${esc(m.equipped_beast_realm||'Linh thú')} ${Number(m.equipped_beast_realm_tier||1)} · +${Number(m.equipped_beast_gear_power||0)} trang bị</div>`:''}</div></article>`).join(''):`<p>Không tìm thấy môn nhân phù hợp.</p>`;
 document.querySelectorAll('.member-card').forEach(c=>c.onclick=()=>openMember(+c.dataset.index));
}
function renderXuatQuan(){
 const grid=$('#xuatQuanGrid'),count=$('#xuatQuanCount'); if(!grid)return;
 const online=members.filter(m=>m.online); if(count)count.textContent=`${online.length} ĐANG XUẤT QUAN`;
 grid.innerHTML=online.length?online.map(m=>`<article class="member-card"><div class="avatar">${avatarHtml(m.emoji,'',m.realmIndex,m.auraRank)}</div><div class="member-info"><span class="nickname">${esc(m.nick||'')}</span><h3>${esc(m.name)}</h3><p>${esc(m.role||'Đệ tử')}</p><div class="presence-status online"><span class="presence-dot"></span>Đang xuất quan</div><div class="tags">${(Array.isArray(m.tags)?m.tags:[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>${m.equipped_beast_name?`<div class="member-beast-badge"><span class="member-beast-avatar">${beastAvatarHtml(m.equipped_beast_avatar,m.equipped_beast_realm_tier,'',m.equipped_beast_name)}</span> ${esc(m.equipped_beast_name)} · ${esc(m.equipped_beast_realm||'Linh thú')} ${Number(m.equipped_beast_realm_tier||1)} · +${Number(m.equipped_beast_gear_power||0)} trang bị</div>`:''}</div></article>`).join(''):`<div class="empty-state compact"><h3>Không có môn nhân đang xuất quan</h3><p>Hiện tại chưa có môn nhân nào đang hoạt động trên sơn môn.</p></div>`;
}
function renderGallery(){
 const grid=$('#galleryGrid'); if(!grid)return;
 grid.innerHTML=memories.length?memories.map(m=>`<article class="memory legend-card"><div class="pic">📜</div><div class="caption"><span class="legend-author">${esc(m.author_name||'Môn nhân')} · ${esc(m.realm_name||'Luyện Khí')} ${Number(m.realm_tier||1)}/9</span><b>${esc(m.title)}</b><small>${esc(m.content||'')}</small><em>${new Date(m.updated_at||m.created_at).toLocaleDateString('vi-VN')} · tối đa ${Number(m.charLimit||300).toLocaleString('vi-VN')} ký tự</em></div></article>`).join(''):`<div class="empty-state compact"><h3>Chưa có Truyền Kỳ</h3><p>Hãy là môn nhân đầu tiên lưu danh câu chuyện của mình.</p></div>`;
}
function renderLegendEditor(){
 const host=$('#legendEditor'); if(!host)return;
 if(!getToken()){host.innerHTML=`<div class="legend-note">☯ Đăng nhập để tạo Truyền Kỳ riêng và thông cáo cho toàn tông môn.</div>`;return;}
 const mine=memories.find(x=>Number(x.user_id)===Number(currentUser?.id));
 const inferred=[300,500,800,1200,1600,2200,3000,4000,5000][Math.max(0,Math.min(8,Number(currentProfile?.realmIndex)||0))]||300;
 const max=Number(mine?.charLimit)||inferred;
 host.innerHTML=`<div class="legend-editor"><div class="legend-editor-head"><div><span class="eyebrow">📜 ${mine?'CHỈNH SỬA TRUYỀN KỲ':'TẠO TRUYỀN KỲ RIÊNG'}</span><h3>${esc(currentProfile?.stage||currentProfile?.rank||'Luyện Khí')}</h3><small>Giới hạn theo cảnh giới: <b>${max.toLocaleString('vi-VN')}</b> ký tự · Tên mục tối đa 60 ký tự.</small></div><span class="tag">📢 TOÀN TÔNG MÔN</span></div><form id="legendForm"><div class="legend-fields"><input id="legendTitle" maxlength="60" value="${esc(mine?.title||'')}" placeholder="Tên Truyền Kỳ của riêng bạn" required><textarea id="legendContent" maxlength="${max}" placeholder="Viết câu chuyện, chiến tích hoặc lời lưu danh của bạn..." required>${esc(mine?.content||'')}</textarea></div><div class="legend-form-foot"><span id="legendCounter">0 / ${max.toLocaleString('vi-VN')}</span><button class="btn primary" type="submit">📜 ${mine?'Cập nhật Truyền Kỳ':'Thông cáo Truyền Kỳ'}</button></div><p id="legendMsg" class="train-msg"></p></form></div>`;
 const ta=$('#legendContent'), counter=$('#legendCounter'); const update=()=>{counter.textContent=`${[...ta.value].length.toLocaleString('vi-VN')} / ${max.toLocaleString('vi-VN')}`;}; ta.addEventListener('input',update); update();
 $('#legendForm').onsubmit=async e=>{e.preventDefault();const msg=$('#legendMsg');try{const x=await api('/api/legends',{method:'POST',headers:authHeaders(),body:JSON.stringify({title:$('#legendTitle').value,content:ta.value})});msg.textContent='✅ '+x.message;await loadData();}catch(err){msg.textContent='❌ '+err.message;}};
}
function renderTimeline(){ $('#timelineList').innerHTML=timeline.map(e=>`<article class="event"><i class="dot"></i><span class="date">${esc(e.year)}</span><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p></article>`).join(''); }
function openMember(i){
 const m=members[i];if(!m)return;
 const isSelf=currentUser&&Number(m.id)===Number(currentUser.id);
 $('#modalContent').innerHTML=`<div class="modal-avatar">${avatarHtml(m.emoji,'',m.realmIndex,m.auraRank)}</div><div class="modal-content"><span class="nickname">${esc(m.nick)}</span><h2>${esc(m.name)}</h2><p>${esc(m.bio||'Đã ghi danh vào Hàn Thiên Môn.')}</p><div class="facts"><div class="fact"><small>Cảnh giới</small><b>${esc(m.rank||'Luyện Khí')} · ${esc(m.realm_tier||1)}/9</b></div><div class="fact"><small>Linh lực</small><b>${Number(m.spirit_power||0).toLocaleString('vi-VN')}</b></div><div class="fact"><small>Sinh nhật</small><b>${esc(m.birthday||'—')}</b></div><div class="fact"><small>Sở thích</small><b>${esc(m.hobby||'—')}</b></div></div><div class="tags">${(m.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>${m.equipped_beast_name?`<div class="member-beast-detail"><span class="eyebrow">🐉 LINH THÚ ĐANG TRIỆU HỒI</span><div class="member-beast-detail-avatar">${beastAvatarHtml(m.equipped_beast_avatar,m.equipped_beast_realm_tier,'',m.equipped_beast_name)}</div><h3>${esc(m.equipped_beast_name)}</h3><p>${esc(m.equipped_beast_realm||'')} ${Number(m.equipped_beast_realm_tier||1)} · Trang bị linh thú +${Number(m.equipped_beast_gear_power||0)}</p></div>`:''}${!getToken()||isSelf?'':`<div class="friend-actions" id="memberFriendActions"><button class="btn small primary" id="memberFriendBtn">🤝 Đang kiểm tra...</button><button class="btn small ghost hidden" id="memberChatBtn">💬 Chat riêng</button></div><div class="discipleship-actions" id="memberDiscipleshipActions"><button class="btn small primary" id="memberDiscipleshipBtn">👑 Đang kiểm tra Sư Đồ...</button></div><p id="memberDiscipleshipMsg" class="train-msg"></p><div class="challenge-actions"><button class="btn small primary" id="memberOnlineChallengeBtn">⚔ Mở lôi đài Online</button><button class="btn small ghost" id="memberOfflineChallengeBtn">🌓 Khiêu chiến Offline</button></div><p id="memberFriendMsg" class="train-msg"></p><p id="memberChallengeMsg" class="train-msg"></p>`}</div>`;
 const friendsHost=$('#memberModal').showModal();
 if(getToken()&&!isSelf){
  refreshMemberFriendState(Number(m.id));
  refreshMemberDiscipleshipState(Number(m.id),m);
  const on=$('#memberOnlineChallengeBtn'), off=$('#memberOfflineChallengeBtn'), msg=$('#memberChallengeMsg');
  if(on)on.onclick=()=>challengeMember(Number(m.id),'online',msg);
  if(off)off.onclick=()=>challengeMember(Number(m.id),'offline',msg);
}
}

async function refreshMemberDiscipleshipState(targetId,m){
 const btn=$('#memberDiscipleshipBtn'),msg=$('#memberDiscipleshipMsg'); if(!btn)return;
 try{
  const d=await api('/api/disciples',{headers:authHeaders()});
  const myIdx=Number(d.stage?.realmIndex||0), targetIdx=Number(m.realmIndex??realmIndexOf(m.rank));
  const mentor=d.mentor, alreadyDisciple=(d.disciples||[]).some(x=>Number(x.disciple_id)===targetId);
  const incoming=(d.incoming||[]).find(x=>Number(x.disciple_id)===Number(currentUser?.id)&&Number(x.mentor_id)===targetId&&x.request_type==='mentor_to_disciple');
  const outgoing=(d.outgoing||[]).find(x=>Number(x.mentor_id)===targetId&&x.request_type==='disciple_to_mentor');
  const inviteOut=(d.outgoing||[]).find(x=>Number(x.disciple_id)===targetId&&x.request_type==='mentor_to_disciple');
  if(mentor&&Number(mentor.mentor_id)===targetId){btn.textContent='🛡 Sư phụ của bạn';btn.disabled=true;return;}
  if(alreadyDisciple){btn.textContent='👑 Đệ tử của bạn';btn.disabled=true;return;}
  if(incoming){btn.textContent='📨 Chấp nhận lời mời nhập môn';btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/disciples/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:incoming.id,action:'accept'})});msg.textContent='✅ '+x.message;await loadDisciples();await loadProfile();}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}};return;}
  if(inviteOut){btn.textContent='⌛ Đã mời nhập môn';btn.disabled=true;return;}
  if(outgoing){btn.textContent='⌛ Đã gửi lời bái sư';btn.disabled=true;return;}
  if(myIdx>=5 && targetIdx<myIdx){
    btn.textContent='📜 Mời nhập môn';btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/disciples/invite',{method:'POST',headers:authHeaders(),body:JSON.stringify({discipleId:targetId})});msg.textContent='✅ '+x.message;btn.textContent='⌛ Đang chờ chấp thuận';}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}};return;
  }
  if(targetIdx>=5 && targetIdx>myIdx){
    btn.textContent='🙏 Bái sư';btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/disciples/request',{method:'POST',headers:authHeaders(),body:JSON.stringify({mentorId:targetId})});msg.textContent='✅ '+x.message;btn.textContent='⌛ Đã gửi lời bái sư';}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}};return;
  }
  btn.textContent='👑 Không phù hợp cảnh giới';btn.disabled=true;
 }catch(e){btn.textContent='👑 Sư Đồ';btn.disabled=false;msg.textContent='❌ '+e.message;}
}

async function refreshMemberFriendState(targetId){
 const btn=$('#memberFriendBtn'), chat=$('#memberChatBtn'), msg=$('#memberFriendMsg');
 if(!btn)return;
 try{
  const d=await api('/api/friends',{headers:authHeaders()});
  const f=(d.friends||[]).find(x=>Number(x.id)===targetId);
  const incoming=(d.incoming||[]).find(x=>Number(x.requester_id)===targetId);
  const outgoing=(d.outgoing||[]).find(x=>Number(x.addressee_id)===targetId);
  if(f){btn.textContent='✓ Đã là bằng hữu';btn.classList.add('ghost');btn.onclick=()=>openFriendChat(targetId,f.display_name);chat.classList.remove('hidden');chat.onclick=()=>openFriendChat(targetId,f.display_name);}
  else if(incoming){btn.textContent='🤝 Chấp nhận kết giao';btn.onclick=async()=>{btn.disabled=true;try{await api('/api/friends/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:incoming.id,action:'accept'})});msg.textContent='✓ Hai người đã kết thành bằng hữu.';await refreshMemberFriendState(targetId);await loadFriends();}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}}}
  else if(outgoing){btn.textContent='⌛ Đã gửi lời mời';btn.disabled=true;}
  else{btn.textContent='🤝 Kết làm bằng hữu';btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/friends/request',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId:targetId})});msg.textContent='✓ '+x.message;btn.textContent='⌛ Chờ đối phương chấp nhận';}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}}}
 }catch(e){btn.textContent='🤝 Kết làm bằng hữu';btn.disabled=false;msg.textContent='❌ '+e.message;}
}

async function challengeMember(targetId, mode, msgEl){
 const btn=mode==='online'?$('#memberOnlineChallengeBtn'):$('#memberOfflineChallengeBtn');
 if(btn)btn.disabled=true;
 try{
  const x=await api(mode==='online'?'/api/challenges/online/request':'/api/challenges/offline',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId:targetId})});
  if(msgEl)msgEl.textContent=mode==='online'?`🏟 ${x.message}`:(x.win?`🏆 ${x.opponent} thất thủ! +${Number(x.reward?.gain||0).toLocaleString('vi-VN')} linh lực, nhận ${esc(x.reward?.item?.name||'vật phẩm ngẫu nhiên')} ×1. Hiệu lực sát thương: ${x.damageMultiplier}%.`:`💥 Thất bại trước ${x.opponent}. ${x.penalty||''}`);
  await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);
 }catch(e){if(msgEl)msgEl.textContent='❌ '+e.message;}
 finally{if(btn)btn.disabled=false;}
}

async function loadChallenges(){
 const area=$('#challengeArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/challenges',{headers:authHeaders()});
  const users=d.users||[], pending=d.pending||[], history=d.history||[], me=d.me||{}, battle=d.activeBattle||null, publicBattles=d.activeBattles||[], usage=d.usage||{used:0,limit:5,remaining:5,windowHours:24};
  const challengeLimitReached=Number(usage.remaining)<=0;
  const debuffActive=me.challenge_debuff_until&&new Date(me.challenge_debuff_until)>new Date();
  const pct=(hp,max)=>Math.min(100,Math.max(0,Math.round((Number(hp||0)/Math.max(1,Number(max||1)))*100)));
  const hpColor=(hp,max)=>pct(hp,max)<=25?'danger':pct(hp,max)<=55?'warn':'';
  const battleHtml=battle?`<div class="challenge-block active-battle">
    <div class="challenge-subhead"><span class="eyebrow">🔥 LÔI ĐÀI ONLINE ĐANG DIỄN RA</span><b>Vòng ${Number(battle.round||0)}</b></div>
    <div class="battle-arena">
      <article class="battle-fighter ${Number(battle.turnUserId)===Number(battle.challengerId)?'turn':''}">
       <div class="battle-fighter-top"><span class="challenge-avatar">${esc(battle.challengerAvatar||'⚔')}</span><div><b>${esc(battle.challengerName||'Người khiêu chiến')}</b><small>${esc(battle.challengerRank||'')} · ${Number(battle.challengerSpirit||0).toLocaleString('vi-VN')} linh lực</small></div></div>
       <div class="battle-hp-head"><span>❤️ HP</span><b>${Math.round(battle.challengerHp).toLocaleString('vi-VN')} / ${Math.round(battle.challengerMaxHp).toLocaleString('vi-VN')}</b></div>
       <div class="battle-hp"><i class="${hpColor(battle.challengerHp,battle.challengerMaxHp)}" style="width:${pct(battle.challengerHp,battle.challengerMaxHp)}%"></i></div>
      </article>
      <div class="battle-vs">VS</div>
      <article class="battle-fighter ${Number(battle.turnUserId)===Number(battle.opponentId)?'turn':''}">
       <div class="battle-fighter-top"><span class="challenge-avatar">${esc(battle.opponentAvatar||'⚔')}</span><div><b>${esc(battle.opponentName||'Đối thủ')}</b><small>${esc(battle.opponentRank||'')} · ${Number(battle.opponentSpirit||0).toLocaleString('vi-VN')} linh lực</small></div></div>
       <div class="battle-hp-head"><span>❤️ HP</span><b>${Math.round(battle.opponentHp).toLocaleString('vi-VN')} / ${Math.round(battle.opponentMaxHp).toLocaleString('vi-VN')}</b></div>
       <div class="battle-hp"><i class="${hpColor(battle.opponentHp,battle.opponentMaxHp)}" style="width:${pct(battle.opponentHp,battle.opponentMaxHp)}%"></i></div>
      </article>
    </div>
    <div class="battle-turn-note">${battle.yourTurn?'<b>⚡ Đến lượt bạn!</b> Chọn một tuyệt chiêu để ra đòn.':'⏳ Đang chờ đối thủ tung tuyệt chiêu...'}</div>
    ${battle.lastAction?`<div class="battle-last-action">${esc(battle.lastAction)} · <b>-${Number(battle.lastDamage||0).toLocaleString('vi-VN')} HP</b></div>`:''}
    ${battle.yourTurn?`<div class="ultimate-choice"><label>⚡ Tuyệt Chiêu</label><select id="battleTechniqueSelect">${(currentProfile?.techniques||[]).map(t=>`<option value="${t.id}" ${t.equipped?'selected':''}>${esc(t.name)} · ${esc(t.grade)} · ⚔+${Number(t.power_bonus||0).toLocaleString('vi-VN')}</option>`).join('') || '<option value="0">⚡ Hàn Thiên Phá</option>'}</select><small>Công pháp đang trang bị được chọn mặc định. Mỗi công pháp có hệ số sát thương riêng.</small></div>`:''}
    <div class="battle-actions"><button class="btn primary battle-ultimate" data-id="${battle.id}" ${battle.yourTurn?'':'disabled'}>${battle.yourTurn?'⚡ TUNG TUYỆT CHIÊU':'⏳ CHỜ ĐỐI THỦ'}</button><button class="btn ghost battle-leave" data-id="${battle.id}">🏳️ RỜI LÔI ĐÀI · TÍNH THẤT BẠI</button></div>
    <small class="battle-rule">Sát thương phụ thuộc Công lực, trang bị, công pháp được chọn và chênh lệch cảnh giới; cảnh giới cao hơn gây sát thương lớn hơn, cảnh giới thấp hơn bị giảm mạnh.</small>
   </div>`:'';
  area.innerHTML=`
   ${debuffActive?`<div class="challenge-debuff"><b>☠ ${esc(me.challenge_debuff_text||'Khiêu chiến thất bại: đang chịu debuff.')}</b><small>Debuff còn hiệu lực đến ${new Date(me.challenge_debuff_until).toLocaleString('vi-VN')}</small></div>`:''}
   ${battleHtml}
   ${publicBattles.length?`<div class="challenge-block betting-block"><div class="challenge-subhead"><span class="eyebrow">💎 SÀN ĐẶT CƯỢC LÔI ĐÀI</span><b>Mọi môn nhân đều có thể tham gia</b></div><div class="challenge-list">${publicBattles.map(x=>{const pool=Number(x.bet_pool||0),a=Number(x.challenger_bet||0),b=Number(x.opponent_bet||0);return `<article class="challenge-card bet-card"><span class="challenge-avatar">⚔</span><div><b>${esc(x.challenger_name)} VS ${esc(x.opponent_name)}</b><small>💎 Tổng cược: ${pool.toLocaleString('vi-VN')} · ${esc(x.challenger_name)}: ${a.toLocaleString('vi-VN')} · ${esc(x.opponent_name)}: ${b.toLocaleString('vi-VN')}</small></div><div class="bet-actions"><select class="bet-target" data-id="${x.id}"><option value="${x.challenger_id}">Cược ${esc(x.challenger_name)}</option><option value="${x.opponent_id}">Cược ${esc(x.opponent_name)}</option></select><input class="bet-amount" data-id="${x.id}" type="number" min="1" value="100" inputmode="numeric"><button class="btn small primary challenge-bet" data-id="${x.id}">💎 Đặt cược</button></div></article>`}).join('')}</div></div>`:''}
   <div class="challenge-limit-banner"><span>⚔ Lượt Khiêu Chiến</span><b>${Number(usage.used)}/${Number(usage.limit)} trong 24 giờ</b><small>${challengeLimitReached?'⛔ Đã hết lượt':'Còn '+Number(usage.remaining)+' lượt'}</small></div><div class="challenge-rules"><div><span class="eyebrow">⚔ ONLINE · LÔI ĐÀI</span><h3>Đánh theo lượt</h3><p>Đối phương đồng thuận rồi hai bên lần lượt tung tuyệt chiêu. Ai hết thanh máu trước sẽ thất bại.</p></div><div><span class="eyebrow">🌓 OFFLINE · MÔ PHỎNG</span><h3>Đánh với bản mô phỏng</h3><p>Không cần đối phương online. Chế độ này vẫn dùng quy tắc chênh cảnh giới.</p></div><div><span class="eyebrow">☯ QUY LUẬT CẢNH GIỚI</span><h3>Sát thương theo cảnh giới</h3><p>Cùng cảnh giới sẽ cân bằng hơn; cảnh giới cao hơn có hệ số sát thương tăng, cảnh giới thấp hơn bị giảm sát thương.</p></div></div>
   ${pending.length?`<div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">📨 LỜI MỜI LÔI ĐÀI</span><b>${pending.length} lời mời đang chờ</b></div><div class="challenge-list">${pending.map(x=>`<article class="challenge-card incoming"><span class="challenge-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.challenger_name)}</b><small>${esc(x.rank)} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary challenge-accept" data-id="${x.id}">Đồng thuận</button><button class="btn small ghost challenge-reject" data-id="${x.id}">Từ chối</button></article>`).join('')}</div></div>`:''}
   <div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">🎯 CHỌN ĐỐI THỦ</span><b>${users.length} môn nhân</b></div><div class="challenge-list">${users.length?users.map(x=>`<article class="challenge-card"><span class="challenge-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank)} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small>${Number(x.challenge_debuff_percent||0)>0?`<small class="debuff-mini">☠ Đang chịu debuff ${x.challenge_debuff_percent}%</small>`:''}</div><div class="challenge-card-actions"><button class="btn small primary challenge-online" data-id="${x.id}" ${battle||challengeLimitReached?'disabled':''}>⚔ Online</button><button class="btn small ghost challenge-offline" data-id="${x.id}" ${battle||challengeLimitReached?'disabled':''}>🌓 Offline</button></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có môn nhân khác để khiêu chiến.</p></div>`}</div></div>
   <div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">📜 CHIẾN TÍCH</span><b>${history.length} trận gần đây</b></div><div class="challenge-history">${history.length?history.map(h=>{const meId=Number(currentUser?.id),won=Number(h.winner_id)===meId,pendingStatus=h.status==='pending',activeStatus=h.status==='accepted';return `<article class="challenge-history-row"><span>${h.mode==='online'?'⚔':'🌓'}</span><div><b>${won?'🏆 Thắng':h.status==='rejected'?'Từ chối':activeStatus?'⚔ Đang giao chiến':pendingStatus?'⌛ Chờ':'💀 Thất bại'}</b><small>${esc(Number(h.challenger_id)===meId?h.opponent_name:h.challenger_name)} · ${new Date(h.created_at).toLocaleString('vi-VN')}</small></div><div class="challenge-result-text">${won?`+${Number(h.reward_spirit||0).toLocaleString('vi-VN')} linh lực${h.reward_item_name?` · ${esc(h.reward_item_name)} ×${h.reward_quantity}`:''}`:esc(h.penalty_text||'')}</div></article>`}).join(''):`<div class="empty-state compact"><p>Chưa có chiến tích.</p></div>`}</div></div>
   <p id="challengeMsg" class="train-msg"></p>`;
  document.querySelectorAll('.challenge-online').forEach(b=>b.onclick=()=>runChallenge(Number(b.dataset.id),'online'));
  document.querySelectorAll('.challenge-offline').forEach(b=>b.onclick=()=>runChallenge(Number(b.dataset.id),'offline'));
  document.querySelectorAll('.challenge-accept').forEach(b=>b.onclick=()=>respondChallenge(Number(b.dataset.id),'accept'));
  document.querySelectorAll('.challenge-reject').forEach(b=>b.onclick=()=>respondChallenge(Number(b.dataset.id),'reject'));
  document.querySelectorAll('.battle-ultimate').forEach(b=>b.onclick=()=>useUltimate(Number(b.dataset.id)));
  document.querySelectorAll('.battle-leave').forEach(b=>b.onclick=()=>leaveBattle(Number(b.dataset.id)));
  document.querySelectorAll('.challenge-bet').forEach(b=>b.onclick=()=>placeChallengeBet(Number(b.dataset.id)));
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function useUltimate(requestId){
 const b=document.querySelector(`.battle-ultimate[data-id="${requestId}"]`),msg=$('#challengeMsg'); if(b)b.disabled=true;
 try{
  const x=await api('/api/challenges/online/action',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId,techniqueId:Number($('#battleTechniqueSelect')?.value||0)})});
  msg.textContent=x.status==='completed'?`🏆 ${x.message}`:`⚡ ${x.message}`;
  await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);
 }catch(e){msg.textContent='❌ '+e.message;await loadChallenges();}
}

async function leaveBattle(requestId){
 const msg=$('#challengeMsg');
 if(!confirm('Rời khỏi lôi đài sẽ được tính là THẤT BẠI và chịu toàn bộ hình phạt. Tiếp tục?'))return;
 try{const x=await api('/api/challenges/online/leave',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId})});msg.textContent='🏳️ '+x.message;await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);}catch(e){msg.textContent='❌ '+e.message;await loadChallenges();}
}

async function placeChallengeBet(challengeId){
 const target=Number(document.querySelector(`.bet-target[data-id="${challengeId}"]`)?.value||0);
 const amount=Math.floor(Number(document.querySelector(`.bet-amount[data-id="${challengeId}"]`)?.value)||0);
 const msg=$('#challengeMsg');
 try{const x=await api('/api/challenges/bet',{method:'POST',headers:authHeaders(),body:JSON.stringify({challengeId,betOnUserId:target,amount})});msg.textContent='💎 '+x.message;await Promise.all([loadProfile(),loadChallenges()]);}catch(e){msg.textContent='❌ '+e.message;}
}

async function runChallenge(userId,mode){
 const b=document.querySelector(`.${mode==='online'?'challenge-online':'challenge-offline'}[data-id="${userId}"]`); if(b)b.disabled=true;
 const msg=$('#challengeMsg');
 try{
  const x=await api(mode==='online'?'/api/challenges/online/request':'/api/challenges/offline',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId})});
  msg.textContent=mode==='online'?`🏟 ${x.message}`:(x.win?`🏆 Khiêu chiến thắng! +${Number(x.reward?.gain||0).toLocaleString('vi-VN')} linh lực · 🎁 ${x.reward?.item?.name||'Vật phẩm ngẫu nhiên'} ×1 · sát thương hiệu lực ${x.damageMultiplier}%.`:`💀 Khiêu chiến thất bại. ${x.penalty||''}`); msg.classList.remove('combat-result-flash','combat-result-win','combat-result-loss'); void msg.offsetWidth; msg.classList.add('combat-result-flash',mode==='online'?'combat-result-win':(x.win?'combat-result-win':'combat-result-loss'));
  await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);
 }catch(e){msg.textContent='❌ '+e.message;}
 finally{if(b)b.disabled=false;}
}

async function respondChallenge(requestId,action){
 const msg=$('#challengeMsg');
 try{
  const x=await api('/api/challenges/online/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId,action})});
  msg.textContent=action==='reject'?`🏳️ ${x.message}`:`⚔ ${x.message}`;
  await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);
 }catch(e){msg.textContent='❌ '+e.message;}
}

async function loadDisciples(){
 const area=$('#disciplesArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/disciples',{headers:authHeaders()});
  const me=d.stage||{}, myIdx=Number(me.realmIndex||0), mentor=d.mentor, disciples=d.disciples||[], incoming=d.incoming||[], outgoing=d.outgoing||[], users=d.users||[], giftInventory=d.giftInventory||{stones:0,artifacts:[],beasts:[],roots:[]};
  const mentorRequests=incoming.filter(x=>x.request_type==='disciple_to_mentor');
  const inviteRequests=incoming.filter(x=>x.request_type==='mentor_to_disciple');
  const baisRequests=outgoing.filter(x=>x.request_type==='disciple_to_mentor');
  const inviteOut=outgoing.filter(x=>x.request_type==='mentor_to_disciple');
  const mentorCandidates=users.filter(x=>Number(x.realmIndex)>myIdx&&Number(x.realmIndex)>=5);
  const discipleCandidates=users.filter(x=>myIdx>=5&&Number(x.realmIndex)<myIdx);
  area.innerHTML=`<div class="friends-head"><div><span class="eyebrow">👑 SƯ ĐỒ · 師徒</span><h3>Kết giao sư đồ</h3><small>Luyện Hư trở lên có thể nhận tối đa 2 đệ tử; môn nhân cảnh giới thấp hơn có thể gửi lời bái sư. Hai bên đều có thể chủ động gửi lời mời tương tự kết giao bằng hữu.</small></div><span class="tag">${mentor?`Có sư phụ`:myIdx>=5?`Có thể nhận đệ tử`:'Có thể bái sư'}</span></div>
  ${mentor?`<div class="friend-subtitle">🛡 SƯ PHỤ CỦA BẠN</div><div class="friend-list"><article class="friend-card"><span class="friend-avatar">${avatarHtml(mentor.avatar,'',realmIndexOf(mentor.rank),mentor.auraRank)}</span><div><b>${esc(mentor.mentor_name)}</b><small>${esc(mentor.rank||'Luyện Hư')} · ${Number(mentor.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><span class="tag">🛡 Bảo hộ</span></article></div>`:''}
  ${disciples.length?`<div class="friend-subtitle">👑 ĐỆ TỬ CỦA BẠN · ${disciples.length}/2</div><div class="friend-list">${disciples.map(x=>`<article class="friend-card disciple-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small><span class="tag">🛡 Được bảo hộ</span></div><div class="disciple-gift-box"><b>🎁 Ban tặng đệ tử</b><div class="disciple-gift-row"><select class="disciple-gift-select" data-disciple="${x.disciple_id}"><option value="stones:0">💎 Linh thạch · Có ${Number(giftInventory.stones||0).toLocaleString('vi-VN')}</option>${(giftInventory.artifacts||[]).map(i=>`<option value="artifact:${i.id}">⚔ ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}${(giftInventory.beasts||[]).map(i=>`<option value="beast:${i.id}">🐉 ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}${(giftInventory.roots||[]).map(i=>`<option value="root:${i.id}">🌿 ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}</select><input class="disciple-gift-qty" data-disciple="${x.disciple_id}" type="number" min="1" value="1" inputmode="numeric"><button class="btn small primary disciple-gift-btn" data-disciple="${x.disciple_id}">🎁 Tặng</button></div></div></article>`).join('')}</div>`:''}
  ${mentorRequests.length?`<div class="friend-subtitle">📨 LỜI BÁI SƯ ĐẾN</div><div class="friend-list">${mentorRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · Muốn bái sư</small></div><button class="btn small primary disciple-accept-mentor" data-id="${x.id}">Nhận đệ tử</button><button class="btn small ghost disciple-reject-mentor" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${inviteRequests.length?`<div class="friend-subtitle">📨 LỜI MỜI NHẬP MÔN</div><div class="friend-list">${inviteRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">👑</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Luyện Hư')} · Mời bạn làm đệ tử</small></div><button class="btn small primary disciple-accept-invite" data-id="${x.id}">Nhập môn</button><button class="btn small ghost disciple-reject-invite" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${baisRequests.length?`<div class="friend-subtitle">⌛ LỜI BÁI SƯ ĐÃ GỬI</div><div class="friend-list">${baisRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">👑</span><div><b>${esc(x.display_name)}</b><small>Đang chờ sư phụ chấp thuận</small></div></article>`).join('')}</div>`:''}
  ${inviteOut.length?`<div class="friend-subtitle">⌛ LỜI MỜI NHẬP MÔN ĐÃ GỬI</div><div class="friend-list">${inviteOut.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>Đang chờ môn nhân chấp thuận</small></div></article>`).join('')}</div>`:''}
  ${mentorCandidates.length?`<div class="friend-subtitle">🙏 CHỌN SƯ PHỤ · CẢNH GIỚI CAO HƠN</div><div class="friend-list">${mentorCandidates.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'👑')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đạo hữu')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary disciple-request" data-id="${x.id}">🙏 Bái sư</button></article>`).join('')}</div>`:''}
  ${discipleCandidates.length?`<div class="friend-subtitle">📜 MỜI NHẬP MÔN · CẢNH GIỚI THẤP HƠN</div><div class="friend-list">${discipleCandidates.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary disciple-invite" data-id="${x.id}">📜 Mời nhập môn</button></article>`).join('')}</div>`:''}
  ${!mentorCandidates.length&&!discipleCandidates.length&&!mentorRequests.length&&!inviteRequests.length&&!mentor&&!disciples.length?`<div class="empty-state compact"><p>Chưa có lựa chọn sư đồ phù hợp. Môn nhân cảnh giới thấp có thể bái sư Luyện Hư trở lên.</p></div>`:''}
  <p id="disciplesMsg" class="train-msg"></p>`;
  const act=async(url,body)=>{try{const x=await api(url,{method:'POST',headers:authHeaders(),body:JSON.stringify(body)});$('#disciplesMsg').textContent='✅ '+x.message;await loadDisciples();await loadProfile();}catch(e){$('#disciplesMsg').textContent='❌ '+e.message;}};
  document.querySelectorAll('.disciple-request').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/request',{mentorId:Number(b.dataset.id)});});
  document.querySelectorAll('.disciple-invite').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/invite',{discipleId:Number(b.dataset.id)});});
  document.querySelectorAll('.disciple-accept-mentor').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/respond',{requestId:Number(b.dataset.id),action:'accept'});});
  document.querySelectorAll('.disciple-reject-mentor').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/respond',{requestId:Number(b.dataset.id),action:'reject'});});
  document.querySelectorAll('.disciple-accept-invite').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/invite/respond',{requestId:Number(b.dataset.id),action:'accept'});});
  document.querySelectorAll('.disciple-reject-invite').forEach(b=>b.onclick=()=>{b.disabled=true;act('/api/disciples/invite/respond',{requestId:Number(b.dataset.id),action:'reject'});});
  document.querySelectorAll('.disciple-gift-btn').forEach(b=>b.onclick=async()=>{
    const id=Number(b.dataset.disciple), select=document.querySelector(`.disciple-gift-select[data-disciple="${id}"]`), qtyEl=document.querySelector(`.disciple-gift-qty[data-disciple="${id}"]`);
    const [giftType,itemId]=String(select?.value||'').split(':'); const quantity=Math.floor(Number(qtyEl?.value)||0);
    if(!giftType||!Number.isInteger(quantity)||quantity<1){$('#disciplesMsg').textContent='❌ Số lượng tặng không hợp lệ.';return;}
    b.disabled=true;
    try{const x=await api('/api/disciples/gift',{method:'POST',headers:authHeaders(),body:JSON.stringify({discipleId:id,giftType,itemId:Number(itemId)||0,quantity})});$('#disciplesMsg').textContent='✅ '+x.message;await loadDisciples();await loadProfile();}
    catch(e){$('#disciplesMsg').textContent='❌ '+e.message;b.disabled=false;}
  });
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadFriends(){
 const area=$('#friendsArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/friends',{headers:authHeaders()});
  const incoming=d.incoming||[], outgoing=d.outgoing||[], friends=d.friends||[];
  area.innerHTML=`<div class="friends-head"><div><span class="eyebrow">🤝 BẰNG HỮU · 交友</span><h3>Ô bằng hữu</h3><small>Kết giao với môn nhân và mở chat riêng.</small></div><span class="tag">${friends.length} bằng hữu</span></div>
  ${incoming.length?`<div class="friend-subtitle">📨 Lời mời đến</div><div class="friend-list">${incoming.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||x.title||'Đệ tử')}</small></div><button class="btn small primary friend-accept" data-id="${x.id}">Chấp nhận</button><button class="btn small ghost friend-reject" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${outgoing.length?`<div class="friend-subtitle">⌛ Đã gửi</div><div class="friend-list">${outgoing.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>Đang chờ chấp nhận</small></div></article>`).join('')}</div>`:''}
  <div class="friend-subtitle">☯ Danh sách bằng hữu</div><div class="friend-list">${friends.length?friends.map(x=>`<article class="friend-card"><span class="friend-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||x.title||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary friend-chat" data-id="${x.id}" data-name="${esc(x.display_name)}">💬 Chat</button><button class="btn small ghost friend-remove" data-id="${x.id}">Hủy bạn</button></article>`).join(''):`<div class="empty-state compact"><p>Chưa có bằng hữu. Hãy mở Danh sách môn nhân để kết giao.</p></div>`}</div><p id="friendsMsg" class="train-msg"></p>`;
  document.querySelectorAll('.friend-accept').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/friends/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:Number(b.dataset.id),action:'accept'})});await loadFriends();}catch(e){$('#friendsMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.friend-reject').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/friends/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:Number(b.dataset.id),action:'reject'})});await loadFriends();}catch(e){$('#friendsMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.friend-chat').forEach(b=>b.onclick=()=>openFriendChat(Number(b.dataset.id),b.dataset.name));
  document.querySelectorAll('.friend-remove').forEach(b=>b.onclick=async()=>{if(!confirm('Hủy kết bằng hữu với người này?'))return;b.disabled=true;try{await api('/api/friends/remove',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId:Number(b.dataset.id)})});await loadFriends();}catch(e){const x=$('#friendsMsg');if(x)x.textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function openFriendChat(userId,name){
 const modal=$('#friendChatModal'); if(!modal)return;
 $('#friendChatContent').innerHTML=`<div class="auth-title">💬 ${esc(name)}</div><div class="auth-sub">Chat riêng giữa hai bằng hữu</div><div class="private-chat-window" id="privateChatWindow"><div class="chat-empty">Đang tải truyền âm...</div></div><form id="privateChatForm" class="chat-form"><input id="privateChatInput" maxlength="1000" autocomplete="off" placeholder="Truyền âm riêng..." required><button class="btn primary">Gửi</button></form><p id="privateChatMsg" class="train-msg"></p>`;
 modal.showModal();
 const render=rows=>{const w=$('#privateChatWindow');w.innerHTML=rows.length?rows.map(x=>`<article class="chat-msg ${Number(x.sender_id)===Number(currentUser?.id)?'mine':''}"><span class="chat-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><div class="chat-meta"><b>${esc(x.display_name)}</b><time>${new Date(x.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${esc(x.message)}</p></div></article>`).join(''):`<div class="chat-empty">Hai người chưa có cuộc trò chuyện nào.</div>`;w.scrollTop=w.scrollHeight;};
 const load=async()=>{try{const d=await api('/api/friends/'+userId+'/messages',{headers:authHeaders()});render(d.rows||[]);}catch(e){$('#privateChatMsg').textContent='❌ '+e.message;}};
 await load();
 $('#privateChatForm').onsubmit=async e=>{e.preventDefault();const input=$('#privateChatInput'),msg=$('#privateChatMsg');try{await api('/api/friends/'+userId+'/messages',{method:'POST',headers:authHeaders(),body:JSON.stringify({message:input.value})});input.value='';await load();}catch(err){msg.textContent='❌ '+err.message;}};
 clearInterval(window.privateChatTimer);window.privateChatTimer=setInterval(()=>{if(modal.open)load();},4000);
}


const TUTORIAL_STEPS=[
 {seal:'寒',eyebrow:'✦ NHẬP MÔN',title:'Chào mừng đến Hàn Thiên Môn',text:'Mọi hành trình bắt đầu từ Hồ sơ. Hãy ghi danh, đặt danh xưng và hoàn thiện thông tin cơ bản. Sau khi đăng nhập, dữ liệu tu luyện của bạn sẽ được lưu lại.',tip:'Tân nhân không cần học hết mọi hệ thống ngay. Cứ đi từng bước, những khu vực chưa đủ cảnh giới sẽ tự chỉ dẫn cho bạn.',target:'#profile'},
 {seal:'☯',eyebrow:'☯ TU LUYỆN',title:'Bước đầu: Vận Công',text:'Mỗi ngày hãy vận công để tích lũy linh lực. Khi đã hoàn thành lượt vận công theo ngày, hệ thống có thể mở chế độ tu luyện online nếu điều kiện phù hợp.',tip:'Gợi ý: luôn xem cảnh giới, linh lực và linh thạch ở Hồ sơ trước khi quyết định mua sắm hay khiêu chiến.',target:'#cultivation'},
 {seal:'📖',eyebrow:'📚 TÀNG THƯ CÁC',title:'Lĩnh ngộ công pháp',text:'Bạn có thể học công pháp không giới hạn. Mỗi lần lĩnh ngộ đều có tỷ lệ thành công; Ngộ Tính và khoảng cách cảnh giới so với yêu cầu của công pháp sẽ ảnh hưởng đến khả năng thành công.',tip:'Thất bại không làm mất công pháp. Hãy tăng Ngộ Tính và cảnh giới rồi thử lại khi cần.',target:'#codex'},
 {seal:'⚗️',eyebrow:'⚗️ ĐAN CÁC',title:'Biến vật phẩm thành linh thạch',text:'Đan Các là nơi thu mua. Khi Tu Di Giới có vật phẩm không dùng tới, bạn có thể bán chúng để nhận linh thạch.',tip:'Trước khi bán, nên kiểm tra Trang Bị để tránh bán nhầm vật phẩm đang sử dụng.',target:'#dan-cac'},
 {seal:'🐉',eyebrow:'🐉 THÚ ĐƯỜNG',title:'Tìm linh thú đồng hành',text:'Thú Đường cung cấp nhiều chủng linh thú. Kho được làm mới theo chu kỳ 5 phút, vì vậy mỗi lần quay lại có thể gặp những linh thú khác.',tip:'Linh thú không chỉ để sưu tầm: hãy xem cảnh giới, phẩm cấp và khả năng hỗ trợ chiến lực trước khi lựa chọn.',target:'#beast-house'},
 {seal:'📜',eyebrow:'📜 NHIỆM VỤ',title:'Làm nhiệm vụ để tích lũy tài nguyên',text:'Nhiệm Vụ Đường, Nghiệp Vụ, Tàng Bảo Các và các hoạt động khác giúp bạn có thêm linh thạch, vật phẩm và thành tích.',tip:'Nếu chưa biết làm gì tiếp theo, hãy mở Nhiệm Vụ Đường trước. Đây là lối chơi an toàn để làm quen với sơn môn.',target:'#quests'},
 {seal:'⚔',eyebrow:'⚔ HÀNH TẨU',title:'Kết giao và bước lên Lôi Đài',text:'Bạn có thể kết bằng hữu, truyền âm, tham gia Bí Cảnh và khiêu chiến môn nhân. Lôi Đài Trực Chiến cho phép theo dõi các trận đang diễn ra và đặt cược linh thạch theo luật của trận.',tip:'Khi mới nhập môn, hãy ưu tiên giao lưu và tăng cảnh giới trước khi tham gia các trận đấu chênh lệch lớn.',target:'#challenge'},
 {seal:'📬',eyebrow:'✦ HOÀN TẤT NHẬP MÔN',title:'Bạn đã nắm được căn bản',text:'Từ đây, hãy tự chọn con đường của mình: tu luyện, học công pháp, săn linh thú, làm nhiệm vụ, kết giao hoặc thử sức trên lôi đài.',tip:'Có thể mở lại hướng dẫn bất cứ lúc nào bằng nút “Mở hướng dẫn cơ bản” ở khu Tân Nhân. Chúc đạo hữu giữ vững đạo tâm.',target:'#tan-nhan'}
];
let tutorialIndex=0;
const tutorialSeenKey=()=>`htm_tutorial_seen_v3646_${currentUser?.id||'guest'}`;
function markTutorialSeen(){localStorage.setItem(tutorialSeenKey(),'1');}
function renderTutorialStep(){
 const s=TUTORIAL_STEPS[tutorialIndex], total=TUTORIAL_STEPS.length;
 $('#tutorialSeal').textContent=s.seal; $('#tutorialEyebrow').textContent=s.eyebrow; $('#tutorialTitle').textContent=s.title; $('#tutorialText').textContent=s.text; $('#tutorialTip').textContent='☯ '+s.tip;
 $('#tutorialProgressText').textContent=`HƯỚNG DẪN ${tutorialIndex+1}/${total}`; $('#tutorialProgressBar').style.width=`${((tutorialIndex+1)/total)*100}%`;
 $('#tutorialNext').textContent=tutorialIndex===total-1?'Hoàn tất nhập môn':'Tiếp tục →';
 $('#tutorialDots').innerHTML=TUTORIAL_STEPS.map((_,i)=>`<i class="${i===tutorialIndex?'active':''}"></i>`).join('');
}
function openTutorial(force=false){
 const overlay=$('#tutorialOverlay'); if(!overlay)return;
 tutorialIndex=0; renderTutorialStep(); overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); document.body.classList.add('tutorial-open');
 if(force) localStorage.removeItem(tutorialSeenKey());
}
function closeTutorial(save=true){
 const overlay=$('#tutorialOverlay'); if(!overlay)return; if(save)markTutorialSeen(); overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); document.body.classList.remove('tutorial-open');
}
function maybeShowTutorial(){
 if(!getToken()||!currentUser)return;
 const key=tutorialSeenKey(); if(!localStorage.getItem(key))setTimeout(()=>openTutorial(),700);
}
function setupTutorial(){
 $('#startTutorialBtn')?.addEventListener('click',()=>openTutorial(true));
 $('#tutorialNext')?.addEventListener('click',()=>{if(tutorialIndex>=TUTORIAL_STEPS.length-1){closeTutorial(true);return;}tutorialIndex++;renderTutorialStep();});
 $('#tutorialSkip')?.addEventListener('click',()=>closeTutorial(true));
 $('#tutorialSkipTop')?.addEventListener('click',()=>closeTutorial(true));
 $('#tutorialOverlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeTutorial(true);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#tutorialOverlay')?.classList.contains('hidden'))closeTutorial(true);});
}

function accountUI(user){
 if(user){currentUser=user;$('#userBadge').textContent='☯ '+user.displayName;$('#userBadge').classList.remove('hidden');$('#accountBtn').textContent='Hồ sơ';}
 else{currentUser=null;$('#userBadge').classList.add('hidden');$('#accountBtn').textContent='☯ Đăng nhập';}
}
async function checkSession(){
 if(!getToken()){accountUI(null);renderGuestAreas();return;}
 try{const d=await api('/api/me',{headers:authHeaders()});accountUI(d.user);await loadProfile();await loadTavern();await loadDisciples();await loadCultivationSafe();await loadCodex();await loadTienPhap();await loadSpiritRankings();await loadMansion();await loadChat();await loadMailbox();await loadSectPosts();await loadLeaderboard();await loadTreasure();await loadTienBan();await loadDanCac();await loadDanDuong();await loadDanPhap();await loadDuocDuong();await loadBeastHouse();await loadBeastFace();await loadDuongThu();await loadBeastArena();await loadLinhPhap();await loadTuDi();await loadMarket();await loadBlackMarket();await loadProfessions();await loadQuests();await loadChallenges();await loadArenaLive();maybeShowTutorial();}
 catch(e){if(e?.status===401){localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}else{console.warn('Phiên vẫn được giữ, lỗi tải dữ liệu tạm thời:',e);}}
}
function renderGuestAreas(){
 $('#tavernArea').innerHTML=`<div class="empty-state compact"><h3>🥂 Tửu Lâu đang phong ấn</h3><p>Đăng nhập để ứng cử Lâu Chủ, mở bán túy phẩm và giao dịch với đạo hữu.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#profileArea').innerHTML=`<div class="empty-state"><div class="empty-seal">寒</div><h3>Đệ tử chưa nhập môn</h3><p>Đăng ký hoặc đăng nhập để mở hồ sơ, linh lực, cảnh giới và thành tích cá nhân.</p><button class="btn primary" onclick="renderAuth('register')">✦ Ghi danh</button></div>`;
 $('#cultivationArea').innerHTML=`<div class="empty-state compact"><h3>Thiên đạo chờ người hữu duyên</h3><p>Đăng nhập để bắt đầu vận công và tích lũy linh lực.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#chatArea').innerHTML=`<div class="empty-state compact"><h3>Truyền âm bị phong</h3><p>Chỉ môn nhân đã nhập môn mới có thể vào Chat tổng.</p><button class="btn primary" onclick="renderAuth('register')">Đăng ký</button></div>`; $('#sectPostsArea').innerHTML=`<div class="empty-state compact"><h3>📜 Bài Đăng đang phong ấn</h3><p>Đăng nhập để xem bài đăng của Môn Phái. Hóa Thần trở lên mới được đăng.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#challengeArea').innerHTML=`<div class="empty-state compact"><h3>Lôi đài đang phong ấn</h3><p>Đăng nhập để khiêu chiến môn nhân và mô phỏng đối thủ.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#arenaLiveArea').innerHTML=`<div class="empty-state compact"><h3>👁 Lôi Đài Trực Chiến đang phong ấn</h3><p>Đăng nhập để theo dõi các trận đấu đang diễn ra và đặt cược linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#bicanhArea').innerHTML=`<div class="empty-state compact"><h3>Bí Cảnh đang phong ấn</h3><p>Đăng nhập để đóng góp linh thạch, khởi động và thám hiểm Cửu Đại Bí Cảnh.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#treasureArea').innerHTML=`<div class="empty-state compact"><h3>Tàng Bảo Các đang phong ấn</h3><p>Đăng nhập để nhận linh thạch hằng ngày và mua vật phẩm.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#danCacArea').innerHTML=`<div class="empty-state compact"><h3>Đan Các đang phong ấn</h3><p>Đăng nhập để bán vật phẩm và nhận linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; ['#duocDuongArea','#duongThuArea','#beastArenaArea','#beastHouseArea','#linhPhapArea','#equipmentArea'].forEach(sel=>{const el=$(sel);if(el)el.innerHTML=`<div class="empty-state compact"><h3>Đường vào đang phong ấn</h3><p>Đăng nhập để dùng linh thạch mua Linh Thú và Linh Căn.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;}); $('#questsArea').innerHTML=`<div class="empty-state compact"><h3>Nhiệm Vụ Đường đang phong ấn</h3><p>Đăng nhập để nhận nhiệm vụ và linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#professionsArea').innerHTML=`<div class="empty-state compact"><h3>Nghiệp Vụ đang phong ấn</h3><p>Đăng nhập để tiếp nhận nghề và nhận thù lao linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; ['#codexArea','#mansionArea'].forEach(sel=>{const el=$(sel);if(el)el.innerHTML=`<div class="empty-state compact"><h3>Đường vào đang phong ấn</h3><p>Đăng nhập để mở công pháp và động phủ.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;}); renderLegendEditor();
 loadLeaderboard(); loadSect(); loadCodex(); loadSpiritRankings();
}

async function loadCultivationSafe(){
  if(!getToken())return;
  try{const d=await api('/api/profile',{headers:authHeaders()}); if(d.profile){currentProfile=d.profile;renderCultivation(currentProfile);}}catch(e){const a=$('#cultivationArea');if(a)a.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Vận Công</h3><p>${esc(e.message)}</p><button class="btn small primary" id="retryCultivationBtn">↻ Mở lại Vận Công</button></div>`;$('#retryCultivationBtn')?.addEventListener('click',loadCultivationSafe);}
}
let rewardSnapshot=null,rewardWatchTimer=null;
function ensureRewardToastHost(){
 const host=$('#rewardToastHost');
 if(host)return host;
 const el=document.createElement('div');el.id='rewardToastHost';el.className='reward-toast-host';document.body.appendChild(el);return el;
}
function showRewardToast(lines){
 if(!lines.length)return;
 const host=ensureRewardToastHost();
 const el=document.createElement('div');el.className='reward-toast';
 el.innerHTML=`<div class="reward-toast-mark">✦</div><div><b>NHẬN ĐƯỢC</b>${lines.map(x=>`<div>${esc(x)}</div>`).join('')}</div><span class="reward-toast-time">10s</span>`;
 host.appendChild(el);
 setTimeout(()=>el.remove(),10000);
}
function snapshotMap(rows,prefix){const m={};for(const x of (rows||[]))m[`${prefix}:${x.id}`]={name:x.name,quantity:Number(x.quantity)||0};return m;}
async function pollRewardSnapshot(initial=false){
 if(!getToken()){rewardSnapshot=null;return;}
 try{
  const d=await api('/api/reward-snapshot',{headers:authHeaders()});
  const next={stones:Number(d.spiritStones)||0,...snapshotMap(d.items,'item'),...snapshotMap(d.beasts,'beast'),...snapshotMap(d.roots,'root'),...snapshotMap(d.tavern,'tavern')};
  if(rewardSnapshot && !initial){
   const lines=[];
   const stoneGain=next.stones-rewardSnapshot.stones;
   if(stoneGain>0)lines.push(`+${stoneGain.toLocaleString('vi-VN')} linh thạch`);
   for(const [key,val] of Object.entries(next)){
    if(key==='stones')continue;
    const old=rewardSnapshot[key]?.quantity||0,diff=val.quantity-old;
    if(diff>0)lines.push(`${val.name} ×${diff}`);
   }
   if(lines.length)showRewardToast(lines.slice(0,6));
  }
  rewardSnapshot=next;
 }catch{}
}
function startRewardWatcher(){
 if(rewardWatchTimer)clearInterval(rewardWatchTimer);
 rewardSnapshot=null;
 pollRewardSnapshot(true);
 rewardWatchTimer=setInterval(()=>{if(document.hidden)return;pollRewardSnapshot(false);},5000);
}

async function loadProfile(){
 try{const d=await api('/api/profile',{headers:authHeaders()});currentProfile=d.profile;renderProfile(currentProfile);renderCultivation(currentProfile);loadFriends();loadDisciples();loadChallenges();loadCodex();loadTienPhap();loadSpiritRankings();loadMansion();if(!Boolean(currentProfile?.mansion?.active))startOnlineCultivation();else if(onlineTimer){clearInterval(onlineTimer);onlineTimer=null;}loadAchievements();loadTreasure();loadDanCac();loadBeastHouse();loadLinhPhap();loadEquipment();loadBicanh();loadProfessions();loadQuests();renderLegendEditor();}
 catch(e){if(e.status===401){localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}}
}
function renderProfile(p){
 $('#profileArea').innerHTML=`<div class="profile-grid">
 <article class="profile-card profile-main"><div class="profile-avatar ${String(p.username||'').toLowerCase()==='cuu_vi_ho'?'immortal-emperor-profile':''}">${avatarHtml(p.avatar,'',p.realmIndex,p.auraRank)}</div><div class="profile-copy"><span class="eyebrow">${esc(p.position||'Ngoại môn đệ tử')}</span><h3>${esc(p.display_name)}</h3><p class="profile-title">${esc(p.stage)} · ${esc(p.title)}</p>${p.position==='Lâu Chủ'?'<span class="tavern-honorific-badge">👑 Tửu Lâu Chi Chủ</span>':''}<p class="muted">@${esc(p.username)} · Gia nhập ${fmtDate(p.created_at)}</p><div class="tags"><span class="tag">🌿 Linh căn: ${p.equipment?.root?'Hậu Thiên Linh Căn · ':''}${esc(p.spiritRoot||'Chưa định')} · ${esc(p.rootRarity||'—')}</span><span class="tag">🐉 Linh thú: ${esc(p.spiritBeast||'Chưa định')} · ${esc(p.beastRarity||'—')} · ${esc(p.beastRealm||'Nhất Giai')} ${Number(p.beastRealmTier||1)}</span></div><p>${esc(p.bio||'Chưa viết lời tựa cho đạo tâm của mình.')}</p><div class="tags"><span class="tag">${esc(p.sect)}</span><span class="tag">${esc(p.hobby||'Đang tu hành')}</span></div></div><button class="btn small edit-profile" id="editProfileBtn">Sửa hồ sơ</button></article>
 <article class="profile-card profile-stats"><div><span>Linh lực</span><b>${Number(p.spirit_power).toLocaleString('vi-VN')}</b></div><div><span>Linh thạch</span><b class="stone-value">💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></div><div><span>Chiến lực</span><b>⚔ ${Number(p.attributes?.combatPower||0).toLocaleString('vi-VN')}</b></div><div><span>Thành tích</span><b>${p.achievement_points}</b></div></article></div><div class="achievement-panel"><div class="attribute-head"><span class="eyebrow">🏆 THÀNH TÍCH</span><h3>Huy hiệu tu hành</h3></div><div id="achievementList" class="achievement-list"><div class="empty-state compact"><p>Đang tải thành tích...</p></div></div></div><div class="profile-equipment-panel"><div class="attribute-head"><span class="eyebrow">⚔ TRANG BỊ · 裝備</span><h3>Trang bị hiện tại</h3><small>Mỗi khi thay đổi ô trang bị, hồ sơ sẽ cập nhật vật phẩm đang sử dụng và công năng riêng.</small></div><div class="equipment-profile-grid">${[['beast','🐉','Linh Thú'],['root','🌿','Linh Căn'],['artifact','⚔','Pháp Khí'],['immortal','🌌','Tiên Pháp']].map(([k,ic,title])=>{const x=p.equipment?.[k];return `<div class="equipment-profile-item ${x?'active':''}"><span class="equipment-profile-icon">${x?.avatar?(k==='beast'?beastAvatarHtml(x.avatar,x.beast_realm_tier):avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)):ic}</span><div><b>${title}</b><strong>${x?esc(x.name):'Chưa trang bị'}</strong>${x?`<small>⚔ +${Number(x.power||0).toLocaleString('vi-VN')} chiến lực</small><p>${esc(x.ability||'Không có công năng riêng.')}</p>`:'<small>Ô đang trống</small>'}</div></div>`}).join('')}</div><div class="equipment-profile-total">⚔ Chiến lực từ trang bị: <b>+${Number(p.attributes?.equipmentPower||0).toLocaleString('vi-VN')}</b></div></div><div class="profile-technique-panel"><div class="attribute-head"><span class="eyebrow">📚 CÔNG PHÁP ĐÃ HỌC</span><h3>${Number(p.techniqueCount||0)} công pháp · KHÔNG GIỚI HẠN</h3><small>Chiến lực công pháp +${Number(p.attributes?.techniquePower||0).toLocaleString('vi-VN')}</small></div><div class="profile-technique-list">${(p.techniques||[]).length?(p.techniques||[]).map(t=>`<div><div class="item-avatar">${avatarHtml(t.avatar)}</div><div><b>${esc(t.name)}</b><span>${esc(t.grade||'')} · ⚔ +${Number(t.power_bonus||0).toLocaleString('vi-VN')}</span><small>${esc(t.ability||'')} · Cần Ngộ tính ${Number(t.required_comprehension||0)}</small></div></div>`).join(''):'<div class="empty-state compact"><p>Chưa học công pháp. Mở Tàng Thư Các để lựa chọn.</p></div>'}</div></div><div class="profile-mansion-panel"><div class="attribute-head"><span class="eyebrow">🏯 ĐỘNG PHỦ</span><h3>${p.mansion?esc(p.mansion.name):'Chưa sở hữu'}</h3><small>${p.mansion?`${esc(p.mansion.grade)} · +${Number(p.mansion.spiritPerHour||0).toLocaleString('vi-VN')} linh lực/giờ · ${p.mansion.active?'ĐANG KHỞI ĐỘNG':'ĐANG NGƯNG'}`:'Mua động phủ để tự động tích linh lực.'}</small></div></div><div class="attribute-panel"><div class="attribute-head"><span class="eyebrow">☯ THUỘC TÍNH ĐỆ TỬ</span><h3>Bảng thuộc tính</h3><small>Thuộc tính tăng theo linh lực, cảnh giới và tầng.</small></div><div class="health-attribute"><div class="health-attribute-head"><span>❤️ Thanh Máu</span><b>${Number(p.attributes?.health||0).toLocaleString('vi-VN')} / ${Number(p.attributes?.healthMax||0).toLocaleString('vi-VN')}</b></div><div class="health-bar"><i style="width:${Math.min(100,Math.max(0,Math.round((Number(p.attributes?.health||0)/Math.max(1,Number(p.attributes?.healthMax||1)))*100)))}%"></i></div>${p.activeBattle?`<small class="health-battle-note">⚔ Đang trong lôi đài online · ${p.activeBattle.yourTurn?'Đến lượt bạn tung tuyệt chiêu.':'Đang chờ đối thủ.'}</small>`:''}</div><div class="attribute-grid">${[['Công lực','⚔',p.attributes?.congLuc],['Phòng thủ','🛡',p.attributes?.phongThu],['Thân pháp','💨',p.attributes?.thanPhap],['Ngộ tính','☯',p.attributes?.ngoTinh],['Khí vận','✦',p.attributes?.khiVan]].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${Number(x[2]||0).toLocaleString('vi-VN')}</strong></div></div>`).join('')}</div></div><div class="random-gifts-panel"><div><span class="eyebrow">🎲 DUYÊN NGẪU NHIÊN · 1 LẦN</span><h3>Gieo duyên Linh Căn & Linh Thú</h3><p>Mỗi đệ tử chỉ được gieo duyên <b>1 lần duy nhất</b>. Độ hiếm quyết định sức mạnh và hiệu quả phụ trợ.</p></div><button class="btn small primary" id="randomGiftsBtn" ${p.gachaClaimed?'disabled':''}>${p.gachaClaimed?'✓ Đã gieo duyên':'🎲 Gieo duyên'}</button><div id="randomGiftsMsg" class="train-msg"></div></div>
 <div class="spirit-companion-panel"><div class="attribute-head"><span class="eyebrow">🐉 THUỘC TÍNH LINH THÚ · PHỤ TRỢ</span><h3>${esc(p.spiritBeast||'Chưa có linh thú')}</h3><small>${esc(p.beastRealm||'Nhất Giai')} · ${Number(p.beastRealmTier||1)} · ${esc(p.beastRarity||'—')} · Linh thú hỗ trợ chiến lực và tu luyện theo độ hiếm.</small></div><div class="attribute-grid">${[['Công kích','⚔',p.beastAttributes?.attack],['Phòng ngự','🛡',p.beastAttributes?.defense],['Thân pháp','💨',p.beastAttributes?.speed],['Linh lực','☯',p.beastAttributes?.spirit],['Thiên phú','✦',p.beastAttributes?.skill||'—']].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${typeof x[2]==='number'?Number(x[2]).toLocaleString('vi-VN'):esc(x[2])}</strong></div></div>`).join('')}</div><p class="muted">Phụ trợ linh căn: +${Number(p.supportBonus||0)}% hiệu quả tu luyện cơ bản.</p></div>`;
 const friendsHost=$('#friendsArea');
 if(!friendsHost){ const host=document.createElement('div'); host.id='friendsArea'; host.className='friends-panel'; $('#profileArea').appendChild(host); }
 loadFriends();
 $('#editProfileBtn').onclick=openProfileEditor;
 $('#randomGiftsBtn').onclick=async()=>{const b=$('#randomGiftsBtn');const msg=$('#randomGiftsMsg');b.disabled=true;try{const x=await api('/api/random-gifts',{method:'POST',headers:authHeaders(),body:'{}'});msg.textContent=`🎲 ${x.spiritRoot} [${x.rootRarity}] · 🐉 ${x.spiritBeast} [${x.beastRarity}] · ${x.beastAttributes.skill}`;await loadProfile();}catch(e){msg.textContent='❌ '+e.message;}};

}
function openProfileEditor(){
 const p=currentProfile;
 $('#accountContent').innerHTML=`<div class="auth-title">Đệ tử lục · 修身</div><div class="auth-sub">Chỉnh sửa dấu ấn cá nhân trong sơn môn</div><form id="profileForm" class="auth-form"><div class="field"><label>Danh xưng</label><input id="pDisplay" value="${esc(p.display_name)}" maxlength="40" required></div><div class="field"><label>Đạo hiệu / danh hiệu</label><input id="pTitle" value="${esc(p.title)}" maxlength="60"></div><div class="field"><label>Chức Vị</label><select id="pPosition">${(p.positionOptions||[]).map(o=>`<option value="${esc(o)}" ${o===p.position?"selected":""}>${esc(o)}</option>`).join("")}</select><small>Chỉ được chọn chức vị phù hợp với cảnh giới hiện tại.</small></div><div class="field"><label>Ảnh đại diện thật</label><input id="pAvatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><div id="pAvatarPreview" class="profile-avatar-upload-preview">${avatarHtml(p.avatar)}</div><small>Chọn ảnh từ iPhone/thiết bị. Ảnh sẽ được tự tối ưu trước khi lưu.</small></div><div class="field"><label>Ngày sinh</label><input id="pBirthday" value="${esc(p.birthday)}" maxlength="30" placeholder="DD/MM/YYYY"></div><div class="field"><label>Sở thích</label><input id="pHobby" value="${esc(p.hobby)}" maxlength="100"></div><div class="field"><label>Tiểu sử</label><textarea id="pBio" maxlength="500" rows="4">${esc(p.bio)}</textarea></div><button class="btn primary" type="submit">Lưu hồ sơ</button><div id="profileMsg" class="auth-msg"></div></form>`;
 const fileInput=$('#pAvatarFile'),preview=$('#pAvatarPreview');
 fileInput?.addEventListener('change',async()=>{try{const f=fileInput.files?.[0];if(!f)return;const x=await preparePostImage(f);preview.innerHTML=avatarHtml(x.data);}catch(err){fileInput.value='';preview.innerHTML=avatarHtml(p.avatar);$('#profileMsg').textContent='❌ '+err.message;}});
 $('#profileForm').onsubmit=async e=>{e.preventDefault();const msg=$('#profileMsg'),btn=$('#profileForm button');btn.disabled=true;try{let avatar=p.avatar;const f=fileInput?.files?.[0];if(f){const x=await preparePostImage(f);avatar=x.data;}await api('/api/profile',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({displayName:$('#pDisplay').value,title:$('#pTitle').value,position:$('#pPosition').value,avatar,birthday:$('#pBirthday').value,hobby:$('#pHobby').value,bio:$('#pBio').value})});$('#accountModal').close();await loadProfile();await loadLeaderboard();}catch(err){msg.textContent='❌ '+err.message;}finally{btn.disabled=false;}};
 $('#accountModal').showModal();
}

let onlineTimer=null;
async function onlineCultivationTick(){
  if(!getToken()||Boolean(currentProfile?.mansion?.active))return;
  try{
    const d=await api('/api/cultivation/online',{method:'POST',headers:authHeaders(),body:'{}'});
    window.__onlineRate=Number(d.rate||0);
    window.__onlineActive=Boolean(d.active);
    window.__onlineEarned=Number(d.onlineEarned||0);
    window.__onlineRemainder=Number(d.remainderSeconds||0);
    window.__onlineSyncedAt=Number(d.serverTime||Date.now());
    const status=$('#onlineStatus'),gainEl=$('#onlineGain');
    if(status)status.textContent=d.active?`🟢 Xuất Quan · đang tụ linh theo thời gian thực · +${Number(d.rate||0).toLocaleString('vi-VN')}/phút · ${Number(d.ratePerHour||0).toLocaleString('vi-VN')}/giờ · ${esc(d.realm||currentProfile?.realm||'cảnh giới hiện tại')}`:'🌙 Đã Bế Quan · tạm dừng tụ linh, chờ Xuất Quan';
    if(gainEl)gainEl.textContent=`+${Number(d.onlineEarned||0).toLocaleString('vi-VN')} linh lực đã tụ · +${Number(d.rate||0).toLocaleString('vi-VN')}/phút`;
    const live=$('#onlineLiveCounter');if(live)live.textContent=d.active?'Đang tích lũy từng nhịp thời gian':'Tạm dừng';
    if(d.gain>0){
      const gain=Number(d.gain)||0;
      if(currentProfile){
        currentProfile.spirit_power=Number(currentProfile.spirit_power||0)+gain;
        currentProfile.onlineEarned=Number(d.onlineEarned||0);
        currentProfile.realm=d.realm||currentProfile.realm;
        currentProfile.stage=d.stage||currentProfile.stage;
      }
      const msg=$('#trainMsg'); if(msg)msg.textContent=d.message||`☁ Online: +${gain.toLocaleString('vi-VN')} linh lực · ${Number(d.rate||0).toLocaleString('vi-VN')}/phút.`;
      renderProfile(currentProfile);
      renderCultivation(currentProfile);
      await loadProfile();
      await loadLeaderboard();
    }
  }catch(e){
    const status=$('#onlineStatus');
    if(status && !Boolean(currentProfile?.mansion?.active)) status.textContent='☁ Chờ Xuất Quan · hệ thống sẽ tự động tiếp tục tụ linh khi trạng thái hoạt động được xác nhận';
  }
}
function startOnlineCultivation(){
  if(onlineTimer)clearInterval(onlineTimer);
  if(window.__onlineRealtimeTimer)clearInterval(window.__onlineRealtimeTimer);
  onlineTimer=setInterval(onlineCultivationTick,5000);
  window.__onlineRealtimeTimer=setInterval(()=>{
    const status=$('#onlineStatus'),gainEl=$('#onlineGain');
    if(!status||!gainEl||!currentProfile||Boolean(currentProfile?.mansion?.active))return;
    const rate=Number(window.__onlineRate||currentProfile.onlineRate||0);
    const active=Boolean(window.__onlineActive);
    const syncedAt=Number(window.__onlineSyncedAt||0);
    const base=Number(window.__onlineEarned||0);
    const remainder=Number(window.__onlineRemainder||0);
    if(!rate||!active||!syncedAt)return;
    const elapsed=Math.max(0,Math.floor((Date.now()-syncedAt)/1000));
    const projected=Math.floor((remainder+elapsed)*rate/60);
    const next=Math.max(1,Math.ceil(60/rate));
    gainEl.textContent=`+${(base+projected).toLocaleString('vi-VN')} linh lực đã tụ · +${rate.toLocaleString('vi-VN')}/phút`;
    status.textContent=`🟢 Xuất Quan · đang tụ linh theo thời gian thực · khoảng ${(rate*60).toLocaleString('vi-VN')} linh lực/giờ · cảnh giới ${currentProfile.realm||currentProfile.stage}`;
    const panel=$('#onlineCultivationPanel'); if(panel)panel.classList.add('online-ready');
    const live=$('#onlineLiveCounter'); if(live)live.textContent=`+${projected.toLocaleString('vi-VN')} linh lực đang tích lũy`;
    if(projected>0 && projected%1===0){
      const progress=$('#onlineRealtimeBar'); if(progress)progress.style.width=`${Math.min(100,(elapsed%next)/next*100)}%`;
    }
  },1000);
  onlineCultivationTick();
}
function renderCultivation(p){
 const prog=p.progress;
 const maxDaily=Number(p.maxDaily||10), trainCount=Number(p.trainCount||0);
 const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
 const atTribulation=String(p.realm)==='Độ Kiếp' && Number(p.tier)===9;
 const mansionActive=Boolean(p.mansion?.active);
 const onlineRate=Number(p.onlineRate||Math.max(1,18-Number(p.progress?.realmIndex||0)));
 const onlineUnlocked=!mansionActive;
 $('#cultivationArea').innerHTML=`<div class="cultivation-grid">
 <article class="cultivation-card"><div class="rank-emblem">${avatarHtml(p.avatar)}</div><div><span class="eyebrow">CẢNH GIỚI HIỆN TẠI</span><h3>${esc(p.stage)}</h3><p class="muted">${esc(p.title)} · ${esc(p.sect)}</p><div class="tier-badge">${esc(p.tierName||(`Tầng ${p.tier}/9`))} · ${esc(p.realm)}</div></div><button class="btn primary train-btn" id="trainBtn" ${trainCount>=maxDaily||mansionActive?'disabled':''}>${mansionActive?'🏯 Động phủ đang khóa vận công':trainCount>=maxDaily?'☁ Đã đủ lượt':'⚔ Vận công'}</button></article>
 <article class="power-card"><div class="power-head"><div><span>Linh lực</span><strong>${Number(p.spirit_power).toLocaleString('vi-VN')}</strong></div><span>${prog.next?`Còn ${prog.remaining.toLocaleString('vi-VN')} để tiến vào ${esc(prog.next)}`:'Đã đạt cảnh giới tối cao'}</span></div><div class="progress"><i style="width:${prog.percent}%"></i></div><div class="rank-ladder">${realms.map(r=>`<span class="${r===p.realm?'on':''}">${r}</span>`).join('')}</div></article>
 </div>
 ${atTribulation?`<div class="daily-stone-card" id="ascensionPanel"><div><span class="eyebrow">🌌 PHI THĂNG · ĐỘ KIẾP</span><h3>Cửu Trọng Thiên Kiếp</h3><p>Đạt <b>Độ Kiếp Cửu Tầng</b> để vượt qua 9 lần thiên kiếp. Mỗi lần thành công <b>không xóa chiến lực, trang bị hay vật phẩm</b>. Hoàn tất lần thứ 9 sẽ lập tức phi thăng lên <b>Nhân Tiên Nhất Tầng</b>.</p></div><div><button class="btn primary" id="ascensionBtn">⚡ Độ kiếp lần 1/9</button><p id="ascensionMsg" class="train-msg">Đang kiểm tra Cửu Trọng Thiên Kiếp...</p></div></div>`:''}
 <div class="daily-stone-card"><div><span class="eyebrow">💎 LINH THẠCH HẰNG NGÀY</span><h3>Kho linh thạch: <b id="stoneCount">${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></h3><p>Mỗi ngày nhận <b>100 linh thạch</b> để sử dụng tại Tàng Bảo Các.</p></div><button class="btn primary" id="claimStoneBtn" ${p.canClaimStones?'':'disabled'}>${p.canClaimStones?'💎 Nhận 100 linh thạch':'✓ Đã nhận hôm nay'}</button></div>
 <div class="online-cultivation-card ${onlineUnlocked?'online-ready':'online-locked'}" id="onlineCultivationPanel"><div class="online-cultivation-copy"><span class="eyebrow">☁ TU LUYỆN ONLINE · THỜI GIAN THỰC</span><h3>${onlineUnlocked?'Tự động tụ linh khi Xuất Quan':'Chưa mở Online'}</h3><p id="onlineStatus">${mansionActive?`🏯 ${esc(p.mansion.name)} đang khởi động · tạm khóa tự động tụ linh.`:`🟢 +${onlineRate.toLocaleString('vi-VN')} linh lực/phút · khoảng ${(onlineRate*60).toLocaleString('vi-VN')} linh lực/giờ · tốc độ tăng theo ${esc(p.realm)}.`}</p><div class="online-progress"><i id="onlineRealtimeBar" style="width:0%"></i></div><small id="onlineLiveCounter" class="online-live-counter">${onlineUnlocked?'Đang chờ nhịp Xuất Quan…':'Đang khóa do Động Phủ'}</small></div><div class="online-numbers"><b id="onlineGain">${onlineUnlocked?`+${Number(p.onlineEarned||0).toLocaleString('vi-VN')} linh lực đã tụ · +${onlineRate.toLocaleString('vi-VN')}/phút`:'Đang khóa do Động Phủ'}</b><small>Tự động theo từng giây · không cần bấm Vận Công</small></div></div><p id="trainMsg" class="train-msg">${mansionActive?`🏯 ${esc(p.mansion.name)} đang khởi động: tự động +${Number(p.mansion.spiritPerHour||0).toLocaleString('vi-VN')} linh lực/giờ. Vận công bị khóa hoàn toàn.`:`☁ Tu luyện Online đã mở: linh lực tự động cộng theo thời gian <b>Xuất Quan</b>, tốc độ thay đổi theo từng cảnh giới. Vận công thủ công vẫn có lượt riêng mỗi ngày.`}</p>`;
 $('#trainBtn').onclick=async()=>{const b=$('#trainBtn');b.disabled=true;b.textContent='☁ Đang vận công...';try{const d=await api('/api/cultivation/train',{method:'POST',headers:authHeaders(),body:'{}'});$('#trainMsg').textContent=d.message||`+${d.gain} linh lực → ${d.stage} · Lượt vận công/tu luyện hôm nay ${d.trainCount}/${d.maxDaily}. ${d.progress.next?`Còn ${d.progress.remaining} linh lực để tiến vào ${d.progress.next}.`:'Đã đạt cảnh giới tối cao.'}`;await loadProfile();await loadLeaderboard();}catch(e){$('#trainMsg').textContent=e.message;}finally{const latest=Number(currentProfile?.trainCount||0)>=Number(currentProfile?.maxDaily||10);const locked=Boolean(currentProfile?.mansion?.active);b.disabled=latest||locked;b.textContent=locked?'🏯 Động phủ đang khóa vận công':latest?'☁ Đã đủ lượt':'⚔ Vận công';}};
 $('#claimStoneBtn').onclick=async()=>{const b=$('#claimStoneBtn');b.disabled=true;try{const d=await api('/api/spirit-stones/claim',{method:'POST',headers:authHeaders(),body:'{}'});$('#trainMsg').textContent=`💎 ${d.amount} linh thạch đã nhập kho. Có thể dùng tại Tàng Bảo Các.`;await loadProfile();await loadTreasure();}catch(e){$('#trainMsg').textContent=e.message;b.disabled=false;}};
 if(atTribulation){
   const b=$('#ascensionBtn'),msg=$('#ascensionMsg');
   (async()=>{try{const d=await api('/api/ascension',{headers:authHeaders()}); if(!d.unlocked){return;} const n=Math.min(9,Number(d.attempts)||0); b.textContent=n>=9?'✓ Đã hoàn tất Cửu Trọng Thiên Kiếp':`⚡ Độ kiếp lần ${n+1}/9`; b.disabled=n>=9; msg.textContent=`Tiến độ: ${n}/9 · Chiến lực và trang bị được bảo toàn.`;}catch(e){msg.textContent='❌ '+e.message;}})();
   b.onclick=async()=>{b.disabled=true;try{const d=await api('/api/ascension/tribulation',{method:'POST',headers:authHeaders(),body:'{}'});msg.textContent=d.message; if(d.ascended){await loadProfile();await loadLeaderboard();} else {const left=9-Number(d.attempts);b.disabled=false;b.textContent=`⚡ Độ kiếp lần ${Number(d.attempts)+1}/9`;msg.textContent+=` Còn ${left} lần.`;}}catch(e){msg.textContent='❌ '+e.message;b.disabled=false;}};
 }
}
async function loadCodex(){
 const area=$('#codexArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/codex',{headers:authHeaders()});
  const current=Number(d.realmIndex||0);
  area.innerHTML=`<div class="codex-summary"><div><span class="eyebrow">📚 CẢNH GIỚI</span><h3>${esc(d.stage)}</h3><p>Đã học <b>${Number(d.used||0)}</b> công pháp · <b>không giới hạn số lượng</b>. Tỷ lệ lĩnh ngộ dựa trên Ngộ Tính và chênh lệch cảnh giới.</p></div><div><span>☯ Ngộ tính</span><strong>${Number(currentProfile?.attributes?.ngoTinh||0).toLocaleString('vi-VN')}</strong></div><div><span>💎 Linh thạch</span><strong>${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong></div></div><div class="codex-grid">${(d.rows||[]).map(x=>{const locked=Number(x.realm_index)>current;const learned=Boolean(x.learned);const reqComp=Number(x.required_comprehension||12+Number(x.realm_index||0)*4+({'Hạ Phẩm':0,'Trung Phẩm':8,'Thượng Phẩm':16}[x.grade]||0));const ngo=Number(currentProfile?.attributes?.ngoTinh||0);const gap=Math.max(0,current-Number(x.realm_index||0));const chance=Math.max(5,Math.min(95,Math.round(35+(ngo-reqComp)*2+gap*10)));const can=!locked&&!learned&&Number(d.spiritStones||0)>=Number(x.price_stones||0);return `<article class="codex-card ${learned?'learned':''} ${locked?'locked':''}"><div class="codex-icon item-avatar-picker"><div class="item-avatar">${avatarHtml(x.avatar||x.default_avatar)}</div>${learned?`<label class="item-avatar-upload">🖼 Ảnh<input class="item-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-type="technique" data-id="${x.id}"></label>`:``}</div><div class="codex-card-copy"><div class="codex-top"><span class="codex-grade">${esc(x.grade)}</span><span class="tag">${esc(x.realm_name)}</span></div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><div class="codex-meta"><span>💎 ${Number(x.price_stones||0).toLocaleString('vi-VN')}/lần</span><span>☯ Cần Ngộ tính ${reqComp}</span><span>🎯 ${chance}% thành công</span></div><small>${esc(x.ability||'')}</small><button class="btn small ${learned?'ghost':'primary'} codex-learn" data-id="${x.id}" ${learned||locked||!can?'disabled':''}>${learned?'✓ Đã học':locked?'🔒 Chưa tới cảnh giới':Number(d.spiritStones||0)<Number(x.price_stones||0)?'Thiếu linh thạch':'📖 Thử lĩnh ngộ'}</button></div></article>`}).join('')}</div><p id="codexMsg" class="train-msg">Mỗi lần thử lĩnh ngộ sẽ tiêu hao linh thạch theo giá công pháp; thất bại không mất công pháp vì chưa lĩnh ngộ thành.</p>`;
  document.querySelectorAll('.codex-learn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/codex/learn',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#codexMsg').textContent=x.success?`📖 ${x.message}`:`⚠️ ${x.message}`;await Promise.all([loadProfile(),loadCodex()]);}catch(e){$('#codexMsg').textContent='❌ '+e.message;b.disabled=false;}});
  bindItemAvatarPickers(loadCodex);
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Tàng Thư Các</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadCodex()">↻ Thử lại</button></div>`;}
}

async function loadTienPhap(){
 const area=$('#tienPhapArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/tien-phap',{headers:authHeaders()});
  const current=Number(d.realmIndex||0);
  const rows=d.rows||[];
  area.innerHTML=`<div class="codex-summary"><div><span class="eyebrow">🌌 CẢNH GIỚI TIÊN ĐẠO</span><h3>${esc(d.stage)}</h3><p>Tiên Pháp được mở khóa theo từng cảnh giới Tiên. Đạt đủ cảnh giới mới có thể lĩnh ngộ.</p></div><div><span>💎 Linh thạch</span><strong>${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong></div></div><div class="codex-grid tien-phap-grid">${rows.map(x=>{const locked=!x.unlocked,learned=Boolean(x.learned),can=!locked&&!learned&&Number(d.spiritStones||0)>=Number(x.price_stones||0);return `<article class="codex-card ${learned?'learned':''} ${locked?'locked':''}"><div class="codex-top"><span class="codex-grade">${esc(x.grade)}</span><span class="tag">${esc(x.realm_name)}</span></div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><div class="codex-meta"><span>💎 ${Number(x.price_stones||0).toLocaleString('vi-VN')}</span><span>⚔ +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><span>☯ +${Number(x.training_bonus_percent||0)}% tu luyện</span></div><small>${esc(x.ability||'')}</small><button class="btn small ${learned?'ghost':'primary'} tien-phap-learn" data-id="${x.id}" ${locked||learned||!can?'disabled':''}>${learned?'✓ Đã lĩnh ngộ':locked?'🔒 Chưa đủ cảnh giới':Number(d.spiritStones||0)<Number(x.price_stones||0)?'Thiếu linh thạch':'🌌 Lĩnh Ngộ'}</button></article>`}).join('')}</div><p id="tienPhapMsg" class="train-msg"></p>`;
  document.querySelectorAll('.tien-phap-learn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/tien-phap/learn',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#tienPhapMsg').textContent=`🌌 ${x.message} · Chiến lực +${Number(x.powerBonus||0).toLocaleString('vi-VN')}.`;await Promise.all([loadProfile(),loadTienPhap(),loadEquipment()]);}catch(e){$('#tienPhapMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Tiên Pháp</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadTienPhap()">↻ Thử lại</button></div>`;}
}

async function loadMansion(){
 const area=$('#mansionArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/mansion',{headers:authHeaders()}); const owned=d.owned; const current=Number(d.realmIndex||0);
  area.innerHTML=`<div class="mansion-summary"><div><span class="eyebrow">🏯 ĐỘNG PHỦ HIỆN TẠI</span><h3>${owned?esc(owned.name):'Chưa sở hữu động phủ'}</h3><p>${owned?`${esc(owned.grade)} · +${Number(owned.spirit_per_hour||0).toLocaleString('vi-VN')} linh lực/giờ · ${owned.active?'🟢 ĐANG KHỞI ĐỘNG':'⚪ ĐANG NGƯNG'}`:'Mua theo thứ tự phẩm cấp từ thấp đến cao.'}</p></div><div><span>💎 Linh thạch</span><strong>${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong></div>${owned?`<button class="btn primary" id="mansionToggleBtn">${owned.active?'⏹ Ngưng động phủ':'▶ Khởi động động phủ'}</button>`:''}</div><div class="mansion-grid">${(d.mansions||[]).map(m=>{const bought=owned&&Number(owned.mansion_id)>=Number(m.id);const next=owned?Number(m.id)===Number(owned.mansion_id)+1:Number(m.id)===1;const lockedRealm=current<Number(m.min_realm);const can=(!owned?next:next)&&!lockedRealm&&Number(d.spiritStones||0)>=Number(m.price_stones||0);return `<article class="mansion-card ${bought?'owned':''} ${lockedRealm?'locked':''}"><div class="mansion-top"><span>🏯</span><div><span class="eyebrow">${esc(m.grade)}</span><h3>${esc(m.name)}</h3></div></div><p>${esc(m.description)}</p><div class="mansion-meta"><span>💎 ${Number(m.price_stones||0).toLocaleString('vi-VN')}</span><span>☯ +${Number(m.spirit_per_hour||0).toLocaleString('vi-VN')}/giờ</span><span>🔒 ${esc(m.min_realm?REALM_NAMES[Number(m.min_realm)]:'Luyện Khí')}</span></div><button class="btn small ${bought?'ghost':'primary'} mansion-buy" data-id="${m.id}" ${bought||!can?'disabled':''}>${bought?'✓ Đã sở hữu':lockedRealm?'🔒 Chưa đủ cảnh giới':!next?'🔒 Mua theo thứ tự':Number(d.spiritStones||0)<Number(m.price_stones||0)?'Thiếu linh thạch':'🏯 Mua động phủ'}</button></article>`}).join('')}</div><p id="mansionMsg" class="train-msg">${owned&&owned.active?'🏯 Động phủ đang hoạt động: vận công và vận công online bị khóa hoàn toàn. Linh lực sẽ được tích lũy theo thời gian.':''}</p>`;
  $('#mansionToggleBtn')?.addEventListener('click',async()=>{const b=$('#mansionToggleBtn');b.disabled=true;try{const x=await api('/api/mansion/toggle',{method:'POST',headers:authHeaders(),body:'{}'});$('#mansionMsg').textContent=x.message+(x.gain?` · Đã nhận +${Number(x.gain).toLocaleString('vi-VN')} linh lực.`:'');await Promise.all([loadProfile(),loadMansion()]);}catch(e){$('#mansionMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.mansion-buy').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/mansion/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#mansionMsg').textContent='🏯 '+x.message;await Promise.all([loadProfile(),loadMansion()]);}catch(e){$('#mansionMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Động Phủ</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadMansion()">↻ Thử lại</button></div>`;}
}

async function loadAchievements(){
 try{const d=await api('/api/achievements',{headers:authHeaders()});$('#achievementList')?.replaceChildren(...d.rows.map(a=>{const el=document.createElement('div');el.className='achievement-item';el.innerHTML=`<span>✦</span><div><b>${esc(a.title)}</b><small>${esc(a.description)}</small></div><strong>+${a.points}</strong>`;return el;}));}
 catch{}
}


async function loadTreasure(){
 try{
  const d=await api('/api/treasury',{headers:authHeaders()});
  const area=$('#treasureArea'); if(!area)return;
  const realmNames=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
  const currentRealmIndex=realmNames.indexOf(String(d.realm||''));
  area.innerHTML=`<div class="treasure-wallet"><span>☯ Linh lực hiện có · 💎 Linh thạch</span><strong>${Number(d.spiritPower).toLocaleString('vi-VN')} · ${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong><small>${esc(d.realm)} · ${esc(d.tierName||(`Tầng ${d.tier}/9`))} · 100 linh lực = 1 linh thạch</small></div>
  <div class="stone-exchange"><div><span class="eyebrow">🏯 TÀNG BẢO CÁC 2.1</span><h3>Pháp khí · Đan dược · Dược Phường · Linh vật trong cùng một kho</h3><p>Toàn bộ vật phẩm của Dược Đường đã được tích hợp vào Tàng Bảo Các. Mua xong vật phẩm chuyển thẳng vào Tu Di Giới; đan dược có thể dùng trực tiếp, thức ăn/Khôi Lỗi/trang bị linh thú dùng tại Dưỡng Thú.</p></div><span class="tag">☯ Giao dịch thống nhất</span></div>
  <div class="stone-exchange-box"><div><b>🔄 Đổi linh lực → linh thạch</b><small>100 linh lực = 1 linh thạch</small></div><input id="exchangeStonesQty" type="number" min="1" max="100000" value="10"><button id="exchangeStonesBtn" class="btn small primary">Đổi linh thạch</button></div>
  <div class="treasure-grid">${d.items.map(i=>{
    const stones=Number(d.spiritStones||0), price=Number(i.price||0), owned=Number(i.quantity||0);
    const requiredRealmIndex=Number(i.min_realm)||0;
    const locked=currentRealmIndex<requiredRealmIndex;
    const can= !locked && stones>=price;
    const isDuoc=String(i.category||'').startsWith('Dược Đường');
    const isFood=i.category==='Dược Đường · Linh thú thức ăn';
    const isPuppet=Boolean(i.is_khoi_loi);
    const isGear=Boolean(i.beast_gear_slot);
    const icon=isFood?'🍖':isPuppet?'🪆':isGear?'🛡️':i.category==='Đan dược'?'◈':i.category==='Linh thú'?'🐉':'⚔';
    const text=locked?'🔒 Cần '+esc(realmNames[requiredRealmIndex]||'cảnh giới cao hơn'):can?'💎 Mua':'Thiếu '+Number(Math.max(0,price-stones)).toLocaleString('vi-VN')+' linh thạch';
    const use=owned>0 && Number(i.spirit_gain||0)>0 ? `<button class="btn small treasure-use-item" data-id="${i.id}">Hấp thụ số lượng</button>` : '';
    const beastAction=owned>0 && (isFood||isPuppet||isGear) ? `<button class="btn small treasure-open-beast" type="button">🐉 Dùng tại Dưỡng Thú</button>` : '';
    return `<article class="treasure-card ${locked?'locked':''} ${isDuoc?'treasure-duoc-card':''}"><span class="item-seal">${icon}</span><div><span class="eyebrow">${esc(isDuoc?i.category.replace('Dược Đường · ','💊 '):i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p>${i.beast_food_gain?`<small>🐉 +${Number(i.beast_food_gain)} linh lực linh thú · 💗 +${Number(i.beast_joy_gain||0)} niềm vui</small>`:''}${isPuppet?`<small>🪆 Khôi Lỗi · +${Number(i.beast_joy_gain||0)} niềm vui</small>`:''}${isGear?`<small>⚔ +${Number(i.beast_gear_power||0)} linh thú · yêu cầu ${esc(realmNames[Number(i.beast_gear_min_realm)]||'cảnh giới cao hơn')}</small>`:''}<small>Đang có: ${owned} · Giá: 💎 ${price.toLocaleString('vi-VN')} linh thạch</small><div class="duoc-buy"><input class="treasure-qty" data-id="${i.id}" type="number" min="1" max="150" value="1" ${locked?'disabled':''}><button class="btn small primary buy-item" data-id="${i.id}" ${locked||!can?'disabled':''}>${text}</button>${use}${beastAction}</div></div></article>`;
  }).join('')}</div><p id="treasureMsg" class="train-msg"></p>`;
  $('#exchangeStonesBtn').onclick=async()=>{const b=$('#exchangeStonesBtn');const qty=Number($('#exchangeStonesQty').value||0);b.disabled=true;try{const x=await api('/api/currency/exchange',{method:'POST',headers:authHeaders(),body:JSON.stringify({stones:qty})});$('#treasureMsg').textContent=`🔄 Đã đổi ${Number(x.spentSpirit).toLocaleString('vi-VN')} linh lực → ${Number(x.receivedStones).toLocaleString('vi-VN')} linh thạch.`;await Promise.all([loadProfile(),loadTreasure()]);}catch(e){$('#treasureMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}};
  document.querySelectorAll('.buy-item').forEach(b=>b.onclick=async()=>{b.disabled=true;const q=Math.max(1,Math.min(99,Number(document.querySelector(`.treasure-qty[data-id="${b.dataset.id}"]`)?.value||1)));try{const x=await api('/api/treasury/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:q})});$('#treasureMsg').textContent=`✅ ${x.message||('Đã mua '+x.item)} · Trừ ${Number(x.spentStones||0).toLocaleString('vi-VN')} linh thạch.`;await Promise.all([loadProfile(),loadTreasure(),loadTuDi(),loadDuongThu()]);}catch(e){$('#treasureMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.treasure-use-item').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const q=Math.max(1,Math.min(99,Number(document.querySelector(`.treasure-qty[data-id="${b.dataset.id}"]`)?.value||1)));const x=await api('/api/storage/use',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:q})});$('#treasureMsg').textContent=`✨ Đã dùng ${x.item}, +${Number(x.gained).toLocaleString('vi-VN')} linh lực.`;await Promise.all([loadProfile(),loadTreasure(),loadTuDi()]);}catch(e){$('#treasureMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}});
  document.querySelectorAll('.treasure-open-beast').forEach(b=>b.onclick=()=>document.getElementById('duong-thu')?.scrollIntoView({behavior:'smooth',block:'start'}));
 }catch(e){const area=$('#treasureArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadEquipment(){
 const area=$('#equipmentArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/equipment',{headers:authHeaders()}); const e=d.equipped||{}, techniques=d.techniques||[], immortalTechniques=d.immortalTechniques||[];
  const slot=(type,title,icon,obj)=>`<article class="equipment-slot ${obj?'equipped':''}">${obj?`<div class="slot-avatar">${avatarHtml(obj.avatar)}</div>`:''}<span class="eyebrow">${icon} ${title}</span>${obj?`<h3>${esc(obj.name)}</h3><p>Chiến lực +${Number(obj.power||0).toLocaleString('vi-VN')}</p><small>${esc(obj.ability||'Không có công năng riêng.')}</small><div class="equipment-actions"><button class="btn small" data-unequip="${type}">Tháo</button></div>`:`<h3>Chưa trang bị</h3><p>Chọn vật phẩm trong Tu Di Giới để trang bị.</p>`}</article>`;
  const beastCards=(d.beasts||[]).map(x=>`<article class="equipment-item item-avatar-picker"><div class="equipment-item-head"><div class="item-avatar">${beastAvatarHtml(x.avatar||x.default_avatar,x.beast_realm_tier,'',x.name)}</div><div><span class="eyebrow">🐉 ${esc(x.rarity)} · ${esc(x.beast_realm)} ${x.beast_realm_tier}</span></div></div><label class="item-avatar-upload">🖼 Đổi ảnh<input class="item-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-type="beast" data-id="${x.beast_id}"></label><h3>${esc(x.name)} ×${x.quantity}</h3><p>⚔ ${x.attack} · 🛡 ${x.defense} · 💨 ${x.speed} · ☯ ${x.spirit}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||x.skill||'—')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="beast" data-equip-id="${x.beast_id}">Trang bị</button></div></article>`).join('');
  const rootCards=(d.roots||[]).map(x=>`<article class="equipment-item"><span class="eyebrow">🌿 ${esc(x.rarity)}</span><h3>${esc(x.name)} ×${x.quantity}</h3><p>${esc(x.support)}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||'—')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="root" data-equip-id="${x.root_id}">Trang bị</button></div></article>`).join('');
  const artifactCards=(d.artifacts||[]).map(x=>`<article class="equipment-item item-avatar-picker"><div class="equipment-item-head"><div class="item-avatar">${avatarHtml(x.avatar||x.default_avatar)}</div><div><span class="eyebrow">⚔ ${esc(x.category)} · ×${x.quantity}</span></div></div><label class="item-avatar-upload">🖼 Đổi ảnh<input class="item-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-type="artifact" data-id="${x.id}"></label><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||'Không có công năng riêng.')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="artifact" data-equip-id="${x.id}">Trang bị</button></div></article>`).join('');
  const power=Number(e.equipment_power||0);
  const combat=Number(currentProfile?.attributes?.combatPower||0);
  const equippedTechnique=techniques.find(x=>x.equipped);
  const techniquePanel=`<div class="equipment-technique-panel item-avatar-picker"><div class="item-avatar">${avatarHtml(equippedTechnique?.avatar)}</div><div><span class="eyebrow">📚 CÔNG PHÁP TRANG BỊ</span><h3>${equippedTechnique?esc(equippedTechnique.name):'Chưa trang bị công pháp'}</h3><small>${equippedTechnique?`${esc(equippedTechnique.grade)} · ⚔ +${Number(equippedTechnique.power_bonus||0).toLocaleString('vi-VN')} · ${esc(equippedTechnique.ability||'')}`:'Chọn một công pháp đã học để làm công pháp đang sử dụng.'}</small></div><div class="technique-equip-row">${equippedTechnique?`<label class="item-avatar-upload">🖼 Đổi ảnh<input class="item-avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-type="technique" data-id="${equippedTechnique.id}"></label>`:''}<select id="equippedTechniqueSelect"><option value="0">— Chọn công pháp —</option>${techniques.map(x=>`<option value="${x.id}" ${x.equipped?'selected':''}>${esc(x.name)} · ${esc(x.grade)}</option>`).join('')}</select><button class="btn small primary" id="equipTechniqueBtn">📚 Đổi công pháp</button>${equippedTechnique?'<button class="btn small ghost" id="unequipTechniqueBtn">Tháo</button>':''}</div></div>`;
  area.innerHTML=`<div class="equipment-power"><div><span class="eyebrow">⚔ CHIẾN LỰC HIỆN TẠI</span><p>Chiến lực đã bao gồm Linh Thú + Linh Căn + Pháp Khí đang trang bị.</p><small>Trang bị cộng thêm: +${power.toLocaleString('vi-VN')}</small></div><strong>${combat.toLocaleString('vi-VN')}</strong></div><div class="equipment-slots">${slot('beast','Linh Thú','🐉',e.beast)}${slot('root','Linh Căn','🌿',e.root)}${slot('artifact','Pháp Khí','⚔',e.artifact)}</div><div class="equipment-immortal-panel"><div class="equipment-power"><div><span class="eyebrow">🌌 TIÊN PHÁP TRANG BỊ</span><p>${e.equipped_immortal_technique_id&&immortalTechniques.find(x=>Number(x.id)===Number(e.equipped_immortal_technique_id))?`Đang dùng: ${esc(immortalTechniques.find(x=>Number(x.id)===Number(e.equipped_immortal_technique_id)).name)}`:'Chưa trang bị Tiên Pháp'}</p></div><select id="equippedImmortalSelect"><option value="0">— Chọn Tiên Pháp —</option>${immortalTechniques.map(x=>`<option value="${x.id}" ${x.equipped?'selected':''}>${esc(x.name)} · ${esc(x.grade)}</option>`).join('')}</select><button class="btn small primary" id="equipImmortalBtn">🌌 Trang bị Tiên Pháp</button>${immortalTechniques.some(x=>x.equipped)?'<button class="btn small ghost" id="unequipImmortalBtn">Tháo</button>':''}</div></div>${techniquePanel}<div><div class="friend-subtitle">📦 Linh Thú trong Tu Di Giới</div><div class="equipment-list">${beastCards||'<div class="equipment-empty">Chưa có Linh Thú.</div>'}</div></div><div><div class="friend-subtitle">📦 Linh Căn trong Tu Di Giới</div><div class="equipment-list">${rootCards||'<div class="equipment-empty">Chưa có Linh Căn.</div>'}</div></div><div><div class="friend-subtitle">📦 Pháp Khí trong Tu Di Giới</div><div class="equipment-list">${artifactCards||'<div class="equipment-empty">Chưa có Pháp Khí/Pháp Bảo.</div>'}</div></div><p id="equipmentMsg" class="train-msg"></p>`;
  $('#equipImmortalBtn')?.addEventListener('click',async()=>{const id=Number($('#equippedImmortalSelect')?.value||0);if(!id){$('#equipmentMsg').textContent='❌ Hãy chọn Tiên Pháp.';return;}try{const x=await api('/api/equipment/equip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:'immortal',id})});$('#equipmentMsg').textContent='✅ '+x.message;await Promise.all([loadEquipment(),loadProfile()]);}catch(err){$('#equipmentMsg').textContent='❌ '+err.message;}});
  $('#unequipImmortalBtn')?.addEventListener('click',async()=>{try{await api('/api/equipment/unequip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:'immortal'})});$('#equipmentMsg').textContent='✅ Đã tháo Tiên Pháp.';await Promise.all([loadEquipment(),loadProfile()]);}catch(err){$('#equipmentMsg').textContent='❌ '+err.message;}});
  document.querySelectorAll('[data-equip-type]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/equipment/equip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:b.dataset.equipType,id:Number(b.dataset.equipId)})});$('#equipmentMsg').textContent=`✅ ${x.message}`;await loadProfile();}catch(err){const m=$('#equipmentMsg');if(m)m.textContent='❌ '+err.message;b.disabled=false;}});
  document.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/equipment/unequip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:b.dataset.unequip})});$('#equipmentMsg').textContent='✅ Đã tháo trang bị.';await loadProfile();await loadEquipment();}catch(err){const m=$('#equipmentMsg');if(m)m.textContent='❌ '+err.message;b.disabled=false;}});
  const et=$('#equipTechniqueBtn'); if(et)et.onclick=async()=>{const id=Number($('#equippedTechniqueSelect')?.value||0);if(!id){$('#equipmentMsg').textContent='❌ Hãy chọn công pháp.';return;}et.disabled=true;try{const x=await api('/api/techniques/equip',{method:'POST',headers:authHeaders(),body:JSON.stringify({techniqueId:id})});$('#equipmentMsg').textContent='✅ '+x.message;await loadProfile();await loadEquipment();}catch(err){$('#equipmentMsg').textContent='❌ '+err.message;et.disabled=false;}};
  const ut=$('#unequipTechniqueBtn'); if(ut)ut.onclick=async()=>{ut.disabled=true;try{const x=await api('/api/techniques/unequip',{method:'POST',headers:authHeaders(),body:'{}'});$('#equipmentMsg').textContent='✅ '+x.message;await loadProfile();await loadEquipment();}catch(err){$('#equipmentMsg').textContent='❌ '+err.message;ut.disabled=false;}};
  bindItemAvatarPickers(loadEquipment);
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Trang Bị</h3><p>${esc(e.message)}</p><button class="btn small primary" id="retryEquipmentBtn">↻ Thử lại</button></div>`;$('#retryEquipmentBtn').onclick=loadEquipment;}
}

async function loadTuDi(){
 try{
  const d=await api('/api/storage',{headers:authHeaders()});
  const area=$('#sumeruArea'); if(!area)return;
  const rows=d.rows||[], beasts=d.beasts||[], roots=d.roots||[];
  area.innerHTML=`<div class="treasure-wallet"><span>◈ TU DI GIỚI 2.0 · Kho cá nhân</span><strong>${d.used}/${d.capacity} · Mỗi loại tối đa 150</strong><small>🌿 ${esc(d.spiritRoot||'—')} · 🐉 ${esc(d.spiritBeast||'—')}</small></div>
  <div class="enhance-panel"><div><span class="eyebrow">📦 QUẢN LÝ KHO</span><h3>Dùng vật phẩm & mở rộng dung lượng</h3><p>Đan dược có linh lực có thể sử dụng trực tiếp. Nâng 5 ô bằng 100 linh thạch, tối đa 100 ô.</p></div><div class="hero-actions"><button id="storageUpgradeBtn" class="btn primary">＋5 ô · 100 linh thạch</button></div><div id="storageMsg" class="train-msg"></div></div>
  <div class="equipment-list"><div class="equipment-item"><span class="eyebrow">🐉 LINH THÚ · ĐÃ NHẬN</span><h3>${beasts.length?beasts.map(x=>`${esc(x.name)} ×${x.quantity}`).join(' · '):'Chưa có'}</h3><p>Linh Thú được lưu trong Tu Di Giới và chỉ cộng chiến lực khi trang bị.</p></div><div class="equipment-item"><span class="eyebrow">🌿 LINH CĂN · ĐÃ NHẬN</span><h3>${roots.length?roots.map(x=>`${esc(x.name)} ×${x.quantity}`).join(' · '):'Chưa có'}</h3><p>Linh Căn được lưu trong Tu Di Giới và chỉ phát huy công năng khi trang bị.</p></div></div>
  <div class="inventory-grid">${rows.length?rows.map(i=>{
    const isTavern=String(i.category||'').startsWith('Tửu Lâu · Túy Phẩm');
    const usable=Number(i.spirit_gain||0)>0||isTavern;
    return `<article class="inventory-card"><span class="item-seal">${i.category==='Đan dược'?'◈':'⚔'}</span><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><b>Số lượng: ${Number(i.quantity||0)}</b>${usable?`<div class="inventory-use-row"><input class="storage-qty" data-id="${i.id}" type="number" min="1" max="150" value="1"><button class="btn small primary use-item" data-id="${i.id}">${isTavern?'🍶 Hấp thu · Buff ngẫu nhiên':'Hấp thụ số lượng'}</button></div>`:''}</div></article>`;
  }).join(''):`<div class="empty-state compact"><h3>Tu Di Giới đang trống</h3><p>Vật phẩm mua tại Tàng Bảo Các, nhận từ Nhiệm Vụ Đường hoặc giao dịch ở Phường Thị sẽ được lưu tại đây.</p></div>`}</div>`;
  $('#storageUpgradeBtn').onclick=async()=>{
    const b=$('#storageUpgradeBtn');b.disabled=true;
    try{const x=await api('/api/storage/upgrade',{method:'POST',headers:authHeaders(),body:'{}'});$('#storageMsg').textContent=`✅ Tu Di Giới đã tăng lên ${x.capacity} ô. Còn ${Number(x.spiritStones).toLocaleString('vi-VN')} linh thạch.`;await loadTuDi();await loadProfile();}
    catch(e){$('#storageMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}
  };
  document.querySelectorAll('.use-item').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{const x=await api('/api/storage/use',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:Math.max(1,Math.min(99,Number(document.querySelector(`.storage-qty[data-id=\"${b.dataset.id}\"]`)?.value||1)))})});$('#storageMsg').textContent=`✨ Đã dùng ${x.item}, +${Number(x.gained).toLocaleString('vi-VN')} linh lực${x.buffText||''}.`;await loadProfile();await loadTuDi();}
    catch(e){$('#storageMsg').textContent='❌ '+e.message;b.disabled=false;}
  });
 }catch(e){const area=$('#sumeruArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}


/* v3.6.76 · Venue roles: quyền chức vị dùng chung cho Chợ Đen/Đan Đường */
async function loadVenueRole(venue){
  return api('/api/venue-role/'+encodeURIComponent(venue),{headers:authHeaders()});
}
function venueRolePanel(role){
  if(!role) return '';
  const meta=role.meta||{};
  const owner=role.owner;
  const isBlack=role.venue==='black-market';
  if(!owner){
    return `<div class="venue-role-panel venue-role-open ${isBlack?'venue-black-aura':''}">
      <div class="venue-role-emblem">${meta.icon||'◈'}</div>
      <div><span class="eyebrow">${esc(meta.roleName||'Chức vị')}</span><h3>Chưa có người giữ chức</h3>
      <p>Môn nhân ứng chức sớm nhất sẽ nhận vị trí duy nhất này.</p></div>
      <button class="btn primary venue-apply-btn" data-venue="${esc(role.venue)}">⚜️ Ứng chức</button>
      <span class="venue-role-msg" data-venue-msg="${esc(role.venue)}"></span>
    </div>`;
  }
  const members=role.members||[];
  return `<div class="venue-role-panel ${isBlack?'venue-black-aura':''}">
    <div class="venue-role-emblem">${meta.icon||'◈'}</div>
    <div class="venue-role-main">
      <span class="eyebrow">${esc(meta.roleName||'Chức vị')}</span>
      <h3>${isBlack?'<span class="black-master-aura">🕶️</span>':''}${esc(owner.display_name)} <small>@${esc(owner.username)}</small></h3>
      <p>${isBlack?'Chủ Chợ Đen · nhận 20% giá trị linh thạch mỗi lần thu mua thành công.':'Chức vị duy nhất của Đan Đường.'}</p>
    </div>
    ${role.me?`<div class="venue-transfer-box">
      <select class="venue-transfer-target" data-venue="${esc(role.venue)}">
        <option value="">Chọn môn nhân để nhường vị</option>
        ${members.map(m=>`<option value="${m.id}">${esc(m.display_name)} · @${esc(m.username)}</option>`).join('')}
      </select>
      <button class="btn small ghost venue-transfer-btn" data-venue="${esc(role.venue)}">Nhường vị</button>
      <span class="venue-role-msg" data-venue-msg="${esc(role.venue)}"></span>
    </div>`:''}
  </div>`;
}
async function fillVenueTransferTargets(){
  /* Target lists are rendered from the role response; kept as a compatibility hook. */
}

async function loadBlackMarket(){
 const area=$('#blackMarketArea'); if(!area||!getToken())return;
 try{
  const [d,role]=await Promise.all([api('/api/black-market',{headers:authHeaders()}),loadVenueRole('black-market')]);
  const roots=d.roots||[], beasts=d.beasts||[];
  const card=(x,type)=>{const sellable=Math.max(0,Number(x.sellable_quantity??x.quantity??0));const locked=Number(x.non_sellable_quantity||0)>0;return `<article class="market-card black-market-card ${sellable<=0?'locked':''}"><div><span class="eyebrow">${type==='root'?'🌿 LINH CĂN':'🐉 LINH THÚ'} · ${esc(x.rarity||x.beast_realm||'')}</span><h3>${esc(x.name)} ×${Number(x.quantity||0)}</h3><p>${esc(x.description||x.support||x.ability||'')}</p><small>${locked?`🔒 Gieo Duyên khóa bán ${Number(x.non_sellable_quantity)} · Có thể bán ${sellable}`:'🟢 Có thể bán'} · 💎 Giá thu mua: <b>${Number(x.sell_price||0).toLocaleString('vi-VN')}</b> linh thạch / 1</small></div><div class="market-black-actions"><input class="black-qty" data-id="${x.id}" data-type="${type}" type="number" min="1" max="${Math.max(1,sellable)}" value="1" ${sellable<=0?'disabled':''}><button class="btn small primary black-sell" data-id="${x.id}" data-type="${type}" ${sellable<=0?'disabled':''}>${sellable<=0?'🔒 Không thể bán':'Bán cho Chợ Đen'}</button></div></article>`};
  area.innerHTML=`${venueRolePanel(role)}<div class="stone-exchange"><div><span class="eyebrow">🕶️ GIAO DỊCH KÍN</span><h3>Chợ Đen thu mua trực tiếp</h3><p>Toàn bộ môn nhân đều có thể giao dịch. Chợ Đen Chi Chủ, nếu có, nhận 20% giá trị linh thạch của mỗi lần thu mua thành công.</p></div><span class="tag">💎 TRẢ LINH THẠCH NGAY</span></div><div class="market-section"><div class="section-head"><div><span class="eyebrow">🌿 LINH CĂN</span><h3>Danh sách có thể bán</h3></div></div><div class="market-listings">${roots.length?roots.map(x=>card(x,'root')).join(''):'<div class="empty-state compact"><p>Không có Linh Căn để bán.</p></div>'}</div></div><div class="market-section"><div class="section-head"><div><span class="eyebrow">🐉 LINH THÚ</span><h3>Danh sách có thể bán</h3></div></div><div class="market-listings">${beasts.length?beasts.map(x=>card(x,'beast')).join(''):'<div class="empty-state compact"><p>Không có Linh Thú để bán.</p></div>'}</div></div><p id="blackMarketMsg" class="train-msg"></p>`;
  await fillVenueTransferTargets();
  document.querySelectorAll('.black-sell').forEach(b=>b.onclick=async()=>{b.disabled=true;const q=document.querySelector(`.black-qty[data-id="${b.dataset.id}"][data-type="${b.dataset.type}"]`);try{const x=await api('/api/black-market/sell',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id),type:b.dataset.type,quantity:Number(q?.value||1)})});$('#blackMarketMsg').textContent=`🕶️ ${x.message}`;await Promise.all([loadProfile(),loadBlackMarket(),loadTuDi(),loadEquipment()]);}catch(e){$('#blackMarketMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.venue-apply-btn').forEach(b=>b.onclick=async()=>{b.disabled=true;const msg=document.querySelector(`[data-venue-msg="${b.dataset.venue}"]`);try{const x=await api('/api/venue-role/'+b.dataset.venue+'/apply',{method:'POST',headers:authHeaders(),body:'{}'});if(msg)msg.textContent='✓ '+x.message;await loadBlackMarket();}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.venue-transfer-btn').forEach(b=>b.onclick=async()=>{const sel=document.querySelector(`.venue-transfer-target[data-venue="${b.dataset.venue}"]`),target=Number(sel?.value||0),msg=document.querySelector(`[data-venue-msg="${b.dataset.venue}"]`);if(!target){if(msg)msg.textContent='❌ Hãy chọn môn nhân nhận chức.';return;}if(!confirm('Xác nhận nhường vị trí?'))return;b.disabled=true;try{const x=await api('/api/venue-role/'+b.dataset.venue+'/transfer',{method:'POST',headers:authHeaders(),body:JSON.stringify({targetId:target})});if(msg)msg.textContent='✓ '+x.message;await loadBlackMarket();await loadProfile();}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>🕶️ Không thể mở Chợ Đen</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadBlackMarket()">↻ Mở lại</button></div>`;}
}

async function loadMarket(){
 try{
  const d=await api('/api/market',{headers:authHeaders()});
  const area=$('#marketArea');if(!area)return;
  const inv=d.inventory||[], catalog=d.catalog||[], users=d.users||[], listings=d.listings||[], trades=d.trades||[];
  area.innerHTML=`<div class="stone-exchange"><div><span class="eyebrow">🏮 PHƯỜNG THỊ · 坊市</span><h3>Mua bán & trao đổi giữa môn nhân</h3><p>Vật phẩm đưa lên chợ được tạm giữ an toàn. Bán dùng <b>linh thạch</b>; trao đổi là đổi vật phẩm trực tiếp.</p></div><span class="tag">⚖ Giao dịch 2 chiều</span></div>
  <div class="market-panels">
   <div class="enhance-panel"><span class="eyebrow">🏷 ĐĂNG BÁN</span><h3>Đưa vật phẩm ra Phường Thị</h3>
    <div class="market-form"><select id="marketSellItem">${inv.map(i=>`<option value="${i.id}">${esc(i.name)} · đang có ${i.quantity}</option>`).join('')}</select><input id="marketSellQty" type="number" min="1" value="1" placeholder="Số lượng"><input id="marketSellPrice" type="number" min="1" value="10" placeholder="Giá linh thạch"><button id="marketSellBtn" class="btn primary">Đăng bán</button></div>
   </div>
   <div class="enhance-panel"><span class="eyebrow">🤝 TRAO ĐỔI</span><h3>Gửi đề nghị đổi vật phẩm</h3>
    <div class="market-form"><select id="marketTradeUser">${users.map(u=>`<option value="${u.id}">${esc(u.display_name)}</option>`).join('')}</select><select id="marketOfferItem">${inv.map(i=>`<option value="${i.id}">${esc(i.name)} · ${i.quantity}</option>`).join('')}</select><input id="marketOfferQty" type="number" min="1" value="1"><select id="marketWantItem">${catalog.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('')}</select><input id="marketWantQty" type="number" min="1" value="1"><button id="marketTradeBtn" class="btn primary">Gửi đề nghị</button></div>
   </div>
  </div>
  <div class="market-section"><div class="section-head"><div><span class="eyebrow">🛒 SÀN GIAO DỊCH</span><h3>Vật phẩm đang được bán</h3></div></div><div class="market-listings">${listings.length?listings.map(l=>`<article class="market-card"><div><span class="eyebrow">${esc(l.category)} · ${esc(l.seller_name)}</span><h3>${esc(l.item_name)} ×${l.quantity}</h3><p>${esc(l.description)}</p><small>Giá cả lô: ☯ ${Number(l.price_stones).toLocaleString('vi-VN')} linh thạch</small></div><button class="btn small primary market-buy" data-id="${l.id}">Mua</button>${Number(l.seller_id)===Number(currentUser?.id)?`<button class="btn small ghost market-cancel" data-id="${l.id}">Hủy</button>`:''}</article>`).join(''):`<div class="empty-state compact"><p>Chưa có vật phẩm nào được rao bán.</p></div>`}</div></div>
  <div class="market-section"><div class="section-head"><div><span class="eyebrow">🤝 ĐỀ NGHỊ TRAO ĐỔI</span><h3>Đang chờ xử lý</h3></div></div><div class="market-listings">${trades.length?trades.map(t=>{const incoming=Number(t.recipient_id)===Number(currentUser?.id);return `<article class="market-card"><div><span class="eyebrow">${incoming?'Từ':'Gửi tới'} ${esc(incoming?t.proposer_name:t.recipient_name)}</span><h3>${esc(t.offer_item_name)} ×${t.offer_quantity} ⇄ ${esc(t.want_item_name)} ×${t.want_quantity}</h3><small>${incoming?'Bạn có thể chấp nhận nếu đủ vật phẩm yêu cầu.':'Vật phẩm đề nghị đang được giữ trong giao dịch.'}</small></div>${incoming?`<button class="btn small primary market-trade-accept" data-id="${t.id}">Chấp nhận</button><button class="btn small ghost market-trade-reject" data-id="${t.id}">Từ chối</button>`:`<button class="btn small ghost market-trade-cancel" data-id="${t.id}">Hủy đề nghị</button>`}</article>`}).join(''):`<div class="empty-state compact"><p>Không có đề nghị trao đổi đang chờ.</p></div>`}</div></div>
  <p id="marketMsg" class="train-msg"></p>`;
  $('#marketSellBtn').onclick=async()=>{try{await api('/api/market/list',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number($('#marketSellItem').value),quantity:Number($('#marketSellQty').value),priceStones:Number($('#marketSellPrice').value)})});$('#marketMsg').textContent='✅ Đã đăng bán. Vật phẩm đã được giữ an toàn trên sàn.';await loadMarket();await loadTuDi();}catch(e){$('#marketMsg').textContent='❌ '+e.message;}};
  $('#marketTradeBtn').onclick=async()=>{try{await api('/api/market/trade',{method:'POST',headers:authHeaders(),body:JSON.stringify({recipientId:Number($('#marketTradeUser').value),offerItemId:Number($('#marketOfferItem').value),offerQuantity:Number($('#marketOfferQty').value),wantItemId:Number($('#marketWantItem').value),wantQuantity:Number($('#marketWantQty').value)})});$('#marketMsg').textContent='🤝 Đã gửi đề nghị trao đổi.';await loadMarket();await loadTuDi();}catch(e){$('#marketMsg').textContent='❌ '+e.message;}};
  document.querySelectorAll('.market-buy').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/market/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({listingId:Number(b.dataset.id)})});$('#marketMsg').textContent=`✅ Đã mua ${x.item} ×${x.quantity}. Trừ ${Number(x.price).toLocaleString('vi-VN')} linh thạch.`;await loadMarket();await loadTuDi();await loadProfile();}catch(e){$('#marketMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.market-cancel').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/market/cancel',{method:'POST',headers:authHeaders(),body:JSON.stringify({listingId:Number(b.dataset.id)})});await loadMarket();await loadTuDi();}catch(e){$('#marketMsg').textContent='❌ '+e.message;b.disabled=false;}});
  const respond=async(id,action)=>{try{await api('/api/market/trade/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({tradeId:Number(id),action})});$('#marketMsg').textContent='✅ Đã xử lý đề nghị trao đổi.';await loadMarket();await loadTuDi();}catch(e){$('#marketMsg').textContent='❌ '+e.message;}};
  document.querySelectorAll('.market-trade-accept').forEach(b=>b.onclick=()=>respond(b.dataset.id,'accept'));
  document.querySelectorAll('.market-trade-reject').forEach(b=>b.onclick=()=>respond(b.dataset.id,'reject'));
  document.querySelectorAll('.market-trade-cancel').forEach(b=>b.onclick=()=>respond(b.dataset.id,'cancel'));
 }catch(e){const area=$('#marketArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadBicanh(){
 const area=$('#bicanhArea'); if(!area||!getToken())return;
 try{
  const [d,h]=await Promise.all([api('/api/bicanh',{headers:authHeaders()}),api('/api/bicanh/history',{headers:authHeaders()})]);
  const realms=d.realms||[], me=d.me||{}, friends=d.friends||[], invites=d.invites||[];
  const debuffActive=me.secret_realm_debuff_until&&new Date(me.secret_realm_debuff_until)>new Date();
  const realmNames=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
  const currentIndex=Math.max(0,Number(me.realmIndex||0));
  const selectedRealm=realms.find(r=>Number(r.required_realm_index)===currentIndex)||realms[0];
  const selector=realms.map(r=>{const idx=Number(r.required_realm_index);const high=idx>currentIndex;const low=idx<currentIndex;return `<option value="${idx}" ${idx===currentIndex?'selected':''} ${high?'disabled':''}>${esc(r.required_realm_name)} — ${esc(r.name)}${high?' 🔒 cảnh giới chưa đủ':low?' ⚠️ thấp hơn · nguy cơ '+Number(r.break_chance||0)+'%':''}</option>`;}).join('');
  const friendOptions=()=>`<option value="">Chọn Bằng Hữu để mời...</option>`+friends.map(f=>`<option value="${Number(f.id)}">${esc(f.display_name)} · ${esc(f.rank||'Đệ tử')}</option>`).join('');
  const cards=realms.map((r,i)=>{
   const eligible=currentIndex>=Number(r.required_realm_index);
   const active=r.status==='active'; const joined=Boolean(r.joined); const count=Number(r.participant_count||0); const canJoin=Boolean(r.canJoin); const canEnter=Boolean(r.canEnter);
   const locked=!eligible;
   const participantNames=(r.participants||[]).map(x=>`<span class="tag">${esc(x.display_name)}${Number(x.user_id)===Number(currentUser?.id)?' · Bạn':''}</span>`).join('');
   let action='';
   if(locked) action=`<button class="btn small" disabled>🔒 Cần từ ${esc(r.required_realm_name)}</button>`;
   else if(!active) action=`<button class="btn small" disabled>⛔ Chưa mở</button>`;
   else action=`<div class="bicanh-party-actions"><button class="btn small ${joined?'ghost':'primary'} bicanh-join" data-id="${r.id}" ${joined?'disabled':''}>${joined?'✓ Đã tham gia':'⚔ Tham gia'}</button>${joined?`<button class="btn small ghost bicanh-leave" data-id="${r.id}">Rời hàng chờ</button>`:''}${canEnter?`<button class="btn small primary bicanh-enter" data-id="${r.id}">🌌 Tiến vào Bí Cảnh</button>`:`<span class="tag">Cần ${Math.max(0,2-count)}/2 người nữa</span>`}</div>`;
   return `<article class="bicanh-card ${locked?'locked':''} ${active?'active':''}" data-realm-index="${Number(r.required_realm_index)}">
    <div class="bicanh-card-top"><span class="bicanh-rank">${i===0?'🌿':i===1?'❄️':i===2?'🟡':i<5?'🔵':i<7?'🟣':'🔴'}</span><div><span class="eyebrow">${esc(r.required_realm_name)} · Bí Cảnh đối xứng</span><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p></div><span class="bicanh-status">${active?'🟢 ĐANG MỞ':'🔴 TẠM ĐÓNG'}</span></div>
    <div class="bicanh-meta"><span>☠ Nguy hiểm <b>${Number(r.danger_percent)}%</b></span><span>☠ Debuff <b>${Number(r.debuff_percent)}%</b></span><span>🎁 Cấp thưởng <b>${Number(r.loot_tier)+1}</b></span><span>👥 Tham gia <b>${count}/2+</b></span>${Number(r.break_chance||0)>0?`<span>💥 Nguy cơ phá toái <b>${Number(r.break_chance)}%</b></span>`:'<span>🛡 Không có nguy cơ phá toái</span>'}</div>
    <div class="bicanh-party"><div class="friend-subtitle">👥 Đội thám hiểm</div>${participantNames||'<small>Chưa có môn nhân nào nhấn tham gia.</small>'}<p><b>Luật:</b> cần tối thiểu 2 môn nhân tham gia. Cảnh giới cao hơn được phép tiến vào Bí Cảnh thấp hơn, nhưng có nguy cơ <b>${Number(r.break_chance||0)}%</b> làm Bí Cảnh phá toái.</p></div>
    ${eligible?`<div class="bicanh-invite"><select class="bicanh-friend-select" data-id="${r.id}">${friendOptions()}</select><button class="btn small primary bicanh-invite-btn" data-id="${r.id}">📨 Mời Bằng Hữu</button></div>`:''}
    <div class="bicanh-actions">${action}</div>
   </article>`;
  }).join('');
  const history=(h.rows||[]).map(x=>`<div class="bicanh-history-row"><span>${x.outcome==='success'?'🏆':x.outcome==='broken'?'💥':'☠'}</span><div><b>${esc(x.realm_name)}</b><small>${esc(x.note||'')}</small></div><em>${new Date(x.created_at).toLocaleString('vi-VN')}</em></div>`).join('')||'<div class="empty-state compact"><p>Chưa có hành trình Bí Cảnh.</p></div>';
  const inviteBox=invites.length?`<div class="bicanh-invites"><div class="friend-subtitle">📨 LỜI MỜI BÍ CẢNH</div>${invites.map(x=>`<div class="friend-card"><span class="friend-avatar">${avatarHtml(x.inviter_avatar)}</span><div><b>${esc(x.inviter_name)}</b><small>Mời bạn vào ${esc(x.realm_name)} · ${esc(x.required_realm_name)}</small></div><button class="btn small primary bicanh-invite-accept" data-id="${x.id}">Tham gia</button><button class="btn small ghost bicanh-invite-reject" data-id="${x.id}">Từ chối</button></div>`).join('')}</div>`:'';
  area.innerHTML=`${debuffActive?`<div class="bicanh-debuff">☠ ${Number(me.secret_realm_debuff_percent)}% debuff Bí Cảnh · còn đến ${new Date(me.secret_realm_debuff_until).toLocaleString('vi-VN')}</div>`:''}<div class="bicanh-banner"><div><span class="eyebrow">🌌 CỬU ĐẠI BÍ CẢNH · ĐÃ KHỞI ĐỘNG</span><h3>Bí Cảnh đối xứng với cảnh giới</h3><p>Toàn bộ Cửu Đại Bí Cảnh đã mở sẵn. Môn nhân có thể vào Bí Cảnh đúng cảnh giới hoặc dùng cảnh giới cao hơn để tiến vào Bí Cảnh thấp hơn; chênh lệch càng lớn thì nguy cơ phá toái càng tăng. Không cần đóng góp linh thạch để mở cửa.</p></div><div class="bicanh-wallet"><span>💎 Linh thạch</span><strong>${Number(me.spirit_stones||0).toLocaleString('vi-VN')}</strong><small>${esc(me.stage||'Luyện Khí')}</small></div></div>${inviteBox}<div class="bicanh-selector"><div><span class="eyebrow">🎯 BÍ CẢNH ĐỐI XỨNG</span><h3>${esc(me.stage||realmNames[currentIndex])} → ${esc(selectedRealm?.name||'')}</h3><p>Có thể chọn Bí Cảnh thấp hơn cảnh giới hiện tại. Cảnh giới cao hơn sẽ chịu nguy cơ phá toái theo độ chênh cảnh giới.</p></div><select id="bicanhRealmSelect">${selector}</select><button class="btn primary" id="bicanhOpenChoices">🌌 Xem Cửu Đại Bí Cảnh</button></div><div id="bicanhChoices" class="bicanh-grid">${cards}</div><div class="bicanh-loot"><span class="eyebrow">🎁 CƠ DUYÊN CÓ THỂ NHẬN</span><div><span>🐉 Linh Thú</span><span>⚔ Pháp Khí</span><span>◈ Đan Dược / Vật phẩm</span><span>💎 Linh Thạch</span><span>☯ Linh lực bạo tăng</span></div></div><div class="bicanh-history"><div class="friend-subtitle">📜 HÀNH TRÌNH GẦN ĐÂY</div>${history}</div><p id="bicanhMsg" class="train-msg"></p>`;
  const openBtn=$('#bicanhOpenChoices'); if(openBtn) openBtn.onclick=()=>{const grid=$('#bicanhChoices');if(grid){grid.classList.toggle('collapsed');openBtn.textContent=grid.classList.contains('collapsed')?'🌌 Xem Cửu Đại Bí Cảnh':'🔽 Thu danh sách Bí Cảnh';}};
  const select=$('#bicanhRealmSelect'); if(select) select.onchange=()=>{const idx=Number(select.value);const target=document.querySelector(`.bicanh-card[data-realm-index="${idx}"]`);if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('bicanh-focus');setTimeout(()=>target.classList.remove('bicanh-focus'),1200);}};
  document.querySelectorAll('.bicanh-join').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/join',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id)})});$('#bicanhMsg').textContent='⚔ '+x.message;await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.bicanh-leave').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/leave',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id)})});$('#bicanhMsg').textContent='↩ '+x.message;await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.bicanh-invite-btn').forEach(btn=>btn.onclick=async()=>{const sel=document.querySelector(`.bicanh-friend-select[data-id="${btn.dataset.id}"]`);const friendId=Number(sel?.value||0);if(!friendId){$('#bicanhMsg').textContent='❌ Hãy chọn Bằng Hữu để mời.';return;}btn.disabled=true;try{const x=await api('/api/bicanh/invite',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id),friendId})});$('#bicanhMsg').textContent='📨 '+x.message;}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;}finally{btn.disabled=false;}});
  document.querySelectorAll('.bicanh-invite-accept').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({invitationId:Number(btn.dataset.id),action:'accept'})});$('#bicanhMsg').textContent='⚔ '+x.message;await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.bicanh-invite-reject').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({invitationId:Number(btn.dataset.id),action:'reject'})});$('#bicanhMsg').textContent='↩ '+x.message;await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.bicanh-enter').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/enter',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id)})});$('#bicanhMsg').textContent=x.outcome==='success'?`🏆 ${x.message}`:x.outcome==='broken'?`💥 ${x.message}`:`☠ ${x.message}`;await Promise.all([loadProfile(),loadBicanh()]);}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Bí Cảnh</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadBicanh()">↻ Thử lại</button></div>`;}
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

async function loadDanCac(){
 const area=$('#danCacArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/dan-cac',{headers:authHeaders()});
  const items=d.items||[];
  area.innerHTML=`<div class="treasure-wallet"><div><span>⚗️ ĐAN CÁC · THƯƠNG HỘI THU MUA</span><small>Bán vật phẩm trong Tu Di Giới để nhận linh thạch. Pháp khí đang trang bị không thể bán.</small></div><strong>💎 ${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong></div><div class="dan-cac-note"><span>📜 Giá thu mua</span><b>Được niêm yết riêng cho từng vật phẩm</b><small>Mặc định khoảng 45% giá Tàng Bảo Các, có thể thay đổi theo vật phẩm.</small></div><div class="dan-cac-grid">${items.length?items.map(x=>{const disabled=Boolean(x.equipped);return `<article class="dan-cac-card ${disabled?'locked':''}"><div class="dan-cac-icon">${x.category==='Đan dược'?'◈':x.category==='Linh thú'?'🐉':x.category==='Pháp bảo'?'⚔':'✦'}</div><div class="dan-cac-copy"><span class="eyebrow">${esc(x.category)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Đang có: <b>${Number(x.quantity||0).toLocaleString('vi-VN')}</b> · Thu mua: <b>💎 ${Number(x.buyback_price||0).toLocaleString('vi-VN')}/cái</b></small>${disabled?'<small class="dan-cac-locked">🔒 Đang trang bị</small>':''}</div><div class="dan-cac-actions"><input class="dan-cac-qty" data-id="${x.id}" type="number" min="1" max="${Number(x.quantity||1)}" value="1" ${disabled?'disabled':''}><button class="btn small primary dan-cac-sell" data-id="${x.id}" ${disabled?'disabled':''}>Bán vật phẩm</button></div></article>`}).join(''):`<div class="empty-state compact"><h3>Tu Di Giới chưa có vật phẩm để bán</h3><p>Hãy nhận vật phẩm từ Tàng Bảo Các, Nhiệm Vụ Đường, Bí Cảnh hoặc giao dịch.</p></div>`}</div><p id="danCacMsg" class="train-msg"></p>`;
  document.querySelectorAll('.dan-cac-sell').forEach(btn=>btn.onclick=async()=>{const id=Number(btn.dataset.id);const input=document.querySelector(`.dan-cac-qty[data-id="${id}"]`);const quantity=Math.max(1,Math.floor(Number(input?.value)||1));btn.disabled=true;try{const x=await api('/api/dan-cac/sell',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:id,quantity})});$('#danCacMsg').textContent=`💎 ${x.message}`;await Promise.all([loadProfile(),loadDanCac(),loadTuDi()]);}catch(e){$('#danCacMsg').textContent='❌ '+e.message;btn.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Đan Các</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadDanCac()">↻ Thử lại</button></div>`;}
}


async function loadTienBan(){
 const area=$('#tienBanArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/tien-ban',{headers:authHeaders()});
  const history=d.history||[];
  area.innerHTML=`<div class="tien-ban-orb"><div class="tien-ban-symbol">🎴</div><div><span class="eyebrow">☯ TIÊN BÀN GIÁNG CƠ DUYÊN</span><h3>Mỗi lần xoay, một mệnh số mới</h3><p>Giá cố định <b>3.000 linh thạch/lượt</b>. Tất cả môn nhân đều được quay.</p><div class="tien-ban-pity">⚜️ Cơ duyên đặc biệt · <b>Cửu Vĩ Thiên Hồ 0,5%</b> · Thiên Phú Vô Thượng: Huyễn Thuật</div></div><div class="tien-ban-wallet">💎 ${Number(d.spiritStones||0).toLocaleString('vi-VN')}</div></div>
  <div class="tien-ban-action"><button id="tienBanSpinBtn" class="btn primary">🎴 XOAY TIÊN BÀN · 3.000 💎</button><button id="tienBanSpin10Btn" class="btn tien-ban-spin10">✨ QUAY 10 LẦN · 30.000 💎</button><span id="tienBanMsg" class="train-msg"></span></div><div id="tienBanBatchResult" class="tien-ban-batch-result"></div>
  <div id="tienBanReward"></div>
  <div class="tien-ban-history"><span class="eyebrow">📜 12 CƠ DUYÊN GẦN NHẤT</span>${history.length?history.map(x=>`<div class="tien-history-row ${x.is_special?'special':''}"><span>${x.is_special?'⚜️':'🎁'}</span><b>${esc(x.reward_name)}</b><small>${esc(x.reward_rarity)} · ${new Date(x.created_at).toLocaleString('vi-VN')}</small></div>`).join(''):'<p class="muted">Chưa có lần quay nào.</p>'}</div>`;
  $('#tienBanSpinBtn').onclick=async()=>{
    const b=$('#tienBanSpinBtn'),msg=$('#tienBanMsg');b.disabled=true;msg.textContent='☯ Tiên Bàn đang vận chuyển cơ duyên...';
    try{
      const x=await api('/api/tien-ban/spin',{method:'POST',headers:authHeaders(),body:'{}'});
      msg.textContent=x.message||'Đã nhận cơ duyên.';
      const r=x.reward||{};
      $('#tienBanReward').innerHTML=x.special?`<div class="tien-special-reward"><div class="special-burst">⚜️✨</div><span class="eyebrow">CHÚC MỪNG ĐẠI CƠ DUYÊN</span><h2>🐉 ${esc(r.name)}</h2><p>${esc(r.description)}</p><strong>🌌 ${esc(r.skill)}</strong><b>Thiên Phú Vô Thượng · Huyễn Thuật</b><small>Tiên Thú Cực Phẩm · Cửu Giai</small></div>`:`<div class="tien-reward"><span>🎁 CƠ DUYÊN NHẬN ĐƯỢC</span><h3>${esc(r.name)}</h3><p>${esc(r.description||'Vật phẩm đã chuyển vào Tu Di Giới.')}</p><small>${esc(r.category||'Vật phẩm')} · ${esc(r.rarity||'Hạ Đẳng')}</small></div>`;
      await Promise.all([loadProfile(),loadTienBan(),loadTuDi()]);
    }catch(e){msg.textContent='❌ '+e.message;}
    finally{b.disabled=false;}
  };
  $('#tienBanSpin10Btn').onclick=async()=>{
    const b=$('#tienBanSpin10Btn'),one=$('#tienBanSpinBtn'),msg=$('#tienBanMsg'),host=$('#tienBanBatchResult');
    if(Number(currentProfile?.spirit_stones||0)<30000){msg.textContent='❌ Cần 30.000 linh thạch để quay 10 lần.';return;}
    b.disabled=true;one.disabled=true;host.innerHTML='<div class="tien-batch-casting">☯ ✦ ☯ Đang mở 10 đạo cơ duyên...</div>';
    try{
      const x=await api('/api/tien-ban/spin10',{method:'POST',headers:authHeaders(),body:'{}'});
      msg.textContent=x.message+` · Còn ${Number(x.remainingStones).toLocaleString('vi-VN')} linh thạch.`;
      host.innerHTML=`<div class="tien-batch-grid">${(x.rewards||[]).map((r,i)=>`<article class="tien-batch-reward ${r.special?'special':''}"><span>${r.special?'⚜️':'🎁'}</span><b>#${i+1} · ${esc(r.name)}</b><small>${esc(r.rarity||'Cơ duyên')}</small></article>`).join('')}</div>`;
      host.classList.remove('tien-batch-reveal');void host.offsetWidth;host.classList.add('tien-batch-reveal');
      await Promise.all([loadProfile(),loadTienBan(),loadTuDi()]);
    }catch(e){msg.textContent='❌ '+e.message;host.innerHTML='';}finally{b.disabled=false;one.disabled=false;}
  };
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadDanDuong(){
 const area=$('#danDuongArea'); if(!area||!getToken())return;
 try{
  const [d,role]=await Promise.all([api('/api/dan-duong',{headers:authHeaders()}),loadVenueRole('dan-duong')]);
  const items=d.items||[], p=d.profile||{}, ri=Number(d.stage?.realmIndex||0);
  area.innerHTML=`${venueRolePanel(role)}<div class="dan-duong-head"><div><span class="eyebrow">🧪 ĐAN ĐƯỜNG · ĐỔI LINH THẠCH</span><h3>${esc(d.npc?.name||'Huyền Lô')}</h3><p>${esc(d.npc?.dialogue||'Đổi linh thạch lấy đan lô và linh dược theo phẩm cấp.')}</p></div><div class="duoc-wallet">💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</div></div><div class="dan-duong-grid">${items.map(x=>{const locked=ri<Number(x.min_realm||0);const type=String(x.category||'').includes('Lò')?'🔥 LÒ LUYỆN ĐAN':'🌿 LINH DƯỢC';const grade=String(x.category||'').split('·').pop().trim();return `<article class="dan-card ${locked?'locked':''}"><div class="dan-card-icon">${String(x.category||'').includes('Lò')?'🔥':'🌿'}</div><span class="eyebrow">${type} · ${esc(grade)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Yêu cầu: ${esc(REALM_NAMES[Number(x.min_realm)]||'Luyện Khí')}</small><div class="dan-buy-row"><b>💎 ${Number(x.price||0).toLocaleString('vi-VN')}</b><span>Kho: ${Number(x.quantity||0)}</span><button class="btn small primary dan-exchange-btn" data-id="${x.id}" ${locked?'disabled':''}>${locked?'🔒 Chưa đủ cảnh giới':'Đổi linh thạch'}</button></div></article>`}).join('')}</div>${role?.me?`<div class="venue-invite-panel"><div class="section-head"><div><span class="eyebrow">📜 ĐAN CHỦ · GỬI LỜI MỜI</span><h3>Mời môn nhân mua vật phẩm</h3></div></div><form id="danInviteForm" class="tavern-invite-form"><select id="danBuyer"><option value="">Chọn môn nhân</option>${(role?.members||[]).map(m=>`<option value="${m.id}">${esc(m.display_name)} · @${esc(m.username)}</option>`).join('')}</select><select id="danInviteItem"><option value="">Chọn vật phẩm</option>${items.map(x=>`<option value="${x.id}">${esc(x.name)} · ${Number(x.price).toLocaleString('vi-VN')} linh thạch</option>`).join('')}</select><button class="btn primary" type="submit">⚗️ Gửi lời mời</button></form><p id="danInviteMsg" class="tavern-msg"></p></div>`:''}<div class="venue-inbox-panel"><div class="section-head"><div><span class="eyebrow">📬 HÒM THƯ ĐAN ĐƯỜNG</span><h3>Lời mời mua vật phẩm</h3></div></div>${(d.inbox||[]).length?`<div class="tavern-inbox-list">${d.inbox.map(x=>`<article class="tavern-inbox-item" data-id="${x.id}"><div class="tavern-mail-icon">⚗️</div><div class="tavern-inbox-content"><b>${esc(x.owner_name)} mời bạn mua ${esc(x.name)}</b><p>${esc(x.category)} · ${Number(x.price).toLocaleString('vi-VN')} linh thạch</p><div class="mail-actions"><button class="btn small primary dan-invite-accept" data-id="${x.id}">✓ Đồng ý · Trả linh thạch</button><button class="btn small ghost dan-invite-reject" data-id="${x.id}">✕ Từ chối</button><span class="mail-action-msg"></span></div></div></article>`).join('')}</div>`:'<div class="empty-state compact"><p>Hòm Thư Đan Đường đang tĩnh lặng.</p></div>'}</div><p id="danMsg" class="train-msg">Đan Đường đã mở cho toàn bộ môn nhân. Đan Chủ nhận 20% giá trị linh thạch của mỗi giao dịch thành công.</p>`;
  await fillVenueTransferTargets();
  document.querySelectorAll('.dan-exchange-btn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/dan-duong/exchange',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:1})});$('#danMsg').textContent='✅ '+x.message;await Promise.all([loadProfile(),loadDanDuong(),loadTuDi()]);}catch(e){$('#danMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.venue-apply-btn').forEach(b=>b.onclick=async()=>{b.disabled=true;const msg=document.querySelector(`[data-venue-msg="${b.dataset.venue}"]`);try{const x=await api('/api/venue-role/'+b.dataset.venue+'/apply',{method:'POST',headers:authHeaders(),body:'{}'});if(msg)msg.textContent='✓ '+x.message;await loadDanDuong();}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.venue-transfer-btn').forEach(b=>b.onclick=async()=>{const sel=document.querySelector(`.venue-transfer-target[data-venue="${b.dataset.venue}"]`),target=Number(sel?.value||0),msg=document.querySelector(`[data-venue-msg="${b.dataset.venue}"]`);if(!target){if(msg)msg.textContent='❌ Hãy chọn môn nhân nhận chức.';return;}if(!confirm('Xác nhận nhường vị trí?'))return;b.disabled=true;try{const x=await api('/api/venue-role/'+b.dataset.venue+'/transfer',{method:'POST',headers:authHeaders(),body:JSON.stringify({targetId:target})});if(msg)msg.textContent='✓ '+x.message;await loadDanDuong();await loadProfile();}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
  $('#danInviteForm')?.addEventListener('submit',async e=>{e.preventDefault();const buyer=Number($('#danBuyer').value),item=Number($('#danInviteItem').value),msg=$('#danInviteMsg');if(!buyer||!item){if(msg)msg.textContent='❌ Hãy chọn môn nhân và vật phẩm.';return;}try{const x=await api('/api/dan-duong/invite',{method:'POST',headers:authHeaders(),body:JSON.stringify({buyerId:buyer,itemId:item})});if(msg)msg.textContent='✓ '+x.message;e.target.reset();await loadDanDuong();}catch(err){if(msg)msg.textContent='❌ '+err.message;}});
  document.querySelectorAll('.dan-invite-accept').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.id),row=b.closest('.tavern-inbox-item'),msg=row?.querySelector('.mail-action-msg');b.disabled=true;try{const x=await api('/api/dan-duong/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:id,action:'accept'})});if(msg)msg.textContent='✓ '+x.message;await Promise.all([loadDanDuong(),loadProfile(),loadTuDi()]);}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.dan-invite-reject').forEach(b=>b.onclick=async()=>{const id=Number(b.dataset.id),row=b.closest('.tavern-inbox-item'),msg=row?.querySelector('.mail-action-msg');b.disabled=true;try{const x=await api('/api/dan-duong/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:id,action:'reject'})});if(msg)msg.textContent='✓ '+x.message;await loadDanDuong();}catch(e){if(msg)msg.textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>🧪 Không thể mở Đan Đường</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadDanDuong()">↻ Mở lại</button></div>`;}
}

async function loadDanPhap(){
 const area=$('#danPhapArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/dan-phap',{headers:authHeaders()});
  const ri=Number(d.realmIndex||0),room=d.room,recipes=d.recipes||[],furnaces=d.furnaces||[],grades=d.roomGrades||[];
  const owned=(d.inventory||[]).filter(x=>Number(x.quantity||0)>0);
  const learned=recipes.filter(r=>r.learned);
  const selectedFurnace=Number(localStorage.getItem('htm_alchemy_furnace')||furnaces[0]?.item_id||0);
  const selectedRecipe=Number(localStorage.getItem('htm_alchemy_recipe')||learned[0]?.id||0);
  const fmt=n=>Number(n||0).toLocaleString('vi-VN');
  const roomHours=room?Math.max(0,((new Date(room.expires_at)-Date.now())/3600000)).toFixed(1):'0';
  const gradeIcon=g=>g==='Tiên Phẩm'?'🌌':g==='Cực Phẩm'?'🐉':g==='Thượng Phẩm'?'🔥':g==='Trung Phẩm'?'🟣':'🌿';
  area.innerHTML=`
  <div class="alchemy-hero"><div><span class="eyebrow">⚗️ ĐAN PHÁP · HỎA HẦU CỔ ĐIỂN</span><h3>Huyền Lô Truyền Pháp</h3><p>Trao đổi Đan Pháp bằng linh thạch. Đan Pháp càng cao cấp càng đắt; lò luyện càng cao phẩm cấp càng tăng tỷ lệ thành đan.</p></div><div class="alchemy-wallet">💎 ${fmt(d.spiritStones)}<small>${room?`🏯 ${esc(room.room_grade)} · còn ${roomHours} giờ`:'Chưa thuê Đan Phòng'}</small></div></div>
  <div class="alchemy-room-panel"><div><span class="eyebrow">🏯 LUYỆN ĐAN PHÒNG · PHẨM CẤP</span><h3>${room?`${gradeIcon(room.room_grade)} ${esc(room.room_grade)} đang hoạt động`:'Chọn phẩm cấp Đan Phòng'}</h3><p>${room?`Giá thuê: ${fmt(room.price_stones)} linh thạch/giờ · hết ${new Date(room.expires_at).toLocaleString('vi-VN')}`:'Thuê tối thiểu 1 giờ, tối đa 10 giờ. Giá phụ thuộc phẩm cấp phòng.'}</p></div>
   ${room?`<div class="alchemy-manager"><label>👤 Người trông coi</label><select id="alchemyManager"><option value="">${room.manager_name?'Đang chọn: '+esc(room.manager_name):'Chọn 1 môn nhân'}</option>${(d.rooms||[]).filter(x=>Number(x.user_id)!==Number(currentUser?.id)).map(x=>`<option value="${x.user_id}">${esc(x.display_name)} · @${esc(x.username)}</option>`).join('')}</select><button class="btn small ghost" id="alchemySetManager">Bổ nhiệm</button><button class="btn small ${room.auto_accept_orders?'primary':'ghost'}" id="alchemyAutoOrders" data-enabled="${room.auto_accept_orders?'1':'0'}">${room.auto_accept_orders?'🟢 Khai phòng':'⚪ Đóng phòng'}</button></div>`:
   `<div class="alchemy-rent"><select id="alchemyRoomGrade">${grades.map(g=>{const locked=ri<Number(g.minRealm||0);return `<option value="${esc(g.grade)}" ${locked?'disabled':''}>${gradeIcon(g.grade)} ${esc(g.grade)} · ${fmt(g.price)} 💎/giờ${locked?' · 🔒':''}</option>`}).join('')}</select><select id="alchemyHours">${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1} giờ</option>`).join('')}</select><button class="btn primary" id="alchemyRent">🔥 Thuê Đan Phòng</button></div>`}</div>
  ${room?`<div class="alchemy-furnace-panel"><div class="alchemy-panel-title"><div><span class="eyebrow">🔥 LÒ LUYỆN SỞ HỮU</span><h3>Đan Lô của môn nhân</h3><p>Chọn lò bạn sở hữu. Phẩm cấp lò cộng trực tiếp vào tỷ lệ thành đan.</p></div></div><div class="alchemy-furnace-grid">${furnaces.length?furnaces.map(f=>`<button type="button" class="alchemy-furnace-card ${Number(f.item_id)===selectedFurnace?'selected':''}" data-furnace="${f.item_id}"><span class="furnace-orb">🔥</span><b>${esc(f.name)}</b><small>${esc(f.grade)} · +${Number(f.bonus)}% thành đan · ×${Number(f.quantity)}</small></button>`).join(''):'<div class="empty-state compact"><p>Chưa sở hữu Lò Luyện Đan. Có thể mua lò tại Đan Đường.</p></div>'}</div></div>`:''}
  <div class="alchemy-recipe-grid">${recipes.map(r=>{const locked=ri<Number(r.min_realm||0),ing=(r.ingredients||[]).map(x=>`${esc(x.name)} ×${Number(x.quantity)}`).join(' · ');return `<article class="alchemy-recipe-card ${locked?'locked':''} ${r.learned?'learned':''}"><div class="alchemy-recipe-top"><span class="alchemy-grade">${gradeIcon(r.grade)} ${esc(r.grade)}</span><span>🎯 Cơ bản ${Number(r.success_rate)}%</span></div><h3>${esc(r.name)}</h3><span class="eyebrow">${esc(r.function_name)}</span><p>${esc(r.description)}</p><div class="alchemy-ingredients"><b>🌿 Linh dược cần dùng</b><span>${ing}</span></div><div class="alchemy-meta"><span>📜 Đổi pháp: <b>${fmt(r.learn_price)} 💎</b></span><span>🧪 Giá đan: <b>${fmt(r.exchange_price)} 💎</b></span></div>${locked?'<button class="btn small ghost" disabled>🔒 Chưa đủ cảnh giới</button>':r.learned?`<button class="btn small primary alchemy-open-recipe" data-id="${r.id}">🔥 Chọn công thức</button>`:`<button class="btn small primary alchemy-learn" data-id="${r.id}">📜 Trao đổi Đan Pháp · ${fmt(r.learn_price)} 💎</button>`}</article>`}).join('')}</div>
  ${room?`<div class="alchemy-brew-panel" id="alchemyBrewPanel"><div class="alchemy-panel-title"><div><span class="eyebrow">🔥 LUYỆN ĐAN PHÒNG</span><h3>Đưa linh dược vào lò luyện</h3><p>Chọn công thức và lò luyện. Các ô dưới đây hiển thị đúng linh dược mà Đan Pháp yêu cầu.</p></div><div class="alchemy-furnace-core"><span>🔥</span><small>${furnaces.find(f=>Number(f.item_id)===selectedFurnace)?.name||'Chưa chọn lò'}</small></div></div><div class="alchemy-brew-controls"><label>📜 Công thức<select id="alchemyBrewRecipe">${learned.map(r=>`<option value="${r.id}" ${Number(r.id)===selectedRecipe?'selected':''}>${esc(r.name)} · ${esc(r.grade)}</option>`).join('')}</select></label><label>🔥 Lò luyện<select id="alchemyBrewFurnace">${furnaces.map(f=>`<option value="${f.item_id}" ${Number(f.item_id)===selectedFurnace?'selected':''}>${esc(f.name)} · +${Number(f.bonus)}%</option>`).join('')}</select></label></div><div id="alchemyIngredientSlots" class="alchemy-ingredient-slots"></div><div class="alchemy-brew-action"><button class="btn primary alchemy-main-brew" ${!furnaces.length||!learned.length?'disabled':''}>🔥 BẮT ĐẦU LUYỆN ĐAN</button><span id="alchemyBrewRate" class="alchemy-rate-badge">Chọn công thức</span></div></div>`:''}
  <div class="alchemy-order-panel"><div class="section-head"><div><span class="eyebrow">📜 ĐƠN LUYỆN ĐAN</span><h3>Giá gửi đơn tính theo giá trị đan dược</h3></div></div><form id="alchemyOrderForm" class="alchemy-order-form"><select id="alchemyOrderRecipe">${learned.map(r=>`<option value="${r.id}">${esc(r.name)} · giá đan ${fmt(r.exchange_price)} 💎</option>`).join('')}</select><select id="alchemyOrderRoom">${(d.rooms||[]).filter(x=>Number(x.user_id)!==Number(currentUser?.id)).map(x=>`<option value="${x.user_id}">${esc(x.display_name)} · ${esc(x.room_grade)}</option>`).join('')}</select><input id="alchemyOrderQty" type="number" min="1" max="20" value="1"><button class="btn primary" type="submit">📜 Gửi đơn · 85%</button></form><p id="alchemyOrderPrice" class="train-msg">Giá gửi đơn = giá trị đan dược × số lượng × 85% (thấp hơn mua trực tiếp).</p><p id="alchemyOrderMsg" class="train-msg"></p></div>
  <div class="alchemy-orders"><div class="section-head"><div><span class="eyebrow">📬 HÒM THƯ LÒ LUYỆN</span><h3>Đơn đang chờ xử lý</h3></div></div>${(d.orders||[]).length?(d.orders||[]).map(o=>`<article class="alchemy-order-card"><div><b>${o.source_type==='npc'?'🤖 NPC':'👤 '+esc(o.requester_name||'Môn nhân')} · ${esc(o.recipe_name)} ×${Number(o.quantity)}</b><p>Giá trả: <strong>${fmt(o.payout)} linh thạch</strong> · Trạng thái: ${esc(o.status)}</p></div><div class="mail-actions">${o.status==='pending'?`<button class="btn small primary alchemy-accept" data-id="${o.id}">✓ Nhận đơn</button><button class="btn small ghost alchemy-reject" data-id="${o.id}">✕ Từ chối</button>`:''}${o.status==='accepted'&&Number(o.accepted_by||0)===Number(currentUser?.id)?`<button class="btn small primary alchemy-brew-order" data-id="${o.id}" data-recipe="${o.recipe_id}">🔥 Đưa vào lò</button>`:''}</div></article>`).join(''):'<div class="empty-state compact"><p>Chưa có đơn luyện đan. NPC mới có thể đến sau mỗi 5 phút khi có Đan Phòng đang hoạt động.</p></div>'}</div><p id="alchemyMsg" class="train-msg">🔥 Đan Phòng chỉ dùng linh dược bạn đang sở hữu và Lò Luyện Đan bạn đang có.</p>`;

  const updateSlots=()=>{
    const rid=Number($('#alchemyBrewRecipe')?.value||0), fId=Number($('#alchemyBrewFurnace')?.value||0), r=recipes.find(x=>Number(x.id)===rid), f=furnaces.find(x=>Number(x.item_id)===fId), host=$('#alchemyIngredientSlots');
    localStorage.setItem('htm_alchemy_recipe',String(rid));localStorage.setItem('htm_alchemy_furnace',String(fId));
    if(!r||!host){return;}
    host.innerHTML=(r.ingredients||[]).map(x=>{const have=Number(owned.find(i=>Number(i.item_id)===Number(x.itemId))?.quantity||0);return `<div class="alchemy-ingredient-slot"><span>🌿</span><div><b>${esc(x.name)}</b><small>Cần ${Number(x.quantity)} · Có ${have}</small></div><input value="${Number(x.quantity)}" min="${Number(x.quantity)}" max="${have}" data-item="${x.itemId}" type="number" ${have<Number(x.quantity)?'disabled':''}></div>`}).join('');
    const rate=Math.min(99,Number(r.success_rate||0)+Number(f?.bonus||0));$('#alchemyBrewRate').textContent=f?`🎯 Thành đan dự kiến: ${rate}% · ${esc(f.grade)}`:'Chưa chọn lò';
  };
  $('#alchemyAutoOrders')?.addEventListener('click',async()=>{const b=$('#alchemyAutoOrders'),enabled=b.dataset.enabled!=='1';b.disabled=true;try{const x=await api('/api/dan-phap/room/auto',{method:'POST',headers:authHeaders(),body:JSON.stringify({enabled})});$('#alchemyMsg').textContent='✅ '+x.message;await loadDanPhap();}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;b.disabled=false;}});
  $('#alchemyRent')?.addEventListener('click',async()=>{const hours=Number($('#alchemyHours').value||1),grade=$('#alchemyRoomGrade').value;try{const x=await api('/api/dan-phap/room/rent',{method:'POST',headers:authHeaders(),body:JSON.stringify({hours,grade})});$('#alchemyMsg').textContent='✅ '+x.message;await Promise.all([loadDanPhap(),loadProfile()]);}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;}});
  $('#alchemySetManager')?.addEventListener('click',async()=>{const id=Number($('#alchemyManager')?.value||0);if(!id){$('#alchemyMsg').textContent='❌ Hãy chọn môn nhân.';return;}try{const x=await api('/api/dan-phap/room/manager',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId:id})});$('#alchemyMsg').textContent='✅ '+x.message;await loadDanPhap();}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;}});
  document.querySelectorAll('.alchemy-learn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/dan-phap/learn',{method:'POST',headers:authHeaders(),body:JSON.stringify({recipeId:Number(b.dataset.id)})});$('#alchemyMsg').textContent='📜 '+x.message;await Promise.all([loadDanPhap(),loadProfile()]);}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.alchemy-open-recipe').forEach(b=>b.onclick=()=>{localStorage.setItem('htm_alchemy_recipe',b.dataset.id);$('#alchemyBrewRecipe').value=b.dataset.id;updateSlots();$('#alchemyBrewPanel')?.scrollIntoView({behavior:'smooth',block:'center'});});
  document.querySelectorAll('.alchemy-furnace-card').forEach(b=>b.onclick=()=>{localStorage.setItem('htm_alchemy_furnace',b.dataset.furnace);document.querySelectorAll('.alchemy-furnace-card').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');if($('#alchemyBrewFurnace'))$('#alchemyBrewFurnace').value=b.dataset.furnace;updateSlots();});
  $('#alchemyBrewRecipe')?.addEventListener('change',updateSlots);$('#alchemyBrewFurnace')?.addEventListener('change',updateSlots);updateSlots();
  $('#alchemyOrderRecipe')?.addEventListener('change',()=>{const r=recipes.find(x=>Number(x.id)===Number($('#alchemyOrderRecipe').value));$('#alchemyOrderPrice').textContent=r?`Giá đơn = ${fmt(r.exchange_price)} × số lượng × 85% = ${fmt(Number(r.exchange_price)*Number($('#alchemyOrderQty').value||1)*0.85)} linh thạch.`:'';});
  $('#alchemyOrderQty')?.addEventListener('input',()=>$('#alchemyOrderRecipe')?.dispatchEvent(new Event('change')));$('#alchemyOrderRecipe')?.dispatchEvent(new Event('change'));
  $('#alchemyOrderForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('#alchemyOrderMsg');try{const x=await api('/api/dan-phap/order',{method:'POST',headers:authHeaders(),body:JSON.stringify({recipeId:Number($('#alchemyOrderRecipe').value),roomOwnerId:Number($('#alchemyOrderRoom').value),quantity:Number($('#alchemyOrderQty').value||1)})});msg.textContent='✅ '+x.message;await loadDanPhap();}catch(err){msg.textContent='❌ '+err.message;}});
  document.querySelectorAll('.alchemy-accept,.alchemy-reject').forEach(b=>b.onclick=async()=>{try{const x=await api('/api/dan-phap/order/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:Number(b.dataset.id),action:b.classList.contains('alchemy-accept')?'accept':'reject'})});$('#alchemyMsg').textContent='✅ '+x.message;await loadDanPhap();}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;}});
  document.querySelectorAll('.alchemy-brew-order').forEach(b=>b.onclick=async()=>{b.disabled=true;const furnaceId=Number($('#alchemyBrewFurnace')?.value||selectedFurnace);try{const x=await api('/api/dan-phap/brew',{method:'POST',headers:authHeaders(),body:JSON.stringify({orderId:Number(b.dataset.id),recipeId:Number(b.dataset.recipe),furnaceId})});$('#alchemyMsg').textContent=(x.success?'✨ ':'❌ ')+x.message;await Promise.all([loadDanPhap(),loadProfile(),loadTuDi()]);}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;b.disabled=false;}});
  $('.alchemy-main-brew')?.addEventListener('click',async()=>{const b=$('.alchemy-main-brew'),recipeId=Number($('#alchemyBrewRecipe').value||0),furnaceId=Number($('#alchemyBrewFurnace').value||0);if(!recipeId||!furnaceId)return;b.disabled=true;area.classList.add('alchemy-furnace-active');$('#alchemyMsg').textContent='🔥 Đan Lô đang tụ hỏa · luyện đan...';try{const x=await api('/api/dan-phap/brew-direct',{method:'POST',headers:authHeaders(),body:JSON.stringify({recipeId,furnaceId})});$('#alchemyMsg').textContent=(x.success?'✨ ':'❌ ')+x.message;await Promise.all([loadDanPhap(),loadProfile(),loadTuDi()]);}catch(e){$('#alchemyMsg').textContent='❌ '+e.message;}finally{area.classList.remove('alchemy-furnace-active');b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>⚗️ Không thể mở Đan Pháp</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadDanPhap()">↻ Mở lại</button></div>`;}
}

async function loadDuocDuong(){
 const area=$('#duocDuongArea'); if(!area||!getToken())return;
 try{const d=await api('/api/duoc-duong',{headers:authHeaders()});const items=d.items||[];const p=d.profile||{};
  area.innerHTML=`<div class="duoc-npc"><div class="duoc-npc-seal">💊</div><div><span class="eyebrow">NPC · ${esc(d.npc?.title||'Dược Đường')}</span><h3>${esc(d.npc?.name||'Dược Đồng')}</h3><p>${esc(d.npc?.dialogue||'')}</p></div><div class="duoc-wallet">💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</div></div><div class="duoc-grid">${items.map(x=>{const locked=Number(d.stage?.realmIndex||0)<Number(x.min_realm||0);const icon=x.category.includes('thức ăn')?'🍖':x.category.includes('Khôi')?'🪆':x.category.includes('trang bị')?'🛡️':'◈';return `<article class="duoc-card ${locked?'locked':''}"><div class="duoc-icon">${icon}</div><span class="eyebrow">${esc(x.category.replace('Dược Đường · ',''))}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p>${x.beast_food_gain?`<small>🐉 +${Number(x.beast_food_gain)} linh lực linh thú · 💗 +${Number(x.beast_joy_gain)} niềm vui</small>`:''}${x.is_khoi_loi?`<small>🪆 +${Number(x.beast_joy_gain)} niềm vui</small>`:''}${x.beast_gear_slot?`<small>⚔ +${Number(x.beast_gear_power)} linh thú · yêu cầu ${esc(REALM_NAMES[Number(x.beast_gear_min_realm)]||'cao hơn')}</small>`:''}<div class="duoc-buy"><b>💎 ${Number(x.price||0).toLocaleString('vi-VN')}</b><span>Kho: ${Number(x.quantity||0)}</span><input class="duoc-qty" data-id="${x.id}" type="number" min="1" max="150" value="1" ${locked?'disabled':''}><button class="btn small primary duoc-buy-btn" data-id="${x.id}" ${locked?'disabled':''}>${locked?'🔒 Chưa đủ cảnh giới':'Mua'}</button>${Number(x.spirit_gain||0)>0&&Number(x.quantity||0)>0?`<button class="btn small duoc-use-btn" data-id="${x.id}">Dùng 1 · +${Number(x.spirit_gain).toLocaleString('vi-VN')} linh lực</button>`:''}${x.category==='Dược Đường · Linh thú thức ăn'&&Number(x.quantity||0)>0?`<button class="btn small duoc-open-beast" type="button">🐉 Dùng tại Dưỡng Thú</button>`:''}</div></article>`}).join('')}</div><p id="duocMsg" class="train-msg">${esc(d.npc?.name||'Mặc Ly')}: “Dược đúng căn cơ, thú đúng tâm tính.”</p>`;
  document.querySelectorAll('.duoc-buy-btn').forEach(b=>b.onclick=async()=>{b.disabled=true;const q=Number(document.querySelector(`.duoc-qty[data-id="${b.dataset.id}"]`)?.value||1);try{const x=await api('/api/duoc-duong/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:q})});$('#duocMsg').textContent='✅ '+x.message;await Promise.all([loadProfile(),loadDuocDuong(),loadTuDi(),loadDuongThu()]);}catch(e){$('#duocMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.duoc-use-btn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/storage/use',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:Math.max(1,Math.min(99,Number(document.querySelector(`.storage-qty[data-id=\"${b.dataset.id}\"]`)?.value||1)))})});$('#duocMsg').textContent=`✨ Đã dùng ${x.item}, +${Number(x.gained).toLocaleString('vi-VN')} linh lực.`;await Promise.all([loadProfile(),loadDuocDuong(),loadTuDi()]);}catch(e){$('#duocMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}});
  document.querySelectorAll('.duoc-open-beast').forEach(b=>b.onclick=()=>{document.getElementById('duong-thu')?.scrollIntoView({behavior:'smooth',block:'start'});});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}
async function loadDuongThu(){
 const area=$('#duongThuArea'); if(!area||!getToken())return;
 try{const [d,shop]=await Promise.all([api('/api/duong-thu',{headers:authHeaders()}),api('/api/duoc-duong',{headers:authHeaders()})]);const foods=(shop.items||[]).filter(x=>x.category==='Dược Đường · Linh thú thức ăn');const puppets=(shop.items||[]).filter(x=>x.is_khoi_loi);const gears=(shop.items||[]).filter(x=>x.beast_gear_slot);const chance=Number(d.bondChance||0);
  area.innerHTML=`<div class="duong-thu-summary"><div><span class="eyebrow">🐉 TÂM THÚ · CẢM XÚC</span><h3>Tỷ lệ nhận chủ hiện tại: ${chance}%</h3><p>Cảm xúc tốt (Hỉ, Ái) giúp linh thú sinh linh lực; Nộ, Ố cao sẽ làm linh lực suy giảm theo thời gian.</p></div><div class="duong-thu-wallet">💎 ${Number(d.profile?.spirit_stones||0).toLocaleString('vi-VN')}</div></div><div class="beast-care-grid">${(d.beasts||[]).map(x=>{const bonded=Math.max(0,Number(x.quantity||0)-Number(x.unbound_quantity||0));const mood=[['Hỉ','happiness','😊'],['Nộ','anger','😡'],['Ái','love','💗'],['Ố','dislike','😒']];return `<article class="beast-care-card"><div class="beast-care-head"><div class="beast-care-icon">🐉</div><div><span class="eyebrow">${esc(x.rarity)} · ${esc(x.beast_realm)} ${Number(x.beast_realm_tier||1)}</span><h3>${esc(x.name)}</h3><p>☯ Linh lực thú: <b>${Number(x.pet_spirit||0).toLocaleString('vi-VN')}</b> · Đã nhận chủ: ${bonded}/${Number(x.quantity||0)}</p></div></div><div class="emotion-grid">${mood.map(([label,key,ic])=>`<div><span>${ic} ${label}</span><b>${Number(x[key]||0)}</b><i><em style="width:${Number(x[key]||0)}%"></em></i></div>`).join('')}</div><div class="joy-meter"><span>✨ Niềm vui</span><b>${Number(x.joy||0)}/100</b><i><em style="width:${Number(x.joy||0)}%"></em></i></div><div class="beast-care-actions">${Number(x.unbound_quantity||0)>0?`<button class="btn small primary beast-bond" data-id="${x.beast_id}">🔗 Nhận chủ · ${chance}%</button>`:'<span class="tag">✓ Đã nhận chủ</span>'}<select class="beast-food-select" data-beast="${x.beast_id}"><option value="0">🍖 Chọn thức ăn</option>${foods.map(f=>`<option value="${f.id}">${esc(f.name)} · ×${Number(f.quantity||0)}</option>`).join('')}</select><button class="btn small beast-feed" data-id="${x.beast_id}">Cho ăn</button><select class="beast-puppet-select" data-beast="${x.beast_id}"><option value="0">🪆 Chọn Khôi Lỗi</option>${puppets.map(f=>`<option value="${f.id}">${esc(f.name)} · ×${Number(f.quantity||0)}</option>`).join('')}</select><button class="btn small beast-puppet" data-id="${x.beast_id}">Dùng</button></div><div class="beast-gear-box"><b>⚔ Trang bị linh thú</b><div>${(x.gear||[]).length?(x.gear||[]).map(g=>`<span class="tag">${esc(g.name)} · +${Number(g.power||0)}</span>`).join(''):'<small>Chưa có trang bị riêng.</small>'}</div><select class="beast-gear-select" data-beast="${x.beast_id}"><option value="0">Chọn trang bị</option>${gears.map(g=>`<option value="${g.id}">${esc(g.name)} · +${Number(g.beast_gear_power||0)}</option>`).join('')}</select><button class="btn small primary beast-gear" data-id="${x.beast_id}">Trang bị</button></div></article>`}).join('')||'<div class="empty-state compact"><h3>Chưa có linh thú</h3><p>Hãy thám hiểm Bí Cảnh để có cơ hội nhận linh thú vô chủ.</p></div>'}</div><p id="duongThuMsg" class="train-msg"></p>`;
  document.querySelectorAll('.beast-bond').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/duong-thu/bond',{method:'POST',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id)})});$('#duongThuMsg').textContent=(x.ok?'🔗 ':'⚠️ ')+x.message;await Promise.all([loadDuongThu(),loadData()]);}catch(e){$('#duongThuMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.beast-feed').forEach(b=>b.onclick=async()=>{const id=Number(document.querySelector(`.beast-food-select[data-beast="${b.dataset.id}"]`)?.value||0);if(!id){$('#duongThuMsg').textContent='❌ Hãy chọn thức ăn.';return;}b.disabled=true;try{const x=await api('/api/duong-thu/feed',{method:'POST',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id),itemId:id,quantity:1})});$('#duongThuMsg').textContent='🍖 '+x.message;await Promise.all([loadDuongThu(),loadTuDi()]);}catch(e){$('#duongThuMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.beast-puppet').forEach(b=>b.onclick=async()=>{const id=Number(document.querySelector(`.beast-puppet-select[data-beast="${b.dataset.id}"]`)?.value||0);if(!id){$('#duongThuMsg').textContent='❌ Hãy chọn Khôi Lỗi.';return;}b.disabled=true;try{const x=await api('/api/duong-thu/puppet',{method:'POST',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id),itemId:id,quantity:1})});$('#duongThuMsg').textContent='🪆 '+x.message;await loadDuongThu();}catch(e){$('#duongThuMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.beast-gear').forEach(b=>b.onclick=async()=>{const id=Number(document.querySelector(`.beast-gear-select[data-beast="${b.dataset.id}"]`)?.value||0);if(!id){$('#duongThuMsg').textContent='❌ Hãy chọn trang bị.';return;}b.disabled=true;try{const x=await api('/api/duong-thu/equip',{method:'POST',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id),itemId:id})});$('#duongThuMsg').textContent='⚔ '+x.message;await Promise.all([loadDuongThu(),loadEquipment(),loadData()]);}catch(e){$('#duongThuMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}


async function loadBeastArena(){
 const area=$('#beastArenaArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/beast-arena',{headers:authHeaders()}); const beasts=d.beasts||[],members=d.members||[],npcs=d.npcs||[],pending=d.pending||[],history=d.history||[],activeBattle=d.activeBattle||null,usage=d.usage||{used:0,limit:5,remaining:5,windowHours:24};
  const beastLimitReached=Number(usage.remaining)<=0;
  const typeOf=b=>b.beast_type||b.type||'Linh';
  const skillsFor=b=>{const t=typeOf(b);const pools={Kim:['Kim Cương · Phá Giáp','Thiên Kim · Kiếm Vũ'],Mộc:['Thanh Mộc · Sinh Trưởng','Mộc Linh · Quấn Thân'],Thủy:['Thủy Nguyệt · Triều Dâng','Hàn Thủy · Băng Kích'],Hỏa:['Xích Viêm · Phần Thiên','Hỏa Vũ · Liệt Bạo'],Thổ:['Hậu Thổ · Sơn Nhạc','Địa Trấn · Phong Ấn'],Phong:['Thanh Phong · Loạn Vũ','Phong Nhận · Thiên Trảm'],Lôi:['Tử Lôi · Thiên Phạt','Lôi Động · Bạo Kích'],Băng:['Hàn Nguyệt · Băng Phong','Băng Phách · Tuyệt Sát'],Ảo:['Huyễn Cảnh · Mê Tâm','Ảo Ảnh · Phân Thân'],Long:['Long Uy · Chấn Thiên','Long Viêm · Phần Giới'],Linh:['Linh Quang · Trấn Áp','Linh Khí · Hộ Thể']}[t]||['Tuyệt Kỹ · Liệt Kích','Tuyệt Kỹ · Phá Hồn'];return [b.skill||'Thiên Phú Linh Thú',pools[0],pools[1]]};
  const rarityMultClient=r=>String(r||'').includes('Thần Thoại')?1.35:String(r||'').includes('Cực Phẩm')?1.2:String(r||'').includes('Thượng Phẩm')?1.1:1;
  const selected=()=>Number($('#beastArenaSelected')?.value||0); const selectedBeast=()=>beasts.find(b=>Number(b.beast_id)===selected());
  const skillOptions=b=>skillsFor(b).map((x,i)=>`<option value="${i+1}">${i+1}. ${esc(x)}</option>`).join('');
  const beastOptions=beasts.map(b=>`<option value="${b.beast_id}">${esc(b.name)} · ${esc(b.rarity)} · ${esc(b.beast_realm)} · ${esc(typeOf(b))}${Number(b.battle_debuff_percent||0)?` · ⚠️ -${b.battle_debuff_percent}%`:''}</option>`).join('');
  const npcCards=npcs.map(n=>`<article class="beast-arena-card ${n.id==='thien-ho'||n.id==='than-long'?'divine-card':''}"><div class="beast-arena-card-top"><span class="beast-arena-icon">${n.id==='than-long'?'🐉':n.id==='thien-ho'?'🦊':'🪶'}</span><div><span class="eyebrow">${esc(n.title)}</span><h3>${esc(n.name)}</h3></div></div><p>${esc(n.rarity)} · ${esc(n.realm)} · Hệ ${esc(n.type)}</p><div class="beast-arena-stats"><span>❤️ Huyết Dịch ${Number(Math.round((n.attack+n.defense+n.spirit)*rarityMultClient(n.rarity)*(1+(n.realmTier||1)*.09))).toLocaleString('vi-VN')}</span><span>⚔ ${n.attack}</span><span>🛡 ${n.defense}</span><span>💨 ${n.speed}</span></div><button class="btn small ${n.id==='thien-ho'||n.id==='than-long'?'primary':''} beast-offline-btn" data-npc="${esc(n.id)}" ${beasts.length&&!beastLimitReached?'':'disabled'}>${n.id==='thien-ho'||n.id==='than-long'?'🔥 Thách Chiến Thần Thú':'⚔ Thách Chiến NPC'}</button></article>`).join('');
  const memberCards=members.map(m=>`<article class="beast-member-card"><div><b>${esc(m.display_name)}</b><small>${esc(m.rank||'Môn nhân')} · 🪶 ${Number(m.beast_count||0)} linh thú</small></div><button class="btn small primary beast-invite-btn" data-user="${m.id}" ${beasts.length&&!beastLimitReached?'':'disabled'}>🪶 Gửi lời mời</button></article>`).join('');
  const pendingHtml=pending.length?`<div class="beast-pending-list">${pending.map(x=>`<div class="beast-pending-row"><div><b>🪶 ${esc(x.challenger_name)}</b><small>${esc(x.challenger_beast)} · ${esc(x.rarity)} · ${esc(x.beast_realm)}</small></div><span>Đã gửi qua Hòm Thư</span></div>`).join('')}</div>`:'<small class="muted">Không có lời mời đang chờ.</small>';
  const historyHtml=history.length?history.slice(0,12).map(x=>`<div class="beast-history-row"><span>${x.status==='completed'?'⚔️':'📬'}</span><div><b>${esc(x.challenger_name)} 🪶 ${esc(x.challenger_beast)} vs ${esc(x.opponent_name)} 🪶 ${esc(x.opponent_beast||'—')}</b><small>${x.winner_id?`🏆 ${Number(x.winner_id)===Number(d.me.userId)?'Bạn giành chiến thắng':'Đối thủ giành chiến thắng'}`:'Đang xử lý'} · ${x.reward_item?`🎁 ${esc(x.reward_item)} ×${Number(x.reward_quantity||1)}`:'Không có vật phẩm'} · ${Number(x.rounds||0)} lượt</small></div></div>`).join(''):'<small class="muted">Chưa có chiến tích tại Thú Trường.</small>';
  const hpOf=b=>Math.max(100,Math.round((Number(b.attack||0)+Number(b.defense||0)+Number(b.spirit||0))*rarityMultClient(b.rarity)*(1+Number(b.beast_realm_tier||1)*.09)));
  area.innerHTML=`<div class="beast-arena-wallet"><div><span class="eyebrow">🪶 LINH THÚ XUẤT CHIẾN</span><h3 id="beastArenaName">${beasts.length?esc(beasts[0].name):'Chưa có linh thú'}</h3><small id="beastArenaHpLabel">${beasts.length?`❤️ Huyết Dịch: ${hpOf(beasts[0]).toLocaleString('vi-VN')}`:'Huyết Dịch: —'} · Cảnh giới + phẩm cấp + chiến lực</small></div><div><b>🎒 Chọn linh thú</b><select id="beastArenaSelected">${beastOptions||'<option value="0">Chưa có linh thú</option>'}</select><select id="beastArenaSkill" class="beast-skill-select">${beasts.length?skillOptions(beasts[0]):'<option>Chưa có tuyệt kỹ</option>'}</select><div class="beast-skill-queue"><b>🎯 Chuỗi kỹ năng lượt</b><div id="beastSkillQueue"><span class="tag">Lượt 1: Tuyệt kỹ đã chọn</span></div><button type="button" class="btn small ghost" id="beastSkillAdd">＋ Thêm kỹ năng</button></div></div></div>
  <div class="beast-type-chart"><b>⚖️ Khắc hệ:</b> Kim → Mộc → Thổ → Thủy → Hỏa → Kim · Phong → Lôi → Thủy · Băng → Phong · Ảo → Linh → Long → Ảo. <span>Khắc hệ ×1.35 · Bị khắc ×0.72</span></div>
  <div class="beast-limit-banner"><span>🪶 Lượt Thách Chiến Thú Trường</span><b>${Number(usage.used)}/${Number(usage.limit)} trong 24 giờ</b><small>${beastLimitReached?'⛔ Đã hết lượt':'Còn '+Number(usage.remaining)+' lượt'}</small></div><div class="beast-arena-mode-grid"><article class="beast-mode-card"><span>⚔️</span><h3>Thách Chiến Online</h3><p>Đánh theo lượt như Khiêu Chiến. Mỗi lượt môn nhân <b>tự chọn 1 trong 3 tuyệt kỹ</b>; chọn xong mới tới lượt đối phương.</p><div class="beast-member-list">${memberCards||'<small class="muted">Chưa có môn nhân khác.</small>'}</div></article><article class="beast-mode-card"><span>🪶</span><h3>Thách Chiến Offline</h3><p>Đối chiến NPC theo lượt. Thắng ngẫu nhiên nhận vật phẩm từ Dược Đường.</p><div class="beast-npc-grid">${npcCards}</div></article><article class="beast-mode-card divine-mode"><span>🔥</span><h3>Thách Chiến Thần Thú</h3><p>Khó nhất · phần thưởng Dược Đường có tỷ lệ và phẩm cấp cao hơn. Thất bại gây <b>debuff -35%</b> ngẫu nhiên trong 24 giờ.</p><div class="divine-warning">⚠️ Phản phệ · Công / Thủ / Tốc / Thần</div></article></div>
  <div id="beastArenaBattle" class="beast-battle-view"></div><div class="beast-arena-lower"><div><h3>📬 Lời mời đang chờ</h3>${pendingHtml}</div><div><h3>📜 Chiến tích Thú Trường</h3><div class="beast-history-list">${historyHtml}</div></div></div><div class="beast-spectator"><h3>👁 Sàn Thú Trường · Mọi môn nhân đều có thể theo dõi</h3><div id="beastSpectatorList"><small class="muted">Đang tải...</small></div></div><p id="beastArenaMsg" class="train-msg"></p>`;
  $('#beastArenaSelected').onchange=()=>{const b=selectedBeast();if(b){$('#beastArenaName').textContent=b.name;$('#beastArenaHpLabel').textContent=`❤️ Huyết Dịch: ${hpOf(b).toLocaleString('vi-VN')} · ${b.beast_realm||''} · ${b.rarity||''}`;$('#beastArenaSkill').innerHTML=skillOptions(b);}};
  const renderBattle=(x)=>{const last=x.log?.[x.log.length-1]||{};const hpA=Number(last.hpA??x.maxHp?.a??0),hpB=Number(last.hpB??x.maxHp?.b??0),maxA=Number(x.maxHp?.a||1),maxB=Number(x.maxHp?.b||1);$('#beastArenaBattle').innerHTML=`<div class="beast-battle-head"><b>⚔️ ${esc(x.challengerName||x.aName||'Linh thú A')} vs ${esc(x.opponentName||x.bName||'Linh thú B')}</b><span>${x.rounds||0} lượt · Hệ ${esc(x.types?.a||'Linh')} vs ${esc(x.types?.b||'Linh')}</span></div><div class="beast-hp-duel"><div><b>🪶 ${esc(x.aName||x.challengerName||'Linh thú A')}</b><div class="beast-hp"><i style="width:${Math.max(0,Math.min(100,hpA/maxA*100))}%"></i></div><small>❤️ ${hpA.toLocaleString('vi-VN')} / ${maxA.toLocaleString('vi-VN')}</small></div><strong>VS</strong><div><b>🪶 ${esc(x.bName||x.opponentName||'Linh thú B')}</b><div class="beast-hp"><i style="width:${Math.max(0,Math.min(100,hpB/maxB*100))}%"></i></div><small>❤️ ${hpB.toLocaleString('vi-VN')} / ${maxB.toLocaleString('vi-VN')}</small></div></div><div class="beast-turn-log">${(x.log||[]).map(l=>`<div class="beast-turn"><span>V${l.round}</span><p>${esc(l.text)}</p><small>❤️ ${Number(l.hpA||0).toLocaleString('vi-VN')} · ${Number(l.hpB||0).toLocaleString('vi-VN')}</small></div>`).join('')}</div>`;};
  const renderActiveBattle=(b)=>{
    if(!b||!$('#beastArenaBattle'))return;
    const meId=Number(d.me.userId), myA=Number(b.challenger_id)===meId, myBeast=beasts.find(x=>Number(x.beast_id)===Number(myA?b.challenger_beast_id:b.opponent_beast_id));
    const log=Array.isArray(b.battle_log)?b.battle_log:[], last=log[log.length-1]||{};
    const hpA=Number(b.challenger_hp||b.challenger_max_hp||1),hpB=Number(b.opponent_hp||b.opponent_max_hp||1),maxA=Number(b.challenger_max_hp||1),maxB=Number(b.opponent_max_hp||1);
    const myTurn=Number(b.turn_user_id)===meId;
    const skills=myBeast?skillOptionsData(myBeast):[];
    const controls=myTurn?`<div class="beast-turn-controls"><b>⚡ Tới lượt bạn — chọn kỹ năng:</b><div class="beast-skill-actions">${skills.map(x=>`<button class="btn small primary beast-turn-skill" data-request="${b.id}" data-skill="${x.id}">⚔️ ${esc(x.name)}</button>`).join('')}</div><small>Chỉ kỹ năng được bạn chọn ở lượt này mới được máy chủ thực thi.</small></div>`:`<div class="beast-waiting">⏳ Đang chờ <b>${esc(Number(b.turn_user_id)===Number(b.challenger_id)?b.challenger_name:b.opponent_name)}</b> chọn kỹ năng...</div>`;
    $('#beastArenaBattle').innerHTML=`<div class="beast-battle-head"><b>⚔️ ${esc(b.challenger_name)} 🪶 vs 🪶 ${esc(b.opponent_name)}</b><span>Lượt ${Number(b.round_number||0)} · ${myTurn?'🔥 Đến lượt bạn':'⏳ Chờ đối phương'}</span></div><div class="beast-hp-duel"><div><b>🪶 ${esc(b.challenger_beast)}</b><div class="beast-hp"><i style="width:${Math.max(0,Math.min(100,hpA/maxA*100))}%"></i></div><small>❤️ ${hpA.toLocaleString('vi-VN')} / ${maxA.toLocaleString('vi-VN')}</small></div><strong>VS</strong><div><b>🪶 ${esc(b.opponent_beast||'Linh thú')}</b><div class="beast-hp"><i style="width:${Math.max(0,Math.min(100,hpB/maxB*100))}%"></i></div><small>❤️ ${hpB.toLocaleString('vi-VN')} / ${maxB.toLocaleString('vi-VN')}</small></div></div>${controls}<div class="beast-last-action ${last.actorId&&Number(last.actorId)===meId?'mine':'enemy'}">${last.text?esc(last.text):'⚔️ Trận đấu vừa khai mở.'}</div><div class="beast-turn-log">${log.map(l=>`<div class="beast-turn ${l===last?'latest':''}"><span>V${l.round}</span><p>${esc(l.text)}</p><small>❤️ ${Number(l.hpA||0).toLocaleString('vi-VN')} · ${Number(l.hpB||0).toLocaleString('vi-VN')}</small></div>`).join('')}</div>`;
    document.querySelectorAll('.beast-turn-skill').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;document.querySelectorAll('.beast-turn-skill').forEach(x=>x.disabled=true);try{const x=await api('/api/beast-arena/online/turn',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:Number(btn.dataset.request),skillId:Number(btn.dataset.skill)})});if(x.finished){$('#beastArenaMsg').textContent=x.message+(x.reward?` · 🎁 ${x.reward.name} ×${x.reward.quantity}`:'');await Promise.all([loadBeastArena(),loadProfile(),loadTuDi()]);}else{const fresh=await api('/api/beast-arena',{headers:authHeaders()});renderActiveBattle(fresh.activeBattle);$('#beastArenaMsg').textContent=x.message;}}catch(e){$('#beastArenaMsg').textContent='❌ '+e.message;btn.disabled=false;document.querySelectorAll('.beast-turn-skill').forEach(x=>x.disabled=false);}});
  };
  const skillQueue=[]; const skillSelect=$('#beastArenaSkill'), queueHost=$('#beastSkillQueue');
  const renderSkillQueue=()=>{if(queueHost)queueHost.innerHTML=(skillQueue.length?skillQueue:['Kỹ năng hiện tại']).map((v,i)=>`<span class="tag">Lượt ${i+1}: ${esc(typeof v==='string'?v:(v.name||'Kỹ năng'))}</span>`).join('');};
  $('#beastSkillAdd')?.addEventListener('click',()=>{const b=beasts.find(x=>Number(x.beast_id)===Number(selected()));const skills=skillOptionsData(b);if(!b||!skills.length)return;const id=Number(skillSelect.value||1);skillQueue.push({id,name:skills.find(x=>Number(x.id)===id)?.name||`Tuyệt kỹ ${id}`});if(skillQueue.length>12)skillQueue.shift();renderSkillQueue();});
  function skillOptionsData(b){if(!b)return[];const type=b.beast_type||'Linh';const pool={Kim:['Kim Cương · Phá Giáp','Thiên Kim · Kiếm Vũ','Kim Linh · Trấn Hồn'],Mộc:['Thanh Mộc · Sinh Trưởng','Mộc Linh · Quấn Thân','Thánh Mộc · Hồi Nguyên'],Thủy:['Thủy Nguyệt · Triều Dâng','Hàn Thủy · Băng Kích','Thiên Hà · Thủy Lao'],Hỏa:['Xích Viêm · Phần Thiên','Hỏa Vũ · Liệt Bạo','Hỏa Linh · Thiêu Hồn'],Thổ:['Hậu Thổ · Sơn Nhạc','Địa Trấn · Phong Ấn','Thổ Linh · Thiết Bích'],Phong:['Thanh Phong · Loạn Vũ','Phong Nhận · Thiên Trảm','Cửu Thiên · Phong Hành'],Lôi:['Tử Lôi · Thiên Phạt','Lôi Động · Bạo Kích','Cửu Tiêu · Lôi Võng'],Băng:['Hàn Nguyệt · Băng Phong','Băng Phách · Tuyệt Sát','Tuyết Vực · Đông Kết'],Ảo:['Huyễn Cảnh · Mê Tâm','Ảo Ảnh · Phân Thân','Vạn Tượng · Mộng Giới'],Long:['Long Uy · Chấn Thiên','Long Viêm · Phần Giới','Vạn Cổ · Long Hồn'],Linh:['Linh Quang · Trấn Áp','Linh Khí · Hộ Thể','Thiên Linh · Phá Vọng']}[type]||[];return [{id:1,name:b.skill||'Thiên Phú Linh Thú'},{id:2,name:pool[0]||'Tuyệt Kỹ 2'},{id:3,name:pool[1]||'Tuyệt Kỹ 3'}];}
  async function spectator(){try{const z=await api('/api/beast-arena/spectate',{headers:authHeaders()});$('#beastSpectatorList').innerHTML=(z.rows||[]).map(r=>{const log=Array.isArray(r.battle_log)?r.battle_log:[];const l=log[log.length-1]||{};return `<article class="beast-spectator-row"><div><b>${esc(r.challenger_name)} 🪶 ${esc(r.challenger_beast)} <span>VS</span> ${esc(r.opponent_name)} 🪶 ${esc(r.opponent_beast||'—')}</b><small>Hệ ${esc(r.challenger_type||'Linh')} vs ${esc(r.opponent_type||'Linh')} · ${Number(r.rounds||0)} lượt · ${new Date(r.created_at).toLocaleString('vi-VN')}</small></div><button class="btn small ghost spectator-replay" data-id="${r.id}">▶ Xem diễn biến</button></article>`}).join('')||'<small class="muted">Chưa có trận đấu.</small>';z.rows?.forEach(r=>{const b=document.querySelector(`.spectator-replay[data-id="${r.id}"]`);b&&(b.onclick=()=>renderBattle({log:Array.isArray(r.battle_log)?r.battle_log:[],rounds:r.rounds,aName:r.challenger_beast,bName:r.opponent_beast,maxHp:{a:r.challenger_hp,b:r.opponent_hp},types:{a:r.challenger_type,b:r.opponent_type}}));});}catch{}}
  document.querySelectorAll('.beast-invite-btn').forEach(btn=>btn.onclick=async()=>{const beastId=selected();const skillId=Number($('#beastArenaSkill')?.value||1);if(!beastId)return;btn.disabled=true;try{const x=await api('/api/beast-arena/online/request',{method:'POST',headers:authHeaders(),body:JSON.stringify({targetUserId:Number(btn.dataset.user),beastId,skillId,skillQueue:skillQueue.map(x=>Number(x.id||1))})});$('#beastArenaMsg').textContent='🪶 '+x.message;await Promise.all([loadBeastArena(),loadMailbox()]);}catch(e){$('#beastArenaMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.beast-offline-btn').forEach(btn=>btn.onclick=async()=>{const beastId=selected(),skillId=Number($('#beastArenaSkill')?.value||1);if(!beastId)return;btn.disabled=true;const divine=btn.dataset.npc==='thien-ho'||btn.dataset.npc==='than-long';try{const x=await api(divine?'/api/beast-arena/divine':'/api/beast-arena/offline',{method:'POST',headers:authHeaders(),body:JSON.stringify({beastId,npcId:btn.dataset.npc,skillId,skillQueue:skillQueue.map(x=>Number(x.id||1))})});$('#beastArenaMsg').textContent=(x.win?'🏆 ':'💥 ')+x.message+(x.reward?` · 🎁 ${x.reward.name} ×${x.reward.quantity}`:'')+(x.debuff?` · ⚠️ ${x.debuff.text}`:'');renderBattle({...x,aName:x.log?.[0]?.actor==='a'?x.log?.[0]?.actorName:'Linh thú',bName:x.npc,types:x.log?.[0]?{a:'—',b:'—'}:{},maxHp:x.maxHp||{a:1,b:1}});await Promise.all([loadBeastArena(),loadTuDi(),loadProfile()]);}catch(e){$('#beastArenaMsg').textContent='❌ '+e.message;}finally{btn.disabled=false;}});
  if(activeBattle)renderActiveBattle(activeBattle); else $('#beastArenaBattle').innerHTML='';
  clearInterval(window.beastActiveBattleTimer); window.beastActiveBattleTimer=setInterval(async()=>{if(!getToken()||!document.querySelector('#beastArenaArea #beastArenaBattle'))return;try{const z=await api('/api/beast-arena',{headers:authHeaders()});if(z.activeBattle)renderActiveBattle(z.activeBattle);else if(!document.querySelector('.beast-turn-skill'))$('#beastArenaBattle').innerHTML='';}catch{}},2500);
  await spectator(); clearInterval(window.beastSpectatorTimer); window.beastSpectatorTimer=setInterval(()=>{if(document.querySelector('#beastArenaArea #beastSpectatorList')&&getToken())spectator();},8000);
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Thú Trường</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadBeastArena()">↻ Thử lại</button></div>`;}
}

async function loadBeastFace(){
 const area=$('#beastFaceArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/beast-face',{headers:authHeaders()}); const rows=d.rows||[];
  area.innerHTML=`<div class="beast-face-head"><div><span class="eyebrow">🖼️ THÚ DIỆN</span><h3>Đổi ảnh đại diện Linh Thú · Tiên Thú</h3><p>Tìm trong toàn bộ linh thú bạn đang sở hữu. Ảnh riêng sẽ ghi đè ảnh mặc định; xóa ảnh để khôi phục ảnh mặc định của chủng thú.</p></div><input id="beastFaceSearch" type="search" placeholder="🔎 Tìm tên, phẩm cấp, cảnh giới..." autocomplete="off"></div><div id="beastFaceGrid" class="beast-face-grid">${rows.length?rows.map(x=>`<article class="beast-face-card" data-name="${esc((x.name+' '+x.rarity+' '+x.beast_realm).toLowerCase())}"><div class="beast-face-preview">${beastAvatarHtml(x.owned_avatar||x.default_avatar,x.beast_realm_tier,'',x.name)}</div><div><span class="eyebrow">${Number(x.beast_realm_tier)>=10?'✨ TIÊN THÚ':'🐉 LINH THÚ'} · ${esc(x.rarity)}</span><h3>${esc(x.name)}</h3><small>${esc(x.beast_realm)} · Sở hữu ×${Number(x.quantity||0)}</small></div><input class="beast-face-file" data-id="${x.beast_id}" type="file" accept="image/png,image/jpeg,image/webp,image/gif" ${x.owned?'':'disabled'}><a class="btn small ghost" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(x.name+' '+x.beast_realm+' '+(Number(x.beast_realm_tier)>=10?'tiên thú':'linh thú'))}">🔎 Tìm ảnh web</a><button class="btn small primary beast-face-save" data-id="${x.beast_id}" ${x.owned?'':'disabled'}>🖼️ Chọn ảnh</button><button class="btn small ghost beast-face-reset" data-id="${x.beast_id}" ${x.owned?'':'disabled'}>↺ Mặc định</button><small class="beast-face-owned">${x.owned?'✓ Đang sở hữu · có thể đổi ảnh':'🔒 Chưa sở hữu · chỉ xem'}</small><p class="beast-face-msg" data-msg="${x.beast_id}"></p></article>`).join(''):`<div class="empty-state compact"><h3>Chưa có linh thú</h3><p>Nhận linh thú tại Thú Đường trước khi dùng Thú Diện.</p></div>`}</div>`;
  const search=$('#beastFaceSearch'); search.oninput=()=>{const q=search.value.toLowerCase().trim();document.querySelectorAll('.beast-face-card').forEach(c=>c.hidden=q&&!c.dataset.name.includes(q));};
  document.querySelectorAll('.beast-face-file').forEach(i=>i.onchange=async()=>{const f=i.files?.[0];if(!f)return;try{i.closest('.beast-face-card').querySelector('.beast-face-save').dataset.data=(await preparePostImage(f)).data;}catch(e){i.value='';i.closest('.beast-face-card').querySelector('.beast-face-msg').textContent='❌ '+e.message;}});
  document.querySelectorAll('.beast-face-save').forEach(b=>b.onclick=async()=>{const data=b.dataset.data;if(!data){b.closest('.beast-face-card').querySelector('.beast-face-msg').textContent='❌ Hãy chọn ảnh trước.';return;}b.disabled=true;try{const x=await api('/api/beast-face',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id),avatar:data})});b.closest('.beast-face-card').querySelector('.beast-face-msg').textContent='✅ '+x.message;await Promise.all([loadBeastFace(),loadEquipment(),loadProfile(),loadData(),loadBeastArena()]);}catch(e){b.closest('.beast-face-card').querySelector('.beast-face-msg').textContent='❌ '+e.message;}finally{b.disabled=false;}});
  document.querySelectorAll('.beast-face-reset').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/beast-face',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({beastId:Number(b.dataset.id),avatar:''})});await Promise.all([loadBeastFace(),loadEquipment(),loadProfile(),loadData(),loadBeastArena()]);}catch(e){b.closest('.beast-face-card').querySelector('.beast-face-msg').textContent='❌ '+e.message;}finally{b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">❌ ${esc(e.message)}</div>`;}
}

async function loadBeastHouse(){
 const area=$('#beastHouseArea'); if(!area||!getToken())return;
 try{
  const [d,rankData]=await Promise.all([api('/api/beast-house',{headers:authHeaders()}),api('/api/linh-thu-bang',{headers:authHeaders()})]); const p=d.profile||{};
  const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
  const realmIndex=realms.indexOf(currentProfile?.rank);
  const refreshAt=Date.now()+Number(d.nextRefreshMs||300000);
  area.innerHTML=`<div class="spirit-shop-summary"><div><span class="eyebrow">🐉 THÚ ĐƯỜNG · LUÂN PHIÊN LINH THÚ</span><h3>${esc(p.spirit_beast||'Chưa có linh thú')}</h3><small>Kho hiện có <b>${Number(d.totalBeasts||0)}</b> chủng · phiên hàng đổi mỗi <b>5 phút</b>.</small></div><div class="beast-refresh-box"><b id="beastRefreshCountdown">Đang tính...</b><small>🔄 Làm mới sau</small></div><b>💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')} linh thạch</b></div><div class="beast-rotation-note">🌌 <b>Phiên ${esc(d.rotationKey||'')}</b> · Danh sách hiện tại gồm <b>${(d.catalog||[]).length}</b> linh thú được chọn từ kho lớn. Hãy quay lại sau 5 phút để gặp những linh thú khác.</div><div class="spirit-shop-grid">${(d.catalog||[]).map(x=>{const unavailable=realmIndex<Number(x.min_realm); return `<article class="spirit-shop-card ${unavailable?'locked':''}"><div class="spirit-shop-icon">🐉</div><div class="spirit-shop-copy"><span class="eyebrow">${esc(x.rarity)} · ${esc(x.beast_realm)} ${Number(x.beast_realm_tier||1)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>⚔ ${x.attack} · 🛡 ${x.defense} · 💨 ${x.speed} · ☯ ${x.spirit}</small><small>Thiên phú: ${esc(x.skill)}</small><small>⚔ Chiến lực trang bị: +${Number(x.power_bonus||0).toLocaleString('vi-VN')} · ${esc(x.ability||'—')}</small><small>Yêu cầu: ${esc(realms[Number(x.min_realm)]||'—')}</small></div><div class="spirit-shop-buy"><b>💎 ${Number(x.price_stones).toLocaleString('vi-VN')}</b><button class="btn small primary beast-buy" data-id="${x.id}" ${unavailable?'disabled':''}>${unavailable?'🔒 Chưa đủ cảnh giới':'Mua linh thú'}</button></div></article>`}).join('')}</div><div class="spirit-shop-note">Linh thú mua thành công sẽ được lưu vào Tu Di Giới. Vào Trang Bị để thay thế linh thú đang dùng.</div><div class="shop-ranking"><div class="friend-subtitle">🏆 Bảng xếp hạng Linh Thú</div><div class="shop-ranking-list">${(rankData.rows||[]).slice(0,10).map((x,i)=>`<div class="shop-ranking-row"><b>#${i+1}</b><span>🐉</span><div><strong>${esc(x.name)}</strong><small>${esc(x.beast_realm||'Nhất Giai')} · ${Number(x.beast_realm_tier||1)} · ${esc(x.rarity)}</small></div><em>${Number(x.owner_count||0)} người sở hữu</em></div>`).join('')||'<div class="empty-state compact"><p>Chưa có linh thú được ghi danh.</p></div>'}</div></div><p id="beastHouseMsg" class="train-msg"></p>`;
  const countdown=$('#beastRefreshCountdown');
  clearInterval(window.beastRefreshCountdownTimer); window.beastRefreshCountdownTimer=setInterval(()=>{const left=Math.max(0,refreshAt-Date.now()); if(countdown)countdown.textContent=`${Math.floor(left/60000)}:${String(Math.floor((left%60000)/1000)).padStart(2,'0')}`; if(left<=0){clearInterval(window.beastRefreshCountdownTimer);loadBeastHouse();}},1000);
  document.querySelectorAll('.beast-buy').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/beast-house/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#beastHouseMsg').textContent=`🐉 ${x.message||('Đã nhận '+x.item)} · Trừ ${Number(x.price).toLocaleString('vi-VN')} linh thạch.`;await loadProfile();await loadBeastHouse();await loadSpiritRankings();await loadEquipment();}catch(e){$('#beastHouseMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadLinhPhap(){
 const area=$('#linhPhapArea'); if(!area||!getToken())return;
 try{
  const [d,rankData]=await Promise.all([api('/api/linh-phap',{headers:authHeaders()}),api('/api/linh-can-bang',{headers:authHeaders()})]); const p=d.profile||{}; const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế']; const realmIndex=realms.indexOf(currentProfile?.rank);
  area.innerHTML=`<div class="spirit-shop-summary"><div><span class="eyebrow">🌿 LINH CĂN HIỆN TẠI</span><h3>${esc(p.spirit_root||'Chưa có linh căn')}</h3><small>${esc(p.spirit_root_rarity||'—')}</small></div><b>💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')} linh thạch</b></div><div class="spirit-shop-grid">${(d.catalog||[]).map(x=>{const unavailable=realmIndex<Number(x.min_realm);return `<article class="spirit-shop-card ${unavailable?'locked':''}"><div class="spirit-shop-icon">🌿</div><div class="spirit-shop-copy"><span class="eyebrow">${esc(x.rarity)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>${esc(x.support)}</small><small>⚔ Chiến lực trang bị: +${Number(x.power_bonus||0).toLocaleString('vi-VN')} · ${esc(x.ability||'—')}</small><small>Yêu cầu: ${esc(realms[Number(x.min_realm)]||'—')}</small></div><div class="spirit-shop-buy"><b>💎 ${Number(x.price_stones).toLocaleString('vi-VN')}</b><button class="btn small primary root-buy" data-id="${x.id}" ${unavailable?'disabled':''}>${unavailable?'🔒 Chưa đủ cảnh giới':'Mua linh căn'}</button></div></article>`}).join('')}</div><div class="spirit-shop-note">Linh căn mua thành công sẽ được lưu vào Tu Di Giới. Vào Trang Bị để thay thế linh căn đang dùng.</div><div class="shop-ranking"><div class="friend-subtitle">🏆 Bảng xếp hạng Linh Căn</div><div class="shop-ranking-list">${(rankData.rows||[]).slice(0,10).map((x,i)=>`<div class="shop-ranking-row"><b>#${i+1}</b><span>🌿</span><div><strong>${esc(x.name)}</strong><small>${esc(x.rarity)} · +${Number(x.owner_count||0)} người sở hữu</small></div><em>${esc(x.support||'')}</em></div>`).join('')||'<div class="empty-state compact"><p>Chưa có linh căn được ghi danh.</p></div>'}</div></div><p id="linhPhapMsg" class="train-msg"></p>`;
  document.querySelectorAll('.root-buy').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/linh-phap/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#linhPhapMsg').textContent=`🌿 ${x.message||('Đã nhận '+x.item)} · Trừ ${Number(x.price).toLocaleString('vi-VN')} linh thạch.`;await loadProfile();await loadLinhPhap();await loadSpiritRankings();await loadEquipment();}catch(e){$('#linhPhapMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadSpiritRankings(){
 try{
  const [r,b]=await Promise.all([api('/api/linh-can-bang',{headers:authHeaders()}),api('/api/linh-thu-bang',{headers:authHeaders()})]);
  const cr=$('#linhCanBangArea'), br=$('#linhThuBangArea');
  if(cr)cr.innerHTML=r.rows.length?r.rows.map((x,i)=>`<article class="codex-card ranked-codex"><span class="codex-rank">#${i+1}</span><span class="codex-icon">🌿</span><div><span class="eyebrow">${esc(x.rarity)} · ${Number(x.owner_count||0)} người sở hữu</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Phụ trợ: ${esc(x.support)}</small><small class="owners">Đạo hữu: ${esc(x.owners||'—')}</small></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có đệ tử sở hữu linh căn.</p></div>`;
  if(br)br.innerHTML=b.rows.length?b.rows.map((x,i)=>`<article class="codex-card ranked-codex"><span class="codex-rank">#${i+1}</span><span class="codex-icon">🐉</span><div><span class="eyebrow">${esc(x.rarity)} · ${Number(x.owner_count||0)} người sở hữu</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>Thuộc tính: ${esc(x.attributes)}</small><small class="owners">Đạo hữu: ${esc(x.owners||'—')}</small></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có đệ tử sở hữu linh thú.</p></div>`;
 }catch(e){}
}

async function loadProfessions(){
 const area=$('#professionsArea'); if(!area)return;
 if(!getToken()){area.innerHTML=`<div class="empty-state compact"><h3>🛠 Nghiệp Vụ đang phong ấn</h3><p>Đăng nhập để tiếp nhận nghề và nhận thù lao linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;return;}
 try{
  const d=await api('/api/professions',{headers:authHeaders()});
  area.innerHTML=`<div class="profession-summary"><div><span class="eyebrow">🛠 CẢNH GIỚI NGHIỆP VỤ</span><h3>${esc(d.stage)}</h3><small>Đang dùng ${Number(d.used)}/${Number(d.slots)} ô nghề. Cứ <b>2 cảnh giới</b> tăng thêm 1 nghề phụ.</small></div><b>💎 ${Number(d.spiritStones||0).toLocaleString('vi-VN')} linh thạch</b></div><div class="profession-grid">${(d.rows||[]).map(x=>`<article class="profession-card ${x.learned?'learned':''}"><div class="profession-icon">${esc(x.icon)}</div><div class="profession-copy"><span class="eyebrow">${x.learned?(x.primary?'NGHỀ CHÍNH':'NGHỀ PHỤ'):'CHƯA TIẾP NHẬN'}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>💎 Thù lao: <b>${Number(x.reward).toLocaleString('vi-VN')}</b> linh thạch</small>${x.learned&&x.lastClaimAt?`<small>Đã nhận gần nhất: ${new Date(x.lastClaimAt).toLocaleDateString('vi-VN')}</small>`:''}</div><div class="profession-actions">${x.learned?`<button class="btn small primary profession-claim" data-code="${esc(x.code)}">💎 Nhận thù lao</button>`:`<button class="btn small primary profession-learn" data-code="${esc(x.code)}" ${Number(d.used)>=Number(d.slots)?'disabled':''}>${Number(d.used)>=Number(d.slots)?'🔒 Hết ô nghề':'🛠 Tiếp nhận nghề'}</button>`}</div></article>`).join('')}</div><div class="profession-note">Nghề đầu tiên là nghề chính. Mỗi 2 cảnh giới mở thêm 1 ô nghề phụ. Mỗi nghề được nhận thù lao tối đa 1 lần/ngày.</div><p id="professionMsg" class="train-msg"></p>`;
  document.querySelectorAll('.profession-learn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/professions/learn',{method:'POST',headers:authHeaders(),body:JSON.stringify({code:b.dataset.code})});$('#professionMsg').textContent='✅ '+x.message;await loadProfile();await loadProfessions();}catch(e){$('#professionMsg').textContent='❌ '+e.message;b.disabled=false;}});
  document.querySelectorAll('.profession-claim').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/professions/claim',{method:'POST',headers:authHeaders(),body:JSON.stringify({code:b.dataset.code})});$('#professionMsg').textContent='💎 '+x.message;await loadProfile();await loadProfessions();}catch(e){$('#professionMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadLeaderboard(){
 try{const d=await api('/api/leaderboard');$('#leaderboardArea').innerHTML=d.rows.length?`<div class="leader-table"><div class="leader-head"><span>#</span><span>Đệ tử</span><span>Cảnh giới</span><span>Linh lực</span><span>Điểm</span></div>${d.rows.map((x,i)=>`<div class="leader-row"><span class="leader-no ${i<3?'medal':''}">${i+1}</span><div class="leader-name"><span class="mini-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.title)}</small></div></div><span class="rank-chip">${esc(x.rank)}</span><b>${Number(x.spirit_power).toLocaleString('vi-VN')}</b><b>${x.achievement_points}</b></div>`).join('')}</div>`:`<div class="empty-state compact"><h3>Thiên bảng còn trống</h3><p>Hãy là người đầu tiên ghi danh.</p></div>`;}
 catch(e){$('#leaderboardArea').innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

function preparePostImage(file){
 return new Promise((resolve,reject)=>{
  if(!file)return resolve(null);
  if(!file.type.startsWith('image/'))return reject(new Error('Vui lòng chọn một tệp hình ảnh.'));
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Không thể đọc hình ảnh.'));
  reader.onload=()=>{
   const img=new Image();
   img.onload=()=>{
    const max=1280;
    const scale=Math.min(1,max/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*scale));
    canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const mime=file.type==='image/png'?'image/png':'image/jpeg';
    const data=canvas.toDataURL(mime,mime==='image/png'?undefined:0.78);
    if(data.length>1500000)return reject(new Error('Ảnh sau khi tối ưu vẫn quá lớn. Hãy chọn ảnh nhẹ hơn.'));
    resolve({data,mime});
   };
   img.onerror=()=>reject(new Error('Hình ảnh không hợp lệ.'));
   img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}

function prepareItemAvatar(file){
 return new Promise((resolve,reject)=>{
  if(!file)return resolve(null);
  if(!file.type.startsWith('image/'))return reject(new Error('Vui lòng chọn một tệp hình ảnh.'));
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Không thể đọc hình ảnh.'));
  reader.onload=()=>{
   const img=new Image();
   img.onload=()=>{
    const max=640,scale=Math.min(1,max/Math.max(img.width,img.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',0.76);
    if(data.length>850000)return reject(new Error('Ảnh vẫn quá lớn. Hãy chọn ảnh nhẹ hơn.'));
    resolve({data,mime:'image/jpeg'});
   };
   img.onerror=()=>reject(new Error('Hình ảnh không hợp lệ.'));img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}

function bindItemAvatarPickers(reloadFn){
 document.querySelectorAll('.item-avatar-file').forEach(input=>{
  input.onchange=async()=>{
   const type=input.dataset.type,id=Number(input.dataset.id),msg=$('#equipmentMsg')||$('#codexMsg');
   try{
    const f=input.files?.[0];if(!f)return;
    const x=await prepareItemAvatar(f);
    const preview=input.closest('.item-avatar-picker')?.querySelector('.item-avatar');if(preview)preview.innerHTML=avatarHtml(x.data);
    input.disabled=true;
    const r=await api('/api/equipment/avatar',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({type,id,avatar:x.data})});
    if(msg)msg.textContent='🖼 '+(r.message||'Đã đổi ảnh đại diện.');
    if(reloadFn)await reloadFn();
   }catch(e){if(msg)msg.textContent='❌ '+e.message;}finally{input.disabled=false;input.value='';}
  };
 });
}

async function loadSectPosts(){
 const area=$('#sectPostsArea'); if(!area)return;
 if(!getToken()){area.innerHTML=`<div class="empty-state compact"><h3>📜 Bài Đăng đang phong ấn</h3><p>Đăng nhập để xem bài đăng và tương tác cùng môn nhân.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;return;}
 try{
  const d=await api('/api/sect-posts',{headers:authHeaders()});
  const elderTitles=['⚜️✨Chí Cao Vô Thượng ✨⚜️','🌊Thượng Cổ Đại Năng 🌊','Đại Lão Đã Đến ⛩️']; const elderHtml=(d.elders||[]).map((x,i)=>`<span class="elder-chip">#${i+1} ${elderTitles[i]} · ${esc(x.display_name)} · ${esc(x.rank)}</span>`).join('');
  const composer=d.canPost?`<form id="sectPostForm" class="sect-post-composer"><div class="composer-head"><div><span class="eyebrow">✒️ ĐĂNG BÀI</span><b>${esc(d.stage)} · được phép đăng</b></div><span class="tag">Hóa Thần+</span></div><input id="sectPostTitle" maxlength="100" placeholder="Tiêu đề bài đăng"><textarea id="sectPostContent" maxlength="3000" rows="5" placeholder="Viết bài cho toàn Môn Phái..."></textarea><label class="post-image-picker">🖼️ <span>Thêm ảnh</span><input id="sectPostImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><div id="sectPostImagePreview" class="sect-post-image-preview hidden"></div><div class="sect-post-foot"><small>Đăng bài với tư cách ${esc(currentUser?.displayName||'Môn nhân')}</small><button class="btn primary">📜 Đăng bài</button></div><p id="sectPostMsg" class="train-msg"></p></form>`:`<div class="sect-post-locked"><b>🔒 Chế độ đăng bài</b><span>${esc(d.stage)} chưa đủ cảnh giới. Chỉ môn nhân từ <b>Hóa Thần</b> trở lên mới được đăng bài.</span></div>`;
  const eldersBox=`<div class="elder-panel"><div><span class="eyebrow">👑 TAM ĐẠI LÃO</span><h3>Ba môn nhân có thành tích cao nhất Môn Phái</h3></div><div class="elder-list">${elderHtml||'<span class="muted">Chưa có Đại Lão.</span>'}</div></div>`;
  const posts=(d.rows||[]).map(x=>{
   const comments=(x.comments||[]).map(c=>`<article class="post-comment"><span class="comment-avatar">${avatarHtml(c.avatar,'',c.realmIndex??realmIndexOf(c.rank))}</span><div><div class="comment-meta"><b>${esc(c.display_name)}</b><span>${esc(c.rank||'Môn nhân')}</span><time>${new Date(c.created_at).toLocaleString('vi-VN')}</time></div><p>${esc(c.content)}</p></div></article>`).join('');
   const image=x.image_data?`<img class="sect-post-image" src="${esc(x.image_data)}" alt="Ảnh trong bài đăng" loading="lazy">`:'';
   return `<article class="sect-post ${x.isElder?'elder-post':''}" data-post-id="${x.id}"><div class="sect-post-head"><span class="post-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><div class="post-author"><b>${esc(x.display_name)}</b>${x.isElder?`<span class="elder-badge">👑 ${esc(['⚜️✨Chí Cao Vô Thượng ✨⚜️','🌊Thượng Cổ Đại Năng 🌊','Đại Lão Đã Đến ⛩️'][Number(x.elderRank||3)-1]||'Đại Lão')}</span>`:''}</div><small>${esc(x.rank)} · ${esc(x.author_title||'Môn nhân')} · ${new Date(x.created_at).toLocaleString('vi-VN')}</small></div></div>${x.title?`<h3>${esc(x.title)}</h3>`:''}${x.content?`<p class="sect-post-content">${esc(x.content)}</p>`:''}${image}<div class="post-reactions"><button class="post-react ${x.my_reaction==='like'?'active':''}" data-reaction="like">👍 Ưa thích <b>${Number(x.likes||0)}</b></button><button class="post-react ${x.my_reaction==='dislike'?'active':''}" data-reaction="dislike">👎 Khinh Thường <b>${Number(x.dislikes||0)}</b></button><button class="post-react ${x.my_reaction==='voice'?'active':''}" data-reaction="voice">📣 Truyền Âm <b>${Number(x.voices||0)}</b></button></div><div class="post-comments"><div class="comments-head"><b>📣 Truyền Âm · Bình luận</b><span>${Number(x.comment_count||0)} ý kiến</span></div><div class="post-comment-list">${comments||'<small class="muted">Chưa có môn nhân nào truyền âm dưới bài viết.</small>'}</div><form class="post-comment-form"><input class="post-comment-input" maxlength="1000" placeholder="Viết suy nghĩ của bạn..."><button class="btn ghost" type="submit">Truyền Âm</button></form><p class="comment-msg train-msg"></p></div></article>`;
  }).join('');
  area.innerHTML=eldersBox+composer+`<div class="sect-post-list">${posts||'<div class="empty-state compact"><h3>Chưa có bài đăng</h3><p>Hãy chờ các môn nhân Hóa Thần trở lên khai bút.</p></div>'}</div>`;
  const form=$('#sectPostForm');
  if(form){
   const imageInput=$('#sectPostImage'), preview=$('#sectPostImagePreview');
   imageInput?.addEventListener('change',async()=>{try{const f=imageInput.files?.[0];if(!f){preview.classList.add('hidden');preview.innerHTML='';return;}const x=await preparePostImage(f);preview.innerHTML=`<img src="${esc(x.data)}" alt="Xem trước">`;preview.classList.remove('hidden');}catch(err){imageInput.value='';preview.classList.add('hidden');preview.innerHTML='';const m=$('#sectPostMsg');if(m)m.textContent='❌ '+err.message;}});
   form.onsubmit=async e=>{e.preventDefault();const msg=$('#sectPostMsg'),btn=form.querySelector('button');btn.disabled=true;try{let imageData='',imageMime='';const f=imageInput?.files?.[0];if(f){const x=await preparePostImage(f);imageData=x.data;imageMime=x.mime;}const title=$('#sectPostTitle').value.trim(),content=$('#sectPostContent').value.trim();if(!title&&!content&&!imageData)throw new Error('Hãy nhập nội dung hoặc chọn ảnh.');const x=await api('/api/sect-posts',{method:'POST',headers:authHeaders(),body:JSON.stringify({title,content,imageData,imageMime})});msg.textContent='✅ '+x.message;form.reset();preview.classList.add('hidden');preview.innerHTML='';await loadSectPosts();}catch(err){msg.textContent='❌ '+err.message;}finally{btn.disabled=false;}};
  }
  area.querySelectorAll('.post-react').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('.sect-post');try{const x=await api('/api/sect-posts/'+card.dataset.postId+'/react',{method:'POST',headers:authHeaders(),body:JSON.stringify({reaction:btn.dataset.reaction})});card.querySelector('[data-reaction="like"] b').textContent=Number(x.likes||0);card.querySelector('[data-reaction="dislike"] b').textContent=Number(x.dislikes||0);card.querySelector('[data-reaction="voice"] b').textContent=Number(x.voices||0);card.querySelectorAll('.post-react').forEach(b=>b.classList.toggle('active',b.dataset.reaction===x.my_reaction));if(btn.dataset.reaction==='voice')card.querySelector('.post-comment-input')?.focus();}catch(err){const m=$('#sectPostMsg');if(m)m.textContent='❌ '+err.message;}});
  area.querySelectorAll('.post-comment-form').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const card=form.closest('.sect-post'),input=form.querySelector('.post-comment-input'),msg=form.querySelector('.comment-msg'),btn=form.querySelector('button');const content=input.value.trim();if(!content)return;btn.disabled=true;try{const x=await api('/api/sect-posts/'+card.dataset.postId+'/comments',{method:'POST',headers:authHeaders(),body:JSON.stringify({content})});const c=x.row;const list=card.querySelector('.post-comment-list');if(list.querySelector('.muted'))list.innerHTML='';list.insertAdjacentHTML('beforeend',`<article class="post-comment"><span class="comment-avatar">${avatarHtml(c.avatar,'',c.realmIndex??realmIndexOf(c.rank))}</span><div><div class="comment-meta"><b>${esc(c.display_name)}</b><span>${esc(c.rank||'Môn nhân')}</span><time>${new Date(c.created_at).toLocaleString('vi-VN')}</time></div><p>${esc(c.content)}</p></div></article>`);const count=card.querySelector('.comments-head span');count.textContent=`${list.querySelectorAll('.post-comment').length} ý kiến`;input.value='';msg.textContent='✓ Đã truyền âm.';}catch(err){msg.textContent='❌ '+err.message;}finally{btn.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadArenaLive(){
 const area=$('#arenaLiveArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/arena/live',{headers:authHeaders()});
  const battles=d.battles||[];
  const count=$('#arenaLiveCount'); if(count)count.textContent=`${battles.length} TRẬN ĐANG ĐẤU`;
  if(!battles.length){area.innerHTML='<div class="empty-state compact"><h3>🏮 Hiện không có lôi đài nào đang giao chiến</h3><p>Khi hai môn nhân đồng thuận Lôi Đài Online, trận đấu sẽ xuất hiện tại đây để toàn môn theo dõi và đặt cược.</p></div>';return;}
  area.innerHTML=`<div class="arena-live-wallet">💎 Linh thạch của bạn: <b>${Number(d.spiritStones||0).toLocaleString('vi-VN')}</b> <span>· Mỗi môn nhân chỉ được đặt 1 cửa cho mỗi trận.</span></div><div class="arena-live-list">${battles.map(x=>{
    const maxA=Math.max(1,Number(x.challenger_max_hp||1)),maxB=Math.max(1,Number(x.opponent_max_hp||1));
    const hpA=Math.min(100,Math.max(0,Math.round(Number(x.challenger_hp||0)/maxA*100))),hpB=Math.min(100,Math.max(0,Math.round(Number(x.opponent_hp||0)/maxB*100)));
    const my=Number(x.my_bet_on_user_id||0), myAmount=Number(x.my_bet_amount||0);
    return `<article class="arena-live-card">
      <div class="arena-live-head"><span class="eyebrow">🔥 LÔI ĐÀI #${x.id}</span><b>Vòng ${Number(x.round_number||0)}</b></div>
      <div class="arena-fighters">
       <div class="arena-fighter ${Number(x.turn_user_id)===Number(x.challenger_id)?'is-turn':''}"><div class="arena-name"><span>${avatarHtml(x.challenger_avatar)}</span><div><b>${esc(x.challenger_name)}</b><small>${esc(x.challenger_rank||'')} · ${Number(x.challenger_spirit||0).toLocaleString('vi-VN')} linh lực</small></div></div><div class="arena-hp"><i style="width:${hpA}%"></i></div><small>❤️ ${Math.round(Number(x.challenger_hp||0)).toLocaleString('vi-VN')} / ${Math.round(maxA).toLocaleString('vi-VN')}</small></div>
       <div class="arena-vs">VS</div>
       <div class="arena-fighter ${Number(x.turn_user_id)===Number(x.opponent_id)?'is-turn':''}"><div class="arena-name"><span>${avatarHtml(x.opponent_avatar)}</span><div><b>${esc(x.opponent_name)}</b><small>${esc(x.opponent_rank||'')} · ${Number(x.opponent_spirit||0).toLocaleString('vi-VN')} linh lực</small></div></div><div class="arena-hp"><i style="width:${hpB}%"></i></div><small>❤️ ${Math.round(Number(x.opponent_hp||0)).toLocaleString('vi-VN')} / ${Math.round(maxB).toLocaleString('vi-VN')}</small></div>
      </div>
      <div class="arena-bet-summary"><b>💎 Tổng cược ${Number(x.bet_pool||0).toLocaleString('vi-VN')}</b><span>${esc(x.challenger_name)}: ${Number(x.challenger_bet||0).toLocaleString('vi-VN')}</span><span>${esc(x.opponent_name)}: ${Number(x.opponent_bet||0).toLocaleString('vi-VN')}</span>${x.last_action?`<small>⚡ ${esc(x.last_action)} · -${Number(x.last_damage||0).toLocaleString('vi-VN')} HP</small>`:''}</div>
      ${my?`<div class="arena-mybet">🎫 Bạn đã cược <b>${myAmount.toLocaleString('vi-VN')} linh thạch</b> cho <b>${my===Number(x.challenger_id)?esc(x.challenger_name):esc(x.opponent_name)}</b>.</div>`:`<div class="arena-bet-form"><select class="arena-bet-target" data-id="${x.id}"><option value="${x.challenger_id}">Cược ${esc(x.challenger_name)}</option><option value="${x.opponent_id}">Cược ${esc(x.opponent_name)}</option></select><input class="arena-bet-amount" data-id="${x.id}" type="number" min="1" max="${Number(d.spiritStones||0)}" value="100" inputmode="numeric"><button class="btn primary arena-bet" data-id="${x.id}">💎 Đặt cược</button></div>`}
    </article>`;
  }).join('')}</div>`;
  document.querySelectorAll('.arena-bet').forEach(btn=>btn.onclick=async()=>{
   const id=Number(btn.dataset.id),target=Number(document.querySelector(`.arena-bet-target[data-id="${id}"]`)?.value||0),amount=Math.floor(Number(document.querySelector(`.arena-bet-amount[data-id="${id}"]`)?.value||0));
   if(amount<1)return alert('Số linh thạch phải lớn hơn 0.');
   btn.disabled=true;
   try{await api('/api/challenges/bet',{method:'POST',headers:authHeaders(),body:JSON.stringify({challengeId:id,betOnUserId:target,amount})});await Promise.all([loadArenaLive(),loadProfile(),loadChallenges()]);}catch(e){alert(e.message);btn.disabled=false;}
  });
 }catch(e){area.innerHTML=`<div class="empty-state compact"><p>${esc(e.message)}</p></div>`;}
}

async function respondMailboxAction(id, type, actionData, actionBtn){
  if(!actionData?.action || !actionData?.requestId && !actionData?.invitationId) return;
  const endpoint=actionData.action==='friend'
    ? '/api/friends/respond'
    : actionData.action==='challenge'
      ? '/api/challenges/online/respond'
      : actionData.action==='beast_challenge'
        ? '/api/beast-arena/online/respond'
        : actionData.action==='bicanh_invite'
          ? '/api/bicanh/invite/respond'
          : actionData.action==='tavern_sale'
            ? '/api/tavern/invite/respond'
            : actionData.action==='alchemy_order'
              ? '/api/dan-phap/order/respond' : '';
  if(!endpoint)return;
  let body=actionData.action==='friend'
    ? {requestId:Number(actionData.requestId),action}
    : actionData.action==='challenge'
      ? {requestId:Number(actionData.requestId),action}
      : actionData.action==='beast_challenge'
        ? {requestId:Number(actionData.requestId),action}
        : actionData.action==='tavern_sale'
          ? {requestId:Number(actionData.requestId),action}
          : actionData.action==='alchemy_order'
            ? {requestId:Number(actionData.requestId),action}
            : {invitationId:Number(actionData.invitationId),action};
  if(actionData.action==='beast_challenge' && action==='accept'){
    body.beastId=Number(document.querySelector(`.mail-beast-select[data-id="${id}"]`)?.value||0);
    body.skillId=Number(document.querySelector(`.mail-skill-select[data-id="${id}"]`)?.value||1);
    if(!body.beastId){const msg=document.querySelector(`.mail-item[data-id="${id}"] .mail-action-msg`);if(msg)msg.textContent='❌ Hãy chọn linh thú xuất chiến.';return;}
  }
  actionBtn?.setAttribute('disabled','disabled');
  try{
    const result=await api(endpoint,{method:'POST',headers:authHeaders(),body:JSON.stringify(body)});
    const mail=document.querySelector(`.mail-item[data-id="${id}"]`);
    if(mail){
      const actions=mail.querySelector('.mail-actions');
      if(actions) actions.innerHTML=`<span class="mail-result">✓ ${action==='accept'?'Đã chấp nhận':'Đã từ chối'}</span>`;
      mail.classList.remove('unread');
    }
    await api('/api/mailbox/read',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(id)})});
    await loadMailbox();
    if(actionData.action==='challenge') await loadChallenges?.();
    if(actionData.action==='beast_challenge') await loadBeastArena?.();
    if(actionData.action==='friend'){ await loadFriends?.(); await loadData?.(); }
    if(actionData.action==='bicanh_invite') await loadBicanh?.();
    if(actionData.action==='tavern_sale'){ await loadTavern?.(); await loadProfile?.(); }
    if(actionData.action==='alchemy_order'){ await loadDanPhap?.(); }
  }catch(e){
    if(actionBtn)actionBtn.removeAttribute('disabled');
    const mail=document.querySelector(`.mail-item[data-id="${id}"]`);
    const msg=mail?.querySelector('.mail-action-msg'); if(msg)msg.textContent='❌ '+e.message;
  }
}


async function loadTavern(){
 const area=$('#tavernArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/tavern',{headers:authHeaders()});
  const role=Boolean(d.role?.active), master=d.master||null, products=d.products||[], listings=d.listings||[], members=d.members||[], inv=d.inventory||[], inbox=d.inbox||[];
  const badge=$('#tavernRoleBadge');
  if(badge) badge.textContent=role?'🥂 LÂU CHỦ':'🥂 TỬU LÂU · ĐANG MỞ';
  const myListings=listings.filter(x=>Number(x.owner_id)===Number(currentUser?.id));
  area.innerHTML=`
   <div class="tavern-hero tavern-scene">
    <div class="tavern-scene-overlay"></div><div class="tavern-ambient tavern-ambient-a"></div><div class="tavern-ambient tavern-ambient-b"></div><div class="tavern-ambient tavern-ambient-c"></div>
    <div class="tavern-hero-copy"><span class="eyebrow">🍶 TỬU YẾN · 酒樓</span><h3>Hàn Thiên Tửu Lâu</h3>
    <p>${master?`Lâu Chủ hiện tại: <b>${esc(master.display_name)}</b> · @${esc(master.username)} · <b>Tửu Lâu Chi Chủ</b>`:'Tửu Lâu đang chờ người kế nhiệm.'}</p>
    <div class="tavern-master-chip">👑 ${master?'Lâu Chủ duy nhất · '+esc(master.display_name):'Chưa định Lâu Chủ'}</div></div>
    <div class="tavern-lantern">◆</div>
   </div>
   <div class="tavern-room-strip"><span>酒樓 · TỬU LÂU</span><span>TRUNG TÂM GIAO DỊCH TÚY PHẨM</span><span>PHÒNG YẾN · QUẦY RƯỢU · HÒM THƯ</span></div>
   <div class="tavern-rules">
    <span>👑 Chỉ có <b>1 Lâu Chủ</b></span><span>🤖 NPC mua sau <b>5 phút</b> · Lâu Chủ nhận <b>31%</b></span><span>☯ Môn nhân mua · Lâu Chủ nhận <b>60%</b></span><span>🍶 Ngộ Túy tại <b>Tửu Lâu</b> · hoặc lưu vào <b>Tu Di Giới</b></span>
   </div>
   <div class="tavern-grid">
    <div class="tavern-panel"><div class="tavern-panel-head"><h3>🍶 Túy Phẩm</h3><small>Phẩm cấp từ thấp đến cao</small></div>
      <div class="tavern-products">${products.map(p=>`<article class="tavern-product tavern-product-${Number(p.id)}">
        <div class="tavern-bottle"><span class="tavern-bottle-icon">🍶</span><div><span class="tavern-grade">${esc(p.grade)}</span><h4>${esc(p.name)}</h4><p>${esc(p.description)}</p><small>✨ Buff ngẫu nhiên: +${Number(p.buff_min||0).toLocaleString('vi-VN')} ~ +${Number(p.buff_max||0).toLocaleString('vi-VN')} linh lực</small><b>${Number(p.price).toLocaleString('vi-VN')} linh thạch</b></div></div>
        ${role?`<button class="btn small ${p.listed?'ghost':'primary'} tavern-list-btn" data-product="${p.id}" ${p.listed?'disabled':''}>${p.listed?'✓ Đang bán':'Mở bán'}</button>`:''}
      </article>`).join('')}</div>
    </div>
    <div class="tavern-panel"><div class="tavern-panel-head"><h3>🏮 Quầy đang mở</h3><small>${listings.length} quầy</small></div>
      <div class="tavern-listings">${listings.map(l=>`<article class="tavern-listing">
       <div><b>${esc(l.name)}</b><span>${esc(l.grade)} · ${Number(l.price).toLocaleString('vi-VN')} linh thạch</span><small>NPC mua kế tiếp: ${new Date(l.npc_next_buy_at).toLocaleString('vi-VN')} · ${esc(l.owner_name)}</small></div>
       ${Number(l.owner_id)===Number(currentUser?.id)?`<button class="btn small ghost tavern-stop-btn" data-id="${l.id}">Đóng bán</button>`:''}
      </article>`).join('')||'<div class="empty-state compact"><p>Chưa có quầy túy phẩm nào.</p></div>'}</div>
    </div>
   </div>
   ${role?`<div class="tavern-panel tavern-invite-panel"><div class="tavern-panel-head"><h3>📜 Mời môn nhân mua rượu</h3><small>Lời mời được xử lý trong Hòm Thư Tửu Lâu.</small></div>
    <form id="tavernInviteForm" class="tavern-invite-form">
      <select id="tavernBuyer"><option value="">Chọn môn nhân</option>${members.map(m=>`<option value="${m.id}">${esc(m.display_name)} · @${esc(m.username)} · ${esc(m.rank)}</option>`).join('')}</select>
      <select id="tavernProduct"><option value="">Chọn túy phẩm</option>${products.filter(p=>p.listed).map(p=>`<option value="${p.id}">${esc(p.name)} · ${Number(p.price).toLocaleString('vi-VN')} linh thạch</option>`).join('')}</select>
      <button class="btn primary" type="submit">🥂 Gửi lời mời</button>
    </form><p id="tavernInviteMsg" class="tavern-msg"></p>
   </div>`:''}
   ${d.isKien?`<div class="tavern-panel tavern-transfer-panel"><div class="tavern-panel-head"><h3>👑 Nhường Tửu Lâu Chi Chủ</h3><small>Chỉ @kien có quyền thực hiện.</small></div>
    <div class="tavern-transfer-form"><select id="tavernTransferTarget"><option value="">Chọn môn nhân tiếp nhận</option>${members.map(m=>`<option value="${m.id}">${esc(m.display_name)} · @${esc(m.username)} · ${esc(m.rank)}</option>`).join('')}</select><button class="btn primary" id="tavernTransferBtn">Nhường vị trí</button></div><p id="tavernTransferMsg" class="tavern-msg"></p></div>`:''}
   <div class="tavern-panel tavern-inbox-panel"><div class="tavern-panel-head"><h3>📬 Hòm Thư Tửu Lâu</h3><small>Lời mời mua rượu riêng của Tửu Lâu</small></div>
    ${inbox.length?`<div class="tavern-inbox-list">${inbox.map(x=>`<article class="tavern-inbox-item" data-id="${x.id}"><div class="tavern-mail-icon">🥂</div><div class="tavern-inbox-content"><b>${esc(x.owner_name)} mời bạn mua ${esc(x.name)}</b><p>${esc(x.grade)} · ${Number(x.price).toLocaleString('vi-VN')} linh thạch</p><small>Chọn nơi hấp thu túy phẩm rồi xác nhận thanh toán.</small><div class="tavern-destination"><label><input type="radio" name="tavernDest${x.id}" value="tavern" checked> 🍶 Tửu Lâu</label><label><input type="radio" name="tavernDest${x.id}" value="sumeru"> ◈ Tu Di Giới</label></div><div class="mail-actions"><button class="btn small primary tavern-invite-accept" data-id="${x.id}">✓ Đồng ý · Trả linh thạch</button><button class="btn small ghost tavern-invite-reject" data-id="${x.id}">✕ Từ chối</button><span class="mail-action-msg"></span></div></div></article>`).join('')}</div>`:'<div class="empty-state compact"><p>Hòm Thư Tửu Lâu đang tĩnh lặng.</p></div>'}
   </div>
   <div class="tavern-panel"><div class="tavern-panel-head"><h3>🎒 Túy Phẩm của ta</h3><small>Kho hấp thu tại Tửu Lâu</small></div>
    <div class="tavern-inventory">${inv.map(x=>`<span class="tavern-inv-item">🍶 ${esc(x.name)} <b>×${x.quantity}</b><button class="btn small tavern-consume-btn" data-product="${x.product_id}">🍶 Ngộ Túy · Nhập tửu</button></span>`).join('')||'<small>Chưa có túy phẩm.</small>'}</div>
   </div>`;
  $('#tavernApplyBtn')?.addEventListener('click',async()=>{});
  document.querySelectorAll('.tavern-list-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;try{const r=await api('/api/tavern/listings',{method:'POST',headers:authHeaders(),body:JSON.stringify({productId:Number(btn.dataset.product)})});alert(r.message);await loadTavern();}catch(e){alert(e.message);btn.disabled=false;}
  }));
  document.querySelectorAll('.tavern-stop-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    try{await api('/api/tavern/listings/stop',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(btn.dataset.id)})});await loadTavern();}catch(e){alert(e.message);}
  }));
  $('#tavernInviteForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const buyer=Number($('#tavernBuyer').value),product=Number($('#tavernProduct').value),msg=$('#tavernInviteMsg');
    if(!buyer||!product){if(msg)msg.textContent='❌ Hãy chọn môn nhân và túy phẩm.';return;}
    try{const r=await api('/api/tavern/invite',{method:'POST',headers:authHeaders(),body:JSON.stringify({buyerId:buyer,productId:product})});if(msg)msg.textContent='✓ '+r.message;e.target.reset();await loadTavern();}catch(err){if(msg)msg.textContent='❌ '+err.message;}
  });
  $('#tavernTransferBtn')?.addEventListener('click',async()=>{
    const target=Number($('#tavernTransferTarget').value),msg=$('#tavernTransferMsg'),btn=$('#tavernTransferBtn');
    if(!target){msg.textContent='❌ Hãy chọn môn nhân tiếp nhận.';return;}
    if(!confirm('Xác nhận nhường Tửu Lâu Chi Chủ?'))return;
    btn.disabled=true;try{const r=await api('/api/tavern/transfer',{method:'POST',headers:authHeaders(),body:JSON.stringify({targetId:target})});msg.textContent='✓ '+r.message;await loadTavern();await loadProfile();await loadData();}catch(e){msg.textContent='❌ '+e.message;btn.disabled=false;}
  });
  document.querySelectorAll('.tavern-invite-accept').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=Number(btn.dataset.id),item=btn.closest('.tavern-inbox-item'),dest=item?.querySelector(`input[name="tavernDest${id}"]:checked`)?.value||'tavern';
    const msg=item?.querySelector('.mail-action-msg');btn.disabled=true;
    try{const r=await api('/api/tavern/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:id,action:'accept',destination:dest})});if(msg)msg.textContent='✓ '+r.message;await loadTavern();await loadProfile();}catch(e){if(msg)msg.textContent='❌ '+e.message;btn.disabled=false;}
  }));
  document.querySelectorAll('.tavern-invite-reject').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=Number(btn.dataset.id),item=btn.closest('.tavern-inbox-item'),msg=item?.querySelector('.mail-action-msg');btn.disabled=true;
    try{const r=await api('/api/tavern/invite/respond',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId:id,action:'reject'})});if(msg)msg.textContent='✓ '+r.message;await loadTavern();}catch(e){if(msg)msg.textContent='❌ '+e.message;btn.disabled=false;}
  }));
  document.querySelectorAll('.tavern-consume-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;try{const r=await api('/api/tavern/consume',{method:'POST',headers:authHeaders(),body:JSON.stringify({productId:Number(btn.dataset.product)})});alert(r.message);await Promise.all([loadTavern(),loadProfile(),loadData()]);}catch(e){alert(e.message);btn.disabled=false;}
  }));
 }catch(e){area.innerHTML=`<div class="empty-state compact"><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadTavern()">↻ Mở lại</button></div>`;}
}

async function loadMailbox(){
 const area=$('#mailboxArea'),badge=$('#mailboxBadge'); if(!area||!getToken())return;
 try{
  const d=await api('/api/mailbox',{headers:authHeaders()});
  try{const ba=await api('/api/beast-arena',{headers:authHeaders()});d.beastsForArena=ba.beasts||[];}catch{}
  if(badge)badge.style.display=Number(d.unread||0)>0?'inline-flex':'none';
  area.innerHTML=`<div class="mailbox-toolbar"><label><input id="mailboxToggle" type="checkbox" ${d.enabled?'checked':''}> 🔔 Nhận thông báo Hòm Thư</label><button id="mailboxReadAll" class="btn small ghost">Đánh dấu tất cả đã đọc</button><span>Chưa đọc: <b>${Number(d.unread||0)}</b></span></div><div class="mailbox-list">${(d.rows||[]).map(x=>{
    const a=x.actionData||null;
    const actionable=Boolean(a?.action && (a.requestId||a.invitationId) && !x.read_at);
    const icon=x.type==='challenge'?'⚔️':x.type==='beast_challenge'?'🪶':x.type==='friend'?'🤝':x.type==='private_chat'?'💬':x.type==='bicanh_invite'?'🌌':x.type==='tavern_sale'?'🥂':x.type==='alchemy_order'?'⚗️':x.type==='chat_total'?'☯':'📬';
    const beastChoice=actionable&&a?.action==='beast_challenge'&&a?.requestId?`<div class="mail-beast-choice"><select class="mail-beast-select" data-id="${x.id}"><option value="0">Chọn linh thú xuất chiến</option>${(d.beastsForArena||[]).map(b=>`<option value="${b.beast_id}">${esc(b.name)} · ${esc(b.beast_realm)} · ${esc(b.beast_type)}</option>`).join('')}</select><select class="mail-skill-select" data-id="${x.id}"><option value="1">Tuyệt kỹ 1</option><option value="2">Tuyệt kỹ 2</option><option value="3">Tuyệt kỹ 3</option></select></div>`:'';
    const buttons=actionable?`${beastChoice}<div class="mail-actions"><button class="btn small primary mail-accept" data-id="${x.id}">✓ Đồng ý</button><button class="btn small ghost mail-reject" data-id="${x.id}">✕ Từ chối</button><span class="mail-action-msg"></span></div>`:'';
    return `<article class="mail-item ${x.read_at?'':'unread'} ${actionable?'mail-actionable':''}" data-id="${x.id}"><div class="mail-icon">${icon}</div><div class="mail-content"><b>${esc(x.title)}</b><p>${esc(x.message)}</p><small>${new Date(x.created_at).toLocaleString('vi-VN')}</small>${buttons}</div>${x.read_at?'':'<span class="mail-new">MỚI</span>'}</article>`;
  }).join('')||'<div class="empty-state compact"><p>Hòm thư đang tĩnh lặng.</p></div>'}</div>`;
  $('#mailboxToggle').onchange=async e=>{try{await api('/api/mailbox/toggle',{method:'POST',headers:authHeaders(),body:JSON.stringify({enabled:e.target.checked})});}catch(err){e.target.checked=!e.target.checked;}};
  $('#mailboxReadAll').onclick=async()=>{await api('/api/mailbox/read',{method:'POST',headers:authHeaders(),body:JSON.stringify({})});await loadMailbox();};
  document.querySelectorAll('.mail-item.unread').forEach(el=>el.onclick=async ev=>{
    if(ev.target.closest('.mail-actions'))return;
    await api('/api/mailbox/read',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(el.dataset.id)})});await loadMailbox();
  });
  document.querySelectorAll('.mail-accept').forEach(btn=>btn.onclick=async ev=>{
    ev.stopPropagation();
    const id=Number(btn.dataset.id),row=(d.rows||[]).find(x=>Number(x.id)===id);
    await respondMailboxAction(id,'accept',row?.actionData,btn);
  });
  document.querySelectorAll('.mail-reject').forEach(btn=>btn.onclick=async ev=>{
    ev.stopPropagation();
    const id=Number(btn.dataset.id),row=(d.rows||[]).find(x=>Number(x.id)===id);
    await respondMailboxAction(id,'reject',row?.actionData,btn);
  });
 }catch(e){area.innerHTML=`<div class="empty-state compact"><p>${esc(e.message)}</p></div>`;}
}
async function loadChat(){
 if(!getToken())return;
 try{const d=await api('/api/chat',{headers:authHeaders()});renderChat(d.rows,d.elderSettings);}catch(e){if(getToken())$('#chatArea').innerHTML=`<div class="empty-state compact"><p>${esc(e.message)}</p></div>`;}
}
function renderChat(rows,elderSettings=null){
 const settings=elderSettings?.canEdit?`<form id="elderNoticeForm" class="elder-notice-panel"><div><span class="eyebrow">⚜️ ĐỔI THÔNG BÁO</span><b>Thông báo khi bạn bước vào Chat Tổng · Top ${elderSettings.rank}</b><small>Mặc định: ${esc(elderSettings.defaultMessage)}</small></div><input id="elderNoticeInput" maxlength="120" value="${esc(elderSettings.message)}" placeholder="Nhập thông báo của bạn..."><button class="btn primary">Lưu thông báo</button><p id="elderNoticeMsg" class="train-msg"></p></form>`:'';
 $('#chatArea').innerHTML=settings+`<div class="chat-window" id="chatWindow">${rows.length?rows.map(x=>{const arrival=Boolean(x.isArrival);return arrival?`<article class="elder-arrival"><span>⛩️</span><b>${esc(x.message)}</b><small>${esc(x.display_name)} đã bước vào Chat Tổng · Top ${Number(x.elderRank||0)}</small></article>`:`<article class="chat-msg ${Number(x.user_id)===Number(currentProfile?.user_id)?'mine':''}"><span class="chat-avatar">${avatarHtml(x.avatar,'',x.realmIndex??realmIndexOf(x.rank),x.auraRank)}</span><div><div class="chat-meta"><b>${esc(x.display_name)}</b>${x.isElder?`<span class="elder-badge">👑 Top ${Number(x.elderRank||0)}</span>`:''}<span>${esc(x.rank)}</span><time>${new Date(x.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${esc(x.message)}</p></div></article>`;}).join(''):`<div class="chat-empty">Sơn môn còn tĩnh lặng. Hãy gửi lời chào đầu tiên.</div>`}</div><form id="chatForm" class="chat-form"><input id="chatInput" maxlength="500" autocomplete="off" placeholder="Truyền âm tới toàn môn..." required><button class="btn primary">Gửi</button></form><p id="chatMsg" class="train-msg"></p>`;
 const w=$('#chatWindow');w.scrollTop=w.scrollHeight;
 $('#chatForm').onsubmit=async e=>{e.preventDefault();const input=$('#chatInput');const msg=$('#chatMsg');try{await api('/api/chat',{method:'POST',headers:authHeaders(),body:JSON.stringify({message:input.value})});input.value='';await loadChat();}catch(err){msg.textContent=err.message;}};
 $('#elderNoticeForm')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('#elderNoticeMsg'),btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const x=await api('/api/elder-notification',{method:'PATCH',headers:authHeaders(),body:JSON.stringify({message:$('#elderNoticeInput').value})});msg.textContent='✓ Đã đổi thông báo: '+x.message;await loadChat();}catch(err){msg.textContent='❌ '+err.message;}finally{btn.disabled=false;}});
}

function accountSummary(){
 if(!currentProfile)return renderAuth('login');
 $('#accountContent').innerHTML=`<div class="account-box"><div class="avatar-mini">${avatarHtml(currentProfile.avatar,'',currentProfile.realmIndex)}</div><span class="eyebrow">ĐÃ NHẬP MÔN</span><h3>${esc(currentProfile.display_name)}</h3><p>${esc(currentProfile.stage||currentProfile.rank)} · ${esc(currentProfile.title)}</p><p>Linh lực: <b>${Number(currentProfile.spirit_power).toLocaleString('vi-VN')}</b></p><p>Linh thạch: <b>💎 ${Number(currentProfile.spirit_stones||0).toLocaleString('vi-VN')}</b></p><div class="account-actions"><button id="profileEditQuick" class="btn primary">Hồ sơ đệ tử</button><button id="logoutBtn" class="btn ghost">Rời phiên</button></div></div>`;
 $('#accountModal').showModal();$('#profileEditQuick').onclick=()=>{ $('#accountModal').close();openProfileEditor(); };$('#logoutBtn').onclick=logout;
}
function openAccount(){if(getToken())accountSummary();else renderAuth('login');}
function renderAuth(mode){
 const register=mode==='register';
 $('#accountContent').innerHTML=`<div class="auth-title">寒天門</div><div class="auth-sub">Ghi danh môn nhân · Dữ liệu được lưu trong PostgreSQL</div><div class="tabs"><button class="tab ${!register?'active':''}" data-mode="login">Đăng nhập</button><button class="tab ${register?'active':''}" data-mode="register">Đăng ký</button></div><form id="authForm" class="auth-form"><div class="field ${register?'':'hidden'}"><label>Danh xưng</label><input id="displayName" maxlength="40" ${register?'required':''} placeholder="Tên hiển thị"></div><div class="field"><label>Tên tài khoản</label><input id="username" required minlength="3" maxlength="24" autocomplete="username" placeholder="tu_tien_01"></div><div class="field"><label>Mật khẩu</label><input id="password" type="password" required minlength="6" autocomplete="current-password" placeholder="Ít nhất 6 ký tự"></div><button class="btn primary" type="submit">${register?'Ghi danh vào sơn môn':'Nhập môn'}</button><div id="authMsg" class="auth-msg"></div></form>`;
 document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>renderAuth(b.dataset.mode));
 $('#authForm').onsubmit=async e=>{e.preventDefault();const msg=$('#authMsg');msg.textContent='Đang xử lý...';const body={username:$('#username').value.trim(),password:$('#password').value};if(register)body.displayName=$('#displayName').value.trim();try{if(register){await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});msg.textContent='Ghi danh thành công. Đang mở cổng nhập môn...';setTimeout(()=>renderAuth('login'),500);}else{const d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});localStorage.setItem(tokenKey,d.token);accountUI(d.user);$('#accountModal').close();await loadProfile();
// loadProfile đã khởi động các module hồ sơ/công pháp/động phủ/kho chính.
// Chỉ tải các module chưa được khởi động ở đây và chạy song song để giảm thời gian đăng nhập.
await Promise.all([loadChat(),loadMailbox(),loadSectPosts(),loadLeaderboard(),loadDanDuong(),loadDuocDuong(),loadBeastFace(),loadDuongThu(),loadBeastArena(),loadTuDi(),loadMarket(),loadBlackMarket(),loadData(),loadArenaLive()]);
maybeShowTutorial();}}catch(err){msg.textContent=err.message;}};
 $('#accountModal').showModal();
}
async function logout(){try{await api('/api/logout',{method:'POST',headers:authHeaders()});}catch{}finally{localStorage.removeItem(tokenKey);currentProfile=null;accountUI(null);$('#accountModal').close();renderGuestAreas();}}

$('#modalClose').onclick=()=>$('#memberModal').close();$('#accountClose').onclick=()=>$('#accountModal').close();$('#friendChatClose').onclick=()=>$('#friendChatModal').close();
$('#memberModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#accountModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#friendChatModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};
$('#searchInput').oninput=e=>{const q=e.target.value.toLowerCase().trim();renderMembers(members.filter(m=>[m.name,m.nick,m.role,...m.tags].join(' ').toLowerCase().includes(q)));};
$('#accountBtn').onclick=openAccount;$('#joinBtn').onclick=()=>getToken()?accountSummary():renderAuth('register');
$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');$('#themeBtn').textContent=dark?'☀':'☾';localStorage.setItem('theme',dark?'dark':'light');};
$('#colorModeBtn').onclick=()=>{document.body.classList.toggle('color-flow');const enabled=document.body.classList.contains('color-flow');localStorage.setItem('colorMode',enabled?'flow':'normal');$('#colorModeBtn').textContent=enabled?'✨':'🌈';};
$('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));$('#topBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});
if(localStorage.getItem('theme')==='dark'){document.body.classList.add('dark');$('#themeBtn').textContent='☀';}
if(localStorage.getItem('colorMode')==='flow'){document.body.classList.add('color-flow');$('#colorModeBtn').textContent='✨';}
setupTutorial();

loadData();loadSect();checkSession();startRewardWatcher();
setInterval(()=>{if(getToken()&&!document.hidden){loadChat();loadData();loadMailbox();loadArenaLive();loadChallenges();}},30000);
setInterval(()=>{if(getToken()&&!document.hidden)sendPresenceHeartbeat();},45000);
window.addEventListener('beforeunload',()=>{const token=getToken();if(token)navigator.sendBeacon('/api/presence/heartbeat',new Blob(['{}'],{type:'application/json'}));});

/* v3.6.47 · Điều hướng tập trung theo từng chức năng */
(function setupFocusNavigation(){
 const focusBar=$('#focusBar'),focusLabel=$('#focusBarLabel'),focusExit=$('#focusExit');
 const labels={
  'tan-nhan':'✦ Tân Nhân','profile':'☯ Hồ Sơ','disciples':'👑 Sư Đồ','cultivation':'☯ Tu Luyện','codex':'📚 Tàng Thư Các','tien-phap':'🌌 Tiên Pháp','mansion':'🏯 Động Phủ','professions':'🛠 Nghiệp Vụ','quests':'📜 Nhiệm Vụ Đường','challenge':'⚔ Khiêu Chiến','arena-live':'👁 Lôi Đài Trực Chiến','treasure':'💎 Tàng Bảo Các','tien-ban':'🎴 Tiên Bàn','dan-cac':'⚗️ Đan Các','dan-duong':'🧪 Đan Đường','beast-house':'🐉 Thú Đường','beast-face':'🖼️ Thú Diện','duong-thu':'💗 Dưỡng Thú','beast-arena':'🪶 Thú Trường','linh-phap':'🌿 Linh Pháp','equipment':'⚔ Trang Bị','bicanh':'🌌 Bí Cảnh','sumeru':'◈ Tu Di Giới','market':'🏮 Phường Thị','sect':'☁ Hàn Thiên Ký Sự','sect-posts':'📜 Đăng Bài','chat':'☯ Chat Tổng','mailbox':'📬 Hòm Thư','members':'☯ Môn Nhân','xuatquan':'🟢 Xuất Quan','leaderboard':'🏆 Thành Tích','linhcanbang':'🌿 Linh Căn Bảng','linhthubang':'🐉 Linh Thú Bảng','gallery':'◈ Truyền Kỳ','audio':'🔊 Âm Thanh','timeline':'☯ Môn Sử'
 };
 const sections=()=>Object.keys(labels).map(id=>document.getElementById(id)).filter(Boolean);
 function exitFocus(push=true){
   document.body.classList.remove('focus-mode','focus-lock');document.documentElement.classList.remove('focus-lock');
   sections().forEach(s=>s.classList.remove('focus-active'));
   if(push && location.hash && location.hash!=='#home') history.pushState('',document.title,location.pathname+location.search);
   window.scrollTo({top:0,behavior:'smooth'});
 }
 function enterFocus(id,push=true){
   const target=document.getElementById(id); if(!target)return;
   document.body.classList.add('focus-mode','focus-lock');document.documentElement.classList.add('focus-lock');
   sections().forEach(s=>s.classList.toggle('focus-active',s===target));
   if(focusLabel)focusLabel.textContent=labels[id]||target.querySelector('h2')?.textContent||'Chế độ tập trung';
   if(push)history.pushState(null,'','#'+id);
   requestAnimationFrame(()=>{target.scrollTop=0;target.querySelector('.section-head')?.scrollIntoView({block:'start'});});
   $('#nav')?.classList.remove('open');
 }
 function handleAnchor(a){
   const href=a.getAttribute('href')||''; if(!href.startsWith('#'))return;
   const id=href.slice(1); if(id==='home'||!labels[id]){if(id==='home')exitFocus(false);return;}
   const target=document.getElementById(id);if(!target)return;
   a.addEventListener('click',e=>{e.preventDefault();enterFocus(id,true);});
 }
 document.querySelectorAll('a[href^="#"]').forEach(handleAnchor);
 focusExit?.addEventListener('click',()=>exitFocus(true));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus-mode'))exitFocus(true);});
 window.addEventListener('popstate',()=>{const id=location.hash.slice(1);if(id&&labels[id])enterFocus(id,false);else exitFocus(false);});
 const initial=location.hash.slice(1);if(initial&&labels[initial])setTimeout(()=>enterFocus(initial,false),0);
})();

/* v3.6.75 · Ghim nhanh vị trí trọng yếu */
(function setupPinnedLocations(){
 const ids=['black-market','dan-duong','tavern'];
 const labels={'black-market':'🕶️ Chợ Đen','dan-duong':'🧪 Đan Đường','tavern':'🥂 Tửu Lâu'};
 let pinned=[]; try{pinned=JSON.parse(localStorage.getItem('htm_pinned_locations')||'[]').filter(x=>ids.includes(x));}catch{}
 const save=()=>localStorage.setItem('htm_pinned_locations',JSON.stringify(pinned));
 const go=id=>document.querySelector(`#nav a[href="#${id}"]`)?.click();
 const bar=document.createElement('div');bar.id='pinnedLocations';bar.className='pinned-locations';document.body.appendChild(bar);
 function render(){
  bar.innerHTML=`<span class="pinned-title">📌 Ghim nhanh</span>${pinned.map(id=>`<button type="button" class="pinned-location-btn" data-go="${id}">${labels[id]}</button>`).join('')}<button type="button" class="pinned-manage" title="Quản lý ghim">⚙</button>`;
  bar.classList.toggle('has-pins',pinned.length>0);
  bar.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  bar.querySelector('.pinned-manage')?.addEventListener('click',()=>{pinned=pinned.length?[]:ids.slice();save();render();document.querySelectorAll('.location-pin-toggle').forEach(b=>b.classList.toggle('active',pinned.includes(b.dataset.pin)));});
 }
 ids.forEach(id=>{
  const sec=document.getElementById(id); if(!sec)return;
  const head=sec.querySelector('.section-head'); if(!head)return;
  const btn=document.createElement('button');btn.type='button';btn.className='location-pin-toggle';btn.dataset.pin=id;btn.innerHTML='📌 Ghim';btn.title='Ghim vị trí này để mở nhanh';
  btn.classList.toggle('active',pinned.includes(id));
  btn.onclick=()=>{pinned=pinned.includes(id)?pinned.filter(x=>x!==id):[...pinned,id];save();render();btn.classList.toggle('active',pinned.includes(id));};
  head.appendChild(btn);
 });
 render();
})();

/* v3.6.57 · Trình phát nhạc nền kiểu streaming · MP4/AAC + MP3 fallback + Media Session */
(function setupBackgroundMusic(){
 const audio=$('#backgroundMusic'),playBtn=$('#audioPlayBtn'),stopBtn=$('#audioStopBtn'),status=$('#audioStatus'),msg=$('#audioMsg'),volume=$('#audioVolume'),volumeValue=$('#audioVolumeValue');
 if(!audio||!playBtn||!stopBtn)return;
 const musicKey='htm_background_music',volumeKey='htm_background_volume';
 let savedVolume=parseFloat(localStorage.getItem(volumeKey));
 if(!Number.isFinite(savedVolume))savedVolume=.5;
 savedVolume=Math.max(0,Math.min(1,savedVolume));
 audio.volume=savedVolume; if(volume)volume.value=String(savedVolume);
 if(volumeValue)volumeValue.textContent=Math.round(savedVolume*100)+'%';
 let desiredPlay=localStorage.getItem(musicKey)==='on';
 let loadingPromise=null;
 function setStatus(playing,text){
   if(status){status.textContent=playing?'🔊 ĐANG PHÁT':'🔇 ĐANG NGƯNG';status.classList.toggle('audio-playing',playing);}
   if(msg)msg.textContent=text;
   playBtn.disabled=playing;stopBtn.disabled=!playing;
 }
 function mediaMeta(){
   if(!('mediaSession' in navigator))return;
   try{navigator.mediaSession.metadata=new MediaMetadata({title:'Tinh Vệ · Hàn Thiên Môn',artist:'Hàn Thiên Môn',album:'Nhạc nền tiên hiệp'});}catch{}
 }
 async function waitForReady(){
   if(audio.readyState>=2)return;
   if(loadingPromise)return loadingPromise;
   loadingPromise=new Promise((resolve,reject)=>{
     const ok=()=>{cleanup();resolve();}, bad=()=>{cleanup();reject(new Error('audio-load'))};
     const cleanup=()=>{audio.removeEventListener('canplay',ok);audio.removeEventListener('error',bad);};
     audio.addEventListener('canplay',ok,{once:true});audio.addEventListener('error',bad,{once:true});
     audio.load();
   }).finally(()=>{loadingPromise=null;});
   return loadingPromise;
 }
 async function start(fromGesture=false){
   desiredPlay=true; localStorage.setItem(musicKey,'on');
   try{
     audio.loop=true; audio.muted=false; audio.volume=savedVolume;
     await waitForReady();
     await audio.play();
     mediaMeta(); setStatus(true,'Nhạc nền đang phát liên tục.');
   }catch(e){
     setStatus(false,fromGesture?'Không phát được âm thanh. Hãy chạm Khởi Nhạc thêm một lần.':'Đã ghi nhớ phát nhạc. Chạm vào trang để trình duyệt cho phép âm thanh.');
   }
 }
 function stop(){desiredPlay=false;localStorage.setItem(musicKey,'off');audio.pause();try{audio.currentTime=0;}catch{}setStatus(false,'Đã ngưng nhạc nền.');}
 playBtn.addEventListener('click',()=>start(true));
 stopBtn.addEventListener('click',stop);
 if(volume)volume.addEventListener('input',()=>{savedVolume=Math.max(0,Math.min(1,Number(volume.value)));audio.volume=savedVolume;localStorage.setItem(volumeKey,String(savedVolume));if(volumeValue)volumeValue.textContent=Math.round(savedVolume*100)+'%';});
 audio.addEventListener('play',()=>{mediaMeta();setStatus(true,'Nhạc nền đang phát liên tục.');});
 audio.addEventListener('pause',()=>{if(!audio.ended&&desiredPlay)setStatus(false,'Tạm dừng · chạm Khởi Nhạc để tiếp tục.');else if(!audio.ended)setStatus(false,'Đã ngưng nhạc nền.');});
 audio.addEventListener('ended',()=>{if(desiredPlay){audio.currentTime=0;start(false);}});
 audio.addEventListener('error',()=>setStatus(false,'Không đọc được luồng nhạc. Đang thử định dạng dự phòng…'));
 audio.addEventListener('stalled',()=>{if(desiredPlay)setTimeout(()=>{if(audio.paused)start(false);},800);});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&desiredPlay&&audio.paused)start(false);});
 ['pointerdown','touchend','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(desiredPlay&&audio.paused)start(false);},{passive:true}));
 if('mediaSession' in navigator){
   try{navigator.mediaSession.setActionHandler('play',()=>start(true));navigator.mediaSession.setActionHandler('pause',stop);navigator.mediaSession.setActionHandler('stop',stop);}catch{}
 }
 setStatus(false,desiredPlay?'Đã ghi nhớ phát nhạc · chạm màn hình để mở khóa âm thanh.':'Đang ngưng nhạc.');
})();

