let members=[], memories=[], timeline=[];
let currentProfile=null, currentUser=null;
const $=s=>document.querySelector(s);
const tokenKey='han_thien_token';
const getToken=()=>localStorage.getItem(tokenKey);
const authHeaders=()=>getToken()?{'Authorization':'Bearer '+getToken(),'Content-Type':'application/json'}:{'Content-Type':'application/json'};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=v=>v?new Date(v).toLocaleDateString('vi-VN'):'—';
const REALM_NAMES=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
const realmIndexOf=name=>Math.max(0,REALM_NAMES.indexOf(String(name||'')));

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
  renderMembers(); renderGallery(); renderTimeline(); renderLegendEditor();
 }catch(e){console.error(e);}
}
function renderMembers(list=members){
 $('#membersGrid').innerHTML=list.length?list.map((m)=>`<article class="member-card" data-index="${members.indexOf(m)}"><div class="avatar">${esc(m.emoji||'🧑🏻‍🎓')}</div><div class="member-info"><span class="nickname">${esc(m.nick||'')}</span><h3>${esc(m.name)}</h3><p>${esc(m.role||'Đệ tử')}</p><div class="tags">${(Array.isArray(m.tags)?m.tags:[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div></div></article>`).join(''):`<p>Không tìm thấy môn nhân phù hợp.</p>`;
 document.querySelectorAll('.member-card').forEach(c=>c.onclick=()=>openMember(+c.dataset.index));
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
 $('#modalContent').innerHTML=`<div class="modal-avatar">${esc(m.emoji)}</div><div class="modal-content"><span class="nickname">${esc(m.nick)}</span><h2>${esc(m.name)}</h2><p>${esc(m.bio||'Đã ghi danh vào Hàn Thiên Môn.')}</p><div class="facts"><div class="fact"><small>Cảnh giới</small><b>${esc(m.rank||'Luyện Khí')} · ${esc(m.realm_tier||1)}/9</b></div><div class="fact"><small>Linh lực</small><b>${Number(m.spirit_power||0).toLocaleString('vi-VN')}</b></div><div class="fact"><small>Sinh nhật</small><b>${esc(m.birthday||'—')}</b></div><div class="fact"><small>Sở thích</small><b>${esc(m.hobby||'—')}</b></div></div><div class="tags">${(m.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>${!getToken()||isSelf?'':`<div class="friend-actions" id="memberFriendActions"><button class="btn small primary" id="memberFriendBtn">🤝 Đang kiểm tra...</button><button class="btn small ghost hidden" id="memberChatBtn">💬 Chat riêng</button></div><div class="discipleship-actions" id="memberDiscipleshipActions"><button class="btn small primary" id="memberDiscipleshipBtn">👑 Đang kiểm tra Sư Đồ...</button></div><p id="memberDiscipleshipMsg" class="train-msg"></p><div class="challenge-actions"><button class="btn small primary" id="memberOnlineChallengeBtn">⚔ Mở lôi đài Online</button><button class="btn small ghost" id="memberOfflineChallengeBtn">🌓 Khiêu chiến Offline</button></div><p id="memberFriendMsg" class="train-msg"></p><p id="memberChallengeMsg" class="train-msg"></p>`}</div>`;
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
  const users=d.users||[], pending=d.pending||[], history=d.history||[], me=d.me||{}, battle=d.activeBattle||null;
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
    <div class="battle-turn-note">${battle.yourTurn?'<b>⚡ Đến lượt bạn!</b> Tung tuyệt chiêu để gây sát thương.':'⏳ Đang chờ đối thủ tung tuyệt chiêu...'}</div>
    ${battle.lastAction?`<div class="battle-last-action">${esc(battle.lastAction)} · <b>-${Number(battle.lastDamage||0).toLocaleString('vi-VN')} HP</b></div>`:''}
    <button class="btn primary battle-ultimate" data-id="${battle.id}" ${battle.yourTurn?'':'disabled'}>${battle.yourTurn?'⚡ TUNG TUYỆT CHIÊU':'⏳ CHỜ ĐỐI THỦ'}</button>
    <small class="battle-rule">Sát thương được tính theo Công lực + trang bị và điều chỉnh trực tiếp theo chênh lệch cảnh giới; cảnh giới cao hơn gây sát thương lớn hơn, cảnh giới thấp hơn gây sát thương giảm mạnh.</small>
   </div>`:'';
  area.innerHTML=`
   ${debuffActive?`<div class="challenge-debuff"><b>☠ ${esc(me.challenge_debuff_text||'Khiêu chiến thất bại: đang chịu debuff.')}</b><small>Debuff còn hiệu lực đến ${new Date(me.challenge_debuff_until).toLocaleString('vi-VN')}</small></div>`:''}
   ${battleHtml}
   <div class="challenge-rules"><div><span class="eyebrow">⚔ ONLINE · LÔI ĐÀI</span><h3>Đánh theo lượt</h3><p>Đối phương đồng thuận rồi hai bên lần lượt tung tuyệt chiêu. Ai hết thanh máu trước sẽ thất bại.</p></div><div><span class="eyebrow">🌓 OFFLINE · MÔ PHỎNG</span><h3>Đánh với bản mô phỏng</h3><p>Không cần đối phương online. Chế độ này vẫn dùng quy tắc chênh cảnh giới.</p></div><div><span class="eyebrow">☯ QUY LUẬT CẢNH GIỚI</span><h3>Sát thương theo cảnh giới</h3><p>Cùng cảnh giới sẽ cân bằng hơn; cảnh giới cao hơn có hệ số sát thương tăng, cảnh giới thấp hơn bị giảm sát thương.</p></div></div>
   ${pending.length?`<div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">📨 LỜI MỜI LÔI ĐÀI</span><b>${pending.length} lời mời đang chờ</b></div><div class="challenge-list">${pending.map(x=>`<article class="challenge-card incoming"><span class="challenge-avatar">${esc(x.avatar||'⚔')}</span><div><b>${esc(x.challenger_name)}</b><small>${esc(x.rank)} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary challenge-accept" data-id="${x.id}">Đồng thuận</button><button class="btn small ghost challenge-reject" data-id="${x.id}">Từ chối</button></article>`).join('')}</div></div>`:''}
   <div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">🎯 CHỌN ĐỐI THỦ</span><b>${users.length} môn nhân</b></div><div class="challenge-list">${users.length?users.map(x=>`<article class="challenge-card"><span class="challenge-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank)} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small>${Number(x.challenge_debuff_percent||0)>0?`<small class="debuff-mini">☠ Đang chịu debuff ${x.challenge_debuff_percent}%</small>`:''}</div><div class="challenge-card-actions"><button class="btn small primary challenge-online" data-id="${x.id}" ${battle?'disabled':''}>⚔ Online</button><button class="btn small ghost challenge-offline" data-id="${x.id}" ${battle?'disabled':''}>🌓 Offline</button></div></article>`).join(''):`<div class="empty-state compact"><p>Chưa có môn nhân khác để khiêu chiến.</p></div>`}</div></div>
   <div class="challenge-block"><div class="challenge-subhead"><span class="eyebrow">📜 CHIẾN TÍCH</span><b>${history.length} trận gần đây</b></div><div class="challenge-history">${history.length?history.map(h=>{const meId=Number(currentUser?.id),won=Number(h.winner_id)===meId,pendingStatus=h.status==='pending',activeStatus=h.status==='accepted';return `<article class="challenge-history-row"><span>${h.mode==='online'?'⚔':'🌓'}</span><div><b>${won?'🏆 Thắng':h.status==='rejected'?'Từ chối':activeStatus?'⚔ Đang giao chiến':pendingStatus?'⌛ Chờ':'💀 Thất bại'}</b><small>${esc(Number(h.challenger_id)===meId?h.opponent_name:h.challenger_name)} · ${new Date(h.created_at).toLocaleString('vi-VN')}</small></div><div class="challenge-result-text">${won?`+${Number(h.reward_spirit||0).toLocaleString('vi-VN')} linh lực${h.reward_item_name?` · ${esc(h.reward_item_name)} ×${h.reward_quantity}`:''}`:esc(h.penalty_text||'')}</div></article>`}).join(''):`<div class="empty-state compact"><p>Chưa có chiến tích.</p></div>`}</div></div>
   <p id="challengeMsg" class="train-msg"></p>`;
  document.querySelectorAll('.challenge-online').forEach(b=>b.onclick=()=>runChallenge(Number(b.dataset.id),'online'));
  document.querySelectorAll('.challenge-offline').forEach(b=>b.onclick=()=>runChallenge(Number(b.dataset.id),'offline'));
  document.querySelectorAll('.challenge-accept').forEach(b=>b.onclick=()=>respondChallenge(Number(b.dataset.id),'accept'));
  document.querySelectorAll('.challenge-reject').forEach(b=>b.onclick=()=>respondChallenge(Number(b.dataset.id),'reject'));
  document.querySelectorAll('.battle-ultimate').forEach(b=>b.onclick=()=>useUltimate(Number(b.dataset.id)));
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function useUltimate(requestId){
 const b=document.querySelector(`.battle-ultimate[data-id="${requestId}"]`),msg=$('#challengeMsg'); if(b)b.disabled=true;
 try{
  const x=await api('/api/challenges/online/action',{method:'POST',headers:authHeaders(),body:JSON.stringify({requestId})});
  msg.textContent=x.status==='completed'?`🏆 ${x.message}`:`⚡ ${x.message}`;
  await Promise.all([loadProfile(),loadChallenges(),loadLeaderboard()]);
 }catch(e){msg.textContent='❌ '+e.message;await loadChallenges();}
}

