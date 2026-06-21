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
function renderUsers(users){const sorted=(users||[]).slice().sort((a,b)=>(b.totalDone||0)-(a.totalDone||0)||String(a.name||'').localeCompare(String(b.name||'')));$('userCards').innerHTML=sorted.map((u,i)=>`<a class="user-card leaderboard-compact-row leaderboard-link-card" href="/analytics/${esc(u.id)}?from=admin" target="_blank" rel="noopener" title="Open ${esc(u.name)} analytics"><div class="user-avatar" style="background:${esc(u.color)}">${i+1}</div><div><b>${esc(u.name)}</b><p>${u.totalDone||0} selected range • ${u.doneToday||0} today</p></div><strong class="leaderboard-count">${u.totalDone||0}</strong></a>`).join('')||'<p class="small">No operators yet.</p>'}

function updateOperatorNavigation(operators){
  const ops=(operators||[]).slice().sort((a,b)=>Number(String(a.id).replace('operator',''))-Number(String(b.id).replace('operator','')));
  const side=document.querySelector('.sidebar');
  const section=[...document.querySelectorAll('.side-section')].find(x=>x.textContent.trim()==='Operators');
  if(side && section){
    let n=section.nextElementSibling;
    while(n && !n.classList.contains('side-section')){ const next=n.nextElementSibling; n.remove(); n=next; }
    const all=document.createElement('a'); all.className='side-link op-filter active'; all.dataset.user=''; all.href='#'; all.innerHTML='<span>●</span>All Operators';
    section.insertAdjacentElement('afterend', all);
    let prev=all;
    ops.forEach((u,i)=>{ const a=document.createElement('a'); a.className='side-link op-open'; a.dataset.user=u.id; a.href=`/analytics/${u.id}?from=admin`; a.target='_blank'; a.rel='noopener'; a.innerHTML=`<span>${['🟣','🔵','🟢','🟠','🟡','🟤','⚫','⚪'][i%8]}</span>${esc(u.name)} Analytics`; prev.insertAdjacentElement('afterend',a); prev=a; });
  }
  const filter=$('userFilter');
  if(filter){ const current=filter.value; filter.innerHTML='<option value="">All Operators</option>'+ops.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')+'<option value="standard">Simple User</option>'; filter.value=current; }
  document.querySelectorAll('.op-filter').forEach(a=>a.onclick=e=>{e.preventDefault();CURRENT_USER=a.dataset.user||'';refresh().catch(err=>alert(err.message));});
}
function renderUserManagement(operators){
  const el=$('operatorManagementList'); if(!el)return;
  const ops=(operators||[]).slice().sort((a,b)=>Number(String(a.id).replace('operator',''))-Number(String(b.id).replace('operator','')));
  setText('operatorCountLabel', `${ops.length} Operators`);
  el.innerHTML=ops.map(u=>`<div class="operator-manage-row compact-user-row" data-user="${esc(u.id)}">
    <div class="operator-view-line">
      <div><b>${esc(u.name)}</b><small>${esc(u.id)} • Work: /worker/${esc(u.id)} • Analytics: /analytics/${esc(u.id)}</small></div>
      <div class="operator-row-actions"><button class="btn ghost tinyBtn edit-operator-btn" type="button">Edit</button><a class="btn ghost tinyBtn" href="/worker/${esc(u.id)}" target="_blank">Work</a><a class="btn ghost tinyBtn" href="/analytics/${esc(u.id)}?from=admin" target="_blank">Analytics</a><button class="btn red tinyBtn delete-operator-btn" type="button">Delete</button></div>
    </div>
    <div class="operator-edit-line hidden">
      <input class="input operator-name-input" value="${esc(u.name)}" placeholder="Display name">
      <input class="input operator-pass-input" type="text" placeholder="New analytics password (optional)">
      <button class="btn blue tinyBtn save-operator-btn" type="button">Save</button>
      <button class="btn ghost tinyBtn cancel-operator-btn" type="button">Cancel</button>
    </div>
  </div>`).join('')||'<p class="small">No operators yet.</p>';
  el.querySelectorAll('.edit-operator-btn').forEach(btn=>btn.onclick=()=>{
    const row=btn.closest('.operator-manage-row');
    row.querySelector('.operator-edit-line')?.classList.remove('hidden');
    row.querySelector('.operator-view-line')?.classList.add('is-editing-row');
  });
  el.querySelectorAll('.cancel-operator-btn').forEach(btn=>btn.onclick=()=>{
    const row=btn.closest('.operator-manage-row');
    row.querySelector('.operator-edit-line')?.classList.add('hidden');
    row.querySelector('.operator-view-line')?.classList.remove('is-editing-row');
  });
  el.querySelectorAll('.save-operator-btn').forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest('.operator-manage-row');
    const id=row.dataset.user;
    const name=row.querySelector('.operator-name-input').value.trim();
    const password=row.querySelector('.operator-pass-input').value.trim();
    try{btn.disabled=true;btn.textContent='Saving...';await api('/api/admin/operators/update',{method:'POST',body:JSON.stringify({id,name,password})});await refresh();}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Save'}
  });
  el.querySelectorAll('.delete-operator-btn').forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest('.operator-manage-row');
    const id=row.dataset.user;
    const name=row.querySelector('.operator-view-line b')?.textContent||id;
    if(!confirm(`Delete ${name}? History stays saved, but this user will be removed from active dashboards.`)) return;
    try{btn.disabled=true;btn.textContent='Deleting...';await api('/api/admin/operators/delete',{method:'POST',body:JSON.stringify({id})});await refresh();}catch(e){alert(e.message)}finally{btn.disabled=false;btn.textContent='Delete'}
  });
}

