(()=>{
'use strict';
if(window.MAGI_STATS_DIRECT_MASTER_GUARD_V308)return;
window.MAGI_STATS_DIRECT_MASTER_GUARD_V308=true;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const isLookup=q=>{
 q=String(q||'');
 const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
 const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return stat&&request&&!decision;
};
const wantedSeason=q=>{
 q=String(q||'');
 if(/2025\s*[-–—_. /]?\s*2026|旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';
 if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(q))return'2026-2027';
 return'';
};
const getFiles=()=>{try{return Array.isArray(driveIndex)?driveIndex:[]}catch(_){return[]}};
const getRows=()=>{try{return Array.isArray(dataRecords)?dataRecords:[]}catch(_){return[]}};

async function ensureCatalogue(){
 if(getFiles().length)return getFiles();
 if(typeof window.MAGI_SERVER_DRIVE_RELOAD==='function'){
  try{await window.MAGI_SERVER_DRIVE_RELOAD()}catch(e){console.warn('[MAGI stats direct] catalogue',e)}
 }
 return getFiles();
}

async function ensureMasterWorkbooks(query){
 const files=await ensureCatalogue();
 const wanted=wantedSeason(query);
 let masters=files.filter(f=>f&&/通算成績一覧/i.test(String(f.name||''))&&/\.(xlsm|xlsx|xls)$/i.test(String(f.name||'')));
 if(wanted)masters=masters.filter(f=>String(`${f.name||''} ${f.path||''}`).includes(wanted));
 masters.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ja'));
 let loaded=0;
 for(const f of masters){
  if(getRows().some(r=>r&&r.source==='drive'&&r.fileId===f.id)){loaded++;continue}
  if(typeof window.importDriveFile!=='function')continue;
  try{
   await window.importDriveFile(f.id,true);
   if(getRows().some(r=>r&&r.source==='drive'&&r.fileId===f.id))loaded++;
  }catch(e){
   console.warn('[MAGI stats direct] master import failed',f.name,e?.message||e);
  }
 }
 return{masters:masters.length,loaded};
}

function install(){
 if(window.MAGI_STATS_DIRECT_MASTER_GUARD_INSTALLED)return true;
 if(window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP!=='v298')return false;
 if(!window.MAGI_STATS_REPORT_FN||typeof window.runMagi!=='function'||typeof window.importDriveFile!=='function')return false;
 const original=window.runMagi;
 const wrapped=async function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(isLookup(query)){
   const status=document.getElementById('status');
   if(status)status.textContent='成績照会：Drive正本を確認しています…';
   await ensureMasterWorkbooks(query);
  }
  return original.apply(this,args);
 };
 // This guard supersedes the older preload wrapper. Keep the direct-report
 // wrapper from re-installing above us after this point.
 window.MAGI_STATS_MASTER_PRELOAD_WRAPPED=true;
 window.runMagi=wrapped;
 window.MAGI_STATS_REPORT_FN=wrapped;
 window.MAGI_STATS_DIRECT_MASTER_GUARD_INSTALLED=true;
 window.MAGI_STATS_DIRECT_MASTER_GUARD='v308';
 return true;
}

let tries=0;
(function wait(){
 tries++;
 if(install())return;
 if(tries<400)setTimeout(wait,100);
})();
})();