async function runChallenge(userId,mode){
 const b=document.querySelector(`.${mode==='online'?'challenge-online':'challenge-offline'}[data-id="${userId}"]`); if(b)b.disabled=true;
 const msg=$('#challengeMsg');
 try{
  const x=await api(mode==='online'?'/api/challenges/online/request':'/api/challenges/offline',{method:'POST',headers:authHeaders(),body:JSON.stringify({userId})});
  msg.textContent=mode==='online'?`🏟 ${x.message}`:(x.win?`🏆 Khiêu chiến thắng! +${Number(x.reward?.gain||0).toLocaleString('vi-VN')} linh lực · 🎁 ${x.reward?.item?.name||'Vật phẩm ngẫu nhiên'} ×1 · sát thương hiệu lực ${x.damageMultiplier}%.`:`💀 Khiêu chiến thất bại. ${x.penalty||''}`);
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
  ${mentor?`<div class="friend-subtitle">🛡 SƯ PHỤ CỦA BẠN</div><div class="friend-list"><article class="friend-card"><span class="friend-avatar">${esc(mentor.avatar||'👑')}</span><div><b>${esc(mentor.mentor_name)}</b><small>${esc(mentor.rank||'Luyện Hư')} · ${Number(mentor.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><span class="tag">🛡 Bảo hộ</span></article></div>`:''}
  ${disciples.length?`<div class="friend-subtitle">👑 ĐỆ TỬ CỦA BẠN · ${disciples.length}/2</div><div class="friend-list">${disciples.map(x=>`<article class="friend-card disciple-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small><span class="tag">🛡 Được bảo hộ</span></div><div class="disciple-gift-box"><b>🎁 Ban tặng đệ tử</b><div class="disciple-gift-row"><select class="disciple-gift-select" data-disciple="${x.disciple_id}"><option value="stones:0">💎 Linh thạch · Có ${Number(giftInventory.stones||0).toLocaleString('vi-VN')}</option>${(giftInventory.artifacts||[]).map(i=>`<option value="artifact:${i.id}">⚔ ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}${(giftInventory.beasts||[]).map(i=>`<option value="beast:${i.id}">🐉 ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}${(giftInventory.roots||[]).map(i=>`<option value="root:${i.id}">🌿 ${esc(i.name)} ×${Number(i.quantity||0)}</option>`).join('')}</select><input class="disciple-gift-qty" data-disciple="${x.disciple_id}" type="number" min="1" value="1" inputmode="numeric"><button class="btn small primary disciple-gift-btn" data-disciple="${x.disciple_id}">🎁 Tặng</button></div></div></article>`).join('')}</div>`:''}
  ${mentorRequests.length?`<div class="friend-subtitle">📨 LỜI BÁI SƯ ĐẾN</div><div class="friend-list">${mentorRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · Muốn bái sư</small></div><button class="btn small primary disciple-accept-mentor" data-id="${x.id}">Nhận đệ tử</button><button class="btn small ghost disciple-reject-mentor" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${inviteRequests.length?`<div class="friend-subtitle">📨 LỜI MỜI NHẬP MÔN</div><div class="friend-list">${inviteRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">👑</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Luyện Hư')} · Mời bạn làm đệ tử</small></div><button class="btn small primary disciple-accept-invite" data-id="${x.id}">Nhập môn</button><button class="btn small ghost disciple-reject-invite" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${baisRequests.length?`<div class="friend-subtitle">⌛ LỜI BÁI SƯ ĐÃ GỬI</div><div class="friend-list">${baisRequests.map(x=>`<article class="friend-card"><span class="friend-avatar">👑</span><div><b>${esc(x.display_name)}</b><small>Đang chờ sư phụ chấp thuận</small></div></article>`).join('')}</div>`:''}
  ${inviteOut.length?`<div class="friend-subtitle">⌛ LỜI MỜI NHẬP MÔN ĐÃ GỬI</div><div class="friend-list">${inviteOut.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>Đang chờ môn nhân chấp thuận</small></div></article>`).join('')}</div>`:''}
  ${mentorCandidates.length?`<div class="friend-subtitle">🙏 CHỌN SƯ PHỤ · CẢNH GIỚI CAO HƠN</div><div class="friend-list">${mentorCandidates.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'👑')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đạo hữu')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary disciple-request" data-id="${x.id}">🙏 Bái sư</button></article>`).join('')}</div>`:''}
  ${discipleCandidates.length?`<div class="friend-subtitle">📜 MỜI NHẬP MÔN · CẢNH GIỚI THẤP HƠN</div><div class="friend-list">${discipleCandidates.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary disciple-invite" data-id="${x.id}">📜 Mời nhập môn</button></article>`).join('')}</div>`:''}
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
  ${incoming.length?`<div class="friend-subtitle">📨 Lời mời đến</div><div class="friend-list">${incoming.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||x.title||'Đệ tử')}</small></div><button class="btn small primary friend-accept" data-id="${x.id}">Chấp nhận</button><button class="btn small ghost friend-reject" data-id="${x.id}">Từ chối</button></article>`).join('')}</div>`:''}
  ${outgoing.length?`<div class="friend-subtitle">⌛ Đã gửi</div><div class="friend-list">${outgoing.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>Đang chờ chấp nhận</small></div></article>`).join('')}</div>`:''}
  <div class="friend-subtitle">☯ Danh sách bằng hữu</div><div class="friend-list">${friends.length?friends.map(x=>`<article class="friend-card"><span class="friend-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><b>${esc(x.display_name)}</b><small>${esc(x.rank||x.title||'Đệ tử')} · ${Number(x.spirit_power||0).toLocaleString('vi-VN')} linh lực</small></div><button class="btn small primary friend-chat" data-id="${x.id}" data-name="${esc(x.display_name)}">💬 Chat</button><button class="btn small ghost friend-remove" data-id="${x.id}">Hủy bạn</button></article>`).join(''):`<div class="empty-state compact"><p>Chưa có bằng hữu. Hãy mở Danh sách môn nhân để kết giao.</p></div>`}</div><p id="friendsMsg" class="train-msg"></p>`;
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
 const render=rows=>{const w=$('#privateChatWindow');w.innerHTML=rows.length?rows.map(x=>`<article class="chat-msg ${Number(x.sender_id)===Number(currentUser?.id)?'mine':''}"><span class="chat-avatar">${esc(x.avatar||'🧑🏻‍🎓')}</span><div><div class="chat-meta"><b>${esc(x.display_name)}</b><time>${new Date(x.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</time></div><p>${esc(x.message)}</p></div></article>`).join(''):`<div class="chat-empty">Hai người chưa có cuộc trò chuyện nào.</div>`;w.scrollTop=w.scrollHeight;};
 const load=async()=>{try{const d=await api('/api/friends/'+userId+'/messages',{headers:authHeaders()});render(d.rows||[]);}catch(e){$('#privateChatMsg').textContent='❌ '+e.message;}};
 await load();
 $('#privateChatForm').onsubmit=async e=>{e.preventDefault();const input=$('#privateChatInput'),msg=$('#privateChatMsg');try{await api('/api/friends/'+userId+'/messages',{method:'POST',headers:authHeaders(),body:JSON.stringify({message:input.value})});input.value='';await load();}catch(err){msg.textContent='❌ '+err.message;}};
 clearInterval(window.privateChatTimer);window.privateChatTimer=setInterval(()=>{if(modal.open)load();},4000);
}