function openUserManagement(){ $('userManagementModal')?.classList.remove('hidden'); }
function closeUserManagement(){ $('userManagementModal')?.classList.add('hidden'); }
function toggleArchiveList(){
  const list=$('uploadArchive'), btn=$('toggleArchiveBtn'); if(!list)return;
  const closed=list.classList.toggle('archive-list-collapsed');
  if(btn) btn.textContent=closed?'View Archive':'Hide Archive';
}
async function addOperator(){
  const name=$('newOperatorName')?.value.trim()||'';
  const password=$('newOperatorPassword')?.value.trim()||'';
  if(!name)return alert('Enter operator display name.');
  if(!password)return alert('Enter an analytics password for this operator.');
  const btn=$('addOperatorBtn');
  try{if(btn){btn.disabled=true;btn.textContent='Adding...'}await api('/api/admin/operators',{method:'POST',body:JSON.stringify({name,password})});if($('newOperatorName'))$('newOperatorName').value='';if($('newOperatorPassword'))$('newOperatorPassword').value='';await refresh();}catch(e){alert(e.message)}finally{if(btn){btn.disabled=false;btn.textContent='Add User'}}
}

function renderSources(sources){$('sourceCards').innerHTML=(sources||[]).map(s=>`<div class="source-card"><div><b>${esc(s.source)}</b><p>${s.completed} active done • ${s.remaining} remaining • ${s.total} total</p><div class="bar"><span style="width:${s.percent}%"></span></div></div><strong>${s.percent}%</strong></div>`).join('')||'<p class="small">No link tabs yet.</p>'}
function renderUploadArchive(items){const el=$('uploadArchive');if(!el)return;const arr=(items||[]).slice();const latest=arr[arr.length-1];const inline=$('archiveLastVersionInline');if(inline) inline.textContent=latest?`— Last version: ${esc(latest.name||('Version '+latest.version))}`:'— No uploads yet';const meta=$('archiveShortDescription');if(meta) meta.textContent=latest?`Latest upload: Version ${latest.version} • ${latest.linkCount||0} links • ${latest.textCount||0} texts • ${(latest.sheets||[]).length} tabs`:'No upload archive yet.';el.classList.add('archive-list-collapsed');const btn=$('toggleArchiveBtn');if(btn)btn.textContent='View Archive';el.innerHTML=arr.slice().reverse().map(x=>`<div class="archive-item"><b>Version ${esc(x.version)} — ${esc(x.name)}</b><p>${esc(new Date(x.uploadedAt).toLocaleString())} • ${x.linkCount||0} links • ${x.textCount||0} texts • ${(x.sheets||[]).length} tabs</p></div>`).join('')||'<p class="small">No upload archive yet.</p>'}
function renderHistoricalSources(items){const el=$('historicalSourceCards');if(!el)return;el.innerHTML=(items||[]).map(s=>`<div class="source-card"><div><b>${esc(s.source)}</b><p>${s.completed} done in selected range • ${s.submittedLinks||0} submitted links</p></div><strong>${s.completed}</strong></div>`).join('')||'<p class="small">No historical tab data yet.</p>'}

function renderActivity(history){const el=$('activityList');if(!el)return;const rows=(history||[]).slice(0,6);el.innerHTML=rows.length?rows.map(h=>`<div class="activity-item"><div class="activity-icon">✓</div><div><b>${esc(h.userName||h.userId||'User')} completed ${esc(h.source||'Links')}</b><p>${esc(h.submittedLink||h.link||'')}</p><p>${esc(h.text||'')}</p></div><div class="activity-time">${esc(dateTimeCell(h.at,h.day))}</div></div>`).join(''):'<p class="small">No recent activity in this date range.</p>';}
function renderWeeklyGoals(progress, goals){const el=$('weeklyGoalsAdmin');if(!el)return;const rows=(progress||[]);el.innerHTML=rows.length?rows.map(u=>`<div class="weekly-goal-row" style="--goal:${esc(u.color||'#7c3aed')}"><div class="goal-user"><span class="goal-avatar">${esc(String(u.name||'?').replace('Operator ','')||'?')}</span><b>${esc(u.name)}</b></div><div class="goal-progress"><div class="bar"><span style="width:${Math.min(100,u.percent||0)}%"></span></div><small>${u.done||0} / ${u.goal||0} this week • ${u.percent||0}%</small></div><input class="input weekly-goal-input" data-user="${esc(u.id)}" type="number" min="0" value="${esc((goals&&goals[u.id])||u.goal||0)}"></div>`).join(''):'<p class="small">No operators found.</p>';}

