(()=>{
'use strict';
if(window.MAGI_STATS_MASTER_PRELOAD_V303)return;
window.MAGI_STATS_MASTER_PRELOAD_V303=true;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function isLookup(q){
  q=String(q||'');
  const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
  const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
  const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
  return stat&&request&&!decision;
}

function explicitSeason(q){
  if(/2025\s*[-–—_. /]?\s*2026|旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';
  if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(q))return'2026-2027';
  return'';
}

function driveFiles(){
  try{return typeof driveIndex!=='undefined'&&Array.isArray(driveIndex)?driveIndex:[]}catch(_){return[]}
}
function driveRows(){
  try{return typeof dataRecords!=='undefined'&&Array.isArray(dataRecords)?dataRecords:[]}catch(_){return[]}
}
function alreadyLoaded(id){return driveRows().some(r=>r&&r.source==='drive'&&r.fileId===id)}

function isMasterBook(f){
  if(!f||!f.id)return false;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/\.(xlsm|xlsx|xls)$/i.test(name))return false;
  return /通算成績一覧/i.test(name)||/00_MASTER_正本/i.test(path);
}

function bookSeason(f){
  const s=String(`${f?.name||''} ${f?.path||''}`);
  if(/2025\s*[-–—_. /]?\s*2026/.test(s))return'2025-2026';
  if(/2026\s*[-–—_. /]?\s*2027/.test(s))return'2026-2027';
  return'';
}

async function ensureCatalogue(){
  if(driveFiles().length)return driveFiles();
  if(typeof window.MAGI_SERVER_DRIVE_RELOAD==='function'){
    try{await window.MAGI_SERVER_DRIVE_RELOAD()}catch(e){console.warn('[MAGI stats master] catalogue',e)}
  }
  return driveFiles();
}

async function preloadMasters(query){
  let files=await ensureCatalogue();
  const wanted=explicitSeason(query);
  let books=files.filter(isMasterBook);
  if(wanted)books=books.filter(f=>bookSeason(f)===wanted);
  else books=books.filter(f=>['2025-2026','2026-2027'].includes(bookSeason(f)));

  books.sort((a,b)=>{
    const ay=bookSeason(a),by=bookSeason(b);
    const ap=/通算成績一覧/i.test(String(a.name||''))?10:0;
    const bp=/通算成績一覧/i.test(String(b.name||''))?10:0;
    const ax=/\.xlsm$/i.test(String(a.name||''))?5:0;
    const bx=/\.xlsm$/i.test(String(b.name||''))?5:0;
    return (bp+bx)-(ap+ax)||ay.localeCompare(by);
  });

  const chosen=[];
  const seenSeason=new Set();
  for(const f of books){
    const y=bookSeason(f)||norm(f.name);
    if(seenSeason.has(y))continue;
    seenSeason.add(y);chosen.push(f);
  }

  let loaded=0;
  for(const f of chosen){
    if(alreadyLoaded(f.id)){loaded++;continue}
    if(typeof window.importDriveFile!=='function')continue;
    try{await window.importDriveFile(f.id,true);loaded++}catch(e){console.warn('[MAGI stats master] import',f.name,e)}
  }

  if(!loaded&&typeof window.MAGI_PREPARE_QUERY_FILES==='function'){
    const suffix=wanted?` ${wanted}`:' 2025-2026 2026-2027 旧チーム 現チーム';
    try{await window.MAGI_PREPARE_QUERY_FILES(String(query||'')+suffix)}catch(e){console.warn('[MAGI stats master] fallback',e)}
  }
}

function install(){
  if(window.MAGI_STATS_MASTER_PRELOAD_WRAPPED)return true;
  if(window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP!=='v298')return false;
  if(typeof window.runMagi!=='function'||!window.MAGI_STATS_REPORT_FN)return false;
  const original=window.runMagi;
  const wrapped=async function(...args){
    const query=(document.getElementById('q')?.value||'').trim();
    if(isLookup(query)){
      const status=document.getElementById('status');
      if(status)status.textContent='成績正本を確認しています…';
      await preloadMasters(query);
    }
    return original.apply(this,args);
  };
  window.runMagi=wrapped;
  window.MAGI_STATS_MASTER_PRELOAD_WRAPPED=true;
  window.MAGI_STATS_MASTER_PRELOAD_VERSION='v303';
  return true;
}

let tries=0;
(function wait(){
  tries++;
  if(install())return;
  if(tries<300)setTimeout(wait,100);
})();
})();
