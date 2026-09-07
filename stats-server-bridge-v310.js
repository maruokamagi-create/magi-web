(()=>{
'use strict';
if(window.MAGI_STATS_SERVER_BRIDGE_V313)return;
window.MAGI_STATS_SERVER_BRIDGE_V313=true;

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
function masterFiles(){
 const out=[];
 for(const f of driveFiles()){
  if(!f?.id||!/通算成績一覧/i.test(String(f.name||''))||!/\.(xlsm|xlsx|xls)$/i.test(String(f.name||'')))continue;
  const season=seasonText(`${f.name||''} ${f.path||''}`);if(!season||out.some(x=>x.season===season))continue;
  out.push({season,id:f.id,name:String(f.name||''),path:String(f.path||'')});
 }
 return out.sort((a,b)=>a.season.localeCompare(b.season));
}
function masterName(season){
 const f=masterFiles().find(x=>x.season===season);
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
  return parseCsv(decodeSmart(await r.arrayBuffer()));
 }finally{clearTimeout(timer)}
}
function makeRecord(src,master,columns,values,index,kind){
 const fileName=kind==='detail'?master:src.name;
 const sheetName=kind==='detail'?'打撃詳細':'CSV';
 const rowValues=values.map(v=>String(v??''));
 return{
  source:'drive',fileId:`magi-stats-v313-${src.season}-${kind}`,fileName,sheetName,rowNumber:index+2,
  columns:columns.slice(),values:rowValues,
  display:rowValues.map((v,i)=>v?`${columns[i]||`列${i+1}`}=${v}`:'').filter(Boolean).join(' | '),
  searchable:`${fileName} ${sheetName} ${columns.join(' ')} ${rowValues.join(' ')}`.toLowerCase(),
  __magiStatsCompatV313:true,originalFileName:src.name,originalFileId:src.id
 };
}
function headerScore(row){
 if(!Array.isArray(row))return 0;
 const vals=row.map(norm);let s=0;
 if(vals.some(v=>['選手名','氏名','選手','名前'].map(norm).includes(v)))s+=5;
 if(vals.some(v=>['得点圏','得点圏打率'].map(norm).includes(v)))s+=5;
 if(vals.includes(norm('打率')))s++;
 if(vals.includes(norm('OPS')))s++;
 return s;
}
function findHeader(rows){
 let best=-1,score=0;
 for(let i=0;i<Math.min(rows.length,50);i++){const s=headerScore(rows[i]);if(s>score){score=s;best=i;}}
 return score>=8?best:-1;
}
function readRispFromBook(book,query,src){
 const names=book?.SheetNames||[];
 const sheetName=names.find(n=>/^打撃一覧$/i.test(String(n).trim()))||names.find(n=>/打撃.*一覧|打者.*成績|通算.*打撃/i.test(String(n)))||'';
 if(!sheetName)return null;
 const ws=book.Sheets[sheetName];
 const rows=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
 const hi=findHeader(rows);if(hi<0)return null;
 const cols=(rows[hi]||[]).map(v=>String(v??'').trim());
 const pi=colIndex(cols,['選手名','氏名','名前','選手']),ri=colIndex(cols,['得点圏打率','得点圏']);
 if(pi<0||ri<0)return null;
 const nq=norm(query),hits=[];
 for(let i=hi+1;i<rows.length;i++){
  const r=rows[i]||[],p=String(r?.[pi]??'').trim(),k=norm(p),v=String(r?.[ri]??'').trim();
  if(p&&k.length>=2&&nq.includes(k)&&v)hits.push({target:p,rispAvg:v,rowNumber:i+1});
 }
 hits.sort((a,b)=>norm(b.target).length-norm(a.target).length);
 const hit=hits[0];
 return hit?{...hit,season:src.season,fileName:src.name,sourceSheet:sheetName}:null;
}
function makeRispRecord(x){
 const columns=['選手名','得点圏打率'],values=[String(x.target||''),String(x.rispAvg||'')];
 return{
  source:'drive',fileId:`magi-risp-v313-${x.season}`,fileName:String(x.fileName||masterName(x.season)),sheetName:'得点圏打率一覧（出典:打撃一覧）',rowNumber:Number(x.rowNumber||1),
  columns,values,display:`選手名=${values[0]} | 得点圏打率=${values[1]}`,
  searchable:`${x.fileName||''} 得点圏打率一覧 ${values.join(' ')}`.toLowerCase(),
  __magiStatsRispV313:true
 };
}
async function hydrateRisp(query,seasons){
 if(!window.XLSX?.read||!window.XLSX?.utils?.sheet_to_json)return 0;
 const wanted=new Set(seasons||[]),out=[];
 for(const src of masterFiles().filter(x=>!wanted.size||wanted.has(x.season))){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   if(!r.ok)continue;
   const book=window.XLSX.read(await r.arrayBuffer(),{type:'array',cellDates:false,cellFormula:false});
   const x=readRispFromBook(book,query,src);if(x)out.push(x);
  }catch(e){console.warn('[MAGI RISP v313]',src.name,e?.name==='AbortError'?'timeout':e?.message||e)}
  finally{clearTimeout(timer)}
 }
 dataRecords=dataRecords.filter(r=>!r?.__magiStatsRispV312&&!r?.__magiStatsRispV313);
 for(const x of out)dataRecords.push(makeRispRecord(x));
 window.MAGI_STATS_RISP_LAST={target:out[0]?.target||'',records:out};
 return out.length;
}
async function hydrate(query){
 const wanted=explicitSeason(query),sources=detailSources().filter(s=>!wanted||s.season===wanted);
 if(!sources.length)return false;
 const loaded=[];
 for(const src of sources){
  try{const table=await fetchSource(src),hit=rowsForPlayer(query,table);if(hit)loaded.push({src,...hit});}
  catch(e){console.warn('[MAGI stats v313]',src.name,e?.name==='AbortError'?'timeout':e?.message||e)}
 }
 if(!loaded.length)return false;
 try{
  dataRecords=dataRecords.filter(r=>!r?.__magiStatsCompatV311&&!r?.__magiServerStatsV310&&!r?.__magiStatsCompatV312&&!r?.__magiStatsCompatV313&&!r?.__magiStatsRispV312&&!r?.__magiStatsRispV313);
  for(const hit of loaded){
   const master=masterName(hit.src.season);
   const hasRaw=records().some(r=>r&&r.source==='drive'&&!r.__magiStatsCompatV311&&!r.__magiStatsCompatV312&&!r.__magiStatsCompatV313&&norm(r.fileName)===norm(hit.src.name));
   hit.rows.forEach((row,i)=>{
    dataRecords.push(makeRecord(hit.src,master,hit.columns,row,i,'detail'));
    if(!hasRaw)dataRecords.push(makeRecord(hit.src,master,hit.columns,row,i,'raw'));
   });
  }
  await hydrateRisp(query,loaded.map(x=>x.src.season));
  window.MAGI_STATS_SERVER_LAST={target:loaded[0].target,seasons:loaded.map(x=>x.src.season),rows:loaded.reduce((n,x)=>n+x.rows.length,0),source:'server-cached-batting-detail-csv+cached-master-risp'};
  return true;
 }catch(e){console.warn('[MAGI stats v313] inject',e?.message||e);return false}
}