let HAS_UNSAVED_HISTORY_CHANGES=false;
function markUnsaved(v=true){HAS_UNSAVED_HISTORY_CHANGES=v;const btn=$('saveHistoryBtn');if(btn)btn.textContent=v?'Save All Changes *':'Save All Changes'}
window.addEventListener('beforeunload',e=>{if(HAS_UNSAVED_HISTORY_CHANGES){e.preventDefault();e.returnValue='You have unsaved changes.';}});
function hrefFor(v){v=String(v||'').trim();if(!v)return'';return /^https?:\/\//i.test(v)?v:'https://'+v;}
function submittedCell(h){const id=esc(h.id||''),val=esc(h.submittedLink||'');const editing=!(h.submittedLink||'').trim();const view=compactLink(h.submittedLink||'');return `<div class="history-lock-field ${editing?'is-editing':'is-locked'}" data-field="submitted"><div class="locked-view">${view}</div><input class="input history-edit submitted-edit" data-history-id="${id}" value="${val}" placeholder="Paste submitted link"></div>`;}
function noteCell(h){const id=esc(h.id||''),val=esc(h.adminNote||''),editing=!(h.adminNote||'').trim();const view=compactText(h.adminNote||'', 'note');return `<div class="history-lock-field ${editing?'is-editing':'is-locked'}" data-field="note"><div class="locked-view">${view}</div><textarea class="note-input history-edit" data-history-id="${id}" placeholder="Add note...">${val}</textarea></div>`;}
function actionCell(h){return `<div class="row-actions"><span class="save-status">${((h.submittedLink||'').trim()||(h.adminNote||'').trim())?'Saved':'Editing'}</span><button class="btn ghost tinyBtn row-edit-btn" type="button">Edit</button></div>`;}

function renderHistory(history){$('historyRows').innerHTML=history.length?history.map(h=>`<tr data-history-id="${esc(h.id||'')}"><td class="select-cell"><input type="checkbox" class="history-row-check" data-history-id="${esc(h.id||'')}"></td><td class="nowrap">${esc(dateTimeCell(h.at,h.day))}</td><td>${esc(h.userName||h.userId||'User')}</td><td class="business-tab-cell">${compactText(h.source||'Links','text')}</td><td class="break">${compactLink(h.link)}</td><td class="break">${submittedCell(h)}</td><td>${compactText(h.text,'text')}</td><td>${noteCell(h)}</td><td>${actionCell(h)}</td></tr>`).join(''):'<tr><td colspan="9">No submissions found for this date range.</td></tr>';setText('resultCount',`Showing ${history.length} result${history.length===1?'':'s'}`);bindHistoryInputs();bindPreviewCells();bindHistorySelection();setTimeout(()=>window.initAdminHistoryColumnResize&&window.initAdminHistoryColumnResize(),0)}

function bindHistoryInputs(){document.querySelectorAll('.history-edit').forEach(el=>{el.oninput=()=>{el.classList.add('dirty');markUnsaved(true);const row=el.closest('tr');if(row){const st=row.querySelector('.save-status');if(st)st.textContent='Editing';}}});document.querySelectorAll('.row-edit-btn').forEach(btn=>{btn.onclick=()=>{const row=btn.closest('tr');if(!row)return;row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.remove('is-locked'));row.querySelectorAll('.history-lock-field').forEach(f=>f.classList.add('is-editing'));const st=row.querySelector('.save-status');if(st)st.textContent='Editing';markUnsaved(true);}})}

