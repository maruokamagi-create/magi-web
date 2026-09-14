import { fetchDriveFileContent, listMagiDriveTree } from '../server/api/drive/_service.js';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';

export const config = { maxDuration: 60 };

const CURRENT_TOKEN='2026-2027_CURRENT_現チーム';
const STATS_TOKEN='03_STATS_成績データ';
const DETAIL_TOKEN='10_DETAIL_詳細データ';
const BATTING_FILE='打撃詳細2026-2027.csv';

const text=v=>String(v??'').trim();
const num=v=>{const n=Number(text(v).replace(/,/g,''));return Number.isFinite(n)?n:0};
const int=v=>Math.trunc(num(v));
const rate=v=>Number.isFinite(v)?v.toFixed(3).replace(/^0/,''):'';

function decodeCsv(buffer){
  const utf8=Buffer.from(buffer).toString('utf8');
  const bad=(utf8.match(/\uFFFD/g)||[]).length;
  if(bad===0&&/開催日/.test(utf8)&&/選手名/.test(utf8))return utf8;
  return new TextDecoder('shift_jis').decode(buffer);
}

function parseCsv(source){
  const raw=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'){
        if(source[i+1]==='"'){cell+='"';i++;}else quoted=false;
      }else cell+=ch;
      continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===','){row.push(cell);cell='';continue;}
    if(ch==='\n'){row.push(cell.replace(/\r$/,''));raw.push(row);row=[];cell='';continue;}
    cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));raw.push(row);}
  const header=(raw.shift()||[]).map(text);
  return raw.map(values=>Object.fromEntries(header.map((key,index)=>[key,text(values[index])])));
}

function findFile(tree){
  const files=(tree||[]).filter(f=>text(f?.name)===BATTING_FILE);
  return files.find(f=>{const p=text(f?.path);return p.includes(CURRENT_TOKEN)&&p.includes(STATS_TOKEN)&&p.includes(DETAIL_TOKEN);})
    ||files.find(f=>text(f?.path).includes(CURRENT_TOKEN))||files[0]||null;
}

function gameKey(r){return `${text(r['開催日'])}|${text(r['試合順'])}|${text(r['相手校'])}`;}

function aggregate(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  const sums={PA:0,AB:0,H:0,SINGLE:0,DOUBLE:0,TRIPLE:0,HR:0,BB:0,HBP:0,SF:0,RBI:0};
  const map={PA:'打席',AB:'打数',H:'安打',SINGLE:'単打',DOUBLE:'二塁打',TRIPLE:'三塁打',HR:'本塁打',BB:'四球',HBP:'死球',SF:'犠飛',RBI:'打点'};
  for(const r of mine)for(const [k,label] of Object.entries(map))sums[k]+=int(r[label]);
  const games=new Set(mine.filter(r=>int(r['打席'])>0).map(gameKey));
  const avg=sums.AB>0?sums.H/sums.AB:null;
  const obpDen=sums.AB+sums.BB+sums.HBP+sums.SF;
  const obp=obpDen>0?(sums.H+sums.BB+sums.HBP)/obpDen:null;
  const tb=sums.SINGLE+2*sums.DOUBLE+3*sums.TRIPLE+4*sums.HR;
  const slg=sums.AB>0?tb/sums.AB:null;
  const ops=obp!==null&&slg!==null?obp+slg:null;
  return {name,games:games.size,AB:sums.AB,H:sums.H,AVG:rate(avg),OBP:rate(obp),OPS:rate(ops),RBI:sums.RBI};
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.statusCode=405;res.setHeader('Allow','GET');
    return res.end(JSON.stringify({ok:false,error:'Method not allowed'}));
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, max-age=60');
  try{
    const tree=await listMagiDriveTree({maxItems:2000,maxDepth:12});
    const file=findFile(tree);
    if(!file){res.statusCode=404;return res.end(JSON.stringify({ok:false,error:`${BATTING_FILE} not found`}));}
    const fetched=await fetchDriveFileContent(file);
    const rows=parseCsv(decodeCsv(fetched.buffer)).filter(r=>text(r['開催日'])&&text(r['選手名']));
    const players=CURRENT_ROSTER.map(name=>aggregate(name,rows));
    res.statusCode=200;
    return res.end(JSON.stringify({ok:true,season:'2026-2027',source:{name:file.name,modifiedTime:file.modifiedTime||''},players}));
  }catch(error){
    console.error('[lineup-batting-stats]',error?.message||error);
    res.statusCode=500;
    return res.end(JSON.stringify({ok:false,error:'Current batting stats unavailable'}));
  }
}
