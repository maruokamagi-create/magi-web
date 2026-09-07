(()=>{
'use strict';
if(window.MAGI_STATS_SERVER_BRIDGE_V311)return;
window.MAGI_STATS_SERVER_BRIDGE_V311=true;

const FALLBACK_SOURCES=[
 {season:'2025-2026',id:'1mNRMN8ChOnDolOoIQ9kHCh2mGionaxai',name:'打撃詳細2025-2026.csv',path:''},
 {season:'2026-2027',id:'1cSj1aKLmlzpOELcFMaJgFD5Irbh7hLvB',name:'打撃詳細2026-2027.csv',path:''}
];
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function isLookup(q){
 q=String(q||'');
 const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
 const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return stat&&request&&!decision;
}
function seasonText(s){
 const m=String(s||'').match(/(20\d{2})\s*[-–—_. /]\s*(20\d{2})/);
 return m?`${m[1]}-${m[2]}`:'';
}
function explicitSeason(q){
 const y=seasonText(q);if(y)return y;
 if(/旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';
 if(/新チーム|現チーム/i.test(q))return'2026-2027';
 return'';
}
function driveFiles(){try{return Array.isArray(driveIndex)?driveIndex:[]}catch(_){return[]}}
function records(){try{return Array.isArray(dataRecords)?dataRecords:[]}catch(_){return[]}}
function detailSources(){
 const found=[];
 for(const f of driveFiles()){
  if(!f?.id)continue;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/打撃詳細/i.test(name)||!/\.csv$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);if(!season)continue;
  if(found.some(x=>x.season===season))continue;
  found.push({season,id:f.id,name,path});
 }
 return (found.length?found:FALLBACK_SOURCES).sort((a,b)=>a.season.localeCompare(b.season));
}
function masterName(season){
 const f=driveFiles().find(x=>seasonText(`${x?.name||''} ${x?.path||''}`)===season&&/通算成績一覧/i.test(String(x?.name||''))&&/\.xlsm$/i.test(String(x?.name||'')));
 return String(f?.name||`丸岡中軟式野球部_通算成績一覧${season}.xlsm`);
}
function parseCsv(text){
 const out=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;continue}
   if(c==='"'){quoted=false;continue}
   cell+=c;continue;
  }
  if(c==='"'){quoted=true;continue}
  if(c===','){row.push(cell);cell='';continue}
  if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);row=[];cell='';continue}
  cell+=c;
 }
 row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);
 return out;
}
function decodeSmart(buffer){
 try{if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer)}catch(_){}
 const score=s=>(String(s).match(/[ぁ-んァ-ヶ一-龯々]/g)||[]).length-(String(s).match(/�/g)||[]).length*30;
 let u='',sj='';
 try{u=new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){}
 try{sj=new TextDecoder('shift_jis',{fatal:false}).decode(buffer)}catch(_){}
 return score(sj)>score(u)?sj:u;
}
function colIndex(cols,aliases){
 const wants=aliases.map(norm);
 for(let i=0;i<cols.length;i++)if(wants.includes(norm(cols[i])))return i;
 return-1;
}
function targetName(query,table){
 if(!table.length)return'';
 const cols=table[0]||[],pi=colIndex(cols,['選手名','氏名','名前','選手']);if(pi<0)return'';
 const q=norm(query),names=[];
 for(const r of table.slice(1)){
  const p=String(r?.[pi]??'').trim(),k=norm(p);
  if(p&&k.length>=2&&q.includes(k)&&!names.some(x=>norm(x)===k))names.push(p);
 }
 return names.sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
}
function rowsForPlayer(query,table){
 if(!table.length)return null;
 const columns=(table[0]||[]).map(v=>String(v??'').trim()),pi=colIndex(columns,['選手名','氏名','名前','選手']);
 if(pi<0)return null;
 const target=targetName(query,table);if(!target)return null;
 const nt=norm(target),rows=table.slice(1).filter(r=>norm(r?.[pi])===nt);
 return rows.length?{target,columns,rows}:null;
}
async function fetchSource(src){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
  if(!r.ok)throw new Error(`Drive file ${r.status}`);
  const table=parseCsv(decodeSmart(await r.arrayBuffer()));
  return table;
 }finally{clearTimeout(timer)}
}
function makeRecord(src,master,columns,values,index,kind){
 const fileName=kind==='detail'?master:src.name;
 const sheetName=kind==='detail'?'打撃詳細':'CSV';
 const rowValues=values.map(v=>String(v??''));
 return{
  source:'drive',fileId:`magi-stats-v311-${src.season}-${kind}`,fileName,sheetName,rowNumber:index+2,
  columns:columns.slice(),values:rowValues,
  display:rowValues.map((v,i)=>v?`${columns[i]||`列${i+1}`}=${v}`:'').filter(Boolean).join(' | '),
  searchable:`${fileName} ${sheetName} ${columns.join(' ')} ${rowValues.join(' ')}`.toLowerCase(),
  __magiStatsCompatV311:true,originalFileName:src.name,originalFileId:src.id
 };
}
async function hydrate(query){
 const wanted=explicitSeason(query),sources=detailSources().filter(s=>!wanted||s.season===wanted);
 if(!sources.length)return false;
 const loaded=[];
 for(const src of sources){
  try{
   const table=await fetchSource(src),hit=rowsForPlayer(query,table);
   if(hit)loaded.push({src,...hit});
  }catch(e){console.warn('[MAGI stats v311]',src.name,e?.name==='AbortError'?'timeout':e?.message||e)}
 }
 if(!loaded.length)return false;
 try{
  dataRecords=dataRecords.filter(r=>!r?.__magiStatsCompatV311&&!r?.__magiServerStatsV310);
  for(const hit of loaded){
   const master=masterName(hit.src.season);
   const hasRaw=records().some(r=>r&&r.source==='drive'&&!r.__magiStatsCompatV311&&norm(r.fileName)===norm(hit.src.name));
   hit.rows.forEach((row,i)=>{
    dataRecords.push(makeRecord(hit.src,master,hit.columns,row,i,'detail'));
    if(!hasRaw)dataRecords.push(makeRecord(hit.src,master,hit.columns,row,i,'raw'));
   });
  }
  window.MAGI_STATS_SERVER_LAST={target:loaded[0].target,seasons:loaded.map(x=>x.src.season),rows:loaded.reduce((n,x)=>n+x.rows.length,0),source:'server-cached-batting-detail-csv'};
  return true;
 }catch(e){console.warn('[MAGI stats v311] inject',e?.message||e);return false}
}