let bridgeFn=null;
let statsDirectFn=null;
function install(){
 if(window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP!=='v298')return false;
 if(typeof window.runMagi!=='function'||!window.MAGI_STATS_REPORT_FN)return false;
 if(!statsDirectFn||statsDirectFn.__magiStatsServerBridgeV311||statsDirectFn.__magiStatsServerBridgeV312||statsDirectFn.__magiStatsServerBridgeV313){
  const candidate=window.MAGI_STATS_REPORT_FN;
  if(!candidate||candidate.__magiStatsServerBridgeV311||candidate.__magiStatsServerBridgeV312||candidate.__magiStatsServerBridgeV313)return false;
  statsDirectFn=candidate;
 }
 if(bridgeFn&&window.runMagi===bridgeFn)return true;
 const normalRun=window.runMagi,directStats=statsDirectFn;
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
 wrapped.__magiStatsServerBridgeV313=true;
 bridgeFn=wrapped;window.runMagi=wrapped;
 if(window.MAGI_NUMERIC_V298_RUN)window.MAGI_NUMERIC_V298_RUN=wrapped;
 window.MAGI_STATS_SERVER_BRIDGE_INSTALLED=true;
 window.MAGI_STATS_SERVER_BRIDGE='v313-direct-risp';
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=500)clearInterval(timer)},100);install();
})();
