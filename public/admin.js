let PASS='',LAST=null,CURRENT_USER='';
const $=id=>document.getElementById(id);
async function api(p,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json','x-admin-password':PASS};const r=await fetch(p,opt);const text=await r.text();let j;try{j=text?JSON.parse(text):{}}catch{throw new Error(`Backend returned ${r.status}: ${text.slice(0,120)}`)}if(!r.ok)throw new Error(j.error||'Request failed');return j}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function fullAttr(s){return esc(String(s||''));}
function compactText(s, type='text'){
  const val = String(s||'');
  const safe = esc(val);
  const emptyLabel = type==='link' ? 'No link' : type==='note' ? 'No note' : '—';
  if(!val.trim()) return `<span class="muted-inline compact-cell">${emptyLabel}</span>`;
  return `<span class="compact-cell preview-cell" title="${safe}" data-full="${safe}">${safe}</span>`;
}
function compactLink(url){
  const val = String(url||'').trim();
  if(!val) return '<span class="muted-inline compact-cell">No link</span>';
  const safe = esc(val), href = esc(hrefFor(val));
  return `<a class="compact-cell preview-cell compact-link" href="${href}" target="_blank" rel="noopener" title="${safe}" data-full="${safe}">${safe}</a>`;
}
function ensureFullViewModal(){
  let m=document.getElementById('fullCellModal');
  if(m) return m;
  m=document.createElement('div');
  m.id='fullCellModal';
  m.className='full-cell-modal hidden';
  m.innerHTML='<div class="full-cell-box"><div class="full-cell-head"><h3>Full Content</h3><button class="btn ghost tinyBtn" id="fullCellClose" type="button">Close</button></div><pre id="fullCellText"></pre><button class="btn copy smallBtn" id="fullCellCopy" type="button">Copy</button></div>';
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')});
  document.getElementById('fullCellClose').onclick=()=>m.classList.add('hidden');
  document.getElementById('fullCellCopy').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('fullCellText').textContent||'');document.getElementById('fullCellCopy').textContent='Copied ✅';setTimeout(()=>document.getElementById('fullCellCopy').textContent='Copy',900)}catch{alert('Copy failed. Select and copy manually.')}};
  return m;
}
function openFullCell(value){
  const m=ensureFullViewModal();
  document.getElementById('fullCellText').textContent=String(value||'');
  m.classList.remove('hidden');
}
function bindPreviewCells(){
  document.querySelectorAll('.preview-cell').forEach(el=>{
    el.ondblclick=e=>{e.preventDefault();e.stopPropagation();openFullCell(el.dataset.full||el.textContent||'')};
  });
}
function localTime(iso){try{return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch{return iso||''}}
function dateTimeCell(isoVal, day){try{const d=new Date(isoVal);return `${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`}catch{return `${day||''} ${localTime(isoVal)}`.trim()}}
function iso(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function weekRange(){const now=new Date();const start=new Date(now);start.setDate(now.getDate()-now.getDay());const end=new Date(start);end.setDate(start.getDate()+6);return [iso(start),iso(end)]}
function dateParams(){const f=$('fromDate')?.value||'',t=$('toDate')?.value||'';return `from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`}
function setDateRange(f,t){if($('fromDate'))$('fromDate').value=f;if($('toDate'))$('toDate').value=t;setText('dateRangeLabel',`${f} → ${t}`)}
function quickRange(type){const now=new Date();let start=new Date(now),end=new Date(now);if(type==='week'){[start,end]=weekRange().map(x=>new Date(x+'T00:00:00'));}else if(type==='today'){}else{const days=Number(type)||7;start.setDate(now.getDate()-days+1)}setDateRange(iso(start),iso(end));refresh().catch(e=>alert(e.message))}
function initDates(){const [f,t]=weekRange();setDateRange(f,t);document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>quickRange(b.dataset.range));const apply=$('applyDateSearch');if(apply)apply.onclick=()=>refresh().catch(e=>alert(e.message));}
function goBack(fallback='/'){if(document.referrer)history.back();else location.href=fallback}
function setText(id,v){const e=$(id);if(e)e.textContent=v??'—'}function setWidth(id,p){const e=$(id);if(e)e.style.width=`${Math.max(0,Math.min(100,p))}%`}
function fillProgress(j){const totalLinks=j.totalLinks||0,totalTexts=j.totalTexts||0,doneLinks=Math.max(totalLinks-(j.linksRemaining||0),0),usedTexts=Math.max(totalTexts-(j.textsRemaining||0),0);const lp=totalLinks?doneLinks/totalLinks*100:0,tp=totalTexts?usedTexts/totalTexts*100:0,overall=(lp+tp)/2;setText('links',totalLinks);setText('linksRemaining',j.linksRemaining);setText('texts',totalTexts);setText('remain',j.textsRemaining);setText('done',j.rangeDone??j.doneToday);setText('overallPct',`${Math.round(overall)}%`);setText('linkProgressText',`${doneLinks} / ${totalLinks}`);setText('textProgressText',`${usedTexts} / ${totalTexts}`);$('overallRing')?.style.setProperty('--p',overall.toFixed(1));$('todayRing')?.style.setProperty('--p',Math.min(100,((j.rangeDone??j.doneToday)||0)*2));setWidth('linkBar',lp);setWidth('textBar',tp);setText('updated',`● Last updated: ${j.updatedAt?new Date(j.updatedAt).toLocaleString():'—'}`);setText('trendChip',$('dateRangeLabel')?.textContent||'This week');setText('currentVersion',`Version ${j.currentVersion||j.meta?.dataVersion||1}`);setText('versionName',j.versionName||j.meta?.versionName||'Initial Data');setText('lifetimeDone',j.lifetimeDone||0)}
function renderUsers(users){$('userCards').innerHTML=(users||[]).map((u,i)=>`<div class="user-card"><div class="user-avatar" style="background:${esc(u.color)}">${i+1}</div><div><b>${esc(u.name)}</b><p>${u.totalDone||0} selected range • ${u.doneToday||0} today</p><div class="bar"><span style="width:${Math.min(100,(u.totalDone||0)*3)}%"></span></div></div><div class="user-card-actions"><a href="/worker/${esc(u.id)}" target="_blank">Work</a><a href="/analytics/${esc(u.id)}?from=admin" target="_blank">Analytics</a></div></div>`).join('')||'<p class="small">No operators yet.</p>'}
function renderSources(sources){$('sourceCards').innerHTML=(sources||[]).map(s=>`<div class="source-card"><div><b>${esc(s.source)}</b><p>${s.completed} active done • ${s.remaining} remaining • ${s.total} total</p><div class="bar"><span style="width:${s.percent}%"></span></div></div><strong>${s.percent}%</strong></div>`).join('')||'<p class="small">No link tabs yet.</p>'}
function renderUploadArchive(items){const el=$('uploadArchive');if(!el)return;el.innerHTML=(items||[]).slice().reverse().map(x=>`<div class="archive-item"><b>Version ${esc(x.version)} — ${esc(x.name)}</b><p>${esc(new Date(x.uploadedAt).toLocaleString())} • ${x.linkCount||0} links • ${x.textCount||0} texts • ${(x.sheets||[]).length} tabs</p></div>`).join('')||'<p class="small">No upload archive yet.</p>'}
function renderHistoricalSources(items){const el=$('historicalSourceCards');if(!el)return;el.innerHTML=(items||[]).map(s=>`<div class="source-card"><div><b>${esc(s.source)}</b><p>${s.completed} done in selected range • ${s.submittedLinks||0} submitted links</p></div><strong>${s.completed}</strong></div>`).join('')||'<p class="small">No historical tab data yet.</p>'}

let HAS_UNSAVED_HISTORY_CHANGES=false;
function markUnsaved(v=true){HAS_UNSAVED_HISTORY_CHANGES=v;const btn=$('saveHistoryBtn');if(btn)btn.textContent=v?'Save All Changes *':'Save All Changes'}
window.addEventListener('beforeunload',e=>{if(HAS_UNSAVED_HISTORY_CHANGES){e.preventDefault();e.returnValue='You have unsaved changes.';}});
function hrefFor(v){v=String(v||'').trim();if(!v)return'';return /^https?:\/\//i.test(v)?v:'https://'+v;}
function submittedCell(h){const id=esc(h.id||''),val=esc(h.submittedLink||'');const editing=!(h.submittedLink||'').trim();const view=compactLink(h.submittedLink||'');return `<div class="history-lock-field ${editing?'is-editing':'is-locked'}" data-field="submitted"><div class="locked-view">${view}</div><input class="input history-edit submitted-edit" data-history-id="${id}" value="${val}" placeholder="Paste submitted link"></div>`;}
function noteCell(h){const id=esc(h.id||''),val=esc(h.adminNote||''),editing=!(h.adminNote||'').trim();const view=compactText(h.adminNote||'', 'note');return `<div class="history-lock-field ${editing?'is-editing':'is-locked'}" data-field="note"><div class="locked-view">${view}</div><textarea class="note-input history-edit" data-history-id="${id}" placeholder="Add note...">${val}</textarea></div>`;}
function actionCell(h){return `<div class="row-actions"><span class="save-status">${((h.submittedLink||'').trim()||(h.adminNote||'').trim())?'Saved':'Editing'}</span><button class="btn ghost tinyBtn row-edit-btn" type="button">Edit</button></div>`;}

function renderHistory(history){$('historyRows').innerHTML=history.length?history.map(h=>`<tr data-history-id="${esc(h.id||'')}"><td class="nowrap">${esc(dateTimeCell(h.at,h.day))}</td><td>${esc(h.userName||h.userId||'User')}</td><td class="business-tab-cell">${compactText(h.source||'Links','text')}</td><td class="break">${compactLink(h.link)}</td><td class="break">${submittedCell(h)}</td><td>${compactText(h.text,'text')}</td><td>${noteCell(h)}</td><td>${actionCell(h)}</td></tr>`).join(''):'<tr><td colspan="8">No submissions found for this date range.</td></tr>';setText('resultCount',`Showing ${history.length} result${history.length===1?'':'s'}`);bindHistoryInputs();bindPreviewCells()}

function bindHistoryInputs(){document.querySelectorAll('.history-edit').forEach(el=>{el.oninput=()=>{el.classList.add('dirty');markUnsaved(true);const row=el.closest('tr');if(row){const st=row.querySelector('.save-status');if(st)st.textContent='Editing';}}});document.querySelectorAll('.row-edit-btn').forEach(btn=>{btn.onclick=()=>{const row=btn.closest('tr');if(!row)return;row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.remove('is-locked'));row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.add('is-editing'));const st=row.querySelector('.save-status');if(st)st.textContent='Editing';markUnsaved(true);}})}
async function saveHistoryChanges(){const byId={};document.querySelectorAll('.submitted-edit,.note-input').forEach(el=>{const id=el.dataset.historyId;if(!id)return;byId[id] ||= {id}; if(el.classList.contains('submitted-edit')) byId[id].submittedLink=el.value; if(el.classList.contains('note-input')) byId[id].adminNote=el.value;});const updates=Object.values(byId);if(!updates.length)return alert('No rows to save.');const btn=$('saveHistoryBtn');try{if(btn){btn.disabled=true;btn.textContent='Saving...'}await api('/api/history/update',{method:'POST',body:JSON.stringify({updates})});if(LAST?.report?.history){for(const u of updates){const row=LAST.report.history.find(h=>String(h.id)===String(u.id));if(row){if(typeof u.submittedLink!=='undefined')row.submittedLink=u.submittedLink;if(typeof u.adminNote!=='undefined')row.adminNote=u.adminNote;}}}markUnsaved(false);applyFilter();if(btn)btn.textContent='Saved ✅';setTimeout(()=>{if(btn)btn.textContent='Save All Changes'},1000);}catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}}
function applyFilter(){const q=($('searchBox').value||'').toLowerCase().trim(),uf=$('userFilter').value||CURRENT_USER;let rows=LAST?.report?.history||[];if(uf)rows=rows.filter(h=>h.userId===uf);if(q)rows=rows.filter(h=>`${h.link} ${h.text} ${h.day} ${h.userName} ${h.userId} ${h.source} ${h.submittedLink} ${h.adminNote}`.toLowerCase().includes(q));renderHistory(rows)}
function drawChart(daily){const svg=$('dailyChart'),rows=(daily||[]).slice(),W=700,H=260,P=24;if(!rows.length){svg.innerHTML='<text x="20" y="40" fill="currentColor">No data yet</text>';return}const max=Math.max(1,...rows.map(d=>d.doneCount));const pts=rows.map((d,i)=>{const x=P+(rows.length===1?0:i*(W-P*2)/(rows.length-1));const y=H-P-(d.doneCount/max)*(H-P*2);return{x,y,d}});const line=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');const area=`${line} L${pts[pts.length-1].x},${H-P} L${pts[0].x},${H-P} Z`;svg.innerHTML=`<defs><linearGradient id="gradLine" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#007aff"/></linearGradient><linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".22"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>`}
function renderAll(j){LAST=j;fillProgress(j);renderUsers(j.users);renderSources(j.sources);renderHistoricalSources(j.historicalSources);renderUploadArchive(j.uploadArchive);drawChart(j.report.daily);applyFilter()}
async function refresh(){renderAll(await api(`/api/admin/data?${dateParams()}&user=${CURRENT_USER}`))}
function readWorkbook(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});const sheetRows=name=>{const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{header:1}).map(r=>String(r[0]||'').trim()).filter(Boolean):[]};let texts=sheetRows('Texts');if(!texts.length)texts=sheetRows('Text');const linkTabs={};for(const name of wb.SheetNames){if(name.toLowerCase()==='texts'||name.toLowerCase()==='text')continue;const rows=sheetRows(name).filter(Boolean);if(rows.length)linkTabs[name]=rows;}resolve({texts,linkTabs})}catch(err){reject(err)}};reader.onerror=reject;reader.readAsArrayBuffer(file)})}
function exportXlsx(){if(!LAST)return;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{dateFrom:$('fromDate')?.value,dateTo:$('toDate')?.value,totalLinks:LAST.totalLinks,linksRemaining:LAST.linksRemaining,totalTexts:LAST.totalTexts,textsRemaining:LAST.textsRemaining,doneInRange:LAST.rangeDone,doneToday:LAST.doneToday,updatedAt:LAST.updatedAt,currentVersion:LAST.currentVersion,versionName:LAST.versionName,lifetimeDone:LAST.lifetimeDone}]),'Summary');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.users||[]),'Operators');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.sources||[]),'Active Business Tabs');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.historicalSources||[]),'Historical Business Tabs');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.uploadArchive||[]),'Upload Archive');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((LAST.report?.history||[]).map(h=>({Date:h.day,Time:localTime(h.at),Operator:h.userName,UserId:h.userId,BusinessTab:h.source,OriginalLink:h.link,SubmittedLink:h.submittedLink,Text:h.text,Status:h.status,DataVersion:h.dataVersion,VersionName:h.versionName,AdminNote:h.adminNote||''}))), 'History');XLSX.writeFile(wb,`global-review-rotator-report-${new Date().toISOString().slice(0,10)}.xlsx`)}
$('loginBtn').onclick=async()=>{PASS=$('pass').value;const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:PASS})});if(!r.ok)return alert('Wrong password');$('login').classList.add('hidden');$('panel').classList.remove('hidden');refresh().catch(e=>alert(e.message))};
$('searchBox').oninput=applyFilter;$('userFilter').onchange=applyFilter;document.querySelectorAll('.op-filter').forEach(a=>a.onclick=e=>{e.preventDefault();CURRENT_USER=a.dataset.user||'';document.querySelectorAll('.op-filter').forEach(x=>x.classList.remove('active'));a.classList.add('active');$('userFilter').value=CURRENT_USER;refresh().catch(err=>alert(err.message));});
$('uploadBtn').onclick=async()=>{try{const f=$('file').files[0];if(!f)return alert('Choose an Excel file first');const data=await readWorkbook(f);const totalLinks=Object.values(data.linkTabs).reduce((a,b)=>a+b.length,0);if(!confirm(`Replace current data with ${totalLinks} links across ${Object.keys(data.linkTabs).length} tabs and ${data.texts.length} texts?`))return;data.versionName=($('versionNameInput')?.value||f.name||'').trim();data.fileName=f.name;const r=await api('/api/admin/upload',{method:'POST',body:JSON.stringify(data)});renderAll(r.status);alert('Uploaded ✅\nHistory was preserved.')}catch(e){alert(e.message)}};
$('undo').onclick=async()=>{if(confirm('Undo last completed item?'))renderAll((await api('/api/admin/undo',{method:'POST',body:'{}'})).status)};const ra=$('resetActive');if(ra)ra.onclick=async()=>{if(confirm('Reset only the active pool? History will stay saved.'))renderAll((await api('/api/admin/reset-active',{method:'POST',body:'{}'})).status)};$('resetAll').onclick=async()=>{if(confirm('DANGER: Reset EVERYTHING including history and upload archive?'))renderAll((await api('/api/admin/reset-all',{method:'POST',body:'{}'})).status)};$('exportBtn').onclick=exportXlsx;const shb=$('saveHistoryBtn');if(shb)shb.onclick=saveHistoryChanges;
initDates();

