const $ = s => document.querySelector(s);
const ICE = { config: { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }
]}};
const ID = c => 'screenvibe-' + c;
let peer = null, roomCode = '', roomPw = '', stream = null, hostConn = null;
const viewers = new Map(), calls = new Map();

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),3200); }
function show(id){ document.querySelectorAll('.screen').forEach(e=>e.classList.add('hidden')); $(id).classList.remove('hidden'); }
function makeCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; }
function baseUrl(){ return location.href.split('#')[0].split('?')[0]; }
function renderCode(el, c){ el.innerHTML=''; [...c].forEach(ch=>{ const b=document.createElement('b'); b.textContent=ch; el.appendChild(b); }); }
async function copy(text, msg){ try{ await navigator.clipboard.writeText(text); toast(msg); }catch(e){ prompt('Copy this:', text); } }

/* ---------- Tabs ---------- */
function tab(which){
  $('#tabCreate').classList.toggle('on', which==='create'); $('#tabJoin').classList.toggle('on', which==='join');
  $('#paneCreate').classList.toggle('hidden', which!=='create'); $('#paneJoin').classList.toggle('hidden', which!=='join');
}
$('#tabCreate').onclick=()=>tab('create'); $('#tabJoin').onclick=()=>tab('join');

/* ---------- HOST ---------- */
function createRoom(){
  const pw = $('#pw').value.trim();
  if(pw.length < 3) return toast('Password needs at least 3 characters.');
  if(peer) peer.destroy();
  const c = makeCode();
  peer = new Peer(ID(c), ICE);
  peer.on('open', () => { roomCode=c; roomPw=pw; showHost(); });
  peer.on('error', e => { if(e.type==='unavailable-id') return createRoom(); toast('Connection problem: '+e.type); });
  peer.on('connection', conn => {
    conn.on('data', d => {
      if(d && d.type==='join'){
        if(d.pw === roomPw){
          viewers.set(conn.peer, conn); updateCount();
          conn.send({type:'ok', sharing: !!stream});
          if(stream) callViewer(conn.peer);
        } else conn.send({type:'denied'});
      }
    });
    conn.on('close', () => { viewers.delete(conn.peer); calls.delete(conn.peer); updateCount(); });
  });
}
function showHost(){
  show('#host'); renderCode($('#hostCode'), roomCode); drawQr();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia){
    $('#btnShare').classList.add('hidden'); $('#noShare').classList.remove('hidden');
  }
}
function roomLink(){ return baseUrl() + '?room=' + roomCode + ($('#inclPw').checked ? '&pw=' + encodeURIComponent(roomPw) : ''); }
function drawQr(){
  const box=$('#qr'); box.innerHTML='';
  new QRCode(box,{text:roomLink(),width:190,height:190,colorDark:'#0a0a14',colorLight:'#ffffff'});
}
function updateCount(){ $('#viewerCount').textContent = viewers.size + ' watching'; }
function callViewer(id){ if(!stream) return; const call = peer.call(id, stream); calls.set(id, call); }
async function startShare(){
  try{ stream = await navigator.mediaDevices.getDisplayMedia({ video:{frameRate:30}, audio:true }); }
  catch(e){ return toast('Sharing was cancelled.'); }
  $('#preview').srcObject = stream;
  $('#btnShare').classList.add('hidden'); $('#btnStop').classList.remove('hidden');
  $('#hostDot').classList.add('live'); $('#hostStatus').textContent='Sharing live';
  stream.getVideoTracks()[0].onended = stopShare;
  viewers.forEach((conn,id)=>{ conn.send({type:'sharing'}); callViewer(id); });
}
function stopShare(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; }
  calls.forEach(c=>c.close()); calls.clear();
  viewers.forEach(c=>c.send({type:'stopped'}));
  $('#preview').srcObject=null;
  $('#btnStop').classList.add('hidden'); if(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) $('#btnShare').classList.remove('hidden');
  $('#hostDot').classList.remove('live'); $('#hostStatus').textContent='Room is open';
}
function closeRoom(){ stopShare(); viewers.forEach(c=>c.close()); viewers.clear(); if(peer) peer.destroy(); peer=null; show('#home'); }

/* ---------- VIEWER ---------- */
function joinRoom(c, pw){
  c = (c||'').trim().toUpperCase();
  if(c.length !== 6) return toast('Room code has 6 characters.');
  if(!pw) return toast('Enter the room password.');
  if(peer) peer.destroy();
  show('#viewer'); $('#vCode').textContent = c; setStatus('Connecting...', false);
  $('#wait').classList.remove('hidden');
  peer = new Peer(ICE);
  peer.on('open', () => {
    hostConn = peer.connect(ID(c), {reliable:true});
    hostConn.on('open', () => hostConn.send({type:'join', pw}));
    hostConn.on('data', d => {
      if(d.type==='denied'){ toast('Wrong password.'); leaveRoom(); }
      if(d.type==='ok') setStatus(d.sharing ? 'Connected' : 'In room', true);
      if(d.type==='sharing') setStatus('Host is sharing', true);
      if(d.type==='stopped'){ setStatus('Host stopped sharing', true); $('#remote').srcObject=null; $('#wait').classList.remove('hidden'); }
    });
    hostConn.on('close', () => { toast('The host closed the room.'); leaveRoom(); });
  });
  peer.on('call', call => {
    call.answer();
    call.on('stream', s => {
      const v=$('#remote'); v.srcObject=s; v.play().catch(()=>{});
      $('#wait').classList.add('hidden'); setStatus('Watching live', true); $('#vDot').classList.add('live');
    });
  });
  peer.on('error', e => {
    if(e.type==='peer-unavailable'){ toast('Room not found. Check the code.'); leaveRoom(); }
    else toast('Connection problem: '+e.type);
  });
}
function setStatus(t){ $('#vStatus').textContent=t; }
function leaveRoom(){ if(peer) peer.destroy(); peer=null; hostConn=null; $('#remote').srcObject=null; $('#vDot').classList.remove('live'); history.replaceState(null,'',baseUrl()); show('#home'); }

/* ---------- Wire up ---------- */
$('#btnCreate').onclick = createRoom;
$('#btnJoin').onclick = () => joinRoom($('#joinCode').value, $('#joinPw').value);
$('#btnShare').onclick = startShare;
$('#btnStop').onclick = stopShare;
$('#closeRoom').onclick = closeRoom;
$('#leaveRoom').onclick = leaveRoom;
$('#copyLink').onclick = () => copy(roomLink(), 'Link copied');
$('#copyCode').onclick = () => copy(roomCode, 'Code copied');
$('#inclPw').onchange = () => { if(roomCode) drawQr(); };
$('#btnMute').onclick = () => { const v=$('#remote'); v.muted=!v.muted; $('#btnMute').textContent = v.muted ? 'Unmute sound' : 'Mute sound'; };
$('#btnFull').onclick = () => { const v=$('#remote'); (v.requestFullscreen||v.webkitEnterFullscreen||function(){}).call(v); };

// Opened from a QR code or shared link
const q = new URLSearchParams(location.search);
if(q.get('room')){
  tab('join'); $('#joinCode').value = q.get('room').toUpperCase();
  if(q.get('pw')){ $('#joinPw').value = q.get('pw'); joinRoom(q.get('room'), q.get('pw')); }
}
