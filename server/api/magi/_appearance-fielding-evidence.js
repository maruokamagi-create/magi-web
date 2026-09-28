import { fetchDriveFileContent, getDriveFileMetadata } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';
import { decodeCsv, parseCsv } from './_recent-batting-form.js';

const APPEARANCE_FILE_ID=process.env.MAGI_CURRENT_APPEARANCE_FILE_ID||'1qjCyNhl49x7DYwa6FajUsvQJ1DkSLx5V';
const FIELDING_FILE_ID=process.env.MAGI_CURRENT_FIELDING_FILE_ID||'1gYLconGQoYjFf4JMFL6o5J8P8hcPjQ2Z';
const text=v=>String(v??'').trim();

function numericOrder(v){const n=Number(text(v));return Number.isInteger(n)&&n>=1&&n<=9?n:null;}
function countMap(values){const out={};for(const v of values){const k=text(v);if(k)out[k]=(out[k]||0)+1;}return out;}
function positionTokens(v){return text(v).split('>').map(x=>x.trim()).filter(Boolean);}

function aggregateAppearance(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  const starts=mine.filter(r=>numericOrder(r['打順'])!==null);
  const substitutions=mine.filter(r=>numericOrder(r['打順'])===null && text(r['打順']).toUpperCase()!=='P');
  return {
    starts:starts.length,
    substitutions:substitutions.length,
    battingOrders:countMap(starts.map(r=>String(numericOrder(r['打順'])))),
    startingPositions:countMap(starts.map(r=>r['守備位置'])),
    latestStarts:starts.slice(-6).map(r=>({game:text(r['試合順']),date:text(r['対戦日']),opponent:text(r['相手']),order:numericOrder(r['打順']),position:text(r['守備位置'])}))
  };
}

function aggregateFielding(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  const positions=[];
  for(const r of mine)positions.push(...positionTokens(r['守備位置']));
  return {games:mine.length,positions:countMap(positions)};
}

async function readCsvById(id,expectedName){
  const meta=await getDriveFileMetadata(id);
  if(text(meta.name)!==expectedName)throw new Error(`Drive ID ${id} のファイル名が想定と異なります: ${text(meta.name)}`);
  const fetched=await fetchDriveFileContent(meta);
  return {meta,rows:parseCsv(decodeCsv(fetched.buffer)).filter(r=>text(r['選手名']))};
}

export async function buildAppearanceFieldingEvidence(){
  const [appearance,fielding]=await Promise.all([
    readCsvById(APPEARANCE_FILE_ID,'出場詳細2026-2027.csv'),
    readCsvById(FIELDING_FILE_ID,'守備詳細2026-2027.csv')
  ]);
  const players=CURRENT_ROSTER.map(name=>({
    name,
    appearance:aggregateAppearance(name,appearance.rows),
    fielding:aggregateFielding(name,fielding.rows)
  }));
  return {
    status:'COMPLETE',
    sources:[
      {id:appearance.meta.id,name:appearance.meta.name,mimeType:appearance.meta.mimeType,modifiedTime:appearance.meta.modifiedTime,priority:'PRIMARY_APPEARANCE_DETAIL'},
      {id:fielding.meta.id,name:fielding.meta.name,mimeType:fielding.meta.mimeType,modifiedTime:fielding.meta.modifiedTime,priority:'PRIMARY_FIELDING_DETAIL'}
    ],
    players,
    rule:'出場詳細CSVをスタメン・途中出場・実打順・スタメン守備位置の最優先Evidenceとする。打順1〜9の行をスタメン、打順空欄を途中出場として扱い、投手表示用のP行は重複出場として数えない。守備詳細CSVは実際に守った守備位置の補助Evidenceとし、「>」で連結された守備位置は各位置の実績として数える。'
  };
}
