import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../server/api/drive/_service.js';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';

export const config = { maxDuration: 60 };

const CURRENT_TOKEN='2026-2027_CURRENT_現チーム';
const STATS_TOKEN='03_STATS_成績データ';
const MASTER_TOKEN='00_MASTER_正本';

const BATTING_FIELDS={
  PA:['打席','打席数'],
  AB:['打数'],
  H:['安打'],
  AVG:['打率','AVG'],
  OBP:['出塁率'],
  SLG:['長打率'],
  OPS:['OPS'],
  RBI:['打点'],
  RISP:['得点圏打率','得点圏'],
  BB:['四球'],
  HBP:['死球'],
  SB:['盗塁'],
  SAC:['犠打'],
  SF:['犠飛']
};
const INTEGER_FIELDS=new Set(['PA','AB','H','RBI','BB','HBP','SB','SAC','SF']);

const norm=v=>String(v??'').replace(/[\s　]+/g,'').trim();
const text=v=>String(v??'').trim();

function isFormulaError(value){
  return /^#(?:NAME\?|REF!|VALUE!|DIV\/0!|N\/A|NUM!|NULL!)/i.test(text(value));
}

function toInt(value){
  if(value===null||value===undefined||value===''||isFormulaError(value))return null;
  const n=Number(text(value).replace(/,/g,''));
  return Number.isFinite(n)?Math.trunc(n):null;
}

function displayDecimal(value){
  const s=text(value);
  if(!s||isFormulaError(s))return '';
  const n=Number(s.replace(/,/g,''));
  if(!Number.isFinite(n))return '';
  if(Math.abs(n)<1&&n!==0)return n.toFixed(3).replace(/^0/,'').replace(/-0\./,'-.');
  return String(n);
}

function headerIndexAliases(row,aliases){
  for(const alias of aliases){
    const exact=row.findIndex(cell=>norm(cell)===norm(alias));
    if(exact>=0)return exact;
  }
  for(const alias of aliases){
    const partial=row.findIndex(cell=>norm(cell).includes(norm(alias)));
    if(partial>=0)return partial;
  }
  return -1;
}

function allRows(buffer){
  const workbook=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellText:true,cellDates:false});
  return workbook.SheetNames.map(sheetName=>({
    sheetName,
    rows:XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,raw:false,defval:''})
      .map(r=>Array.isArray(r)?r.map(v=>text(v)):[])
  }));
}

function findMaster(tree){
  const candidates=(tree||[]).filter(file=>{
    const name=text(file?.name);
    const path=text(file?.path);
    return /\.xlsm$/i.test(name)&&path.includes(CURRENT_TOKEN)&&path.includes(STATS_TOKEN)&&path.includes(MASTER_TOKEN);
  });
  if(candidates.length!==1)throw new Error(`2026-2027現チームの00_MASTER_正本XLSMを一意に特定できませんでした (${candidates.length})`);
  return candidates[0];
}

function findAppearanceGames(sheets,playerName){
  const target=norm(playerName);
  const sheet=sheets.find(item=>norm(item.sheetName)===norm('出場試合数'));
  if(!sheet)return null;
  const rows=sheet.rows||[];
  for(let h=0;h<rows.length;h++){
    const header=rows[h]||[];
    const playerCol=headerIndexAliases(header,['選手名']);
    const gamesCol=headerIndexAliases(header,['出場数','試合数']);
    if(playerCol<0||gamesCol<0)continue;
    for(let i=h+1;i<rows.length;i++){
      const row=rows[i]||[];
      if(norm(row[playerCol])!==target)continue;
      const games=toInt(row[gamesCol]);
      return games===null?null:{games,sheetName:sheet.sheetName,row:i+1,headerRow:h+1};
    }
  }
  return null;
}

function sheetPriority(sheetName){
  const n=norm(sheetName);
  if(n===norm('打撃一覧'))return 1000;
  if(n===norm('年末用打撃一覧'))return 900;
  if(n.startsWith(norm('打撃一覧')))return 800;
  if(n.includes(norm('打撃')))return 400;
  return 0;
}

function readBattingFields(header,row){
  const stats={};
  for(const [key,aliases] of Object.entries(BATTING_FIELDS)){
    const col=headerIndexAliases(header,aliases);
    if(col<0)continue;
    const raw=row[col];
    if(INTEGER_FIELDS.has(key)){
      const value=toInt(raw);
      if(value!==null)stats[key]=value;
    }else{
      const value=displayDecimal(raw);
      if(value!=='')stats[key]=value;
    }
  }
  return stats;
}

