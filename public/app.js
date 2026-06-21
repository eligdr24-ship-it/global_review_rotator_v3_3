let current = null;
const $ = id => document.getElementById(id);
function labelFromId(id){ const m=String(id||'').match(/operator(\d+)/i); return m ? `Operator ${m[1]}` : String(id||'Operator'); }
function currentUserId(){ const p = location.pathname.split('/').filter(Boolean); return (p[1] || 'operator1').toLowerCase().replace(/[^a-z0-9_-]/g,'') || 'operator1'; }
const USER_ID = currentUserId();
let USER = { id: USER_ID, name: labelFromId(USER_ID) };
async function api(p,opt={}){
  opt.headers = { ...(opt.headers || {}), 'Content-Type':'application/json' };
  const r = await fetch(p,opt);
  const text = await r.text();
  let j;
  try { j = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Backend returned ${r.status}: ${text.slice(0,120)}`); }
  if(!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
async function hydrateUser(){ try{ const r=await fetch(`/api/status?user=${USER_ID}`); const j=await r.json(); if(j.user) USER=j.user; }catch{} }
function showWork(){
  document.title = `${USER.name} Work Dashboard`;
  $('operatorLabel').textContent = `${USER.name} Work Dashboard`;
  $('analyticsLink').href = `/analytics/${USER_ID}`;
}
function setEmpty(msg){
  $('txt').value = msg;
  $('open').href = '#';
  $('openTextLink').href = '#';
  $('openTextLink').textContent = 'No active link';
  $('sourceLabel').textContent = '';
  current = null;
  $('readyPill').textContent = 'Complete';
}
async function loadNext(){
  const j = await api(`/api/next?user=${USER_ID}`);
  if(j.completed){
    setEmpty('All available links or text suggestions have already been marked done. Upload more data or reset progress in admin.');
    return;
  }
  current = j;
  $('txt').value = j.text;
  $('open').href = j.link;
  $('openTextLink').href = j.link;
  $('openTextLink').textContent = j.link;
  $('sourceLabel').textContent = j.source ? `Source: ${j.source}` : '';
  $('linkLabel').textContent = `Link ${j.linkIdx + 1}: ${j.link}`;
  $('copy').textContent = '▣ Copy Text';
  $('readyPill').textContent = 'Ready';
  $('submittedLink').value = '';
  $('updatedLabel').textContent = 'Refreshed just now';
}
async function markDone(){
  if(!current) return;
  const submittedLink = $('submittedLink').value.trim();
  await api('/api/done',{
    method:'POST',
    body:JSON.stringify({ linkIdx:current.linkIdx, textIdx:current.textIdx, userId:USER_ID, submittedLink })
  });
  await loadNext();
}
async function init(){
  await hydrateUser();
  showWork();
  $('next').onclick = () => loadNext().catch(e => alert(e.message));
  $('copy').onclick = async()=>{
    try { await navigator.clipboard.writeText($('txt').value); $('copy').textContent = 'Copied ✅'; }
    catch { alert('Copy failed. Select the text and copy manually.'); }
  };
  $('done').onclick = () => markDone().catch(e => alert(e.message));
  loadNext().catch(e => alert(e.message));
}
init();