function accountUI(user){
 if(user){currentUser=user;$('#userBadge').textContent='☯ '+user.displayName;$('#userBadge').classList.remove('hidden');$('#accountBtn').textContent='Hồ sơ';}
 else{currentUser=null;$('#userBadge').classList.add('hidden');$('#accountBtn').textContent='☯ Đăng nhập';}
}
async function checkSession(){
 if(!getToken()){accountUI(null);renderGuestAreas();return;}
 try{const d=await api('/api/me',{headers:authHeaders()});accountUI(d.user);await loadProfile();await loadDisciples();await loadCultivationSafe();await loadCodex();await loadSpiritRankings();await loadMansion();await loadChat();await loadLeaderboard();await loadTreasure();await loadBeastHouse();await loadLinhPhap();await loadTuDi();await loadMarket();await loadProfessions();await loadQuests();await loadChallenges();}
 catch{localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}
}
function renderGuestAreas(){
 $('#profileArea').innerHTML=`<div class="empty-state"><div class="empty-seal">寒</div><h3>Đệ tử chưa nhập môn</h3><p>Đăng ký hoặc đăng nhập để mở hồ sơ, linh lực, cảnh giới và thành tích cá nhân.</p><button class="btn primary" onclick="renderAuth('register')">✦ Ghi danh</button></div>`;
 $('#cultivationArea').innerHTML=`<div class="empty-state compact"><h3>Thiên đạo chờ người hữu duyên</h3><p>Đăng nhập để bắt đầu vận công và tích lũy linh lực.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;
 $('#chatArea').innerHTML=`<div class="empty-state compact"><h3>Truyền âm bị phong</h3><p>Chỉ môn nhân đã nhập môn mới có thể vào Chat tổng.</p><button class="btn primary" onclick="renderAuth('register')">Đăng ký</button></div>`;
 $('#challengeArea').innerHTML=`<div class="empty-state compact"><h3>Lôi đài đang phong ấn</h3><p>Đăng nhập để khiêu chiến môn nhân và mô phỏng đối thủ.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#bicanhArea').innerHTML=`<div class="empty-state compact"><h3>Bí Cảnh đang phong ấn</h3><p>Đăng nhập để đóng góp linh thạch, khởi động và thám hiểm Cửu Đại Bí Cảnh.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#treasureArea').innerHTML=`<div class="empty-state compact"><h3>Tàng Bảo Các đang phong ấn</h3><p>Đăng nhập để nhận linh thạch hằng ngày và mua vật phẩm.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; ['#beastHouseArea','#linhPhapArea','#equipmentArea'].forEach(sel=>{const el=$(sel);if(el)el.innerHTML=`<div class="empty-state compact"><h3>Đường vào đang phong ấn</h3><p>Đăng nhập để dùng linh thạch mua Linh Thú và Linh Căn.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;}); $('#questsArea').innerHTML=`<div class="empty-state compact"><h3>Nhiệm Vụ Đường đang phong ấn</h3><p>Đăng nhập để nhận nhiệm vụ và linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; $('#professionsArea').innerHTML=`<div class="empty-state compact"><h3>Nghiệp Vụ đang phong ấn</h3><p>Đăng nhập để tiếp nhận nghề và nhận thù lao linh thạch.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`; ['#codexArea','#mansionArea'].forEach(sel=>{const el=$(sel);if(el)el.innerHTML=`<div class="empty-state compact"><h3>Đường vào đang phong ấn</h3><p>Đăng nhập để mở công pháp và động phủ.</p><button class="btn primary" onclick="renderAuth('login')">Đăng nhập</button></div>`;}); renderLegendEditor();
 loadLeaderboard(); loadSect(); loadCodex(); loadSpiritRankings();
}