function findBatting(sheets,playerName){
  const target=norm(playerName);
  const ranked=[...sheets].sort((a,b)=>sheetPriority(b.sheetName)-sheetPriority(a.sheetName));
  const candidates=[];
  for(const {sheetName,rows} of ranked){
    const priority=sheetPriority(sheetName);
    if(priority<=0)continue;
    for(let h=0;h<rows.length;h++){
      const header=rows[h]||[];
      const playerCol=headerIndexAliases(header,['選手名']);
      const core=['打率','打数','安打','OPS'].map(label=>headerIndexAliases(header,[label]));
      if(playerCol<0||core.filter(i=>i>=0).length<3)continue;
      for(let i=h+1;i<rows.length;i++){
        const row=rows[i]||[];
        if(norm(row[playerCol])!==target)continue;
        const stats=readBattingFields(header,row);
        const completeness=Object.keys(stats).length;
        if(!(stats.AB!==undefined||stats.H!==undefined||stats.AVG||stats.OPS))continue;
        candidates.push({stats,sheetName,row:i+1,headerRow:h+1,priority,completeness});
      }
    }
  }
  candidates.sort((a,b)=>(b.priority-a.priority)||(b.completeness-a.completeness)||(a.row-b.row));
  return candidates[0]||null;
}

function findBattingSupplement(sheets,playerName){
  const target=norm(playerName);
  const preferred=sheets.find(item=>norm(item.sheetName)===norm('得点圏打率一覧'));
  if(!preferred)return null;
  const rows=preferred.rows||[];
  for(let h=0;h<rows.length;h++){
    const header=rows[h]||[];
    const playerCol=headerIndexAliases(header,['選手名','選手']);
    if(playerCol<0)continue;
    for(let i=h+1;i<rows.length;i++){
      const row=rows[i]||[];
      if(norm(row[playerCol])!==target)continue;
      return {stats:readBattingFields(header,row),sheetName:preferred.sheetName,row:i+1,headerRow:h+1};
    }
  }
  return null;
}

function mergeMissing(primary,supplement){
  const out={...(primary||{})};
  for(const [key,value] of Object.entries(supplement||{})){
    if(out[key]===undefined||out[key]===null||out[key]==='')out[key]=value;
  }
  return out;
}

function derivedPlateAppearances(stats){
  if(Number.isInteger(stats.PA))return stats.PA;
  const parts=['AB','BB','HBP','SAC','SF'].map(key=>stats[key]);
  if(parts.every(Number.isInteger))return parts.reduce((sum,value)=>sum+value,0);
  return null;
}

function combinedWalksHbp(stats){
  if(Number.isInteger(stats.BB)&&Number.isInteger(stats.HBP))return stats.BB+stats.HBP;
  return null;
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.statusCode=405;
    res.setHeader('Allow','GET');
    return res.end(JSON.stringify({ok:false,error:'Method not allowed'}));
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, max-age=60');
  try{
    const tree=await listMagiDriveTree({fresh:true,maxItems:2000,maxDepth:12});
    const file=findMaster(tree);
    const fetched=await fetchDriveFileContent(file);
    const sheets=allRows(fetched.buffer);
    const players=CURRENT_ROSTER.map(name=>{
      const appearance=findAppearanceGames(sheets,name);
      const batting=findBatting(sheets,name);
      const supplement=findBattingSupplement(sheets,name);
      const b=mergeMissing(batting?.stats||{},supplement?.stats||{});
      const PA=derivedPlateAppearances(b);
      const BBHBP=combinedWalksHbp(b);
      return {
        name,
        games:appearance?.games??null,
        PA,
        AB:b.AB??null,
        H:b.H??null,
        AVG:b.AVG??'',
        OBP:b.OBP??'',
        SLG:b.SLG??'',
        OPS:b.OPS??'',
        RISP:b.RISP??'',
        RBI:b.RBI??null,
        BB:b.BB??null,
        HBP:b.HBP??null,
        BBHBP,
        SB:b.SB??null
      };
    });
    res.statusCode=200;
    return res.end(JSON.stringify({
      ok:true,
      season:'2026-2027',
      authoritativeSource:'XLSM_MASTER',
      source:{name:file.name,path:file.path,modifiedTime:file.modifiedTime||''},
      players
    }));
  }catch(error){
    console.error('[lineup-batting-stats]',error?.message||error);
    res.statusCode=500;
    return res.end(JSON.stringify({ok:false,error:'Current batting stats unavailable'}));
  }
}