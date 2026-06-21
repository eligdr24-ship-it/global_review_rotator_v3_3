const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const BASE_OPERATORS = {
  operator1: { id:'operator1', name:'Operator 1', color:'#7c3aed', env:'OPERATOR1_PASSWORD', enabled:true },
  operator2: { id:'operator2', name:'Operator 2', color:'#007aff', env:'OPERATOR2_PASSWORD', enabled:true },
  operator3: { id:'operator3', name:'Operator 3', color:'#16a34a', env:'OPERATOR3_PASSWORD', enabled:true },
  operator4: { id:'operator4', name:'Operator 4', color:'#f97316', env:'OPERATOR4_PASSWORD', enabled:true }
};
const OPERATOR_COLORS = ['#7c3aed','#007aff','#16a34a','#f97316','#ec4899','#06b6d4','#f59e0b','#64748b','#8b5cf6','#10b981'];
function displayNameFromId(id){ const n=String(id||'').replace(/^operator/i,''); return `Operator ${n||''}`.trim(); }
function defaultPasswordFor(id){ return process.env[BASE_OPERATORS[id]?.env] || id; }
function normalizeStoredOperators(ops=[]){
  const out=[];
  if(Array.isArray(ops)){
    for(const op of ops){
      const id=String(op?.id||'').toLowerCase().replace(/[^a-z0-9_-]/g,'');
      if(!/^operator\d+$/.test(id)) continue;
      out.push({id, name:String(op.name||displayNameFromId(id)).trim()||displayNameFromId(id), color:String(op.color||OPERATOR_COLORS[out.length%OPERATOR_COLORS.length]), password:String(op.password||''), enabled:op.enabled!==false});
    }
  }
  return out;
}
function getOperators(db){
  const map={};
  Object.values(BASE_OPERATORS).forEach((op,i)=>{ map[op.id]={...op, password:'', enabled:true, color:op.color||OPERATOR_COLORS[i%OPERATOR_COLORS.length]}; });
  normalizeStoredOperators(db?.meta?.operators||[]).forEach(op=>{ map[op.id]={...(map[op.id]||{}),...op}; });
  for(const h of (db?.state?.history||[])){
    const id=String(h.userId||'').toLowerCase().replace(/[^a-z0-9_-]/g,'');
    if(/^operator\d+$/.test(id) && !map[id]) map[id]={id,name:h.userName||displayNameFromId(id),color:OPERATOR_COLORS[Object.keys(map).length%OPERATOR_COLORS.length],password:'',enabled:true};
  }
  return Object.fromEntries(Object.values(map).filter(op=>op.enabled!==false).sort((a,b)=>Number(a.id.replace('operator',''))-Number(b.id.replace('operator',''))).map(op=>[op.id,op]));
}
function operatorList(db){ return Object.values(getOperators(db)).map(u=>({id:u.id,name:u.name,color:u.color,enabled:u.enabled!==false})); }
function normalizeWeeklyGoals(goals={}, db=null){
  const out = {};
  for (const id of Object.keys(db?getOperators(db):BASE_OPERATORS)) {
    const n = Number(goals[id]);
    out[id] = Number.isFinite(n) && n >= 0 ? Math.round(n) : 50;
  }
  return out;
}
function operatorPassword(id, db=null){ const uid=cleanUserId(id,db); const ops=db?getOperators(db):BASE_OPERATORS; const op=ops[uid]; return op?.password || defaultPasswordFor(uid); }
function operatorAuthOk(req, id, db=null){ const uid=cleanUserId(id,db); return String(req.headers['x-operator-password'] || '') === String(operatorPassword(uid,db)); }
function cleanUserId(value, db=null){ const id = String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,''); const ops=db?getOperators(db):BASE_OPERATORS; if(ops[id]) return id; if(/^operator\d+$/.test(id)) return id; return id === 'standard' ? 'standard' : 'operator1'; }
function userInfo(id, db=null){ const uid=cleanUserId(id,db); const ops=db?getOperators(db):BASE_OPERATORS; const u=ops[uid]; return u ? {id:u.id,name:u.name,color:u.color} : { id:uid==='standard'?'standard':uid, name:uid==='standard'?'Simple User':displayNameFromId(uid), color:'#64748b' }; }
function dayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function dateOnly(ts){ return String(ts||'').slice(0,10); }
function recentDays(count=365){ const out=[]; const d=new Date(); for(let i=0;i<count;i++){ const x=new Date(d); x.setUTCDate(d.getUTCDate()-i); out.push(dayKey(x)); } return out; }
function validDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||'')); }
function dateRangeDays(from,to){
  if(!validDate(from)||!validDate(to)) return null;
  const start=new Date(from+'T00:00:00Z'), end=new Date(to+'T00:00:00Z');
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end) return null;
  const out=[]; const cur=new Date(start);
  while(cur<=end && out.length<=366){ out.push(dayKey(cur)); cur.setUTCDate(cur.getUTCDate()+1); }
  return out;
}
function selectedDays(count=365,from='',to=''){ return dateRangeDays(from,to) || recentDays(Math.min(Math.max(Number(count)||365,1),365)); }
function currentWeekDays(){ const now=new Date(); const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())); start.setUTCDate(start.getUTCDate()-start.getUTCDay()); const end=new Date(start); end.setUTCDate(start.getUTCDate()+6); return dateRangeDays(dayKey(start), dayKey(end)); }
function isUrl(s){ return /^https?:\/\//i.test(String(s||'').trim()); }
function normalizeLinks(raw){
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    if (typeof item === 'string') return { url:item.trim(), source:'Links', originalIndex:idx };
    return { url:String(item.url || item.link || '').trim(), source:String(item.source || item.tab || item.sheet || 'Links').trim() || 'Links', originalIndex:Number.isInteger(item.originalIndex)?item.originalIndex:idx };
  }).filter(x=>x.url);
}
function normalizeData(data){
  const texts = Array.isArray(data?.texts) ? data.texts.map(String).map(s=>s.trim()).filter(Boolean) : [];
  let links = [];
  if (Array.isArray(data?.links)) links = normalizeLinks(data.links);
  if ((!links.length) && data && typeof data === 'object') {
    for (const [source, arr] of Object.entries(data.linkTabs || data.sources || {})) {
      if (Array.isArray(arr)) links.push(...arr.map((url, idx)=>({url:String(url).trim(), source, originalIndex:idx})).filter(x=>x.url));
    }
  }
  return { links, texts };
}
function loadSeed(){ try { return normalizeData(JSON.parse(fs.readFileSync(SEED_PATH,'utf8'))); } catch { return {links:[],texts:[]}; } }
function cleanState(state={}){ return { doneLinks:Array.isArray(state.doneLinks)?state.doneLinks:[], usedTexts:Array.isArray(state.usedTexts)?state.usedTexts:[], history:Array.isArray(state.history)?state.history:[], sourcePtr:Number.isInteger(state.sourcePtr)?state.sourcePtr:0 }; }
function activeOnlyState(state={}){ return { doneLinks:[], usedTexts:[], history:Array.isArray(state.history)?state.history:[], sourcePtr:0 }; }
function cleanMeta(meta={}){ return { dataVersion:Number.isInteger(meta.dataVersion)?meta.dataVersion:1, versionName:String(meta.versionName||'Initial Data'), uploadArchive:Array.isArray(meta.uploadArchive)?meta.uploadArchive:[], operators: normalizeStoredOperators(meta.operators||[]), weeklyGoals: meta.weeklyGoals || {} }; }
function defaultDb(){ return { data:loadSeed(), state:cleanState(), meta:cleanMeta({ dataVersion:1, versionName:'Initial Data', uploadArchive:[{version:1, name:'Initial Data', uploadedAt:new Date().toISOString(), linkCount:loadSeed().links.length, textCount:loadSeed().texts.length, sheets:[...new Set(loadSeed().links.map(l=>l.source||'Links'))]}] }), updatedAt:new Date().toISOString() }; }
function ensureDb(){ fs.mkdirSync(DATA_DIR,{recursive:true}); if(!fs.existsSync(SEED_PATH)){ const bundled=path.join(__dirname,'data','seed.json'); if(bundled!==SEED_PATH && fs.existsSync(bundled)) fs.copyFileSync(bundled, SEED_PATH); } if(!fs.existsSync(DB_PATH)) saveDb(defaultDb()); }
function migrateDb(db){ db.data = normalizeData(db.data || loadSeed()); db.state = cleanState(db.state || {}); db.meta = cleanMeta(db.meta || {}); return db; }
function loadDb(){ ensureDb(); const db=migrateDb(JSON.parse(fs.readFileSync(DB_PATH,'utf8'))); if(ensureHistoryIds(db)) saveDb(db); return db; }
function saveDb(db){ fs.mkdirSync(DATA_DIR,{recursive:true}); db.updatedAt=new Date().toISOString(); fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2)); }
function send(res,status,body,type='application/json'){ res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store'}); res.end(type==='application/json'?JSON.stringify(body):body); }
function bodyJson(req){ return new Promise((resolve,reject)=>{ let data=''; req.on('data', c=>{data+=c; if(data.length>10_000_000){req.destroy(); reject(new Error('Payload too large'));}}); req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch(e){reject(e);}}); }); }
function authOk(req){ return req.headers['x-admin-password'] === ADMIN_PASSWORD; }
function linkAt(db, idx){ const x=db.data.links[idx]; return typeof x==='string'?{url:x,source:'Links'}:(x||{url:'',source:'Links'}); }
function historyId(h){
  if (h && h.id) return String(h.id);
  const raw = [h?.at||'', h?.userId||'', h?.linkIdx??'', h?.textIdx??'', h?.link||'', h?.text||''].join('|');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0,16);
}
function ensureHistoryIds(db){
  let changed=false;
  for (const h of (db.state.history||[])) {
    if (!h.id) { h.id = historyId(h); changed=true; }
    if (typeof h.adminNote !== 'string') { h.adminNote = h.adminNote ? String(h.adminNote) : ''; changed=true; }
  }
  return changed;
}
function historyItem(db,h){ const l=linkAt(db,h.linkIdx); const uid=h.userId||'standard'; const u=userInfo(uid,db); return { id:historyId(h), at:h.at, day:dateOnly(h.at), linkIdx:h.linkIdx, textIdx:h.textIdx, userId:uid, userName:h.userName||u.name, source:h.source||l.source||'Links', link:h.link||l.url||'', text:h.text||db.data.texts?.[h.textIdx]||'', submittedLink:h.submittedLink||'', adminNote:h.adminNote||'', status:h.status||'done', dataVersion:h.dataVersion || db.meta?.dataVersion || 1, versionName:h.versionName || db.meta?.versionName || 'Initial Data', deletedAt:h.deletedAt||'' }; }
function publicState(db, userId=''){
  const totalLinks=db.data.links.length,totalTexts=db.data.texts.length;
  const doneSet=new Set(db.state.doneLinks), usedSet=new Set(db.state.usedTexts);
  const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status!=='deleted');
  const s={day:dayKey(), totalLinks,totalTexts, doneToday:hist.filter(h=>h.day===dayKey()&&h.status==='done').length, lifetimeDone:hist.filter(h=>h.status==='done').length, currentVersion:db.meta?.dataVersion||1, versionName:db.meta?.versionName||'Initial Data', linksRemaining:Math.max(totalLinks-doneSet.size,0), textsRemaining:Math.max(totalTexts-usedSet.size,0), updatedAt:db.updatedAt};
  if(userId){ const uid=cleanUserId(userId,db); const uh=hist.filter(h=>h.userId===uid && h.status==='done'); s.user=userInfo(uid,db); s.userDoneToday=uh.filter(h=>h.day===dayKey()).length; s.userTotalDone=uh.length; s.userLinksDone=new Set(uh.map(h=>h.linkIdx)).size; s.userTextsDone=new Set(uh.map(h=>h.textIdx)).size; }
  return s;
}
function report(db, count=365, userId='', from='', to=''){
  const days=selectedDays(count,from,to);
  let hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status!=='deleted' && days.includes(h.day));
  if(userId) hist=hist.filter(h=>h.userId===cleanUserId(userId,db));
  const daily=days.map(day=>({day, doneCount:hist.filter(h=>h.day===day&&h.status==='done').length}));
  return { range:{from:days[0]||'', to:days[days.length-1]||'', days:days.length}, daily, totalDone:hist.filter(h=>h.status==='done').length, history:hist.reverse() };
}
function sourceStats(db){
  const sources=[...new Set(db.data.links.map((l,i)=>linkAt(db,i).source||'Links'))];
  const done=new Set(db.state.doneLinks);
  return sources.map(source=>{ const idxs=db.data.links.map((_,i)=>i).filter(i=>linkAt(db,i).source===source); const completed=idxs.filter(i=>done.has(i)).length; return {source,total:idxs.length,completed,remaining:idxs.length-completed,percent:idxs.length?Math.round(completed/idxs.length*100):0}; });
}
function historicalSourceStats(db,count=365,from='',to=''){ const days=selectedDays(count,from,to); const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status!=='deleted' && days.includes(h.day)&&h.status==='done'); const map={}; for(const h of hist){ const k=h.source||'Links'; map[k] ||= {source:k, completed:0, submittedLinks:0}; map[k].completed++; if(h.submittedLink) map[k].submittedLinks++; } return Object.values(map).sort((a,b)=>b.completed-a.completed); }
function userBreakdown(db,count=365,from='',to=''){ const days=selectedDays(count,from,to); const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status!=='deleted' && days.includes(h.day)&&h.status==='done'); return operatorList(db).map(u=>{ const items=hist.filter(h=>h.userId===u.id); return { id:u.id, name:u.name, color:u.color, totalDone:items.length, doneToday:items.filter(h=>h.day===dayKey()).length, linksDone:new Set(items.map(h=>h.linkIdx)).size, textsDone:new Set(items.map(h=>h.textIdx)).size };  }); }
function weeklyProgress(db){ const days=currentWeekDays(); const goals=normalizeWeeklyGoals(db.meta?.weeklyGoals||{},db); const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status!=='deleted' && days.includes(h.day)&&h.status==='done'); return operatorList(db).map(u=>{ const done=hist.filter(h=>h.userId===u.id).length; const goal=goals[u.id]||0; return { id:u.id, name:u.name, color:u.color, done, goal, percent: goal ? Math.min(100, Math.round(done/goal*100)) : 0 }; }); }
function nextItem(db){
  const doneSet=new Set(db.state.doneLinks), usedSet=new Set(db.state.usedTexts);
  const linkCandidates=db.data.links.map((_,i)=>i).filter(i=>!doneSet.has(i));
  const textCandidates=db.data.texts.map((_,i)=>i).filter(i=>!usedSet.has(i));
  if(!db.data.links.length || !db.data.texts.length) return null;
  if(!linkCandidates.length || !textCandidates.length) return {completed:true};
  const availableSources=[...new Set(linkCandidates.map(i=>linkAt(db,i).source||'Links'))].sort();
  const doneBySource=Object.fromEntries(availableSources.map(s=>[s,0]));
  for(const i of db.state.doneLinks){ const s=linkAt(db,i).source||'Links'; if(s in doneBySource) doneBySource[s]++; }
  const minDone=Math.min(...availableSources.map(s=>doneBySource[s]));
  const fairSources=availableSources.filter(s=>doneBySource[s]===minDone);
  const selectedSource=fairSources[(db.state.sourcePtr||0)%fairSources.length];
  db.state.sourcePtr=(db.state.sourcePtr||0)+1;
  const sourceCandidates=linkCandidates.filter(i=>(linkAt(db,i).source||'Links')===selectedSource);
  const linkIdx=sourceCandidates[Math.floor(Math.random()*sourceCandidates.length)];
  const textIdx=textCandidates[Math.floor(Math.random()*textCandidates.length)];
  const link=linkAt(db,linkIdx);
  return {linkIdx,textIdx,source:link.source,link:link.url,text:db.data.texts[textIdx]};
}
function serveStatic(req,res){ let p=req.url.split('?')[0]; if(p==='/')p='/index.html'; if(p==='/admin')p='/admin.html'; if(p.startsWith('/worker/'))p='/worker.html'; if(p==='/analytics'||p.startsWith('/analytics/')||p==='/premium'||p.startsWith('/premium/'))p='/premium.html'; const file=path.normalize(path.join(PUBLIC_DIR,p)); if(!file.startsWith(PUBLIC_DIR))return send(res,403,'Forbidden','text/plain'); if(!fs.existsSync(file))return send(res,404,'Not found','text/plain'); const ext=path.extname(file).toLowerCase(); const type=ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css':ext==='.js'?'application/javascript':'text/plain'; res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}); fs.createReadStream(file).pipe(res); }

const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/api/status') return send(res,200,publicState(loadDb(), url.searchParams.get('user')||''));
  if(url.pathname==='/api/report') { const db=loadDb(); const user=url.searchParams.get('user')||''; if(user && !operatorAuthOk(req,user,db)) return send(res,401,{error:'Wrong operator password.'}); const from=url.searchParams.get('from')||'', to=url.searchParams.get('to')||''; const rep=report(db, Number(url.searchParams.get('days')||365), user, from, to); const st=publicState(db,user); st.rangeDone=rep.totalDone; const wp=weeklyProgress(db); const userWeekly=user?wp.find(x=>x.id===cleanUserId(user,db)):null; return send(res,200,{status:{...st, weeklyGoal:userWeekly?.goal||0, weeklyDone:userWeekly?.done||0, weeklyPercent:userWeekly?.percent||0}, report:rep, weekly:userWeekly}); }
  if(url.pathname==='/api/operator/login'&&req.method==='POST'){ const p=await bodyJson(req); const db=loadDb(); const uid=cleanUserId(p.userId,db); const ok=String(p.password||'')===String(operatorPassword(uid,db)); return send(res,ok?200:401,{ok,user:userInfo(uid,db)}); }
  if(url.pathname==='/api/next') { const user=url.searchParams.get('user')||''; const db=loadDb(); const item=nextItem(db); if(!item)return send(res,400,{error:'No links/texts loaded yet.'}); if(item.completed)return send(res,200,{completed:true,status:publicState(db,user)}); saveDb(db); return send(res,200,{...item,status:publicState(db,user)}); }
  if(url.pathname==='/api/done'&&req.method==='POST'){ const p=await bodyJson(req); const db=loadDb(); const linkIdx=Number(p.linkIdx), textIdx=Number(p.textIdx); if(!Number.isInteger(linkIdx)||!Number.isInteger(textIdx))return send(res,400,{error:'Missing link/text selection.'}); const uid=p.userId?cleanUserId(p.userId,db):'standard'; const u=userInfo(uid,db); const l=linkAt(db,linkIdx); if(!db.state.doneLinks.includes(linkIdx))db.state.doneLinks.push(linkIdx); if(!db.state.usedTexts.includes(textIdx))db.state.usedTexts.push(textIdx); const rec={id:crypto.randomUUID(),at:new Date().toISOString(),status:'done',userId:uid,userName:u.name,linkIdx,textIdx,source:l.source,link:l.url,text:db.data.texts[textIdx]||'',submittedLink:String(p.submittedLink||'').trim(),adminNote:'',dataVersion:db.meta?.dataVersion||1,versionName:db.meta?.versionName||'Initial Data'}; db.state.history.push(rec); saveDb(db); return send(res,200,{ok:true,status:publicState(db,uid)}); }

  if(url.pathname==='/api/history/update'&&req.method==='POST'){
    const p=await bodyJson(req);
    const db=loadDb();
    const userId = p.userId ? cleanUserId(p.userId,db) : '';
    const isAdmin = authOk(req);
    const isOperator = userId && operatorAuthOk(req, userId, db);
    if(!isAdmin && !isOperator) return send(res,401,{error:'Not authorized to update history.'});
    const updates = Array.isArray(p.updates) ? p.updates : [];
    if(!updates.length) return send(res,400,{error:'No updates provided.'});
    let updated=0;
    for(const u of updates){
      const id=String(u.id||'').trim();
      if(!id) continue;
      const row=(db.state.history||[]).find(h=>historyId(h)===id || String(h.id||'')===id);
      if(!row) continue;
      if(isOperator && cleanUserId(row.userId,db)!==userId) continue;
      if(typeof u.submittedLink !== 'undefined') row.submittedLink = String(u.submittedLink||'').trim().slice(0,4000);
      if(isAdmin && typeof u.adminNote !== 'undefined') row.adminNote = String(u.adminNote||'').slice(0,2000);
      row.id = id;
      updated++;
    }
    saveDb(db);
    return send(res,200,{ok:true,updated});
  }


  if(url.pathname==='/api/admin/history/delete'&&req.method==='POST'){
    if(!authOk(req)) return send(res,401,{error:'Wrong admin password.'});
    const p=await bodyJson(req);
    const ids=new Set((Array.isArray(p.ids)?p.ids:[]).map(x=>String(x||'').trim()).filter(Boolean));
    if(!ids.size) return send(res,400,{error:'No history rows selected.'});
    const db=loadDb();
    let deleted=0;
    for(const h of (db.state.history||[])){
      const id=historyId(h);
      if(ids.has(id)){
        h.id=id;
        h.status='deleted';
        h.deletedAt=new Date().toISOString();
        deleted++;
      }
    }
    saveDb(db);
    return send(res,200,{ok:true,deleted});
  }

  if(url.pathname==='/api/admin/history/trash'){
    if(!authOk(req)) return send(res,401,{error:'Wrong admin password.'});
    const db=loadDb();
    const trash=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>h.status==='deleted').reverse();
    return send(res,200,{ok:true,trash});
  }

  if(url.pathname==='/api/admin/history/restore'&&req.method==='POST'){
    if(!authOk(req)) return send(res,401,{error:'Wrong admin password.'});
    const p=await bodyJson(req);
    const ids=new Set((Array.isArray(p.ids)?p.ids:[]).map(x=>String(x||'').trim()).filter(Boolean));
    if(!ids.size) return send(res,400,{error:'No history rows selected.'});
    const db=loadDb();
    let restored=0;
    for(const h of (db.state.history||[])){
      const id=historyId(h);
      if(ids.has(id) && h.status==='deleted'){
        h.id=id;
        h.status='done';
        delete h.deletedAt;
        restored++;
      }
    }
    saveDb(db);
    return send(res,200,{ok:true,restored});
  }

  if(url.pathname==='/api/admin/login'&&req.method==='POST'){ const p=await bodyJson(req); return send(res,p.password===ADMIN_PASSWORD?200:401,{ok:p.password===ADMIN_PASSWORD}); }
  if(url.pathname.startsWith('/api/admin/')){ if(!authOk(req))return send(res,401,{error:'Wrong admin password.'}); const db=loadDb();
    if(url.pathname==='/api/admin/data'){ const c=url.searchParams.get('days')||365; const from=url.searchParams.get('from')||'', to=url.searchParams.get('to')||''; const user=url.searchParams.get('user')||''; const rep=report(db,c,user,from,to); const st=publicState(db); st.rangeDone=rep.totalDone; return send(res,200,{...st, meta:db.meta, uploadArchive:db.meta?.uploadArchive||[], report:rep, users:userBreakdown(db,c,from,to), sources:sourceStats(db), historicalSources:historicalSourceStats(db,c,from,to), weeklyGoals:normalizeWeeklyGoals(db.meta?.weeklyGoals||{},db), weeklyProgress:weeklyProgress(db), operators:operatorList(db), links:db.data.links, texts:db.data.texts}); }
    if(url.pathname==='/api/admin/operators'&&req.method==='POST'){
      const p=await bodyJson(req);
      db.meta=cleanMeta(db.meta||{});
      const ops=operatorList(db);
      const nums=ops.map(o=>Number(String(o.id).replace('operator',''))).filter(Number.isFinite);
      const next=(nums.length?Math.max(...nums):0)+1;
      const id=`operator${next}`;
      const name=String(p.name||displayNameFromId(id)).trim()||displayNameFromId(id);
      const password=String(p.password||id).trim()||id;
      const color=OPERATOR_COLORS[(next-1)%OPERATOR_COLORS.length];
      db.meta.operators=normalizeStoredOperators([...(db.meta.operators||[]),{id,name,password,color,enabled:true}]);
      db.meta.weeklyGoals=normalizeWeeklyGoals(db.meta.weeklyGoals||{},db);
      saveDb(db);
      return send(res,200,{ok:true,operator:userInfo(id,db),operators:operatorList(db),weeklyGoals:normalizeWeeklyGoals(db.meta.weeklyGoals||{},db),weeklyProgress:weeklyProgress(db)});
    }
    if(url.pathname==='/api/admin/operators/update'&&req.method==='POST'){
      const p=await bodyJson(req);
      const id=cleanUserId(p.id,db);
      if(!/^operator\d+$/.test(id)) return send(res,400,{error:'Invalid operator id.'});
      db.meta=cleanMeta(db.meta||{});
      const current=getOperators(db)[id] || {id,name:displayNameFromId(id),color:OPERATOR_COLORS[0],enabled:true};
      const stored=normalizeStoredOperators(db.meta.operators||[]).filter(o=>o.id!==id);
      const name=String(p.name||current.name||displayNameFromId(id)).trim()||displayNameFromId(id);
      const password=typeof p.password==='string' && p.password.trim() ? p.password.trim() : (current.password||'');
      stored.push({id,name,password,color:current.color||OPERATOR_COLORS[stored.length%OPERATOR_COLORS.length],enabled:true});
      db.meta.operators=normalizeStoredOperators(stored);
      for(const h of (db.state.history||[])) if(cleanUserId(h.userId,db)===id) h.userName=name;
      saveDb(db);
      return send(res,200,{ok:true,operator:userInfo(id,db),operators:operatorList(db),weeklyGoals:normalizeWeeklyGoals(db.meta.weeklyGoals||{},db),weeklyProgress:weeklyProgress(db)});
    }
    if(url.pathname==='/api/admin/weekly-goals'&&req.method==='POST'){
      const p=await bodyJson(req);
      db.meta=cleanMeta(db.meta||{});
      db.meta.weeklyGoals=normalizeWeeklyGoals(p.goals||{},db);
      saveDb(db);
      return send(res,200,{ok:true,weeklyGoals:db.meta.weeklyGoals,weeklyProgress:weeklyProgress(db)});
    }
    if(url.pathname==='/api/admin/upload'&&req.method==='POST'){ const p=await bodyJson(req); const texts=(p.texts||[]).map(String).map(s=>s.trim()).filter(Boolean); let links=[]; let sheets=[]; if(p.linkTabs&&typeof p.linkTabs==='object'){ for(const [source,arr] of Object.entries(p.linkTabs)){ if(source.toLowerCase()==='texts')continue; const clean=(arr||[]).map(x=>String(x||'').trim()).filter(Boolean); if(clean.length) sheets.push(source); clean.forEach((u,idx)=>links.push({url:u,source,originalIndex:idx})); } } else { links=normalizeLinks(p.links||[]); sheets=[...new Set(links.map(l=>l.source||'Links'))]; } if(!links.length||!texts.length)return send(res,400,{error:'Upload needs at least one link and one text.'}); const oldHistory=Array.isArray(db.state.history)?db.state.history:[]; db.meta=cleanMeta(db.meta||{}); const nextVersion=(db.meta.dataVersion||0)+1; const versionName=String(p.versionName||p.fileName||`Version ${nextVersion}`).trim()||`Version ${nextVersion}`; db.data={links,texts}; db.state=activeOnlyState({history:oldHistory}); db.meta.dataVersion=nextVersion; db.meta.versionName=versionName; db.meta.uploadArchive ||= []; db.meta.uploadArchive.push({version:nextVersion,name:versionName,uploadedAt:new Date().toISOString(),linkCount:links.length,textCount:texts.length,sheets}); saveDb(db); fs.writeFileSync(SEED_PATH,JSON.stringify(db.data,null,2)); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta.uploadArchive,report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/history-note'&&req.method==='POST'){ const p=await bodyJson(req); const id=String(p.id||'').trim(); const note=String(p.note||'').slice(0,2000); if(!id)return send(res,400,{error:'Missing history row id.'}); let found=false; for(const h of (db.state.history||[])){ if(historyId(h)===id){ h.id=id; h.adminNote=note; found=true; break; } } if(!found)return send(res,404,{error:'History row not found.'}); saveDb(db); return send(res,200,{ok:true,id,note}); }
    if(url.pathname==='/api/admin/undo'&&req.method==='POST'){ const last=db.state.history.pop(); if(last){ db.state.doneLinks=db.state.doneLinks.filter(i=>i!==last.linkIdx); db.state.usedTexts=db.state.usedTexts.filter(i=>i!==last.textIdx); } saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/reset-active'&&req.method==='POST'){ db.state.doneLinks=[]; db.state.usedTexts=[]; db.state.sourcePtr=0; saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/reset-all'&&req.method==='POST'){ db.state=cleanState(); db.meta=cleanMeta({dataVersion:1,versionName:'Initial Data',uploadArchive:[]}); saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
  }
  serveStatic(req,res);
} catch(e){ send(res,500,{error:e.message||'Server error'}); }});
server.listen(PORT,()=>console.log(`Global Review Rotator v3 running on :${PORT}`));
