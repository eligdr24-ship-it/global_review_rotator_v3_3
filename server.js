const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const OPERATORS = {
  operator1: { id:'operator1', name:'Operator 1', color:'#7c3aed', env:'OPERATOR1_PASSWORD' },
  operator2: { id:'operator2', name:'Operator 2', color:'#007aff', env:'OPERATOR2_PASSWORD' },
  operator3: { id:'operator3', name:'Operator 3', color:'#16a34a', env:'OPERATOR3_PASSWORD' },
  operator4: { id:'operator4', name:'Operator 4', color:'#f97316', env:'OPERATOR4_PASSWORD' }
};
function operatorPassword(id){ const uid=cleanUserId(id); return process.env[OPERATORS[uid]?.env] || uid; }
function operatorAuthOk(req, id){ const uid=cleanUserId(id); return String(req.headers['x-operator-password'] || '') === String(operatorPassword(uid)); }
function cleanUserId(value){ const id = String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,''); return OPERATORS[id] ? id : (id === 'standard' ? 'standard' : 'operator1'); }
function userInfo(id){ const uid=cleanUserId(id); const u=OPERATORS[uid]; return u ? {id:u.id,name:u.name,color:u.color} : { id:'standard', name:'Simple User', color:'#64748b' }; }
function dayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function dateOnly(ts){ return String(ts||'').slice(0,10); }
function recentDays(count=365){ const out=[]; const d=new Date(); for(let i=0;i<count;i++){ const x=new Date(d); x.setUTCDate(d.getUTCDate()-i); out.push(dayKey(x)); } return out; }
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
function cleanMeta(meta={}){ return { dataVersion:Number.isInteger(meta.dataVersion)?meta.dataVersion:1, versionName:String(meta.versionName||'Initial Data'), uploadArchive:Array.isArray(meta.uploadArchive)?meta.uploadArchive:[] }; }
function defaultDb(){ return { data:loadSeed(), state:cleanState(), meta:cleanMeta({ dataVersion:1, versionName:'Initial Data', uploadArchive:[{version:1, name:'Initial Data', uploadedAt:new Date().toISOString(), linkCount:loadSeed().links.length, textCount:loadSeed().texts.length, sheets:[...new Set(loadSeed().links.map(l=>l.source||'Links'))]}] }), updatedAt:new Date().toISOString() }; }
function ensureDb(){ fs.mkdirSync(DATA_DIR,{recursive:true}); if(!fs.existsSync(SEED_PATH)){ const bundled=path.join(__dirname,'data','seed.json'); if(bundled!==SEED_PATH && fs.existsSync(bundled)) fs.copyFileSync(bundled, SEED_PATH); } if(!fs.existsSync(DB_PATH)) saveDb(defaultDb()); }
function migrateDb(db){ db.data = normalizeData(db.data || loadSeed()); db.state = cleanState(db.state || {}); db.meta = cleanMeta(db.meta || {}); return db; }
function loadDb(){ ensureDb(); return migrateDb(JSON.parse(fs.readFileSync(DB_PATH,'utf8'))); }
function saveDb(db){ fs.mkdirSync(DATA_DIR,{recursive:true}); db.updatedAt=new Date().toISOString(); fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2)); }
function send(res,status,body,type='application/json'){ res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store'}); res.end(type==='application/json'?JSON.stringify(body):body); }
function bodyJson(req){ return new Promise((resolve,reject)=>{ let data=''; req.on('data', c=>{data+=c; if(data.length>10_000_000){req.destroy(); reject(new Error('Payload too large'));}}); req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch(e){reject(e);}}); }); }
function authOk(req){ return req.headers['x-admin-password'] === ADMIN_PASSWORD; }
function linkAt(db, idx){ const x=db.data.links[idx]; return typeof x==='string'?{url:x,source:'Links'}:(x||{url:'',source:'Links'}); }
function historyItem(db,h){ const l=linkAt(db,h.linkIdx); const uid=h.userId||'standard'; const u=userInfo(uid); return { at:h.at, day:dateOnly(h.at), linkIdx:h.linkIdx, textIdx:h.textIdx, userId:uid, userName:h.userName||u.name, source:h.source||l.source||'Links', link:h.link||l.url||'', text:h.text||db.data.texts?.[h.textIdx]||'', submittedLink:h.submittedLink||'', status:h.status||'done', dataVersion:h.dataVersion || db.meta?.dataVersion || 1, versionName:h.versionName || db.meta?.versionName || 'Initial Data' }; }
function publicState(db, userId=''){
  const totalLinks=db.data.links.length,totalTexts=db.data.texts.length;
  const doneSet=new Set(db.state.doneLinks), usedSet=new Set(db.state.usedTexts);
  const hist=(db.state.history||[]).map(h=>historyItem(db,h));
  const s={day:dayKey(), totalLinks,totalTexts, doneToday:hist.filter(h=>h.day===dayKey()&&h.status==='done').length, lifetimeDone:hist.filter(h=>h.status==='done').length, currentVersion:db.meta?.dataVersion||1, versionName:db.meta?.versionName||'Initial Data', linksRemaining:Math.max(totalLinks-doneSet.size,0), textsRemaining:Math.max(totalTexts-usedSet.size,0), updatedAt:db.updatedAt};
  if(userId){ const uid=cleanUserId(userId); const uh=hist.filter(h=>h.userId===uid && h.status==='done'); s.user=userInfo(uid); s.userDoneToday=uh.filter(h=>h.day===dayKey()).length; s.userTotalDone=uh.length; s.userLinksDone=new Set(uh.map(h=>h.linkIdx)).size; s.userTextsDone=new Set(uh.map(h=>h.textIdx)).size; }
  return s;
}
function report(db, count=365, userId=''){
  const days=recentDays(Math.min(Math.max(Number(count)||365,1),365));
  let hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>days.includes(h.day));
  if(userId) hist=hist.filter(h=>h.userId===cleanUserId(userId));
  const daily=days.map(day=>({day, doneCount:hist.filter(h=>h.day===day&&h.status==='done').length}));
  return { daily, history:hist.reverse() };
}
function sourceStats(db){
  const sources=[...new Set(db.data.links.map((l,i)=>linkAt(db,i).source||'Links'))];
  const done=new Set(db.state.doneLinks);
  return sources.map(source=>{ const idxs=db.data.links.map((_,i)=>i).filter(i=>linkAt(db,i).source===source); const completed=idxs.filter(i=>done.has(i)).length; return {source,total:idxs.length,completed,remaining:idxs.length-completed,percent:idxs.length?Math.round(completed/idxs.length*100):0}; });
}
function historicalSourceStats(db,count=365){ const days=recentDays(Math.min(Math.max(Number(count)||365,1),365)); const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>days.includes(h.day)&&h.status==='done'); const map={}; for(const h of hist){ const k=h.source||'Links'; map[k] ||= {source:k, completed:0, submittedLinks:0}; map[k].completed++; if(h.submittedLink) map[k].submittedLinks++; } return Object.values(map).sort((a,b)=>b.completed-a.completed); }
function userBreakdown(db,count=365){ const days=recentDays(Math.min(Math.max(Number(count)||365,1),365)); const hist=(db.state.history||[]).map(h=>historyItem(db,h)).filter(h=>days.includes(h.day)&&h.status==='done'); return Object.values(OPERATORS).map(u=>{ const items=hist.filter(h=>h.userId===u.id); return { id:u.id, name:u.name, color:u.color, totalDone:items.length, doneToday:items.filter(h=>h.day===dayKey()).length, linksDone:new Set(items.map(h=>h.linkIdx)).size, textsDone:new Set(items.map(h=>h.textIdx)).size };  }); }
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
  if(url.pathname==='/api/report') { const db=loadDb(); const user=url.searchParams.get('user')||''; if(user && !operatorAuthOk(req,user)) return send(res,401,{error:'Wrong operator password.'}); return send(res,200,{status:publicState(db,user), report:report(db, Number(url.searchParams.get('days')||365), user)}); }
  if(url.pathname==='/api/operator/login'&&req.method==='POST'){ const p=await bodyJson(req); const uid=cleanUserId(p.userId); const ok=String(p.password||'')===String(operatorPassword(uid)); return send(res,ok?200:401,{ok,user:userInfo(uid)}); }
  if(url.pathname==='/api/next') { const user=url.searchParams.get('user')||''; const db=loadDb(); const item=nextItem(db); if(!item)return send(res,400,{error:'No links/texts loaded yet.'}); if(item.completed)return send(res,200,{completed:true,status:publicState(db,user)}); saveDb(db); return send(res,200,{...item,status:publicState(db,user)}); }
  if(url.pathname==='/api/done'&&req.method==='POST'){ const p=await bodyJson(req); const db=loadDb(); const linkIdx=Number(p.linkIdx), textIdx=Number(p.textIdx); if(!Number.isInteger(linkIdx)||!Number.isInteger(textIdx))return send(res,400,{error:'Missing link/text selection.'}); const uid=p.userId?cleanUserId(p.userId):'standard'; const u=userInfo(uid); const l=linkAt(db,linkIdx); if(!db.state.doneLinks.includes(linkIdx))db.state.doneLinks.push(linkIdx); if(!db.state.usedTexts.includes(textIdx))db.state.usedTexts.push(textIdx); db.state.history.push({at:new Date().toISOString(),status:'done',userId:uid,userName:u.name,linkIdx,textIdx,source:l.source,link:l.url,text:db.data.texts[textIdx]||'',submittedLink:String(p.submittedLink||'').trim(),dataVersion:db.meta?.dataVersion||1,versionName:db.meta?.versionName||'Initial Data'}); saveDb(db); return send(res,200,{ok:true,status:publicState(db,uid)}); }
  if(url.pathname==='/api/admin/login'&&req.method==='POST'){ const p=await bodyJson(req); return send(res,p.password===ADMIN_PASSWORD?200:401,{ok:p.password===ADMIN_PASSWORD}); }
  if(url.pathname.startsWith('/api/admin/')){ if(!authOk(req))return send(res,401,{error:'Wrong admin password.'}); const db=loadDb();
    if(url.pathname==='/api/admin/data'){ const c=url.searchParams.get('days')||365; return send(res,200,{...publicState(db), meta:db.meta, uploadArchive:db.meta?.uploadArchive||[], report:report(db,c,url.searchParams.get('user')||''), users:userBreakdown(db,c), sources:sourceStats(db), historicalSources:historicalSourceStats(db,c), operators:Object.values(OPERATORS).map(u=>({id:u.id,name:u.name,color:u.color})), links:db.data.links, texts:db.data.texts}); }
    if(url.pathname==='/api/admin/upload'&&req.method==='POST'){ const p=await bodyJson(req); const texts=(p.texts||[]).map(String).map(s=>s.trim()).filter(Boolean); let links=[]; let sheets=[]; if(p.linkTabs&&typeof p.linkTabs==='object'){ for(const [source,arr] of Object.entries(p.linkTabs)){ if(source.toLowerCase()==='texts')continue; const clean=(arr||[]).map(x=>String(x||'').trim()).filter(Boolean); if(clean.length) sheets.push(source); clean.forEach((u,idx)=>links.push({url:u,source,originalIndex:idx})); } } else { links=normalizeLinks(p.links||[]); sheets=[...new Set(links.map(l=>l.source||'Links'))]; } if(!links.length||!texts.length)return send(res,400,{error:'Upload needs at least one link and one text.'}); const oldHistory=Array.isArray(db.state.history)?db.state.history:[]; db.meta=cleanMeta(db.meta||{}); const nextVersion=(db.meta.dataVersion||0)+1; const versionName=String(p.versionName||p.fileName||`Version ${nextVersion}`).trim()||`Version ${nextVersion}`; db.data={links,texts}; db.state=activeOnlyState({history:oldHistory}); db.meta.dataVersion=nextVersion; db.meta.versionName=versionName; db.meta.uploadArchive ||= []; db.meta.uploadArchive.push({version:nextVersion,name:versionName,uploadedAt:new Date().toISOString(),linkCount:links.length,textCount:texts.length,sheets}); saveDb(db); fs.writeFileSync(SEED_PATH,JSON.stringify(db.data,null,2)); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta.uploadArchive,report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/undo'&&req.method==='POST'){ const last=db.state.history.pop(); if(last){ db.state.doneLinks=db.state.doneLinks.filter(i=>i!==last.linkIdx); db.state.usedTexts=db.state.usedTexts.filter(i=>i!==last.textIdx); } saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/reset-active'&&req.method==='POST'){ db.state.doneLinks=[]; db.state.usedTexts=[]; db.state.sourcePtr=0; saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
    if(url.pathname==='/api/admin/reset-all'&&req.method==='POST'){ db.state=cleanState(); db.meta=cleanMeta({dataVersion:1,versionName:'Initial Data',uploadArchive:[]}); saveDb(db); return send(res,200,{ok:true,status:{...publicState(db),meta:db.meta,uploadArchive:db.meta?.uploadArchive||[],report:report(db,365),users:userBreakdown(db),sources:sourceStats(db),historicalSources:historicalSourceStats(db)}}); }
  }
  serveStatic(req,res);
} catch(e){ send(res,500,{error:e.message||'Server error'}); }});
server.listen(PORT,()=>console.log(`Global Review Rotator v3 running on :${PORT}`));