async function loadCultivationSafe(){
  if(!getToken())return;
  try{const d=await api('/api/profile',{headers:authHeaders()}); if(d.profile){currentProfile=d.profile;renderCultivation(currentProfile);}}catch(e){const a=$('#cultivationArea');if(a)a.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Vận Công</h3><p>${esc(e.message)}</p><button class="btn small primary" id="retryCultivationBtn">↻ Mở lại Vận Công</button></div>`;$('#retryCultivationBtn')?.addEventListener('click',loadCultivationSafe);}
}
async function loadProfile(){
 try{const d=await api('/api/profile',{headers:authHeaders()});currentProfile=d.profile;renderProfile(currentProfile);renderCultivation(currentProfile);loadFriends();loadDisciples();loadChallenges();loadCodex();loadSpiritRankings();loadMansion();if(Number(currentProfile.trainCount||0)>=Number(currentProfile.maxDaily||10))startOnlineCultivation();else if(onlineTimer){clearInterval(onlineTimer);onlineTimer=null;}loadAchievements();loadTreasure();loadBeastHouse();loadLinhPhap();loadEquipment();loadBicanh();loadProfessions();loadQuests();renderLegendEditor();}
 catch(e){if(e.message.includes('đăng nhập')){localStorage.removeItem(tokenKey);accountUI(null);renderGuestAreas();}}
}
function renderProfile(p){
 $('#profileArea').innerHTML=`<div class="profile-grid">
 <article class="profile-card profile-main"><div class="profile-avatar">${esc(p.avatar)}</div><div class="profile-copy"><span class="eyebrow">${esc(p.position||'Ngoại môn đệ tử')}</span><h3>${esc(p.display_name)}</h3><p class="profile-title">${esc(p.stage)} · ${esc(p.title)}</p><p class="muted">@${esc(p.username)} · Gia nhập ${fmtDate(p.created_at)}</p><div class="tags"><span class="tag">🌿 Linh căn: ${esc(p.spiritRoot||'Chưa định')} · ${esc(p.rootRarity||'—')}</span><span class="tag">🐉 Linh thú: ${esc(p.spiritBeast||'Chưa định')} · ${esc(p.beastRarity||'—')} · ${esc(p.beastRealm||'Nhất Giai')} ${Number(p.beastRealmTier||1)}</span></div><p>${esc(p.bio||'Chưa viết lời tựa cho đạo tâm của mình.')}</p><div class="tags"><span class="tag">${esc(p.sect)}</span><span class="tag">${esc(p.hobby||'Đang tu hành')}</span></div></div><button class="btn small edit-profile" id="editProfileBtn">Sửa hồ sơ</button></article>
 <article class="profile-card profile-stats"><div><span>Linh lực</span><b>${Number(p.spirit_power).toLocaleString('vi-VN')}</b></div><div><span>Linh thạch</span><b class="stone-value">💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></div><div><span>Chiến lực</span><b>⚔ ${Number(p.attributes?.combatPower||0).toLocaleString('vi-VN')}</b></div><div><span>Thành tích</span><b>${p.achievement_points}</b></div></article></div><div class="achievement-panel"><div class="attribute-head"><span class="eyebrow">🏆 THÀNH TÍCH</span><h3>Huy hiệu tu hành</h3></div><div id="achievementList" class="achievement-list"><div class="empty-state compact"><p>Đang tải thành tích...</p></div></div></div><div class="profile-equipment-panel"><div class="attribute-head"><span class="eyebrow">⚔ TRANG BỊ · 裝備</span><h3>Trang bị hiện tại</h3><small>Mỗi khi thay đổi ô trang bị, hồ sơ sẽ cập nhật vật phẩm đang sử dụng và công năng riêng.</small></div><div class="equipment-profile-grid">${[['beast','🐉','Linh Thú'],['root','🌿','Linh Căn'],['artifact','⚔','Pháp Khí']].map(([k,ic,title])=>{const x=p.equipment?.[k];return `<div class="equipment-profile-item ${x?'active':''}"><span class="equipment-profile-icon">${ic}</span><div><b>${title}</b><strong>${x?esc(x.name):'Chưa trang bị'}</strong>${x?`<small>⚔ +${Number(x.power||0).toLocaleString('vi-VN')} chiến lực</small><p>${esc(x.ability||'Không có công năng riêng.')}</p>`:'<small>Ô đang trống</small>'}</div></div>`}).join('')}</div><div class="equipment-profile-total">⚔ Chiến lực từ trang bị: <b>+${Number(p.attributes?.equipmentPower||0).toLocaleString('vi-VN')}</b></div></div><div class="profile-technique-panel"><div class="attribute-head"><span class="eyebrow">📚 CÔNG PHÁP ĐÃ HỌC</span><h3>${Number(p.techniqueCount||0)}/${Number(p.techniqueSlots||0)} công pháp</h3><small>Chiến lực công pháp +${Number(p.attributes?.techniquePower||0).toLocaleString('vi-VN')}</small></div><div class="profile-technique-list">${(p.techniques||[]).length?(p.techniques||[]).map(t=>`<div><b>${esc(t.name)}</b><span>${esc(t.grade||'')} · ⚔ +${Number(t.power_bonus||0).toLocaleString('vi-VN')}</span><small>${esc(t.ability||'')}</small></div>`).join(''):'<div class="empty-state compact"><p>Chưa học công pháp. Mở Tàng Thư Các để lựa chọn.</p></div>'}</div></div><div class="profile-mansion-panel"><div class="attribute-head"><span class="eyebrow">🏯 ĐỘNG PHỦ</span><h3>${p.mansion?esc(p.mansion.name):'Chưa sở hữu'}</h3><small>${p.mansion?`${esc(p.mansion.grade)} · +${Number(p.mansion.spiritPerHour||0).toLocaleString('vi-VN')} linh lực/giờ · ${p.mansion.active?'ĐANG KHỞI ĐỘNG':'ĐANG NGƯNG'}`:'Mua động phủ để tự động tích linh lực.'}</small></div></div><div class="attribute-panel"><div class="attribute-head"><span class="eyebrow">☯ THUỘC TÍNH ĐỆ TỬ</span><h3>Bảng thuộc tính</h3><small>Thuộc tính tăng theo linh lực, cảnh giới và tầng.</small></div><div class="health-attribute"><div class="health-attribute-head"><span>❤️ Thanh Máu</span><b>${Number(p.attributes?.health||0).toLocaleString('vi-VN')} / ${Number(p.attributes?.healthMax||0).toLocaleString('vi-VN')}</b></div><div class="health-bar"><i style="width:${Math.min(100,Math.max(0,Math.round((Number(p.attributes?.health||0)/Math.max(1,Number(p.attributes?.healthMax||1)))*100)))}%"></i></div>${p.activeBattle?`<small class="health-battle-note">⚔ Đang trong lôi đài online · ${p.activeBattle.yourTurn?'Đến lượt bạn tung tuyệt chiêu.':'Đang chờ đối thủ.'}</small>`:''}</div><div class="attribute-grid">${[['Công lực','⚔',p.attributes?.congLuc],['Phòng thủ','🛡',p.attributes?.phongThu],['Thân pháp','💨',p.attributes?.thanPhap],['Ngộ tính','☯',p.attributes?.ngoTinh],['Khí vận','✦',p.attributes?.khiVan]].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${Number(x[2]||0).toLocaleString('vi-VN')}</strong></div></div>`).join('')}</div></div><div class="random-gifts-panel"><div><span class="eyebrow">🎲 DUYÊN NGẪU NHIÊN · 1 LẦN</span><h3>Gieo duyên Linh Căn & Linh Thú</h3><p>Mỗi đệ tử chỉ được gieo duyên <b>1 lần duy nhất</b>. Độ hiếm quyết định sức mạnh và hiệu quả phụ trợ.</p></div><button class="btn small primary" id="randomGiftsBtn" ${p.gachaClaimed?'disabled':''}>${p.gachaClaimed?'✓ Đã gieo duyên':'🎲 Gieo duyên'}</button><div id="randomGiftsMsg" class="train-msg"></div></div>
 <div class="spirit-companion-panel"><div class="attribute-head"><span class="eyebrow">🐉 THUỘC TÍNH LINH THÚ · PHỤ TRỢ</span><h3>${esc(p.spiritBeast||'Chưa có linh thú')}</h3><small>${esc(p.beastRealm||'Nhất Giai')} · ${Number(p.beastRealmTier||1)} · ${esc(p.beastRarity||'—')} · Linh thú hỗ trợ chiến lực và tu luyện theo độ hiếm.</small></div><div class="attribute-grid">${[['Công kích','⚔',p.beastAttributes?.attack],['Phòng ngự','🛡',p.beastAttributes?.defense],['Thân pháp','💨',p.beastAttributes?.speed],['Linh lực','☯',p.beastAttributes?.spirit],['Thiên phú','✦',p.beastAttributes?.skill||'—']].map(x=>`<div class="attribute-item"><span>${x[1]}</span><div><b>${x[0]}</b><strong>${typeof x[2]==='number'?Number(x[2]).toLocaleString('vi-VN'):esc(x[2])}</strong></div></div>`).join('')}</div><p class="muted">Phụ trợ linh căn: +${Number(p.supportBonus||0)}% hiệu quả tu luyện cơ bản.</p></div>`;
 const friendsHost=$('#friendsArea');
 if(!friendsHost){ const host=document.createElement('div'); host.id='friendsArea'; host.className='friends-panel'; $('#profileArea').appendChild(host); }
 loadFriends();
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
      const msg=$('#trainMsg'); if(msg)msg.textContent=d.message||`☁ Trực tuyến: +${d.gain} linh lực. Tích lũy online hôm nay ${d.onlineEarned}/${d.dailyCap}. Tốc độ ${d.rate} linh lực/phút.`;
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
 const realms=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
 const atTribulation=String(p.realm)==='Độ Kiếp' && Number(p.tier)===9;
 const mansionActive=Boolean(p.mansion?.active);
 $('#cultivationArea').innerHTML=`<div class="cultivation-grid">
 <article class="cultivation-card"><div class="rank-emblem">${esc(p.avatar)}</div><div><span class="eyebrow">CẢNH GIỚI HIỆN TẠI</span><h3>${esc(p.stage)}</h3><p class="muted">${esc(p.title)} · ${esc(p.sect)}</p><div class="tier-badge">Tầng ${p.tier}/9 · ${esc(p.realm)}</div></div><button class="btn primary train-btn" id="trainBtn" ${trainCount>=maxDaily||mansionActive?'disabled':''}>${mansionActive?'🏯 Động phủ đang khóa vận công':trainCount>=maxDaily?'☁ Đã đủ lượt':'⚔ Vận công'}</button></article>
 <article class="power-card"><div class="power-head"><div><span>Linh lực</span><strong>${Number(p.spirit_power).toLocaleString('vi-VN')}</strong></div><span>${prog.next?`Còn ${prog.remaining.toLocaleString('vi-VN')} để tiến vào ${esc(prog.next)}`:'Đã đạt cảnh giới tối cao'}</span></div><div class="progress"><i style="width:${prog.percent}%"></i></div><div class="rank-ladder">${realms.map(r=>`<span class="${r===p.realm?'on':''}">${r}</span>`).join('')}</div></article>
 </div>
 ${atTribulation?`<div class="daily-stone-card" id="ascensionPanel"><div><span class="eyebrow">🌌 PHI THĂNG · ĐỘ KIẾP</span><h3>Cửu Trọng Thiên Kiếp</h3><p>Đạt <b>Độ Kiếp Cửu Tầng</b> để vượt qua 9 lần thiên kiếp. Mỗi lần thành công <b>không xóa chiến lực, trang bị hay vật phẩm</b>. Hoàn tất lần thứ 9 sẽ lập tức phi thăng lên <b>Nhân Tiên Nhất Tầng</b>.</p></div><div><button class="btn primary" id="ascensionBtn">⚡ Độ kiếp lần 1/9</button><p id="ascensionMsg" class="train-msg">Đang kiểm tra Cửu Trọng Thiên Kiếp...</p></div></div>`:''}
 <div class="daily-stone-card"><div><span class="eyebrow">💎 LINH THẠCH HẰNG NGÀY</span><h3>Kho linh thạch: <b id="stoneCount">${Number(p.spirit_stones||0).toLocaleString('vi-VN')}</b></h3><p>Mỗi ngày nhận <b>100 linh thạch</b> để sử dụng tại Tàng Bảo Các.</p></div><button class="btn primary" id="claimStoneBtn" ${p.canClaimStones?'':'disabled'}>${p.canClaimStones?'💎 Nhận 100 linh thạch':'✓ Đã nhận hôm nay'}</button></div>
 <p id="trainMsg" class="train-msg">${mansionActive?`🏯 ${esc(p.mansion.name)} đang khởi động: tự động +${Number(p.mansion.spiritPerHour||0).toLocaleString('vi-VN')} linh lực/giờ. Vận công bị khóa hoàn toàn.`:`Lượt tu luyện hôm nay = lượt vận công: <b>${trainCount}/${maxDaily}</b>. ${trainCount>=maxDaily?'Đã hết lượt vận công hôm nay; chế độ tích lũy online có thể tiếp tục hoạt động.':'Mỗi lần vận công chính là 1 lượt tu luyện trong ngày.'}`}</p>`;
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
  area.innerHTML=`<div class="codex-summary"><div><span class="eyebrow">📚 CẢNH GIỚI</span><h3>${esc(d.stage)}</h3><p>Đã học <b>${Number(d.used||0)}/${Number(d.slots||0)}</b> công pháp. Chỉ công pháp không vượt quá cảnh giới hiện tại mới được mua và học.</p></div><div><span>💎 Linh thạch</span><strong>${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong></div></div><div class="codex-grid">${(d.rows||[]).map(x=>{const locked=Number(x.realm_index)>current;const learned=Boolean(x.learned);const can=!locked&&!learned&&Number(d.used||0)<Number(d.slots||0)&&Number(d.spiritStones||0)>=Number(x.price_stones||0);return `<article class="codex-card ${learned?'learned':''} ${locked?'locked':''}"><div class="codex-top"><span class="codex-grade">${esc(x.grade)}</span><span class="tag">${esc(x.realm_name)}</span></div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><div class="codex-meta"><span>💎 ${Number(x.price_stones||0).toLocaleString('vi-VN')}</span><span>⚔ +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><span>☯ +${Number(x.training_bonus_percent||0)}% vận công</span></div><small>${esc(x.ability||'')}</small><button class="btn small ${learned?'ghost':'primary'} codex-learn" data-id="${x.id}" ${learned||locked||!can?'disabled':''}>${learned?'✓ Đã học':locked?'🔒 Chưa tới cảnh giới':Number(d.used||0)>=Number(d.slots||0)?'🔒 Đã đủ ô công pháp':Number(d.spiritStones||0)<Number(x.price_stones||0)?'Thiếu linh thạch':'📖 Mua & Học'}</button></article>`}).join('')}</div><p id="codexMsg" class="train-msg"></p>`;
  document.querySelectorAll('.codex-learn').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/codex/learn',{method:'POST',headers:authHeaders(),body:JSON.stringify({id:Number(b.dataset.id)})});$('#codexMsg').textContent=`📖 ${x.message} · ${esc(x.ability||'')}`;await Promise.all([loadProfile(),loadCodex()]);}catch(e){$('#codexMsg').textContent='❌ '+e.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Tàng Thư Các</h3><p>${esc(e.message)}</p><button class="btn small primary" onclick="loadCodex()">↻ Thử lại</button></div>`;}
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
  area.innerHTML=`<div class="treasure-wallet"><span>☯ Linh lực hiện có · 💎 Linh thạch</span><strong>${Number(d.spiritPower).toLocaleString('vi-VN')} · ${Number(d.spiritStones||0).toLocaleString('vi-VN')}</strong><small>${esc(d.realm)} · Tầng ${d.tier}/9 · 100 linh lực = 1 linh thạch</small></div>
  <div class="stone-exchange"><div><span class="eyebrow">🏯 TÀNG BẢO CÁC 2.0</span><h3>Mua pháp khí, vật phẩm, linh thú bằng linh thạch</h3><p>Giao dịch dùng linh thạch. Linh lực chỉ dùng để đổi sang linh thạch theo tỷ lệ 100 linh lực = 1 linh thạch.</p></div><span class="tag">☯ An toàn giao dịch</span></div>
  <div class="stone-exchange-box"><div><b>🔄 Đổi linh lực → linh thạch</b><small>100 linh lực = 1 linh thạch</small></div><input id="exchangeStonesQty" type="number" min="1" max="100000" value="10"><button id="exchangeStonesBtn" class="btn small primary">Đổi linh thạch</button></div>
  <div class="treasure-grid">${d.items.map(i=>{
    const stones=Number(d.spiritStones||0), price=Number(i.price||0);
    const requiredRealmIndex=Number(i.min_realm)||0;
    const locked=currentRealmIndex<requiredRealmIndex;
    const can=!locked&&stones>=price;
    const text=locked?'🔒 Cần '+esc(realmNames[requiredRealmIndex]||'cảnh giới cao hơn'):can?'💎 Mua vật phẩm':'Thiếu '+Number(Math.max(0,price-stones)).toLocaleString('vi-VN')+' linh thạch';
    return `<article class="treasure-card ${locked?'locked':''}"><span class="item-seal">${i.category==='Đan dược'?'◈':i.category==='Linh thú'?'🐉':'⚔'}</span><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><small>Đang có: ${Number(i.quantity||0)} · Giá: 💎 ${price.toLocaleString('vi-VN')} linh thạch</small></div><button class="btn small primary buy-item" data-id="${i.id}" ${locked||!can?'disabled':''}>${text}</button></article>`;
  }).join('')}</div><p id="treasureMsg" class="train-msg"></p>`;
  $('#exchangeStonesBtn').onclick=async()=>{const b=$('#exchangeStonesBtn');const qty=Number($('#exchangeStonesQty').value||0);b.disabled=true;try{const x=await api('/api/currency/exchange',{method:'POST',headers:authHeaders(),body:JSON.stringify({stones:qty})});$('#treasureMsg').textContent=`🔄 Đã đổi ${Number(x.spentSpirit).toLocaleString('vi-VN')} linh lực → ${Number(x.receivedStones).toLocaleString('vi-VN')} linh thạch.`;await Promise.all([loadProfile(),loadTreasure()]);}catch(e){$('#treasureMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}};
  document.querySelectorAll('.buy-item').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{
      const x=await api('/api/treasury/buy',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id)})});
      $('#treasureMsg').textContent=`✅ ${x.message||('Đã mua '+x.item)} · Trừ ${Number(x.spentStones||0).toLocaleString('vi-VN')} linh thạch.`;
      await Promise.all([loadProfile(),loadTreasure(),loadTuDi()]);
    }catch(e){$('#treasureMsg').textContent='❌ '+e.message;b.disabled=false;}
  });
 }catch(e){const area=$('#treasureArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
}

async function loadEquipment(){
 const area=$('#equipmentArea'); if(!area||!getToken())return;
 try{
  const d=await api('/api/equipment',{headers:authHeaders()}); const e=d.equipped||{};
  const slot=(type,title,icon,obj)=>`<article class="equipment-slot ${obj?'equipped':''}"><span class="eyebrow">${icon} ${title}</span>${obj?`<h3>${esc(obj.name)}</h3><p>Chiến lực +${Number(obj.power||0).toLocaleString('vi-VN')}</p><small>${esc(obj.ability||'Không có công năng riêng.')}</small><div class="equipment-actions"><button class="btn small" data-unequip="${type}">Tháo</button></div>`:`<h3>Chưa trang bị</h3><p>Chọn vật phẩm trong Tu Di Giới để trang bị.</p>`}</article>`;
  const beastCards=(d.beasts||[]).map(x=>`<article class="equipment-item"><span class="eyebrow">🐉 ${esc(x.rarity)} · ${esc(x.beast_realm)} ${x.beast_realm_tier}</span><h3>${esc(x.name)} ×${x.quantity}</h3><p>⚔ ${x.attack} · 🛡 ${x.defense} · 💨 ${x.speed} · ☯ ${x.spirit}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||x.skill||'—')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="beast" data-equip-id="${x.beast_id}">Trang bị</button></div></article>`).join('');
  const rootCards=(d.roots||[]).map(x=>`<article class="equipment-item"><span class="eyebrow">🌿 ${esc(x.rarity)}</span><h3>${esc(x.name)} ×${x.quantity}</h3><p>${esc(x.support)}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||'—')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="root" data-equip-id="${x.root_id}">Trang bị</button></div></article>`).join('');
  const artifactCards=(d.artifacts||[]).map(x=>`<article class="equipment-item"><span class="eyebrow">⚔ ${esc(x.category)} · ×${x.quantity}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><span class="equip-meta">Chiến lực +${Number(x.power_bonus||0).toLocaleString('vi-VN')}</span><p>${esc(x.ability||'Không có công năng riêng.')}</p><div class="equipment-actions"><button class="btn small primary" data-equip-type="artifact" data-equip-id="${x.id}">Trang bị</button></div></article>`).join('');
  const power=Number(e.equipment_power||0);
  const combat=Number(currentProfile?.attributes?.combatPower||0);
  area.innerHTML=`<div class="equipment-power"><div><span class="eyebrow">⚔ CHIẾN LỰC HIỆN TẠI</span><p>Chiến lực đã bao gồm Linh Thú + Linh Căn + Pháp Khí đang trang bị.</p><small>Trang bị cộng thêm: +${power.toLocaleString('vi-VN')}</small></div><strong>${combat.toLocaleString('vi-VN')}</strong></div><div class="equipment-slots">${slot('beast','Linh Thú','🐉',e.beast)}${slot('root','Linh Căn','🌿',e.root)}${slot('artifact','Pháp Khí','⚔',e.artifact)}</div><div><div class="friend-subtitle">📦 Linh Thú trong Tu Di Giới</div><div class="equipment-list">${beastCards||'<div class="equipment-empty">Chưa có Linh Thú.</div>'}</div></div><div><div class="friend-subtitle">📦 Linh Căn trong Tu Di Giới</div><div class="equipment-list">${rootCards||'<div class="equipment-empty">Chưa có Linh Căn.</div>'}</div></div><div><div class="friend-subtitle">📦 Pháp Khí trong Tu Di Giới</div><div class="equipment-list">${artifactCards||'<div class="equipment-empty">Chưa có Pháp Khí/Pháp Bảo.</div>'}</div></div><p id="equipmentMsg" class="train-msg"></p>`;
  document.querySelectorAll('[data-equip-type]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const x=await api('/api/equipment/equip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:b.dataset.equipType,id:Number(b.dataset.equipId)})});$('#equipmentMsg').textContent=`✅ ${x.message}`;await loadProfile();}catch(err){const m=$('#equipmentMsg');if(m)m.textContent='❌ '+err.message;b.disabled=false;}});
  document.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('/api/equipment/unequip',{method:'POST',headers:authHeaders(),body:JSON.stringify({type:b.dataset.unequip})});$('#equipmentMsg').textContent='✅ Đã tháo trang bị.';await loadProfile();}catch(err){const m=$('#equipmentMsg');if(m)m.textContent='❌ '+err.message;b.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact"><h3>Không thể mở Trang Bị</h3><p>${esc(e.message)}</p><button class="btn small primary" id="retryEquipmentBtn">↻ Thử lại</button></div>`;$('#retryEquipmentBtn').onclick=loadEquipment;}
}

