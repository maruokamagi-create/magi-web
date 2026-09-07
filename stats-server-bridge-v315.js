(()=>{
'use strict';
if(window.MAGI_STATS_SERVER_BRIDGE_V315)return;
window.MAGI_STATS_SERVER_BRIDGE_V315=true;

const FALLBACK_DETAIL=[
 {season:'2025-2026',id:'1mNRMN8ChOnDolOoIQ9kHCh2mGionaxai',name:'打撃詳細2025-2026.csv',path:''},
 {season:'2026-2027',id:'1cSj1aKLmlzpOELcFMaJgFD5Irbh7hLvB',name:'打撃詳細2026-2027.csv',path:''}
];
const FALLBACK_MASTER=[
 {season:'2026-2027',id:'11ABgSFKN-9Bhde1hJ_n-Qytz0cuImM0E',name:'丸岡中軟式野球部_通算成績一覧2026-2027.xlsm',path:''}
];
const tableCache=new Map();
const rispCache=new Map();
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function isLookup(q){
 q=String(q||'');
 const stat=/通算|打撃成績|成績|打率|得点圏|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
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
function currentRecords(){try{return Array.isArray(dataRecords)?dataRecords:[]}catch(_){return[]}}

function mergeBySeason(found,fallback){
 const map=new Map();
 for(const x of fallback)map.set(x.season,{...x});
 for(const x of found)map.set(x.season,{...x});
 return [...map.values()].sort((a,b)=>a.season.localeCompare(b.season));
}
function detailSources(){
 const found=[];
 for(const f of driveFiles()){
  if(!f?.id)continue;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/打撃詳細/i.test(name)||!/\.csv$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);if(!season)continue;
  found.push({season,id:f.id,name,path});
 }
 return mergeBySeason(found,FALLBACK_DETAIL);
}
function masterSources(){
 const found=[];
 for(const f of driveFiles()){
  if(!f?.id)continue;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/通算成績一覧/i.test(name)||!/\.(xlsm|xlsx|xls)$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);if(!season)continue;
  found.push({season,id:f.id,name,path});
 }
 return mergeBySeason(found,FALLBACK_MASTER);
}
function masterName(season){
 const x=masterSources().find(v=>v.season===season);
 return String(x?.name||`丸岡中軟式野球部_通算成績一覧${season}.xlsm`);
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
async function fetchBuffer(id,timeout=12000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
 try{
  const r=await fetch(`/api/drive/file?id=${encodeURIComponent(id)}`,{cache:'no-store',credentials:'same-origin',signal:c.signal});
  if(!r.ok)throw new Error(`Drive file ${r.status}`);
  return await r.arrayBuffer();
 }finally{clearTimeout(t)}
}
function getTable(src){
 if(tableCache.has(src.id))return tableCache.get(src.id);
 const p=fetchBuffer(src.id,10000).then(b=>parseCsv(decodeSmart(b))).catch(e=>{tableCache.delete(src.id);throw e});
 tableCache.set(src.id,p);return p;
}
function colIndex(cols,aliases){
 const want=aliases.map(norm);
 for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;
 return-1;
}
function dateRank(v){
 const s=String(v??'').trim();
 const m=s.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
 if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const x=Number(s);return Number.isFinite(x)?x:0;
}
function tableMeta(src,table){
 const cols=(table[0]||[]).map(v=>String(v??'').trim());
 const ix={
  date:colIndex(cols,['開催日','日付']),
  tournament:colIndex(cols,['大会名','大会','試合種別']),
  order:colIndex(cols,['試合順','試合']),
  opponent:colIndex(cols,['相手校','対戦相手','対戦校']),
  battingOrder:colIndex(cols,['打順']),
  player:colIndex(cols,['選手名','氏名','名前','選手'])
 };
 const rowGame=new Map(),games=new Map();
 let lastDate='',lastBat=null,gameNo=0,lastOpponent='';
 for(let i=1;i<table.length;i++){
  const r=table[i]||[];
  const date=ix.date>=0?String(r[ix.date]??'').trim():'';
  const tour=ix.tournament>=0?String(r[ix.tournament]??'').trim():'';
  if(!date||!/練習試合/.test(tour)||/公式戦/.test(tour))continue;
  const opp=ix.opponent>=0?String(r[ix.opponent]??'').trim():'';
  const bo=ix.battingOrder>=0?Number(String(r[ix.battingOrder]??'').trim()):NaN;
  if(date!==lastDate){lastDate=date;gameNo=1;lastBat=null;lastOpponent=opp}
  else{
   const reset=Number.isFinite(bo)&&Number.isFinite(lastBat)&&bo<=1&&lastBat>=7;
   const opponentReset=opp&&lastOpponent&&opp!==lastOpponent&&Number.isFinite(bo)&&bo<=1;
   if(reset||opponentReset)gameNo++;
  }
  const key=`${src.season}|${date}|G${gameNo}`;
  rowGame.set(i,key);
  if(!games.has(key))games.set(key,{key,season:src.season,date,rank:dateRank(date),gameNo,src,rowIndex:i});
  if(Number.isFinite(bo))lastBat=bo;
  if(opp)lastOpponent=opp;
 }
 return{src,table,cols,ix,rowGame,games:[...games.values()]};
}
function findTarget(query,metas){
 const q=norm(query),names=[];
 for(const m of metas){
  if(m.ix.player<0)continue;
  for(let i=1;i<m.table.length;i++){
   const p=String(m.table[i]?.[m.ix.player]??'').trim(),k=norm(p);
   if(p&&k.length>=2&&q.includes(k)&&!names.some(x=>norm(x)===k))names.push(p);
  }
 }
 return names.sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
}
function latestSixPlan(metas){
 const all=[];for(const m of metas)all.push(...m.games);
 const seen=new Map();for(const g of all)if(!seen.has(g.key))seen.set(g.key,g);
 const six=[...seen.values()].sort((a,b)=>b.rank-a.rank||b.gameNo-a.gameNo||b.season.localeCompare(a.season)).slice(0,6);
 const map=new Map();
 six.forEach((g,i)=>map.set(g.key,{syntheticDate:String(9999999999999-Math.floor(i/2)),syntheticOrder:`直近${i+1}試合`,index:i}));
 return{games:six,map};
}
function makeRecord(src,columns,values,index,kind='detail'){
 const rowValues=values.map(v=>String(v??'')),fileName=masterName(src.season);
 return{
  source:'drive',fileId:`magi-stats-v315-${src.season}-${kind}`,fileName,sheetName:'打撃詳細',rowNumber:index+1,
  columns:columns.slice(),values:rowValues,
  display:rowValues.map((v,i)=>v?`${columns[i]||`列${i+1}`}=${v}`:'').filter(Boolean).join(' | '),
  searchable:`${fileName} 打撃詳細 ${columns.join(' ')} ${rowValues.join(' ')}`.toLowerCase(),
  __magiStatsCompatV315:true,originalFileName:src.name,originalFileId:src.id
 };
}
function zeroLikeRow(row,cols){
 const out=row.map(v=>String(v??''));
 for(const z of ['打席','打席数','打数','得点','安打','単打','二塁打','三塁打','本塁打','打点','盗塁','四球','死球','三振','犠打','犠飛']){const i=colIndex(cols,[z]);if(i>=0)out[i]='0'}
 for(const z of ['打率','出塁率','長打率','OPS']){const i=colIndex(cols,[z]);if(i>=0)out[i]='.000'}
 return out;
}
function injectDetail(target,metas,plan){
 const np=norm(target),out=[];
 for(const m of metas){
  if(m.ix.player<0)continue;
  for(let i=1;i<m.table.length;i++){
   const row=m.table[i]||[];if(norm(row[m.ix.player])!==np)continue;
   const v=row.map(x=>String(x??'')),gp=plan.map.get(m.rowGame.get(i));
   if(gp){if(m.ix.date>=0)v[m.ix.date]=gp.syntheticDate;if(m.ix.order>=0)v[m.ix.order]=gp.syntheticOrder}
   out.push(makeRecord(m.src,m.cols,v,i,'player'));
  }
 }
 for(const g of plan.games){
  const m=metas.find(x=>x.src.id===g.src.id);if(!m)continue;
  const row=zeroLikeRow(m.table[g.rowIndex]||[],m.cols),gp=plan.map.get(g.key);
  if(m.ix.player>=0)row[m.ix.player]='__MAGI_TEAM_RECENT__';
  if(m.ix.date>=0)row[m.ix.date]=gp.syntheticDate;
  if(m.ix.order>=0)row[m.ix.order]=gp.syntheticOrder;
  out.push(makeRecord(m.src,m.cols,row,100000+gp.index,'sentinel'));
 }
 return out;
}
function headerScore(row){
 if(!Array.isArray(row))return 0;
 const vals=row.map(norm);let s=0;
 if(vals.some(v=>['選手名','氏名','選手','名前'].map(norm).includes(v)))s+=5;
 if(vals.some(v=>['得点圏','得点圏打率'].map(norm).includes(v)))s+=5;
 if(vals.includes(norm('打率')))s++;if(vals.includes(norm('OPS')))s++;
 return s;
}
function findHeader(rows){let best=-1,score=0;for(let i=0;i<Math.min(rows.length,50);i++){const s=headerScore(rows[i]);if(s>score){score=s;best=i}}return score>=8?best:-1}
async function waitXlsx(ms=4000){const start=Date.now();while(Date.now()-start<ms){if(window.XLSX?.read&&window.XLSX?.utils?.sheet_to_json)return true;await new Promise(r=>setTimeout(r,40))}return false}
function getRispMap(src){
 if(rispCache.has(src.id))return rispCache.get(src.id);
 const p=(async()=>{
  if(!(await waitXlsx()))return new Map();
  const book=window.XLSX.read(await fetchBuffer(src.id,15000),{type:'array',cellDates:false,cellFormula:false});
  const names=book?.SheetNames||[];
  const sheetName=names.find(n=>/^打撃一覧$/i.test(String(n).trim()))||names.find(n=>/打撃.*一覧|打者.*成績|通算.*打撃/i.test(String(n)))||'';
  if(!sheetName)return new Map();
  const rows=window.XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:true,blankrows:false});
  const hi=findHeader(rows);if(hi<0)return new Map();
  const cols=(rows[hi]||[]).map(v=>String(v??'').trim());
  const pi=colIndex(cols,['選手名','氏名','名前','選手']),ri=colIndex(cols,['得点圏打率','得点圏']);
  const map=new Map();if(pi<0||ri<0)return map;
  for(let i=hi+1;i<rows.length;i++){
   const player=String(rows[i]?.[pi]??'').trim(),value=String(rows[i]?.[ri]??'').trim();
   if(player&&value)map.set(norm(player),{player,value,rowNumber:i+1,sheetName});
  }
  return map;
 })().catch(e=>{rispCache.delete(src.id);console.warn('[MAGI v315 RISP]',src.name,e?.message||e);return new Map()});
 rispCache.set(src.id,p);return p;
}
function makeRispRecord(src,target,hit){
 const columns=['選手名','得点圏打率'],values=[target,String(hit.value??'')];
 return{source:'drive',fileId:`magi-risp-v315-${src.season}`,fileName:src.name,sheetName:'得点圏打率一覧（出典:打撃一覧）',rowNumber:Number(hit.rowNumber||1),columns,values,display:`選手名=${target} | 得点圏打率=${values[1]}`,searchable:`${src.name} 得点圏打率一覧 ${values.join(' ')}`.toLowerCase(),__magiStatsRispV315:true};
}
async function waitDriveIndex(ms=1800){const start=Date.now();while(Date.now()-start<ms){if(driveFiles().length)return true;await new Promise(r=>setTimeout(r,40))}return false}
async function hydrate(query){
 await waitDriveIndex();
 const wanted=explicitSeason(query),sources=detailSources().filter(s=>!wanted||s.season===wanted);
 if(!sources.length)return false;
 const settled=await Promise.all(sources.map(async src=>{try{return tableMeta(src,await getTable(src))}catch(e){console.warn('[MAGI v315 CSV]',src.name,e?.message||e);return null}}));
 const metas=settled.filter(Boolean);if(!metas.length)return false;
 const target=findTarget(query,metas);if(!target)return false;
 const plan=latestSixPlan(metas),injected=injectDetail(target,metas,plan);
 try{
  dataRecords=currentRecords().filter(r=>!r?.__magiStatsCompatV311&&!r?.__magiStatsCompatV312&&!r?.__magiStatsCompatV313&&!r?.__magiStatsCompatV315&&!r?.__magiServerStatsV310&&!r?.__magiStatsRispV312&&!r?.__magiStatsRispV313&&!r?.__magiStatsRispV315);
  dataRecords.push(...injected);
 }catch(e){console.warn('[MAGI v315 inject]',e?.message||e);return false}
 const masters=masterSources().filter(s=>!wanted||s.season===wanted).filter(s=>metas.some(m=>m.src.season===s.season));
 const risps=await Promise.all(masters.map(async src=>{const map=await getRispMap(src),hit=map.get(norm(target));return hit?makeRispRecord(src,target,hit):null}));
 for(const r of risps.filter(Boolean))dataRecords.push(r);
 window.MAGI_STATS_SERVER_LAST={version:'v315',target,seasons:metas.map(m=>m.src.season),rows:injected.filter(r=>r.fileId.includes('-player')).length,recentTeamGames:plan.games.map(g=>({season:g.season,date:g.date,game:g.gameNo})),source:'server-cached-detail+master-risp'};
 return true;
}
async function warm(){
 await waitDriveIndex(5000);
 const details=detailSources(),masters=masterSources();
 await Promise.allSettled([...details.map(s=>getTable(s)),...masters.map(s=>getRispMap(s))]);
 window.MAGI_STATS_WARM_V315=true;
}
let bridgeFn=null,statsDirectFn=null;
function install(){
 if(window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP!=='v298')return false;
 if(typeof window.runMagi!=='function'||!window.MAGI_STATS_REPORT_FN)return false;
 if(!statsDirectFn){const c=window.MAGI_STATS_REPORT_FN;if(!c)return false;statsDirectFn=c}
 if(bridgeFn&&window.runMagi===bridgeFn)return true;
 const normalRun=window.runMagi,directStats=statsDirectFn;
 const wrapped=async function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(isLookup(query)){
   const status=document.getElementById('status');if(status)status.textContent='成績照会：準備済みデータを確認しています…';
   const ok=await hydrate(query);if(!ok&&status)status.textContent='成績照会：必要な選手データを取得できませんでした。';
   return directStats.apply(this,args);
  }
  return normalRun.apply(this,args);
 };
 wrapped.__magiStatsServerBridgeV313=true;wrapped.__magiStatsServerBridgeV315=true;
 bridgeFn=wrapped;window.runMagi=wrapped;window.MAGI_NUMERIC_V298_RUN=wrapped;
 window.MAGI_STATS_SERVER_BRIDGE_INSTALLED=true;window.MAGI_STATS_SERVER_BRIDGE='v315-team-recent6-cache';
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>=900)clearInterval(timer)},40);install();
setTimeout(()=>{warm().catch(e=>console.warn('[MAGI v315 warm]',e?.message||e))},250);
})();