let bridgeFn=null;
let statsDirectFn=null;
function install(){
 if(window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP!=='v298')return false;
 if(typeof window.runMagi!=='function'||!window.MAGI_STATS_REPORT_FN)return false;
 if(!statsDirectFn||statsDirectFn.__magiStatsServerBridgeV311){
  const candidate=window.MAGI_STATS_REPORT_FN;
  if(!candidate||candidate.__magiStatsServerBridgeV311)return false;
  statsDirectFn=candidate;
 }
 if(bridgeFn&&window.runMagi===bridgeFn)return true;
 const normalRun=window.runMagi;
 const directStats=statsDirectFn;
 const wrapped=async function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(isLookup(query)){
   const status=document.getElementById('status');
   if(status)status.textContent='成績照会：全選手共通データを確認しています…';
   await hydrate(query);
   return directStats.apply(this,args);
  }
  return normalRun.apply(this,args);
 };
 wrapped.__magiStatsServerBridgeV311=true;
 bridgeFn=wrapped;
 window.runMagi=wrapped;
 if(window.MAGI_NUMERIC_V298_RUN)window.MAGI_NUMERIC_V298_RUN=wrapped;
 window.MAGI_STATS_SERVER_BRIDGE_INSTALLED=true;
 window.MAGI_STATS_SERVER_BRIDGE='v311-direct';
 return true;
}
let tries=0;
const timer=setInterval(()=>{
 tries++;
 install();
 if(tries>=500)clearInterval(timer);
},100);
install();
})();