async function loadTuDi(){
 try{
  const d=await api('/api/storage',{headers:authHeaders()});
  const area=$('#sumeruArea'); if(!area)return;
  const rows=d.rows||[], beasts=d.beasts||[], roots=d.roots||[];
  area.innerHTML=`<div class="treasure-wallet"><span>◈ TU DI GIỚI 2.0 · Kho cá nhân</span><strong>${d.used}/${d.capacity}</strong><small>🌿 ${esc(d.spiritRoot||'—')} · 🐉 ${esc(d.spiritBeast||'—')}</small></div>
  <div class="enhance-panel"><div><span class="eyebrow">📦 QUẢN LÝ KHO</span><h3>Dùng vật phẩm & mở rộng dung lượng</h3><p>Đan dược có linh lực có thể sử dụng trực tiếp. Nâng 5 ô bằng 100 linh thạch, tối đa 100 ô.</p></div><div class="hero-actions"><button id="storageUpgradeBtn" class="btn primary">＋5 ô · 100 linh thạch</button></div><div id="storageMsg" class="train-msg"></div></div>
  <div class="equipment-list"><div class="equipment-item"><span class="eyebrow">🐉 LINH THÚ · ĐÃ NHẬN</span><h3>${beasts.length?beasts.map(x=>`${esc(x.name)} ×${x.quantity}`).join(' · '):'Chưa có'}</h3><p>Linh Thú được lưu trong Tu Di Giới và chỉ cộng chiến lực khi trang bị.</p></div><div class="equipment-item"><span class="eyebrow">🌿 LINH CĂN · ĐÃ NHẬN</span><h3>${roots.length?roots.map(x=>`${esc(x.name)} ×${x.quantity}`).join(' · '):'Chưa có'}</h3><p>Linh Căn được lưu trong Tu Di Giới và chỉ phát huy công năng khi trang bị.</p></div></div>
  <div class="inventory-grid">${rows.length?rows.map(i=>{
    const usable=Number(i.spirit_gain||0)>0;
    return `<article class="inventory-card"><span class="item-seal">${i.category==='Đan dược'?'◈':'⚔'}</span><div><span class="eyebrow">${esc(i.category)}</span><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><b>Số lượng: ${Number(i.quantity||0)}</b>${usable?`<button class="btn small primary use-item" data-id="${i.id}">Dùng 1 · +${Number(i.spirit_gain).toLocaleString('vi-VN')} linh lực</button>`:''}</div></article>`;
  }).join(''):`<div class="empty-state compact"><h3>Tu Di Giới đang trống</h3><p>Vật phẩm mua tại Tàng Bảo Các, nhận từ Nhiệm Vụ Đường hoặc giao dịch ở Phường Thị sẽ được lưu tại đây.</p></div>`}</div>`;
  $('#storageUpgradeBtn').onclick=async()=>{
    const b=$('#storageUpgradeBtn');b.disabled=true;
    try{const x=await api('/api/storage/upgrade',{method:'POST',headers:authHeaders(),body:'{}'});$('#storageMsg').textContent=`✅ Tu Di Giới đã tăng lên ${x.capacity} ô. Còn ${Number(x.spiritStones).toLocaleString('vi-VN')} linh thạch.`;await loadTuDi();await loadProfile();}
    catch(e){$('#storageMsg').textContent='❌ '+e.message;}finally{b.disabled=false;}
  };
  document.querySelectorAll('.use-item').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    try{const x=await api('/api/storage/use',{method:'POST',headers:authHeaders(),body:JSON.stringify({itemId:Number(b.dataset.id),quantity:1})});$('#storageMsg').textContent=`✨ Đã dùng ${x.item}, +${Number(x.gained).toLocaleString('vi-VN')} linh lực.`;await loadProfile();await loadTuDi();}
    catch(e){$('#storageMsg').textContent='❌ '+e.message;b.disabled=false;}
  });
 }catch(e){const area=$('#sumeruArea');if(area)area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
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
  const realms=d.realms||[], me=d.me||{};
  const debuffActive=me.secret_realm_debuff_until&&new Date(me.secret_realm_debuff_until)>new Date();
  const statusText=(r)=>r.status==='active'?'🟢 ĐANG MỞ':r.status==='paused'?'🔴 TẠM HOÃN':'🟡 CHỜ LINH THẠCH';
  const realmNames=['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'];
  const currentIndex=Math.max(0,Number(me.realmIndex||0));
  const selectedIndex=Math.min(currentIndex,8);
  const selectedRealm=realms.find(r=>Number(r.required_realm_index)===selectedIndex) || realms[0];
  const selector=realms.map((r,i)=>`<option value="${Number(r.required_realm_index)}" ${Number(r.required_realm_index)===selectedIndex?'selected':''}>${esc(r.required_realm_name)} — ${esc(r.name)}${Number(r.required_realm_index)>currentIndex?' 🔒':''}</option>`).join('');
  const cards=realms.map((r,i)=>{
   const locked=!r.canEnter;
   const active=r.status==='active'; const paused=r.status==='paused';
   const percent=Math.min(100,Math.round((Number(r.funded_stones||0)/Number(r.activation_cost||1))*100));
   const gap=Math.max(0,Number(me.realmIndex||0)-Number(r.required_realm_index||0));
   const highRisk=gap>=2;
   return `<article class="bicanh-card ${locked?'locked':''} ${active?'active':''} ${paused?'paused':''}" data-realm-index="${Number(r.required_realm_index)}">
    <div class="bicanh-card-top"><span class="bicanh-rank">${i===0?'🌿':i===1?'❄️':i===2?'🟡':i<5?'🔵':i<7?'🟣':'🔴'}</span><div><span class="eyebrow">${esc(r.required_realm_name)} trở lên</span><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p></div><span class="bicanh-status">${statusText(r)}</span></div>
    <div class="bicanh-meta"><span>☠ Nguy hiểm <b>${Number(r.danger_percent)}%</b></span><span>☠ Debuff <b>${Number(r.debuff_percent)}%</b></span><span>🎁 Cấp thưởng <b>${Number(r.loot_tier)+1}</b></span><span>⏳ ${active&&r.active_until?`đến ${new Date(r.active_until).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`:paused&&r.paused_until?`mở lại ${new Date(r.paused_until).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`:'chưa khởi động'}</span></div>
    <div class="bicanh-fund"><div class="bicanh-fund-head"><span>💎 Linh thạch khởi động</span><b>${Number(r.funded_stones||0).toLocaleString('vi-VN')} / ${Number(r.activation_cost).toLocaleString('vi-VN')}</b></div><div class="bicanh-progress"><i style="width:${percent}%"></i></div></div>
    ${highRisk&&!locked?`<div class="bicanh-warning">⚠ ${esc(me.stage)} tiến vào bí cảnh thấp hơn ${gap} cảnh giới: có ${Math.min(65,Math.max(0,gap*12-4))}% khả năng phá vỡ linh áp, khiến bí cảnh tạm hoãn.</div>`:''}
    <div class="bicanh-actions">${locked?`<button class="btn small" disabled>🔒 Cần ${esc(r.required_realm_name)}</button>`:paused?`<button class="btn small" disabled>⛔ Đang tạm hoãn</button>`:active?`<button class="btn small primary bicanh-enter" data-id="${r.id}">⚔ Thám hiểm Bí Cảnh</button>`:`<input class="bicanh-amount" data-id="${r.id}" type="number" min="1" value="10" placeholder="Linh thạch"><button class="btn small primary bicanh-contribute" data-id="${r.id}">💎 Đóng góp</button>`}</div>
   </article>`;
  }).join('');
  const history=(h.rows||[]).map(x=>`<div class="bicanh-history-row"><span>${x.outcome==='success'?'🏆':x.outcome==='broken'?'💥':'☠'}</span><div><b>${esc(x.realm_name)}</b><small>${esc(x.note||'')}</small></div><em>${new Date(x.created_at).toLocaleString('vi-VN')}</em></div>`).join('')||'<div class="empty-state compact"><p>Chưa có hành trình Bí Cảnh.</p></div>';
  area.innerHTML=`${debuffActive?`<div class="bicanh-debuff">☠ ${Number(me.secret_realm_debuff_percent)}% debuff Bí Cảnh · còn đến ${new Date(me.secret_realm_debuff_until).toLocaleString('vi-VN')}</div>`:''}<div class="bicanh-banner"><div><span class="eyebrow">🌌 LUẬT BÍ CẢNH</span><h3>Cơ duyên càng cao, hiểm nguy càng lớn</h3><p>Chín Bí Cảnh đối xứng với chín cảnh giới. Bạn có thể đóng linh thạch cho Bí Cảnh tương ứng hoặc các Bí Cảnh thấp hơn. Nhiều môn nhân có thể đóng cùng lúc; đủ phí thì cửa mở 60 phút.</p></div><div class="bicanh-wallet"><span>💎 Linh thạch</span><strong>${Number(me.spirit_stones||0).toLocaleString('vi-VN')}</strong><small>${esc(me.stage||'Luyện Khí')}</small></div></div><div class="bicanh-selector"><div><span class="eyebrow">🎯 BÍ CẢNH TƯƠNG ỨNG</span><h3>${esc(me.stage||realmNames[currentIndex])} → ${esc(selectedRealm?.name||'')}</h3><p>Đây là Bí Cảnh đối xứng với cảnh giới hiện tại của bạn.</p></div><select id="bicanhRealmSelect">${selector}</select><button class="btn primary" id="bicanhOpenChoices">🌌 Mở danh sách Bí Cảnh</button></div><div id="bicanhChoices" class="bicanh-grid">${cards}</div><div class="bicanh-loot"><span class="eyebrow">🎁 CƠ DUYÊN CÓ THỂ NHẬN</span><div><span>🐉 Linh Thú</span><span>⚔ Pháp Khí</span><span>◈ Đan Dược / Vật phẩm</span><span>💎 Linh Thạch</span><span>☯ Linh lực bạo tăng</span></div></div><div class="bicanh-history"><div class="friend-subtitle">📜 HÀNH TRÌNH GẦN ĐÂY</div>${history}</div><p id="bicanhMsg" class="train-msg"></p>`;
  const openBtn=$('#bicanhOpenChoices'); if(openBtn) openBtn.onclick=()=>{const grid=$('#bicanhChoices'); if(grid){grid.classList.toggle('collapsed');openBtn.textContent=grid.classList.contains('collapsed')?'🌌 Mở danh sách Bí Cảnh':'🔽 Thu danh sách Bí Cảnh';}};
  const select=$('#bicanhRealmSelect'); if(select) select.onchange=()=>{const idx=Number(select.value);const target=document.querySelector(`.bicanh-card[data-realm-index="${idx}"]`); if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('bicanh-focus');setTimeout(()=>target.classList.remove('bicanh-focus'),1200);}};
  document.querySelectorAll('.bicanh-contribute').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;const input=document.querySelector(`.bicanh-amount[data-id="${btn.dataset.id}"]`);try{const x=await api('/api/bicanh/contribute',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id),amount:Number(input?.value||0)})});$('#bicanhMsg').textContent='💎 '+x.message;await loadProfile();await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
  document.querySelectorAll('.bicanh-enter').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const x=await api('/api/bicanh/enter',{method:'POST',headers:authHeaders(),body:JSON.stringify({realmId:Number(btn.dataset.id)})});$('#bicanhMsg').textContent=x.outcome==='success'?`🏆 ${x.message}`:x.outcome==='broken'?`💥 ${x.message}`:`☠ ${x.message}`;await loadProfile();await loadBicanh();}catch(e){$('#bicanhMsg').textContent='❌ '+e.message;btn.disabled=false;}});
 }catch(e){area.innerHTML=`<div class="empty-state compact">${esc(e.message)}</div>`;}
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

