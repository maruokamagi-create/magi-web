(()=>{
'use strict';
if(window.MAGI_PITCHING_DIRECT_REPORT_V317)return;
window.MAGI_PITCHING_DIRECT_REPORT_V317=true;

// v317 is intentionally only an adapter. The actual report renderer is the
// previously-built pitch-report-v253.js (MAGI_PITCH_REPORT_FN).
const FALLBACK=[
 {season:'2025-2026',id:'1thxQXAdswckPVdmXdvRXPeuVAfDtskUB',name:'投手詳細2025-2026.csv',path:''},
 {season:'2026-2027',id:'12Lw2EfQFktx57z_AEVcteFdO4ayD197C',name:'投手詳細2026-2027.csv',path:''}
];
const cache=new Map();
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function isPitchLookup(q){
 q=String(q||'');
 const pitch=/投手|ピッチャー|投球|登板|防御率|投球回|奪三振|WHIP|勝敗|勝利|敗北|セーブ|被安打|自責点|与四死球|与四球|与死球|投球数/i.test(q);
 const request=/通算|成績|出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|起用|固定|先発に|先発させ|抑え|クローザー|継投|ローテ|任せる|投げさせ/i.test(q);
 return pitch&&request&&!decision;
}
function seasonText(s){
 const m=String(s||'').match(/(20\d{2})\s*[-–—_. /]\s*(20\d{2})/);
 return m?`${m[1]}-${m[2]}`:'';
}
function sources(){
 const map=new Map(FALLBACK.map(x=>[x.season,{...x}]));
 let files=[];try{files=Array.isArray(driveIndex)?driveIndex:[]}catch(_){}
 for(const f of files){
  if(!f?.id)continue;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/投手詳細/i.test(name)||!/\.csv$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);
  if(season)map.set(season,{season,id:f.id,name,path});
 }
 return [...map.values()].sort((a,b)=>a.season.localeCompare(b.season));
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
  if(c==='\n'){
   row.push(cell.replace(/\r$/,''));
   if(row.some(v=>String(v).trim()))out.push(row);
   row=[];cell='';continue;
  }
  cell+=c;
 }
 row.push(cell.replace(/\r$/,''));
 if(row.some(v=>String(v).trim()))out.push(row);
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
async function fetchTable(src){
 if(cache.has(src.id))return cache.get(src.id);
 const p=(async()=>{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{
   const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:c.signal});
   if(!r.ok)throw new Error(`Drive file ${r.status}`);
   return parseCsv(decodeSmart(await r.arrayBuffer()));
  }finally{clearTimeout(t)}
 })().catch(e=>{cache.delete(src.id);throw e});
 cache.set(src.id,p);return p;
}
function colIndex(cols,aliases){
 const want=aliases.map(norm);
 for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;
 for(let i=0;i<cols.length;i++){
  const c=norm(cols[i]);
  if(want.some(w=>w&&w.length>=2&&c.includes(w)))return i;
 }
 return-1;
}
function dateRank(v){
 const s=String(v??'').trim();
 const m=s.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
 if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const x=Number(s);return Number.isFinite(x)?x:0;
}
function buildMeta(src,table){
 const cols=(table[0]||[]).map(v=>String(v??'').trim());
 const ix={
  date:colIndex(cols,['開催日','日付']),
  tournament:colIndex(cols,['大会名','大会','試合種別']),
  order:colIndex(cols,['試合順','試合']),
  opponent:colIndex(cols,['相手校','対戦相手','対戦校']),
  usage:colIndex(cols,['起用法','起用'])
 };
 const rowGame=new Map(),games=[];
 let seq=0,currentKey='',lastDate='',lastOrder='',lastOpponent='',rowsInGame=0;
 for(let i=1;i<table.length;i++){
  const r=table[i]||[];
  const date=ix.date>=0?String(r[ix.date]??'').trim():'';
  if(!date)continue;
  const tournament=ix.tournament>=0?String(r[ix.tournament]??'').trim():'';
  const order=ix.order>=0?String(r[ix.order]??'').trim():'';
  const opponent=ix.opponent>=0?String(r[ix.opponent]??'').trim():'';
  const usage=ix.usage>=0?String(r[ix.usage]??'').trim():'';
  const start=/先発/.test(usage);
  let newGame=!currentKey||date!==lastDate;
  if(!newGame&&start&&rowsInGame>0)newGame=true;
  if(!newGame&&order&&lastOrder&&order!==lastOrder&&start)newGame=true;
  if(!newGame&&opponent&&lastOpponent&&opponent!==lastOpponent&&start)newGame=true;
  if(newGame){
   seq++;currentKey=`${src.season}|G${seq}`;rowsInGame=0;
   games.push({key:currentKey,src,season:src.season,date,rank:dateRank(date),seq,tournament,order,opponent,practice:/練習試合/.test(tournament)&&!/公式戦/.test(tournament)});
  }
  rowGame.set(i,currentKey);rowsInGame++;
  lastDate=date;if(order)lastOrder=order;if(opponent)lastOpponent=opponent;
 }
 return{src,table,cols,ix,rowGame,games};
}
function latestSixPlan(metas){
 const all=[];
 for(const m of metas)for(const g of m.games)if(g.practice)all.push(g);
 const six=all.sort((a,b)=>b.rank-a.rank||b.seq-a.seq||b.season.localeCompare(a.season)).slice(0,6);
 const map=new Map();
 six.forEach((g,i)=>map.set(g.key,{date:String(9999999999999-Math.floor(i/2)),order:`直近${i+1}試合`}));
 return{six,map};
}
function masterName(season){return`丸岡中軟式野球部_通算成績一覧${season}.xlsm`}
function makeCompatRecords(metas,plan){
 const out=[];
 for(const m of metas){
  for(let i=1;i<m.table.length;i++){
   const row=m.table[i]||[];
   if(!row.some(v=>String(v??'').trim()))continue;
   const values=row.map(v=>String(v??''));
   const gp=plan.map.get(m.rowGame.get(i));
   if(gp){
    if(m.ix.date>=0)values[m.ix.date]=gp.date;
    if(m.ix.order>=0)values[m.ix.order]=gp.order;
   }
   const fileName=masterName(m.src.season);
   out.push({
    source:'drive',fileId:`magi-pitch-old-report-v317-${m.src.season}`,fileName,sheetName:'投手詳細',rowNumber:i+1,
    columns:m.cols.slice(),values,
    display:values.map((v,j)=>v?`${m.cols[j]||`列${j+1}`}=${v}`:'').filter(Boolean).join(' | '),
    searchable:`${fileName} 投手詳細 ${m.cols.join(' ')} ${values.join(' ')}`.toLowerCase(),
    __magiPitchOldReportCompatV317:true,originalFileName:m.src.name,originalFileId:m.src.id
   });
  }
 }
 return out;
}
function injectCompat(records){
 try{
  const base=Array.isArray(dataRecords)?dataRecords:[];
  dataRecords=base.filter(r=>!r?.__magiPitchOldReportCompatV317).concat(records);
  try{window.dataRecords=dataRecords}catch(_){}
  return;
 }catch(_){}
 const base=Array.isArray(window.dataRecords)?window.dataRecords:[];
 window.dataRecords=base.filter(r=>!r?.__magiPitchOldReportCompatV317).concat(records);
}
async function waitOldReport(ms=6000){
 const start=Date.now();
 while(Date.now()-start<ms){
  if(typeof window.MAGI_PITCH_REPORT_FN==='function')return window.MAGI_PITCH_REPORT_FN;
  await new Promise(r=>setTimeout(r,40));
 }
 return null;
}
function patchOldReportNote(){
 const small=document.querySelector('#statsPdfSource .statsFooter small');
 if(small)small.textContent='投球回はアウト数へ変換して合算し、防御率・WHIP・奪三振率・与四球率を再計算しています。防御率は7回制です。相手校別成績も各校の投手詳細から同じ方式で再計算しています。直近6試合はチーム全体の最新6練習試合を基準にし、公式戦を除外しています。';
}
async function execute(q){
 const ss=sources();
 const loaded=await Promise.all(ss.map(async src=>({src,table:await fetchTable(src)})));
 const metas=loaded.map(x=>buildMeta(x.src,x.table));
 const plan=latestSixPlan(metas);
 injectCompat(makeCompatRecords(metas,plan));
 const oldReport=await waitOldReport();
 if(!oldReport)throw new Error('以前の投手成績レポートを準備できませんでした');
 await oldReport.call(window);
 patchOldReportNote();
 setTimeout(patchOldReportNote,200);
}

let busy=false;
document.addEventListener('click',async event=>{
 const btn=event.target?.closest?.('button[onclick*="runMagi"]');
 if(!btn)return;
 const q=(document.getElementById('q')?.value||'').trim();
 if(!isPitchLookup(q))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(busy)return;busy=true;
 const oldText=btn.textContent,status=document.getElementById('status');
 btn.disabled=true;btn.textContent='投手成績照会中…';
 if(status)status.textContent='投手成績照会：以前の投手レポート用データを準備しています…';
 try{
  await execute(q);
 }catch(e){
  console.warn('[MAGI pitch old-report adapter v317]',e?.message||e);
  if(status)status.textContent='投手成績照会を完了できませんでした。投手詳細データを確認してください。';
 }finally{
  btn.disabled=false;
  if(btn.textContent==='投手成績照会中…')btn.textContent=oldText||'MAGI実行';
  busy=false;
 }
},true);

setTimeout(()=>{Promise.allSettled(sources().map(fetchTable)).then(()=>{window.MAGI_PITCHING_WARM_V317=true})},500);
})();
