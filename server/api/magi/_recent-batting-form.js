import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';

const CURRENT_TOKEN = '2026-2027_CURRENT_現チーム';
const STATS_TOKEN = '03_STATS_成績データ';
const DETAIL_TOKEN = '10_DETAIL_詳細データ';
const BATTING_FILE = '打撃詳細2026-2027.csv';

function text(value){ return String(value ?? '').trim(); }
function numberValue(value){
  const n = Number(text(value).replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}
function integer(value){ return Math.trunc(numberValue(value)); }
function three(value){
  if(!Number.isFinite(value)) return '';
  return value.toFixed(3).replace(/^0/, '');
}
function parseDate(value){
  const m = text(value).match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if(!m) return null;
  const y=Number(m[1]), mo=Number(m[2]), d=Number(m[3]);
  return { key:`${m[1]}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`, value:Date.UTC(y,mo-1,d) };
}
function gameOrder(value){
  const m=text(value).match(/第?\s*(\d+)\s*試合/);
  return m ? Number(m[1]) : 99;
}
function gameKey(row){
  return `${text(row['開催日'])}|${text(row['試合順'])}|${text(row['相手校'])}`;
}

function decodeCsv(buffer){
  const utf8 = Buffer.from(buffer).toString('utf8');
  const replacements = (utf8.match(/\uFFFD/g) || []).length;
  if(replacements === 0 && /開催日/.test(utf8) && /選手名/.test(utf8)) return utf8;
  return new TextDecoder('shift_jis').decode(buffer);
}

function parseCsv(source){
  const rows=[];
  let row=[], cell='', quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'){
        if(source[i+1]==='"'){ cell+='"'; i++; }
        else quoted=false;
      }else cell+=ch;
      continue;
    }
    if(ch==='"'){ quoted=true; continue; }
    if(ch===','){ row.push(cell); cell=''; continue; }
    if(ch==='\n'){
      row.push(cell.replace(/\r$/,''));
      rows.push(row);
      row=[]; cell='';
      continue;
    }
    cell+=ch;
  }
  if(cell.length || row.length){ row.push(cell.replace(/\r$/,'')); rows.push(row); }
  const header=(rows.shift()||[]).map(text);
  return rows.map(values=>Object.fromEntries(header.map((key,index)=>[key,text(values[index])])));
}

function findBattingDetailFile(tree){
  const files=(tree||[]).filter(file=>text(file?.name)===BATTING_FILE);
  return files.find(file=>{
    const path=text(file?.path);
    return path.includes(CURRENT_TOKEN) && path.includes(STATS_TOKEN) && path.includes(DETAIL_TOKEN);
  }) || files.find(file=>text(file?.path).includes(CURRENT_TOKEN)) || files[0] || null;
}

function discoverGames(rows){
  const byKey=new Map();
  rows.forEach((row,index)=>{
    const date=parseDate(row['開催日']);
    if(!date || !text(row['選手名'])) return;
    const key=gameKey(row);
    if(!byKey.has(key)){
      byKey.set(key,{
        key,
        date:date.key,
        time:date.value,
        order:gameOrder(row['試合順']),
        opponent:text(row['相手校']),
        firstIndex:index
      });
    }
  });
  return [...byKey.values()].sort((a,b)=>a.time-b.time || a.order-b.order || a.firstIndex-b.firstIndex);
}

function aggregatePlayer(name,rows,selectedKeys){
  const mine=rows.filter(row=>text(row['選手名'])===name && selectedKeys.has(gameKey(row)));
  const sums={
    PA:0,AB:0,H:0,SINGLE:0,DOUBLE:0,TRIPLE:0,HR:0,BB:0,HBP:0,SF:0,
    RBI:0,R:0,SO:0,SB:0,SAC:0
  };
  const fieldMap={
    PA:'打席',AB:'打数',H:'安打',SINGLE:'単打',DOUBLE:'二塁打',TRIPLE:'三塁打',HR:'本塁打',
    BB:'四球',HBP:'死球',SF:'犠飛',RBI:'打点',R:'得点',SO:'三振',SB:'盗塁',SAC:'犠打'
  };
  for(const row of mine){
    for(const [key,label] of Object.entries(fieldMap)) sums[key]+=integer(row[label]);
  }
  const games=new Set(mine.filter(row=>integer(row['打席'])>0).map(gameKey));
  const avg=sums.AB>0 ? sums.H/sums.AB : null;
  const obpDen=sums.AB+sums.BB+sums.HBP+sums.SF;
  const obp=obpDen>0 ? (sums.H+sums.BB+sums.HBP)/obpDen : null;
  const tb=sums.SINGLE+(2*sums.DOUBLE)+(3*sums.TRIPLE)+(4*sums.HR);
  const slg=sums.AB>0 ? tb/sums.AB : null;
  const ops=obp!==null && slg!==null ? obp+slg : null;
  return {
    name,
    games:games.size,
    batting:{
      PA:String(sums.PA),AB:String(sums.AB),H:String(sums.H),RBI:String(sums.RBI),R:String(sums.R),SO:String(sums.SO),
      BB:String(sums.BB),HBP:String(sums.HBP),SB:String(sums.SB),SAC:String(sums.SAC),SF:String(sums.SF),
      AVG:avg===null?'':three(avg),OBP:obp===null?'':three(obp),SLG:slg===null?'':three(slg),OPS:ops===null?'':three(ops)
    }
  };
}

export async function buildRecentSixBattingEvidence(){
  const tree=await listMagiDriveTree({maxItems:2000,maxDepth:12});
  const file=findBattingDetailFile(tree);
  if(!file) throw new Error(`${BATTING_FILE} がDrive内に見つかりません`);
  const fetched=await fetchDriveFileContent(file);
  const rows=parseCsv(decodeCsv(fetched.buffer)).filter(row=>parseDate(row['開催日']) && text(row['選手名']));
  const games=discoverGames(rows);
  if(!games.length) throw new Error(`${BATTING_FILE} に試合データがありません`);
  const selectedGames=games.slice(-6);
  const selectedKeys=new Set(selectedGames.map(game=>game.key));
  const players=CURRENT_ROSTER.map(name=>aggregatePlayer(name,rows,selectedKeys));
  return {
    status:'COMPLETE',
    source:{
      id:file.id,
      name:file.name,
      path:file.path,
      mimeType:file.mimeType,
      modifiedTime:file.modifiedTime,
      season:'current',
      priority:'RECENT_FORM'
    },
    totalRecordedGames:games.length,
    gameCount:selectedGames.length,
    windowStart:selectedGames[0]?.date||'',
    windowEnd:selectedGames[selectedGames.length-1]?.date||'',
    sameAsCurrentSeasonWindow:games.length<=6,
    games:selectedGames.map(game=>({date:game.date,opponent:game.opponent,order:game.order})),
    players,
    rule:'直近6試合は打撃詳細2026-2027.csvの開催日・試合順・相手校で試合を識別し、最新6試合を集計する。打率・出塁率・長打率・OPSは合計打撃成績から再計算する。'
  };
}
