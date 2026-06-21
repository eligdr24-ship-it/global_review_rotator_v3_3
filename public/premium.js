let LAST=null;const $=id=>document.getElementById(id);function labelFromId(id){const m=String(id||'').match(/operator(\d+)/i);return m?`Operator ${m[1]}`:String(id||'Operator')}function uid(){const p=location.pathname.split('/').filter(Boolean);const maybe=p[1]||p[0]||'operator1';return String(maybe).toLowerCase().replace(/[^a-z0-9_-]/g,'')||'operator1'}const USER_ID=uid();let USER={id:USER_ID,name:labelFromId(USER_ID),color:'#7c3aed'},PASS_KEY=`grr_operator_pass_${USER_ID}`;function pass(){return localStorage.getItem(PASS_KEY)||''}
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
async function login(){const password=$('operatorPassword').value.trim();const r=await fetch('/api/operator/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:USER_ID,password})});if(!r.ok)return alert('Wrong operator password');const j=await r.json().catch(()=>({}));if(j.user){USER=j.user;init();}localStorage.setItem(PASS_KEY,password);showAnalytics();loadReport().catch(e=>alert(e.message));}
function showAnalytics(){$('loginPanel').classList.add('hidden');$('analyticsPanel').classList.remove('hidden')}function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function compactText(s){const val=String(s||'');const safe=esc(val);if(!val.trim())return '<span class="muted-inline compact-cell">—</span>';return `<span class="compact-cell preview-cell" title="${safe}" data-full="${safe}">${safe}</span>`}
function compactLink(url){const val=String(url||'').trim();if(!val)return '<span class="muted-inline compact-cell">No link</span>';const safe=esc(val);return `<a class="compact-cell preview-cell compact-link" href="${safe}" target="_blank" rel="noopener" title="${safe}" data-full="${safe}">${safe}</a>`}
function ensureFullViewModal(){let m=document.getElementById('fullCellModal');if(m)return m;m=document.createElement('div');m.id='fullCellModal';m.className='full-cell-modal hidden';m.innerHTML='<div class="full-cell-box"><div class="full-cell-head"><h3>Full Content</h3><button class="btn ghost tinyBtn" id="fullCellClose" type="button">Close</button></div><pre id="fullCellText"></pre><button class="btn copy smallBtn" id="fullCellCopy" type="button">Copy</button></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});document.getElementById('fullCellClose').onclick=()=>m.classList.add('hidden');document.getElementById('fullCellCopy').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('fullCellText').textContent||'');document.getElementById('fullCellCopy').textContent='Copied ✅';setTimeout(()=>document.getElementById('fullCellCopy').textContent='Copy',900)}catch{alert('Copy failed. Select and copy manually.')}};return m}
function openFullCell(value){const m=ensureFullViewModal();document.getElementById('fullCellText').textContent=String(value||'');m.classList.remove('hidden')}
function bindPreviewCells(){document.querySelectorAll('.preview-cell').forEach(el=>{el.ondblclick=e=>{e.preventDefault();e.stopPropagation();openFullCell(el.dataset.full||el.textContent||'')}})}
function localTime(iso){try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return iso||''}}function setText(id,v){const e=$(id);if(e)e.textContent=v??'—'}function setWidth(id,p){const e=$(id);if(e)e.style.width=`${Math.max(0,Math.min(100,p))}%`}
function fill(s){const totalLinks=s.totalLinks||0,totalTexts=s.totalTexts||0,doneLinks=s.userLinksDone||0,usedTexts=s.userTextsDone||0;const lp=totalLinks?doneLinks/totalLinks*100:0,tp=totalTexts?usedTexts/totalTexts*100:0,overall=(lp+tp)/2;setText('totalLinks',totalLinks);setText('linksRemaining',s.linksRemaining);setText('doneToday',s.rangeDone??s.userDoneToday??s.doneToday);setText('totalTexts',totalTexts);setText('textsRemaining',s.textsRemaining);setText('overallPct',`${Math.round(overall)}%`);setText('linkProgressText',`${doneLinks} / ${totalLinks}`);setText('textProgressText',`${usedTexts} / ${totalTexts}`);$('overallRing')?.style.setProperty('--p',overall.toFixed(1));$('todayRing')?.style.setProperty('--p',Math.min(100,((s.rangeDone??s.userDoneToday)||0)*4));setWidth('linkBar',lp);setWidth('textBar',tp);setText('updatedLabel',`Selected range: ${$('dateRangeLabel')?.textContent||'This week'} • Updated: ${s.updatedAt?new Date(s.updatedAt).toLocaleString():'—'}`)}
function renderWeeklyGoalBox(w){const el=$('weeklyGoalBox');if(!el)return;const done=w?.done||0, goal=w?.goal||0, percent=w?.percent||0;el.innerHTML=`<div class="weekly-goal-row single"><div class="goal-user"><span class="goal-avatar">${esc(String(USER.name||'O').replace('Operator ',''))}</span><b>${esc(USER.name)}</b></div><div class="goal-progress"><div class="bar"><span style="width:${Math.min(100,percent)}%"></span></div><small>${done} / ${goal} this week • ${percent}%</small></div></div>`;}
function renderActivity(hist){const rows=(hist||[]).slice(0,5);$('activityList').innerHTML=rows.length?rows.map(h=>`<div class="activity-item"><div class="activity-icon">✓</div><div><b>Marked link #${Number(h.linkIdx)+1} as done</b><p>${esc(h.source||'Links')} • ${esc(h.link)}</p><p>${esc(h.text)}</p></div><div class="activity-time">${esc(localTime(h.at))}</div></div>`).join(''):'<p class="small">No activity in this date range.</p>'}

let HAS_UNSAVED_HISTORY_CHANGES=false;
function markUnsaved(v=true){HAS_UNSAVED_HISTORY_CHANGES=v;const btn=$('saveHistoryBtn');if(btn)btn.textContent=v?'Save All Changes *':'Save All Changes'}
window.addEventListener('beforeunload',e=>{if(HAS_UNSAVED_HISTORY_CHANGES){e.preventDefault();e.returnValue='You have unsaved changes.';}});
function hrefFor(v){v=String(v||'').trim();if(!v)return'';return /^https?:\/\//i.test(v)?v:'https://'+v;}
function submittedCell(h){const val=String(h.submittedLink||'');const safe=esc(val);const id=esc(h.id||'');if(val.trim())return `<span class="history-lock-field is-locked"><a class="compact-cell preview-cell compact-link" href="${safe}" target="_blank" rel="noopener" title="${safe}" data-full="${safe}">${safe}</a><input class="history-edit submitted-edit" data-history-id="${id}" value="${safe}" /></span>`;return `<span class="history-lock-field is-locked"><span class="muted-inline compact-cell">Paste submitted link...</span><input class="history-edit submitted-edit" data-history-id="${id}" value="" placeholder="Paste submitted link..." /></span>`}
function actionCell(h){return `<div class="row-actions"><span class="save-status">${(h.submittedLink||'').trim()?'Saved':'Editing'}</span><button class="btn ghost tinyBtn row-edit-btn" type="button">Edit</button></div>`;}

function renderHistory(hist){$('historyRows').innerHTML=hist.length?hist.map(h=>`<tr data-history-id="${esc(h.id||'')}"><td>${esc(localTime(h.at))}</td><td>${esc(h.day)}</td><td>${compactText(h.source||'Links')}</td><td class="break">${compactLink(h.link)}</td><td class="break">${submittedCell(h)}</td><td>${compactText(h.text)}</td><td>${actionCell(h)}</td></tr>`).join(''):'<tr><td colspan="7">No submissions for this date range.</td></tr>';setText('resultCount',`Showing ${hist.length} result${hist.length===1?'':'s'}`);bindHistoryInputs();bindPreviewCells()}
function bindHistoryInputs(){document.querySelectorAll('.history-edit').forEach(el=>{el.oninput=()=>{el.classList.add('dirty');markUnsaved(true);const row=el.closest('tr');if(row){const st=row.querySelector('.save-status');if(st)st.textContent='Editing';}}});document.querySelectorAll('.row-edit-btn').forEach(btn=>{btn.onclick=()=>{const row=btn.closest('tr');if(!row)return;row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.remove('is-locked'));row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.add('is-editing'));const st=row.querySelector('.save-status');if(st)st.textContent='Editing';markUnsaved(true);}})}
async function saveHistoryChanges(){const updates=[];document.querySelectorAll('.submitted-edit').forEach(el=>{const id=el.dataset.historyId;if(id)updates.push({id,submittedLink:el.value});});if(!updates.length)return alert('No rows to save.');const btn=$('saveHistoryBtn');try{if(btn){btn.disabled=true;btn.textContent='Saving...'}await api('/api/history/update',{method:'POST',body:JSON.stringify({userId:USER_ID,updates})});if(LAST?.report?.history){for(const u of updates){const row=LAST.report.history.find(h=>String(h.id)===String(u.id));if(row)row.submittedLink=u.submittedLink;}}markUnsaved(false);renderHistory(LAST?.report?.history||[]);if(btn)btn.textContent='Saved ✅';setTimeout(()=>{if(btn)btn.textContent='Save All Changes'},1000);}catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}}
function drawChart(daily){
  const svg=$('dailyChart'),rows=(daily||[]).slice(),W=760,H=300,P=34;
  if(!svg)return;
  if(!rows.length){svg.innerHTML='<text x="24" y="46" fill="currentColor">No data yet</text>';return}
  const max=Math.max(1,...rows.map(d=>d.doneCount||0));
  const pts=rows.map((d,i)=>{const x=P+(rows.length===1?0:i*(W-P*2)/(rows.length-1));const y=H-P-((d.doneCount||0)/max)*(H-P*2);return{x,y,d}});
  const line=pts.map((p,i)=>{if(i===0)return`M${p.x.toFixed(1)},${p.y.toFixed(1)}`;const prev=pts[i-1];const cx=(prev.x+p.x)/2;return` C${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join('');
  const area=`${line} L${pts[pts.length-1].x},${H-P} L${pts[0].x},${H-P} Z`;
  const grid=[0,1,2,3,4].map(i=>{const y=P+i*(H-P*2)/4;return`<line class="chart-grid" x1="${P}" x2="${W-P}" y1="${y}" y2="${y}"/>`}).join('');
  const step=Math.max(1,Math.ceil(pts.length/8));
  const labels=pts.filter((_,i)=>i%step===0||i===pts.length-1).map(p=>`<text class="chart-label" x="${p.x}" y="${H-8}" text-anchor="middle">${esc(String(p.d.day||'').slice(5))}</text>`).join('');
  const dots=pts.filter((_,i)=>i%step===0||i===pts.length-1).map(p=>`<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="5"><title>${esc(p.d.day)}: ${p.d.doneCount||0}</title></circle>`).join('');
  const last=pts[pts.length-1];
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=`<defs><linearGradient id="gradLine" x1="0" x2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#3b82f6"/><stop offset="1" stop-color="#22c55e"/></linearGradient><linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".26"/><stop offset=".65" stop-color="#3b82f6" stop-opacity=".08"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></linearGradient><filter id="chartGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-line chart-line-glow" d="${line}" filter="url(#chartGlow)"/>${dots}${labels}<g class="chart-last"><circle cx="${last.x}" cy="${last.y}" r="7"/><text x="${Math.min(W-60,last.x+12)}" y="${Math.max(24,last.y-10)}">${last.d.doneCount||0}</text></g>`;
}


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

async function loadReport(){const j=await api(`/api/report?${dateParams()}&user=${USER_ID}`);if(j.status?.user){USER=j.status.user;init();}LAST=j;fill(j.status);renderWeeklyGoalBox(j.weekly);renderHistory(j.report.history);drawChart(j.report.daily);renderActivity(j.report.history)}
$('loginBtn').onclick=login;const exportBtn=$('exportOperatorBtn');if(exportBtn)exportBtn.onclick=exportOperatorXlsx;const saveBtn=$('saveHistoryBtn');if(saveBtn)saveBtn.onclick=saveHistoryChanges;$('operatorPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});initDates();if(pass()){showAnalytics();loadReport().catch(e=>{localStorage.removeItem(PASS_KEY);$('analyticsPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');alert(e.message)})}
