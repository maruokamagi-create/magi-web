import { fetchDriveFileContent, getDriveFileMetadata, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';
import { evidenceSource } from './_evidence-source-map.js';
import { decodeCsv, parseCsv } from './_recent-batting-form.js';

const APPEARANCE_FILE_ID=process.env.MAGI_CURRENT_APPEARANCE_FILE_ID||evidenceSource('CURRENT_APPEARANCE_DETAIL').id;
const FIELDING_FILE_ID=process.env.MAGI_CURRENT_FIELDING_FILE_ID||evidenceSource('CURRENT_FIELDING_DETAIL').id;
const text=v=>String(v??'').trim();
const SCORE_SOURCE=evidenceSource('CURRENT_SCORE_SHEETS');
const SCORE_ROOT='2026-2027_CURRENT_現チーム/02_SCORE_SHEETS_スコアシート/';

function scoreSheetKey(name){
  const m=text(name).normalize('NFKC').match(/^(\d{4})-(\d{2})-(\d{2})_(.+?)_(?:第(\d+)試合_)?(?:[^_]+_)?スコア原本(?:\.pdf)?$/);
  if(!m)return null;
  return {date:`${m[1]}-${m[2]}-${m[3]}`,opponent:m[4],gameNo:m[5]?Number(m[5]):null};
}
function appearanceGameKeys(rows){
  const out=[];
  const seen=new Set();
  for(const r of rows){
    const date=text(r['対戦日']),opponent=text(r['相手']),label=text(r['試合順']);
    if(!date||!opponent)continue;
    const no=Number((label.match(/(\d+)/)||[])[1]||0)||null;
    const k=`${date}|${opponent}|${no||''}`;
    if(seen.has(k))continue; seen.add(k); out.push({date,opponent,gameNo:no,label});
  }
  return out;
}
async function verifyScoreSheetOriginals(appearanceRows){
  const tree=await listMagiDriveTree({maxItems:2500,maxDepth:14,fresh:false});
  const files=tree.filter(x=>text(x.path).includes(SCORE_ROOT)&&/スコア原本(?:\.pdf)?$/i.test(text(x.name))&&text(x.mimeType)==='application/pdf');
  const originals=files.map(file=>({file,key:scoreSheetKey(file.name)})).filter(x=>x.key);
  const games=appearanceGameKeys(appearanceRows);
  const verified=[],unmatched=[];
  for(const game of games){
    const candidates=originals.filter(x=>x.key.date===game.date&&text(x.key.opponent)===game.opponent);
    const exact=candidates.find(x=>x.key.gameNo===game.gameNo)||(!game.gameNo&&candidates.length===1?candidates[0]:null);
    if(exact)verified.push({game,source:exact.file}); else unmatched.push(game);
  }
  return {
    status:unmatched.length?'PARTIAL':'COMPLETE',
    sourceSet:{folderId:SCORE_SOURCE.folderId,officialFolderId:SCORE_SOURCE.officialFolderId,practiceFolderId:SCORE_SOURCE.practiceFolderId,authority:SCORE_SOURCE.authority,independentVote:false},
    originalCount:originals.length,appearanceGameCount:games.length,verifiedCount:verified.length,
    unmatched,
    sources:originals.map(x=>({id:x.file.id,name:x.file.name,path:x.file.path,mimeType:x.file.mimeType,modifiedTime:x.file.modifiedTime,priority:'PRIMARY_SCORE_SHEET_VERIFICATION'})),
    rule:'スコア原本は出場詳細CSVと試合結果の一次照合資料。CSVとPDFを同じ試合の独立Evidenceとして二重加点しない。日付・対戦相手・試合番号で対応確認し、不一致は推測で補完しない。'
  };
}

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
  const scoreSheets=await verifyScoreSheetOriginals(appearance.rows);
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
    scoreSheets,
    players,
    rule:'出場詳細CSVをスタメン・途中出場・実打順・スタメン守備位置の最優先Evidenceとする。打順1〜9の行をスタメン、打順空欄を途中出場として扱い、投手表示用のP行は重複出場として数えない。守備詳細CSVは実際に守った守備位置の補助Evidenceとし、「>」で連結された守備位置は各位置の実績として数える。'
  };
}
