let LAST=null;const $=id=>document.getElementById(id);const USERS={operator1:{id:'operator1',name:'Operator 1'},operator2:{id:'operator2',name:'Operator 2'},operator3:{id:'operator3',name:'Operator 3'},operator4:{id:'operator4',name:'Operator 4'}};function uid(){const p=location.pathname.split('/').filter(Boolean);const maybe=p[1]||p[0];return USERS[maybe]?maybe:'operator1'}const USER_ID=uid(),USER=USERS[USER_ID],PASS_KEY=`grr_operator_pass_${USER_ID}`;function pass(){return localStorage.getItem(PASS_KEY)||''}
function init(){document.title=`${USER.name} Analytics`;$('userNameTitle').textContent=USER.name;['homeNav','workNav','topWorkLink','workShortcut'].forEach(id=>{const el=$(id);if(el)el.href=`/worker/${USER_ID}`});const a=$('analyticsNav');if(a)a.href=`/analytics/${USER_ID}`;const back=$('backBtn');if(back)back.onclick=()=>goBack();}
function goBack(){if(new URLSearchParams(location.search).get('from')==='admin')location.href='/admin';else location.href=`/worker/${USER_ID}`}
init();function theme(){document.documentElement.dataset.theme=localStorage.theme==='dark'?'dark':''}theme();['theme','theme2'].forEach(id=>{const el=$(id);if(el)el.onclick=()=>{localStorage.theme=localStorage.theme==='dark'?'light':'dark';theme()}});
function iso(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function weekRange(){const now=new Date();const start=new Date(now);start.setDate(now.getDate()-now.getDay());const end=new Date(start);end.setDate(start.getDate()+6);return [iso(start),iso(end)]}
function setDateRange(f,t){if($('fromDate'))$('fromDate').value=f;if($('toDate'))$('toDate').value=t;setText('dateRangeLabel',`${f} → ${t}`)}
function dateParams(){return `from=${encodeURIComponent($('fromDate')?.value||'')}&to=${encodeURIComponent($('toDate')?.value||'')}`}
function quickRange(type){const now=new Date();let start=new Date(now),end=new Date(now);if(type==='week'){[start,end]=weekRange().map(x=>new Date(x+'T00:00:00'));}else if(type==='today'){}else{const days=Number(type)||7;start.setDate(now.getDate()-days+1)}setDateRange(iso(start),iso(end));loadReport().catch(e=>alert(e.message))}
function initDates(){const [f,t]=weekRange();setDateRange(f,t);document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>quickRange(b.dataset.range));const apply=$('applyDateSearch');if(apply)apply.onclick=()=>loadReport().catch(e=>alert(e.message));}
async function api(p,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json','x-operator-password':pass()};const r=await fetch(p,opt);const text=await r.text();let j;try{j=text?JSON.parse(text):{};}catch{throw new Error(`Backend returned ${r.status}: ${text.slice(0,120)}`)}if(!r.ok)throw new Error(j.error||'Request failed');return j}
async function login(){const password=$('operatorPassword').value.trim();const r=await fetch('/api/operator/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:USER_ID,password})});if(!r.ok)return alert('Wrong operator password');localStorage.setItem(PASS_KEY,password);showAnalytics();loadReport().catch(e=>alert(e.message));}
function showAnalytics(){$('loginPanel').classList.add('hidden');$('analyticsPanel').classList.remove('hidden')}function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function localTime(iso){try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return iso||''}}function setText(id,v){const e=$(id);if(e)e.textContent=v??'—'}function setWidth(id,p){const e=$(id);if(e)e.style.width=`${Math.max(0,Math.min(100,p))}%`}
function fill(s){const totalLinks=s.totalLinks||0,totalTexts=s.totalTexts||0,doneLinks=s.userLinksDone||0,usedTexts=s.userTextsDone||0;const lp=totalLinks?doneLinks/totalLinks*100:0,tp=totalTexts?usedTexts/totalTexts*100:0,overall=(lp+tp)/2;setText('totalLinks',totalLinks);setText('linksRemaining',s.linksRemaining);setText('doneToday',s.rangeDone??s.userDoneToday??s.doneToday);setText('totalTexts',totalTexts);setText('textsRemaining',s.textsRemaining);setText('overallPct',`${Math.round(overall)}%`);setText('linkProgressText',`${doneLinks} / ${totalLinks}`);setText('textProgressText',`${usedTexts} / ${totalTexts}`);$('overallRing')?.style.setProperty('--p',overall.toFixed(1));$('todayRing')?.style.setProperty('--p',Math.min(100,((s.rangeDone??s.userDoneToday)||0)*4));setWidth('linkBar',lp);setWidth('textBar',tp);setText('updatedLabel',`Selected range: ${$('dateRangeLabel')?.textContent||'This week'} • Updated: ${s.updatedAt?new Date(s.updatedAt).toLocaleString():'—'}`)}
function renderActivity(hist){const rows=(hist||[]).slice(0,5);$('activityList').innerHTML=rows.length?rows.map(h=>`<div class="activity-item"><div class="activity-icon">✓</div><div><b>Marked link #${Number(h.linkIdx)+1} as done</b><p>${esc(h.source||'Links')} • ${esc(h.link)}</p><p>${esc(h.text)}</p></div><div class="activity-time">${esc(localTime(h.at))}</div></div>`).join(''):'<p class="small">No activity in this date range.</p>'}

let HAS_UNSAVED_HISTORY_CHANGES=false;
function markUnsaved(v=true){HAS_UNSAVED_HISTORY_CHANGES=v;const btn=$('saveHistoryBtn');if(btn)btn.textContent=v?'Save All Changes *':'Save All Changes'}
window.addEventListener('beforeunload',e=>{if(HAS_UNSAVED_HISTORY_CHANGES){e.preventDefault();e.returnValue='You have unsaved changes.';}});
function hrefFor(v){v=String(v||'').trim();if(!v)return'';return /^https?:\/\//i.test(v)?v:'https://'+v;}
function submittedCell(h){const id=esc(h.id||''),val=esc(h.submittedLink||''),href=esc(hrefFor(h.submittedLink||''));const editing=!(h.submittedLink||'').trim();const view=(h.submittedLink||'').trim()?`<a class="saved-link" href="${href}" target="_blank" rel="noopener">${val}</a>`:'<span class="muted-inline">No submitted link</span>';return `<div class="history-lock-field ${editing?'is-editing':'is-locked'}" data-field="submitted"><div class="locked-view">${view}</div><input class="input history-edit submitted-edit" data-history-id="${id}" value="${val}" placeholder="Paste submitted link"></div>`;}
function actionCell(h){return `<div class="row-actions"><span class="save-status">${(h.submittedLink||'').trim()?'Saved':'Editing'}</span><button class="btn ghost tinyBtn row-edit-btn" type="button">Edit</button></div>`;}

function renderHistory(hist){$('historyRows').innerHTML=hist.length?hist.map(h=>`<tr data-history-id="${esc(h.id||'')}"><td>${esc(localTime(h.at))}</td><td>${esc(h.day)}</td><td>${esc(h.source||'Links')}</td><td class="break"><a href="${esc(h.link)}" target="_blank">${esc(h.link)}</a></td><td class="break">${submittedCell(h)}</td><td>${esc(h.text)}</td><td>${actionCell(h)}</td></tr>`).join(''):'<tr><td colspan="7">No submissions for this date range.</td></tr>';setText('resultCount',`Showing ${hist.length} result${hist.length===1?'':'s'}`);bindHistoryInputs()}
function bindHistoryInputs(){document.querySelectorAll('.history-edit').forEach(el=>{el.oninput=()=>{el.classList.add('dirty');markUnsaved(true);const row=el.closest('tr');if(row){const st=row.querySelector('.save-status');if(st)st.textContent='Editing';}}});document.querySelectorAll('.row-edit-btn').forEach(btn=>{btn.onclick=()=>{const row=btn.closest('tr');if(!row)return;row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.remove('is-locked'));row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.add('is-editing'));const st=row.querySelector('.save-status');if(st)st.textContent='Editing';markUnsaved(true);}})}
async function saveHistoryChanges(){const updates=[];document.querySelectorAll('.submitted-edit').forEach(el=>{const id=el.dataset.historyId;if(id)updates.push({id,submittedLink:el.value});});if(!updates.length)return alert('No rows to save.');const btn=$('saveHistoryBtn');try{if(btn){btn.disabled=true;btn.textContent='Saving...'}await api('/api/history/update',{method:'POST',body:JSON.stringify({userId:USER_ID,updates})});if(LAST?.report?.history){for(const u of updates){const row=LAST.report.history.find(h=>String(h.id)===String(u.id));if(row)row.submittedLink=u.submittedLink;}}markUnsaved(false);renderHistory(LAST?.report?.history||[]);if(btn)btn.textContent='Saved ✅';setTimeout(()=>{if(btn)btn.textContent='Save All Changes'},1000);}catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}}
function drawChart(daily){const svg=$('dailyChart'),rows=(daily||[]).slice(),W=700,H=260,P=24;if(!rows.length){svg.innerHTML='<text x="20" y="40" fill="currentColor">No data yet</text>';return}const max=Math.max(1,...rows.map(d=>d.doneCount));const pts=rows.map((d,i)=>{const x=P+(rows.length===1?0:i*(W-P*2)/(rows.length-1));const y=H-P-(d.doneCount/max)*(H-P*2);return{x,y,d}});const line=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');const area=`${line} L${pts[pts.length-1].x},${H-P} L${pts[0].x},${H-P} Z`;svg.innerHTML=`<defs><linearGradient id="gradLine" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#007aff"/></linearGradient><linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".2"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>`}

function exportOperatorXlsx(){
  if(!LAST){ alert('No report data loaded yet.'); return; }
  if(typeof XLSX === 'undefined'){ alert('Excel export library is still loading. Please try again in a few seconds.'); return; }
  const from = $('fromDate')?.value || '';
  const to = $('toDate')?.value || '';
  const history = LAST.report?.history || [];
  const daily = LAST.report?.daily || [];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    Operator: USER.name,
    OperatorId: USER_ID,
    DateFrom: from,
    DateTo: to,
    DoneInRange: LAST.status?.rangeDone ?? history.length,
    TotalLinks: LAST.status?.totalLinks,
    LinksRemaining: LAST.status?.linksRemaining,
    TotalTexts: LAST.status?.totalTexts,
    TextsRemaining: LAST.status?.textsRemaining,
    UpdatedAt: LAST.status?.updatedAt
  }]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daily.map(d => ({
    Date: d.day,
    Completed: d.doneCount
  }))), 'Daily Counter');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(history.map(h => ({
    Date: h.day,
    Time: localTime(h.at),
    Operator: h.userName || USER.name,
    OperatorId: h.userId || USER_ID,
    BusinessTab: h.source || 'Links',
    OriginalLink: h.link || '',
    SubmittedLink: h.submittedLink || '',
    Text: h.text || '',
    Status: h.status || 'done',
    DataVersion: h.dataVersion || '',
    VersionName: h.versionName || '',
    AdminNote: h.adminNote || ''
  }))), 'Completed History');
  const safeName = USER_ID.replace(/[^a-z0-9_-]/gi,'');
  XLSX.writeFile(wb, `operator-${safeName}-analytics-${from || 'start'}-to-${to || 'end'}.xlsx`);
}

async function loadReport(){const j=await api(`/api/report?${dateParams()}&user=${USER_ID}`);LAST=j;fill(j.status);renderActivity(j.report.history);renderHistory(j.report.history);drawChart(j.report.daily)}
$('loginBtn').onclick=login;const exportBtn=$('exportOperatorBtn');if(exportBtn)exportBtn.onclick=exportOperatorXlsx;const saveBtn=$('saveHistoryBtn');if(saveBtn)saveBtn.onclick=saveHistoryChanges;$('operatorPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});initDates();if(pass()){showAnalytics();loadReport().catch(e=>{localStorage.removeItem(PASS_KEY);$('analyticsPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');alert(e.message)})}