async function loadBeastHouse(){
 const area=$('#beastHouseArea'); if(!area||!getToken())return;
 try{
  const [d,rankData]=await Promise.all([api('/api/beast-house',{headers:authHeaders()}),api('/api/linh-thu-bang',{headers:authHeaders()})]); const p=d.profile||{};
  area.innerHTML=`<div class="spirit-shop-summary"><div><span class="eyebrow">🐉 LINH THÚ HIỆN TẠI</span><h3>${esc(p.spirit_beast||'Chưa có linh thú')}</h3><small>${p.beast_realm?esc(p.beast_realm):'Chưa định cảnh giới'} · ${Number(p.beast_realm_tier||1)} · ${esc(p.spirit_beast_rarity||'—')}</small></div><b>💎 ${Number(p.spirit_stones||0).toLocaleString('vi-VN')} linh thạch</b></div><div class="spirit-shop-grid">${(d.catalog||[]).map(x=>{const locked=Number(p.realm_tier||0)>=0 && Number(currentProfile?.progress?.remaining||0)>=0 && false; const realmIndex=(currentProfile?.rank?['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'].indexOf(currentProfile.rank):-1); const unavailable=realmIndex<Number(x.min_realm); return `<article class="spirit-shop-card ${unavailable?'locked':''}"><div class="spirit-shop-icon">🐉</div><div class="spirit-shop-copy"><span class="eyebrow">${esc(x.rarity)} · ${esc(x.beast_realm)} ${Number(x.beast_realm_tier||1)}</span><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><small>⚔ ${x.attack} · 🛡 ${x.defense} · 💨 ${x.speed} · ☯ ${x.spirit}</small><small>Thiên phú: ${esc(x.skill)}</small><small>⚔ Chiến lực trang bị: +${Number(x.power_bonus||0).toLocaleString('vi-VN')} · ${esc(x.ability||'—')}</small><small>Yêu cầu: ${esc(['Luyện Khí','Trúc Cơ','Kim Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Nhân Tiên','Chân Tiên','Địa Tiên','Thiên Tiên','Huyền Tiên','Kim Tiên','Tiên Quân','Tiên Tôn','Tiên Đế'][Number(x.min_realm)]||'—')}</small></div><div class="spirit-shop-buy"><b>💎 ${Number(x.price_stones).toLocaleString('vi-VN')}</b><button class="btn small primary beast-buy" data-id="${x.id}" ${unavailable?'disabled':''}>${unavailable?'🔒 Chưa đủ cảnh giới':'Mua linh thú'}</button></div></article>`}).join('')}</div><div class="spirit-shop-note">Linh thú mua thành công sẽ được lưu vào Tu Di Giới. Vào Trang Bị để thay thế linh thú đang dùng.</div><div class="shop-ranking"><div class="friend-subtitle">🏆 Bảng xếp hạng Linh Thú</div><div class="shop-ranking-list">${(rankData.rows||[]).slice(0,10).map((x,i)=>`<div class="shop-ranking-row"><b>#${i+1}</b><span>🐉</span><div><strong>${esc(x.name)}</strong><small>${esc(x.beast_realm||'Nhất Giai')} · ${Number(x.beast_realm_tier||1)} · ${esc(x.rarity)}</small></div><em>${Number(x.owner_count||0)} người sở hữu</em></div>`).join('')||'<div class="empty-state compact"><p>Chưa có linh thú được ghi danh.</p></div>'}</div></div><p id="beastHouseMsg" class="train-msg"></p>`;
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
 $('#authForm').onsubmit=async e=>{e.preventDefault();const msg=$('#authMsg');msg.textContent='Đang xử lý...';const body={username:$('#username').value.trim(),password:$('#password').value};if(register)body.displayName=$('#displayName').value.trim();try{if(register){await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});msg.textContent='Ghi danh thành công. Đang mở cổng nhập môn...';setTimeout(()=>renderAuth('login'),500);}else{const d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});localStorage.setItem(tokenKey,d.token);accountUI(d.user);$('#accountModal').close();await loadProfile();await loadDisciples();await loadCodex();await loadSpiritRankings();await loadMansion();await loadChat();await loadLeaderboard();await loadTreasure();await loadBeastHouse();await loadLinhPhap();await loadEquipment();await loadTuDi();await loadMarket();await loadProfessions();await loadData();await loadChallenges();}}catch(err){msg.textContent=err.message;}};
 $('#accountModal').showModal();
}
async function logout(){try{await api('/api/logout',{method:'POST',headers:authHeaders()});}catch{}finally{localStorage.removeItem(tokenKey);currentProfile=null;accountUI(null);$('#accountModal').close();renderGuestAreas();}}

