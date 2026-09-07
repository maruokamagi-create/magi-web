(()=>{
'use strict';
if(window.MAGI_STATS_SERVER_BRIDGE_V310)return;
window.MAGI_STATS_SERVER_BRIDGE_V310=true;

const SOURCES={
  '2025-2026':{id:'1mNRMN8ChOnDolOoIQ9kHCh2mGionaxai',name:'打撃詳細2025-2026.csv'},
  '2026-2027':{id:'1cSj1aKLmlzpOELcFMaJgFD5Irbh7hLvB',name:'打撃詳細2026-2027.csv'}
};
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const num=v=>{const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:0};

const isLookup=q=>{
  q=String(q||'');
  const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
  const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
  const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
  return stat&&request&&!decision;
};
function seasonsFor(q){
  q=String(q||'');
  if(/2025\s*[-–—_. /]?\s*2026|旧チーム|昨季|前年|昨年/i.test(q))return['2025-2026'];
  if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(q))return['2026-2027'];
  if(/全年度|両年度|過去も|昨季も|前年も/i.test(q))return['2025-2026','2026-2027'];
  return['2026-2027'];
}
function parseCsv(text){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'&&text[i+1]==='"'){cell+='"';i++;continue}
      if(c==='"'){q=false;continue}
      cell+=c;continue;
    }
    if(c==='"'){q=true;continue}
    if(c===','){row.push(cell);cell='';continue}
    if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))rows.push(row);row=[];cell='';continue}
    cell+=c;
  }
  row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))rows.push(row);
  return rows;
}
function decodeSmart(buffer){
  try{if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer)}catch(_){}
  const score=s=>(String(s).match(/[ぁ-んァ-ヶ一-龯々]/g)||[]).length-(String(s).match(/�/g)||[]).length*20;
  let u='',s='';
  try{u=new TextDecoder('utf-8').decode(buffer)}catch(_){}
  try{s=new TextDecoder('shift_jis').decode(buffer)}catch(_){}
  return score(s)>score(u)?s:u;
}
function colIndex(cols,aliases){
  const wants=aliases.map(norm);
  for(let i=0;i<cols.length;i++)if(wants.includes(norm(cols[i])))return i;
  return-1;
}
function findPlayerName(query,rows){
  if(!rows.length)return'';
  const cols=rows[0]||[],pi=colIndex(cols,['選手名','氏名','選手']);
  if(pi<0)return'';
  const z=norm(query),names=[];
  for(const r of rows.slice(1)){
    const p=String(r?.[pi]??'').trim(),k=norm(p);
    if(p&&k.length>=2&&z.includes(k)&&!names.some(x=>norm(x)===k))names.push(p);
  }
  return names.sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
}
function aggregate(query,season,rows){
  if(!rows.length)return null;
  const cols=rows[0].map(v=>String(v??'').trim());
  const idx={
    player:colIndex(cols,['選手名','氏名','選手']),date:colIndex(cols,['開催日','日付']),tourney:colIndex(cols,['大会名','大会']),order:colIndex(cols,['試合順','試合']),opp:colIndex(cols,['相手校','対戦相手','対戦校']),
    pa:colIndex(cols,['打席','打席数']),ab:colIndex(cols,['打数']),runs:colIndex(cols,['得点']),h:colIndex(cols,['安打']),single:colIndex(cols,['単打']),double:colIndex(cols,['二塁打']),triple:colIndex(cols,['三塁打']),hr:colIndex(cols,['本塁打']),rbi:colIndex(cols,['打点']),sb:colIndex(cols,['盗塁']),bb:colIndex(cols,['四球']),hbp:colIndex(cols,['死球']),so:colIndex(cols,['三振']),sh:colIndex(cols,['犠打']),sf:colIndex(cols,['犠飛'])
  };
  if(idx.player<0)return null;
  const target=findPlayerName(query,rows);if(!target)return null;
  const nt=norm(target),g={games:new Set(),pa:0,ab:0,runs:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,sb:0,bb:0,hbp:0,so:0,sh:0,sf:0};
  for(const r of rows.slice(1)){
    if(norm(r?.[idx.player])!==nt)continue;
    const key=[idx.date,idx.tourney,idx.order,idx.opp].map(i=>i>=0?String(r?.[i]??''):'').join('|');
    if(key.replace(/\|/g,''))g.games.add(key);
    for(const k of ['pa','ab','runs','h','single','double','triple','hr','rbi','sb','bb','hbp','so','sh','sf'])if(idx[k]>=0)g[k]+=num(r?.[idx[k]]);
  }
  if(!g.pa&&!g.ab&&!g.h)return null;
  const avg=g.ab?g.h/g.ab:0;
  const obpDen=g.ab+g.bb+g.hbp+g.sf,obp=obpDen?(g.h+g.bb+g.hbp)/obpDen:0;
  const slg=g.ab?(g.single+2*g.double+3*g.triple+4*g.hr)/g.ab:0,ops=obp+slg;
  const columns=['選手名','出場数','打席','打数','得点','安打','単打','二塁打','三塁打','本塁打','打点','盗塁','四球','死球','犠打','犠飛','三振','打率','出塁率','長打率','OPS'];
  const values=[target,g.games.size,g.pa,g.ab,g.runs,g.h,g.single,g.double,g.triple,g.hr,g.rbi,g.sb,g.bb,g.hbp,g.sh,g.sf,g.so,avg,obp,slg,ops].map(v=>String(v));
  return{target,season,columns,values};
}
async function loadSeason(query,season){
  const src=SOURCES[season];if(!src)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
    if(!r.ok)return null;
    const text=decodeSmart(await r.arrayBuffer()),rows=parseCsv(text);
    return aggregate(query,season,rows);
  }catch(e){console.warn('[MAGI stats bridge]',season,e?.name==='AbortError'?'timeout':e?.message||e);return null}
  finally{clearTimeout(timer)}
}
async function hydrateStats(query){
  const seasons=seasonsFor(query),results=[];
  for(const y of seasons){const x=await loadSeason(query,y);if(x)results.push(x)}
  if(!results.length)return false;
  try{
    dataRecords=dataRecords.filter(x=>!x?.__magiServerStatsV310);
    for(const x of results){
      const fileName=`丸岡中軟式野球部_通算成績一覧${x.season}.xlsm`;
      dataRecords.push({source:'drive',fileId:`magi-aggregate-${x.season}`,fileName,sheetName:'打撃一覧',rowNumber:1,columns:x.columns,values:x.values,display:x.values.map((v,i)=>`${x.columns[i]}=${v}`).join(' | '),searchable:`${fileName} 打撃一覧 ${x.columns.join(' ')} ${x.values.join(' ')}`.toLowerCase(),__magiServerStatsV310:true});
    }
    window.MAGI_STATS_SERVER_LAST={target:results[0].target,seasons:results.map(x=>x.season),count:results.length,source:'detail-csv-cache'};
    return true;
  }catch(e){console.warn('[MAGI stats bridge] inject',e?.message||e);return false}
}
function install(){
  if(window.MAGI_STATS_SERVER_BRIDGE_INSTALLED)return true;
  if(!window.MAGI_STATS_REPORT_FN||typeof window.runMagi!=='function')return false;
  const original=window.MAGI_STATS_REPORT_FN;
  const wrapped=async function(...args){
    const query=(document.getElementById('q')?.value||'').trim();
    if(isLookup(query)){
      const status=document.getElementById('status');
      if(status)status.textContent='成績照会：サーバー準備済みデータを集計しています…';
      await hydrateStats(query);
    }
    return original.apply(this,args);
  };
  wrapped.__magiStatsServerBridgeV310=true;
  window.runMagi=wrapped;window.MAGI_STATS_REPORT_FN=wrapped;
  window.MAGI_STATS_SERVER_BRIDGE_INSTALLED=true;window.MAGI_STATS_SERVER_BRIDGE='v310';
  return true;
}
let tries=0;(function wait(){tries++;if(install())return;if(tries<400)setTimeout(wait,100)})();
})();
