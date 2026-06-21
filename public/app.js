let current = null;
const $ = id => document.getElementById(id);
const USERS = {
  operator1: { id:'operator1', name:'Operator 1' },
  operator2: { id:'operator2', name:'Operator 2' },
  operator3: { id:'operator3', name:'Operator 3' },
  operator4: { id:'operator4', name:'Operator 4' }
};
function currentUserId(){ const p = location.pathname.split('/').filter(Boolean); return USERS[p[1]] ? p[1] : 'operator1'; }
const USER_ID = currentUserId();
const USER = USERS[USER_ID];
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
function init(){
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