$('#modalClose').onclick=()=>$('#memberModal').close();$('#accountClose').onclick=()=>$('#accountModal').close();$('#friendChatClose').onclick=()=>$('#friendChatModal').close();
$('#memberModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#accountModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};$('#friendChatModal').onclick=e=>{if(e.target===e.currentTarget)e.currentTarget.close()};
$('#searchInput').oninput=e=>{const q=e.target.value.toLowerCase().trim();renderMembers(members.filter(m=>[m.name,m.nick,m.role,...m.tags].join(' ').toLowerCase().includes(q)));};
$('#accountBtn').onclick=openAccount;$('#joinBtn').onclick=()=>getToken()?accountSummary():renderAuth('register');
$('#themeBtn').onclick=()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');$('#themeBtn').textContent=dark?'☀':'☾';localStorage.setItem('theme',dark?'dark':'light');};
$('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');document.querySelectorAll('#nav a').forEach(a=>a.onclick=()=>$('#nav').classList.remove('open'));$('#topBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});
if(localStorage.getItem('theme')==='dark'){document.body.classList.add('dark');$('#themeBtn').textContent='☀';}

loadData();loadSect();checkSession();
setInterval(()=>{if(getToken()){loadChat();if(currentProfile?.activeBattle)loadChallenges();}},5000);