/* v3.9 Excel-style resizable columns for Admin Completed History */
(function(){
  const STORAGE_KEY = 'grr_admin_history_column_widths_v312';
  // v3.12: tighter default column widths so links/text stay as one-line previews.
  // Users can still drag column edges in the header to make any column wider.
  const DEFAULT_WIDTHS = [135,105,85,155,165,245,180,130];
  function getWidths(){
    try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return DEFAULT_WIDTHS.map((d,i)=>Number(v[i])||d);}catch{return DEFAULT_WIDTHS.slice();}
  }
  function saveWidths(widths){localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));}
  function applyWidths(table,widths){
    if(!table)return;
    let cg=table.querySelector('colgroup');
    if(!cg){cg=document.createElement('colgroup'); for(let i=0;i<widths.length;i++)cg.appendChild(document.createElement('col')); table.insertBefore(cg, table.firstChild);}
    [...cg.children].forEach((col,i)=>{col.style.width=(widths[i]||DEFAULT_WIDTHS[i]||120)+'px';});
  }
  window.initAdminHistoryColumnResize=function(){
    const table=document.getElementById('historyTable'); if(!table)return;
    const ths=[...table.querySelectorAll('thead th')]; if(!ths.length)return;
    const widths=getWidths(); applyWidths(table,widths);
    ths.forEach((th,i)=>{
      th.classList.add('resizable-th');
      if(th.querySelector('.col-resizer'))return;
      const handle=document.createElement('span'); handle.className='col-resizer'; handle.title='Drag to resize column'; th.appendChild(handle);
      let startX=0,startW=0;
      const move=e=>{
        const x=e.touches?e.touches[0].clientX:e.clientX;
        const next=Math.max(55,startW+(x-startX)); widths[i]=next; applyWidths(table,widths);
      };
      const up=()=>{document.body.classList.remove('resize-active');handle.classList.remove('is-dragging');saveWidths(widths);document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);};
      const down=e=>{e.preventDefault();startX=e.touches?e.touches[0].clientX:e.clientX;startW=widths[i]||th.offsetWidth;document.body.classList.add('resize-active');handle.classList.add('is-dragging');document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up);};
      handle.addEventListener('mousedown',down); handle.addEventListener('touchstart',down,{passive:false});
    });
  };
  const oldRenderHistory = window.renderHistory || (typeof renderHistory === 'function' ? renderHistory : null);
  if(oldRenderHistory){
    window.renderHistory = function(history){ const r=oldRenderHistory(history); setTimeout(()=>window.initAdminHistoryColumnResize&&window.initAdminHistoryColumnResize(),0); return r; };
    try{ renderHistory = window.renderHistory; }catch{}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>window.initAdminHistoryColumnResize&&window.initAdminHistoryColumnResize(),0));
  setTimeout(()=>window.initAdminHistoryColumnResize&&window.initAdminHistoryColumnResize(),200);
})();