function selectedHistoryIds(){return [...document.querySelectorAll('.history-row-check:checked')].map(x=>x.dataset.historyId).filter(Boolean)}
function bindHistorySelection(){const all=$('selectAllHistory'); if(all){all.checked=false; all.onchange=()=>document.querySelectorAll('.history-row-check').forEach(c=>c.checked=all.checked);} updateSelectedCount(); document.querySelectorAll('.history-row-check').forEach(c=>c.onchange=updateSelectedCount);}
function updateSelectedCount(){const n=selectedHistoryIds().length; const el=$('selectedHistoryCount'); if(el)el.textContent=n?`${n} selected`:'';}
async function deleteSelectedHistory(){const ids=selectedHistoryIds(); if(!ids.length)return alert('Choose at least one row to delete.'); if(!confirm(`Move ${ids.length} completed history row${ids.length===1?'':'s'} to Trash?`))return; const btn=$('deleteSelectedHistoryBtn'); try{if(btn){btn.disabled=true;btn.textContent='Deleting...'} await api('/api/admin/history/delete',{method:'POST',body:JSON.stringify({ids})}); await refresh(); await loadTrash();}catch(e){alert(e.message)}finally{if(btn){btn.disabled=false;btn.textContent='Delete Selected'}}}
async function loadTrash(){const el=$('trashRows'); if(!el)return; try{const j=await api('/api/admin/history/trash'); const rows=j.trash||[]; el.innerHTML=rows.length?rows.map(h=>`<tr><td>${esc(dateTimeCell(h.deletedAt||h.at,h.day))}</td><td>${esc(h.userName||h.userId||'User')}</td><td>${compactText(h.source||'Links')}</td><td>${compactLink(h.link)}</td><td>${compactLink(h.submittedLink||'')}</td><td>${compactText(h.text||'')}</td><td><button class="btn blue tinyBtn restore-history-btn" data-history-id="${esc(h.id)}" type="button">Restore</button></td></tr>`).join(''):'<tr><td colspan="7">Trash is empty.</td></tr>'; document.querySelectorAll('.restore-history-btn').forEach(b=>b.onclick=()=>restoreHistoryRow(b.dataset.historyId)); bindPreviewCells();}catch(e){el.innerHTML='<tr><td colspan="7">Could not load trash.</td></tr>';}}
async function restoreHistoryRow(id){if(!id)return; try{await api('/api/admin/history/restore',{method:'POST',body:JSON.stringify({ids:[id]})}); await refresh(); await loadTrash();}catch(e){alert(e.message)}}
async function saveHistoryChanges(){const byId={};document.querySelectorAll('.submitted-edit,.note-input').forEach(el=>{const id=el.dataset.historyId;if(!id)return;byId[id] ||= {id}; if(el.classList.contains('submitted-edit')) byId[id].submittedLink=el.value; if(el.classList.contains('note-input')) byId[id].adminNote=el.value;});const updates=Object.values(byId);if(!updates.length)return alert('No rows to save.');const btn=$('saveHistoryBtn');try{if(btn){btn.disabled=true;btn.textContent='Saving...'}await api('/api/history/update',{method:'POST',body:JSON.stringify({updates})});if(LAST?.report?.history){for(const u of updates){const row=LAST.report.history.find(h=>String(h.id)===String(u.id));if(row){if(typeof u.submittedLink!=='undefined')row.submittedLink=u.submittedLink;if(typeof u.adminNote!=='undefined')row.adminNote=u.adminNote;}}}markUnsaved(false);applyFilter();if(btn)btn.textContent='Saved ✅';setTimeout(()=>{if(btn)btn.textContent='Save All Changes'},1000);}catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}}
function applyFilter(){const q=($('searchBox').value||'').toLowerCase().trim(),uf=$('userFilter').value||CURRENT_USER;let rows=LAST?.report?.history||[];if(uf)rows=rows.filter(h=>h.userId===uf);if(q)rows=rows.filter(h=>`${h.link} ${h.text} ${h.day} ${h.userName} ${h.userId} ${h.source} ${h.submittedLink} ${h.adminNote}`.toLowerCase().includes(q));renderHistory(rows)}
function drawChart(daily){
  const svg=$('dailyChart'), rows=(daily||[]).slice(), W=820, H=320, P=42;
  if(!svg)return;
  if(!rows.length){svg.innerHTML='<text x="24" y="46" fill="currentColor">No data yet</text>';return}
  const operators=(LAST?.users||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const history=(LAST?.report?.history||[]).filter(h=>h.status==='done');
  const dayIndex=Object.fromEntries(rows.map((d,i)=>[d.day,i]));
  const counts={};
  operators.forEach(u=>counts[u.id]=Array(rows.length).fill(0));
  history.forEach(h=>{ if(counts[h.userId] && h.day in dayIndex) counts[h.userId][dayIndex[h.day]]++; });
  const max=Math.max(1,...operators.flatMap(u=>counts[u.id]||[0]),...rows.map(d=>d.doneCount||0));
  const xFor=i=>P+(rows.length===1?0:i*(W-P*2)/(rows.length-1));
  const yFor=v=>H-P-(v/max)*(H-P*2);
  const smoothPath=vals=>vals.map((v,i)=>({x:xFor(i),y:yFor(v),v})).map((p,i,arr)=>{if(i===0)return`M${p.x.toFixed(1)},${p.y.toFixed(1)}`;const prev=arr[i-1],cx=(prev.x+p.x)/2;return` C${cx.toFixed(1)},${prev.y.toFixed(1)} ${cx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join('');
  const palette=['#8b5cf6','#007aff','#22c55e','#f97316','#ec4899','#14b8a6','#f43f5e'];
  const grid=[0,1,2,3,4].map(i=>{const y=P+i*(H-P*2)/4;const label=Math.round(max-(i*max/4));return`<line class="chart-grid" x1="${P}" x2="${W-P}" y1="${y}" y2="${y}"/><text class="chart-axis-label" x="10" y="${y+4}">${label}</text>`}).join('');
  const step=Math.max(1,Math.ceil(rows.length/8));
  const labels=rows.map((d,i)=>({d,i})).filter(o=>o.i%step===0||o.i===rows.length-1).map(o=>`<text class="chart-label" x="${xFor(o.i)}" y="${H-10}" text-anchor="middle">${esc(String(o.d.day||'').slice(5))}</text>`).join('');
  const lines=operators.map((u,idx)=>{const vals=counts[u.id]||[]; if(!vals.some(Boolean)) return ''; const color=palette[idx%palette.length]; const path=smoothPath(vals); const lastIdx=vals.length-1, lx=xFor(lastIdx), ly=yFor(vals[lastIdx]); return `<path class="chart-operator-line" d="${path}" stroke="${color}"/><circle class="chart-operator-dot" cx="${lx}" cy="${ly}" r="5" fill="${color}"><title>${esc(u.name)}: ${vals[lastIdx]||0}</title></circle>`;}).join('');
  const totalVals=rows.map(d=>d.doneCount||0), areaPath=smoothPath(totalVals);
  const area=`${areaPath} L${xFor(rows.length-1)},${H-P} L${xFor(0)},${H-P} Z`;
  const legend=operators.map((u,idx)=>`<span><i style="background:${palette[idx%palette.length]}"></i>${esc(u.name)}</span>`).join('');
  const total=totalVals.reduce((a,b)=>a+b,0);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=`<defs><linearGradient id="adminChartArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".18"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}" fill="url(#adminChartArea)"/>${lines}${labels}<text class="chart-total-label" x="${W-160}" y="26">Total selected range: ${total}</text>`;
  const legendEl=$('chartLegend'); if(legendEl) legendEl.innerHTML=legend;
}
function renderAll(j){LAST=j;updateOperatorNavigation(j.operators||j.users);fillProgress(j);renderUsers(j.users);renderUserManagement(j.operators||j.users);renderSources(j.sources);renderHistoricalSources(j.historicalSources);renderUploadArchive(j.uploadArchive);renderWeeklyGoals(j.weeklyProgress,j.weeklyGoals);drawChart(j.report.daily);applyFilter();renderActivity(j.report?.history||[])}
async function refresh(){renderAll(await api(`/api/admin/data?${dateParams()}&user=${CURRENT_USER}`))}
function readWorkbook(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});const sheetRows=name=>{const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{header:1}).map(r=>String(r[0]||'').trim()).filter(Boolean):[]};let texts=sheetRows('Texts');if(!texts.length)texts=sheetRows('Text');const linkTabs={};for(const name of wb.SheetNames){if(name.toLowerCase()==='texts'||name.toLowerCase()==='text')continue;const rows=sheetRows(name).filter(Boolean);if(rows.length)linkTabs[name]=rows;}resolve({texts,linkTabs})}catch(err){reject(err)}};reader.onerror=reject;reader.readAsArrayBuffer(file)})}
async function saveWeeklyGoals(){const goals={};document.querySelectorAll('.weekly-goal-input').forEach(i=>{goals[i.dataset.user]=Number(i.value)||0});const btn=$('saveGoalsBtn');try{if(btn){btn.disabled=true;btn.textContent='Saving...'}const r=await api('/api/admin/weekly-goals',{method:'POST',body:JSON.stringify({goals})});if(LAST){LAST.weeklyGoals=r.weeklyGoals;LAST.weeklyProgress=r.weeklyProgress;}renderWeeklyGoals(r.weeklyProgress,r.weeklyGoals);if(btn)btn.textContent='Saved ✅';setTimeout(()=>{if(btn)btn.textContent='Save Goals'},900)}catch(e){alert(e.message)}finally{if(btn)btn.disabled=false}}
function exportXlsx(){
  if(!LAST)return;
  const wb=XLSX.utils.book_new();
  const history=(LAST.report?.history||[]).map(h=>({
    Date:h.day,
    Time:localTime(h.at),
    DateTime:dateTimeCell(h.at,h.day),
    Operator:h.userName,
    UserId:h.userId,
    BusinessTab:h.source,
    OriginalLink:h.link,
    SubmittedLink:h.submittedLink||'',
    Text:h.text,
    Status:h.status,
    DataVersion:h.dataVersion,
    VersionName:h.versionName,
    AdminNote:h.adminNote||''
  }));
  const submitted=history.filter(h=>String(h.SubmittedLink||'').trim()).map(h=>({
    DateTime:h.DateTime,
    Operator:h.Operator,
    BusinessTab:h.BusinessTab,
    OriginalLink:h.OriginalLink,
    SubmittedLink:h.SubmittedLink,
    Text:h.Text,
    AdminNote:h.AdminNote,
    DataVersion:h.DataVersion,
    VersionName:h.VersionName
  }));
  const businessLinks=(LAST.links||[]).map((l,i)=>({
    Index:i+1,
    BusinessTab:l.source||l.tab||l.sheet||'Links',
    Link:l.url||l.link||String(l||''),
    OriginalIndex: typeof l.originalIndex==='number'?l.originalIndex:''
  }));
  const textList=(LAST.texts||[]).map((t,i)=>({Index:i+1, Text:t}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{dateFrom:$('fromDate')?.value,dateTo:$('toDate')?.value,totalLinks:LAST.totalLinks,linksRemaining:LAST.linksRemaining,totalTexts:LAST.totalTexts,textsRemaining:LAST.textsRemaining,doneInRange:LAST.rangeDone,doneToday:LAST.doneToday,updatedAt:LAST.updatedAt,currentVersion:LAST.currentVersion,versionName:LAST.versionName,lifetimeDone:LAST.lifetimeDone}]),'Summary');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.report?.daily||[]),'Daily Counter');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(history),'Completed History');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(submitted),'Submitted Links');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(businessLinks),'Business Links Used');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(textList),'Text List Used');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet((LAST.users||[]).slice().sort((a,b)=>(b.totalDone||0)-(a.totalDone||0))),'Operators');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.sources||[]),'Active Business Tabs');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.historicalSources||[]),'Historical Business Tabs');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(LAST.uploadArchive||[]),'Upload Archive');
  XLSX.writeFile(wb,`global-review-rotator-report-${new Date().toISOString().slice(0,10)}.xlsx`)
}

async function adminLogin(){
  const passInput=$('pass');
  const btn=$('loginBtn');
  PASS=(passInput?.value||'').trim();
  if(!PASS){alert('Enter admin password.');return;}
  try{
    if(btn){btn.disabled=true;btn.textContent='Checking...';}
    const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:PASS})});
    if(!r.ok){PASS='';alert('Wrong admin password.');return;}
    $('login')?.classList.add('hidden');
    $('panel')?.classList.remove('hidden');
    await refresh();
  }catch(e){alert(e.message||'Login failed.');}
  finally{if(btn){btn.disabled=false;btn.textContent='Login';}}
}
const loginButton=$('loginBtn');
if(loginButton) loginButton.onclick=adminLogin;
const passField=$('pass');
if(passField) passField.addEventListener('keydown',e=>{if(e.key==='Enter')adminLogin();});

$('uploadBtn').onclick=async()=>{try{const f=$('file').files[0];if(!f)return alert('Choose an Excel file first');const data=await readWorkbook(f);const totalLinks=Object.values(data.linkTabs).reduce((a,b)=>a+b.length,0);if(!confirm(`Replace current data with ${totalLinks} links across ${Object.keys(data.linkTabs).length} tabs and ${data.texts.length} texts?`))return;data.versionName=($('versionNameInput')?.value||f.name||'').trim();data.fileName=f.name;const r=await api('/api/admin/upload',{method:'POST',body:JSON.stringify(data)});renderAll(r.status);alert('Uploaded ✅\nHistory was preserved.')}catch(e){alert(e.message)}};
$('undo').onclick=async()=>{if(confirm('Undo last completed item?'))renderAll((await api('/api/admin/undo',{method:'POST',body:'{}'})).status)};const ra=$('resetActive');if(ra)ra.onclick=async()=>{if(confirm('Reset only the active pool? History will stay saved.'))renderAll((await api('/api/admin/reset-active',{method:'POST',body:'{}'})).status)};$('resetAll').onclick=async()=>{if(confirm('DANGER: Reset EVERYTHING including history and upload archive?'))renderAll((await api('/api/admin/reset-all',{method:'POST',body:'{}'})).status)};$('exportBtn').onclick=exportXlsx;const shb=$('saveHistoryBtn');if(shb)shb.onclick=saveHistoryChanges;const delb=$('deleteSelectedHistoryBtn');if(delb)delb.onclick=deleteSelectedHistory;const sgb=$('saveGoalsBtn');if(sgb)sgb.onclick=saveWeeklyGoals;const aub=$('addOperatorBtn');if(aub)aub.onclick=addOperator;const oum=$('openUserManagementBtn');if(oum)oum.onclick=openUserManagement;const cum=$('closeUserManagementBtn');if(cum)cum.onclick=closeUserManagement;const umm=$('userManagementModal');if(umm)umm.addEventListener('click',e=>{if(e.target===umm)closeUserManagement();});const tab=$('toggleArchiveBtn');if(tab)tab.onclick=toggleArchiveList;
initDates();

/* v3.9 Excel-style resizable columns for Admin Completed History */
(function(){
  const STORAGE_KEY = 'grr_admin_history_column_widths_v316_admin_history_fixed';
  // v3.12: tighter default column widths so links/text stay as one-line previews.
  // Users can still drag column edges in the header to make any column wider.
  const DEFAULT_WIDTHS = [34,110,80,78,155,145,200,145,120];
  function getWidths(){
    try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return DEFAULT_WIDTHS.map((d,i)=>Number(v[i])||d);}catch{return DEFAULT_WIDTHS.slice();}
  }
  function saveWidths(widths){localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));}
  function applyWidths(table,widths){
    if(!table)return;
    let cg=table.querySelector('colgroup');
    if(!cg){cg=document.createElement('colgroup'); for(let i=0;i<widths.length;i++)cg.appendChild(document.createElement('col')); table.insertBefore(cg, table.firstChild);}
    [...cg.children].forEach((col,i)=>{col.style.width=(widths[i]||DEFAULT_WIDTHS[i]||120)+'px';});
    const total = widths.reduce((a,b)=>a+(Number(b)||0),0);
    table.style.width = total + 'px';
    table.style.minWidth = total + 'px';
    table.style.maxWidth = total + 'px';
  }
  window.initAdminHistoryColumnResize=function(){
    const table=document.getElementById('historyTable'); if(!table)return;
    const ths=[...table.querySelectorAll('thead th')]; if(!ths.length)return;
    const widths=getWidths(); applyWidths(table,widths);
    const hint=document.querySelector('#history .table-resize-hint');
    if(hint && !document.getElementById('resetHistoryColumns')){
      const b=document.createElement('button'); b.id='resetHistoryColumns'; b.type='button'; b.className='btn ghost tinyBtn'; b.textContent='Reset Column Sizes';
      b.style.marginLeft='10px'; b.onclick=()=>{localStorage.removeItem(STORAGE_KEY); applyWidths(table, DEFAULT_WIDTHS.slice()); location.reload();};
      hint.appendChild(b);
    }
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

/* v3.18.3 admin mockup behavior: compact action cards + working sidebar */
(function(){
  let activeModalPanel=null;
  function ensureSectionModal(){
    let m=document.getElementById('adminSectionModal');
    if(m) return m;
    m=document.createElement('div');
    m.id='adminSectionModal';
    m.className='admin-modal mock-section-modal hidden';
    m.innerHTML='<div class="admin-modal-box"><div class="admin-modal-head"><div><h3 id="adminSectionModalTitle">Section</h3><p class="small" id="adminSectionModalSub">Manage this section.</p></div><button class="btn ghost tinyBtn" id="adminSectionModalClose" type="button">Close</button></div><div class="mock-modal-body" id="adminSectionModalBody"></div></div>';
    document.body.appendChild(m);
    const close=()=>closeSectionModal();
    document.getElementById('adminSectionModalClose').onclick=close;
    m.addEventListener('click',e=>{if(e.target===m) close();});
    return m;
  }
  function closeSectionModal(){
    const m=document.getElementById('adminSectionModal');
    const body=document.getElementById('adminSectionModalBody');
    if(activeModalPanel && body){
      const content=body.querySelector('.mock-hidden-content');
      if(content) activeModalPanel.appendChild(content);
    }
    activeModalPanel=null;
    if(body) body.innerHTML='';
    if(m) m.classList.add('hidden');
  }
  function openSectionModal(panel,title,sub){
    const m=ensureSectionModal(), body=document.getElementById('adminSectionModalBody');
    const content=panel.querySelector('.mock-hidden-content');
    if(!content) return;
    if(activeModalPanel && activeModalPanel!==panel) closeSectionModal();
    activeModalPanel=panel;
    document.getElementById('adminSectionModalTitle').textContent=title;
    document.getElementById('adminSectionModalSub').textContent=sub||'';
    body.appendChild(content);
    m.classList.remove('hidden');
  }
  function compactPanel(selector,buttonText,subtitle){
    const panel=document.querySelector(selector);
    if(!panel || panel.dataset.mockReady==='1') return;
    panel.dataset.mockReady='1';
    panel.classList.add('mock-action-card');
    const head=panel.querySelector('.card-head') || panel.firstElementChild;
    const title=(head?.querySelector('h3')?.textContent||'Section').trim();
    const content=document.createElement('div');
    content.className='mock-hidden-content';
    // Move header action buttons into the modal content so compact cards stay clean.
    if(head){ [...head.querySelectorAll('button, .btn')].forEach(b=>content.appendChild(b)); }
    const toMove=[];
    [...panel.childNodes].forEach(n=>{if(n!==head) toMove.push(n);});
    toMove.forEach(n=>content.appendChild(n));
    panel.appendChild(content);
    const body=document.createElement('div');
    body.className='mock-card-body';
    body.innerHTML=`<p>${subtitle||'Open and manage this section.'}</p><button class="btn ghost smallBtn" type="button">${buttonText}</button>`;
    panel.appendChild(body);
    body.querySelector('button').onclick=()=>openSectionModal(panel,title,subtitle||'');
  }
  function initAdminMockupUI(){
    // Make sidebar links reliable: scroll to section, open management modal where needed.
    document.querySelectorAll('.admin-nav-link').forEach(link=>{
      link.addEventListener('click',e=>{
        const href=link.getAttribute('href')||'';
        const label=(link.textContent||'').toLowerCase();
        if(label.includes('users')){e.preventDefault();document.getElementById('openUserManagementBtn')?.click();return;}
        let target=null;
        if(href.startsWith('#')) target=document.querySelector(href);
        else if(href.startsWith('.')) target=document.querySelector(href);
        if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.admin-nav-link').forEach(a=>a.classList.remove('active'));link.classList.add('active');}
      });
    });
    // Compact lower dashboard cards to match approved mockup.
    compactPanel('#weeklyGoals','View Goals','Set and manage weekly goals.');
    compactPanel('#businessTabs','View Analytics','Analytics and statistics.');
    compactPanel('#historicalBusiness','View Data','View historical business data.');
    compactPanel('#upload','Open Upload','Upload and manage Excel files.');
    compactPanel('#trash','Open Trash','Deleted items and old data.');
    // Upload archive keeps current version visible in the card, archive list opens in modal.
    const archive=document.getElementById('uploadArchivePanel');
    if(archive && archive.dataset.mockArchiveReady!=='1'){
      archive.dataset.mockArchiveReady='1';
      archive.classList.add('mock-action-card');
      const list=document.getElementById('uploadArchive');
      if(list){
        const content=document.createElement('div'); content.className='mock-hidden-content'; content.appendChild(list); archive.appendChild(content);
        const oldBtn=document.getElementById('toggleArchiveBtn'); if(oldBtn) oldBtn.remove();
        const body=document.createElement('div'); body.className='mock-card-body';
        body.innerHTML='<p>Click to see the full upload history.</p><button class="btn ghost smallBtn" type="button">View Archive</button>';
        archive.appendChild(body);
        body.querySelector('button').onclick=()=>openSectionModal(archive,'🗂 Upload Archive','Full archive upload list.');
      }
    }
    // Ensure user management stays compact and opens popup.
    const userCard=document.getElementById('userManagement');
    if(userCard){userCard.classList.add('mock-action-card');}
  }
  window.initAdminMockupUI=initAdminMockupUI;
  const oldRenderAll = (typeof renderAll==='function') ? renderAll : null;
  if(oldRenderAll){
    window.renderAll=function(j){const r=oldRenderAll(j); setTimeout(initAdminMockupUI,0); return r;};
    try{renderAll=window.renderAll;}catch{}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(initAdminMockupUI,100));
  setTimeout(initAdminMockupUI,300);
})();


/* v3.18.4 Admin dashboard targeted fixes: mobile menu, user analytics nav, fit fixes */
(function(){
  function escLocal(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function getOps(){return ((window.LAST&& (window.LAST.operators||window.LAST.users)) || (typeof LAST!=='undefined' && LAST && (LAST.operators||LAST.users)) || []).slice();}
  function operatorSort(a,b){
    const na=Number(String(a.id||'').replace(/\D/g,''));
    const nb=Number(String(b.id||'').replace(/\D/g,''));
    if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb) return na-nb;
    return String(a.name||'').localeCompare(String(b.name||''));
  }
  function buildAnalyticsNav(ops){
    const nav=document.querySelector('.admin-nav');
    if(!nav) return;
    let section=nav.querySelector('.admin-user-analytics-section');
    if(!section){
      section=document.createElement('div');
      section.className='admin-user-analytics-section';
      section.innerHTML='<div class="admin-nav-section-title">User Analytics</div><div class="admin-user-analytics-links"></div>';
      const userLink=[...nav.querySelectorAll('a')].find(a=>(a.textContent||'').toLowerCase().includes('user management'));
      if(userLink) userLink.insertAdjacentElement('afterend',section); else nav.appendChild(section);
    }
    const holder=section.querySelector('.admin-user-analytics-links');
    holder.innerHTML=(ops||[]).sort(operatorSort).map(u=>`<a class="admin-nav-link admin-analytics-link" href="/analytics/${escLocal(u.id)}?from=admin" target="_blank" rel="noopener"><span>♙</span><b>${escLocal(u.name||u.id)} Analytics</b></a>`).join('');
  }
  function wireAdminMobileMenu(){
    const btn=document.querySelector('.admin-dashboard-page .mobile-menu');
    const sidebar=document.querySelector('.admin-dashboard-page .sidebar');
    if(!btn||!sidebar||btn.dataset.mobileWired==='1') return;
    btn.dataset.mobileWired='1';
    btn.setAttribute('aria-label','Open admin menu');
    btn.addEventListener('click',e=>{e.preventDefault();document.body.classList.toggle('admin-menu-open');});
    document.addEventListener('click',e=>{
      if(!document.body.classList.contains('admin-menu-open')) return;
      if(sidebar.contains(e.target)||btn.contains(e.target)) return;
      document.body.classList.remove('admin-menu-open');
    });
    sidebar.addEventListener('click',e=>{ const a=e.target.closest('a'); if(a && window.innerWidth<=980) document.body.classList.remove('admin-menu-open'); });
  }
  function applyAdminFixes(){
    wireAdminMobileMenu();
    buildAnalyticsNav(getOps());
    const archive=document.getElementById('uploadArchivePanel');
    if(archive) archive.classList.add('admin-fit-card');
    const leaderboard=document.querySelector('.admin-leaderboard-panel');
    if(leaderboard) leaderboard.classList.add('admin-fit-card');
    const search=document.querySelector('.date-search-panel');
    if(search) search.classList.add('admin-fit-card');
  }
  window.applyAdminDashboardFixesV3184=applyAdminFixes;
  const previousRenderAll=window.renderAll || (typeof renderAll==='function'?renderAll:null);
  if(previousRenderAll && !previousRenderAll.__v3184Wrapped){
    const wrapped=function(j){const result=previousRenderAll(j); setTimeout(applyAdminFixes,0); return result;};
    wrapped.__v3184Wrapped=true;
    try{window.renderAll=wrapped; renderAll=wrapped;}catch{window.renderAll=wrapped;}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(applyAdminFixes,50));
  setTimeout(applyAdminFixes,300);
})();

// v3.18.7: robust mobile sidebar close button and overlay behavior
(function(){
  function ensureAdminMobileSidebar(){
    const body=document.body;
    const root=document.querySelector('.admin-dashboard-page');
    const btn=document.querySelector('.admin-dashboard-page .mobile-menu');
    const sidebar=document.querySelector('.admin-dashboard-page .sidebar');
    if(!root||!btn||!sidebar) return;
    let close=sidebar.querySelector('.admin-close-menu');
    if(!close){
      close=document.createElement('button');
      close.type='button';
      close.className='admin-close-menu';
      close.setAttribute('aria-label','Close admin menu');
      close.textContent='×';
      sidebar.appendChild(close);
    }
    if(btn.dataset.v3187Wired==='1') return;
    btn.dataset.v3187Wired='1';
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      body.classList.add('admin-menu-open');
    },true);
    close.addEventListener('click',function(e){e.preventDefault();body.classList.remove('admin-menu-open');});
    document.addEventListener('keydown',function(e){if(e.key==='Escape') body.classList.remove('admin-menu-open');});
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(ensureAdminMobileSidebar,80);});
  setTimeout(ensureAdminMobileSidebar,400);
})();
