import { fetchDriveFileContent, getDriveFileMetadata, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';
import { evidenceSource } from './_evidence-source-map.js';
import { decodeCsv, parseCsv } from './_recent-batting-form.js';

const APPEARANCE_FILE_ID=process.env.MAGI_CURRENT_APPEARANCE_FILE_ID||evidenceSource('CURRENT_APPEARANCE_DETAIL').id;
const FIELDING_FILE_ID=process.env.MAGI_CURRENT_FIELDING_FILE_ID||evidenceSource('CURRENT_FIELDING_DETAIL').id;
const text=v=>String(v??'').trim();
const SCORE_SOURCE=evidenceSource('CURRENT_SCORE_SHEETS');
const SCORE_ROOT='2026-2027_CURRENT_現チーム/02_SCORE_SHEETS_スコアシート/';

function pick(row,names){for(const name of names){const value=text(row?.[name]);if(value)return value;}return'';}
function dateKey(value){
  const m=text(value).normalize('NFKC').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  return m?`${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`:'';
}
function competitionType(row){
  const value=pick(row,['大会名','試合種別','区分']);
  if(/公式戦/.test(value))return'OFFICIAL';
  if(/練習試合/.test(value))return'PRACTICE';
  return'UNKNOWN';
}
function opponentName(row){return pick(row,['相手校','相手','対戦相手']);}
function gameLabel(row){return pick(row,['試合順','試合','試合番号']);}
function practiceGameNumber(row){
  if(competitionType(row)!=='PRACTICE')return null;
  const m=gameLabel(row).normalize('NFKC').match(/第\s*(\d+)\s*試合/);
  return m?Number(m[1]):null;
}
function scoreCategory(file){
  const path=text(file?.path);
  if(path.includes('OFFICIAL_公式戦'))return'OFFICIAL';
  if(path.includes('PRACTICE_練習試合'))return'PRACTICE';
  return'UNKNOWN';
}
function scoreSheetKey(file){
  const name=text(file?.name).normalize('NFKC').replace(/\.pdf$/i,'');
  const m=name.match(/^(\d{4})-(\d{2})-(\d{2})_(.+)_スコア原本$/);
  if(!m)return null;
  const category=scoreCategory(file);
  const parts=m[4].split('_').map(text).filter(Boolean);
  if(!parts.length)return null;
  let opponent='',gameNo=null,stage='';
  if(category==='PRACTICE'){
    const last=parts[parts.length-1];
    const gm=last.match(/^第\s*(\d+)\s*試合$/);
    if(gm){gameNo=Number(gm[1]);opponent=parts.slice(0,-1).join('_');stage=last;}
    else opponent=parts.join('_');
  }else if(category==='OFFICIAL'){
    stage=parts.length>1?parts[parts.length-1]:'';
    opponent=parts.length>1?parts.slice(0,-1).join('_'):parts[0];
  }else opponent=parts.join('_');
  return {date:`${m[1]}-${m[2]}-${m[3]}`,opponent,gameNo,stage,category};
}
function appearanceGameKeys(rows){
  const out=[];const seen=new Set();
  for(const row of rows){
    const date=dateKey(pick(row,['開催日','対戦日','日付']));
    const opponent=opponentName(row),label=gameLabel(row),category=competitionType(row);
    if(!date||!opponent)continue;
    const gameNo=practiceGameNumber(row);
    const stage=category==='OFFICIAL'?label:'';
    const key=`${date}|${category}|${opponent}|${gameNo??''}|${stage}`;
    if(seen.has(key))continue;
    seen.add(key);out.push({date,opponent,gameNo,label,stage,category});
  }
  return out;
}
function sameIdentity(a,b){
  if(a.date!==b.date||a.category!==b.category)return false;
  if(a.category==='PRACTICE')return a.gameNo!==null&&a.gameNo===b.gameNo;
  if(a.category==='OFFICIAL')return !a.stage||!b.stage||a.stage===b.stage;
  return true;
}
async function verifyScoreSheetOriginals(appearanceRows){
  const tree=await listMagiDriveTree({maxItems:2500,maxDepth:14,fresh:false});
  const files=tree.filter(x=>text(x.path).includes(SCORE_ROOT)&&/スコア原本(?:\.pdf)?$/i.test(text(x.name))&&text(x.mimeType)==='application/pdf');
  const originals=files.map(file=>({file,key:scoreSheetKey(file)})).filter(x=>x.key);
  const games=appearanceGameKeys(appearanceRows);
  const verified=[],sourceMismatches=[],unverified=[];
  for(const game of games){
    const sameGame=originals.filter(x=>sameIdentity(game,x.key));
    const exact=sameGame.find(x=>text(x.key.opponent)===text(game.opponent));
    if(exact){
      verified.push({game,source:exact.file});
      continue;
    }
    if(sameGame.length){
      sourceMismatches.push({
        game,
        reason:'SOURCE_MISMATCH_OPPONENT',
        candidates:sameGame.map(x=>({id:x.file.id,name:x.file.name,path:x.file.path,opponent:x.key.opponent}))
      });
      continue;
    }
    unverified.push({...game,reason:'UNVERIFIED_SCORE_SHEET'});
  }
  const status=(sourceMismatches.length||unverified.length)?'PARTIAL':'COMPLETE';
  return {
    status,
    sourceSet:{folderId:SCORE_SOURCE.folderId,officialFolderId:SCORE_SOURCE.officialFolderId,practiceFolderId:SCORE_SOURCE.practiceFolderId,authority:SCORE_SOURCE.authority,independentVote:false},
    originalCount:originals.length,
    officialOriginalCount:originals.filter(x=>x.key.category==='OFFICIAL').length,
    practiceOriginalCount:originals.filter(x=>x.key.category==='PRACTICE').length,
    appearanceGameCount:games.length,
    verifiedCount:verified.length,
    sourceMismatchCount:sourceMismatches.length,
    unverifiedCount:unverified.length,
    verified:verified.map(x=>({game:x.game,source:{id:x.source.id,name:x.source.name,path:x.source.path}})),
    sourceMismatches,
    unverified,
    sources:originals.map(x=>({id:x.file.id,name:x.file.name,path:x.file.path,mimeType:x.file.mimeType,modifiedTime:x.file.modifiedTime,category:x.key.category,priority:'PRIMARY_SCORE_SHEET_VERIFICATION'})),
    rule:'スコア原本は出場詳細CSVと試合結果の一次照合資料。CSVとPDFを同じ試合の独立Evidenceとして二重加点しない。開催日・公式戦/練習試合・対戦相手・公式戦ラウンドまたは練習試合番号で対応確認し、不一致はSOURCE_MISMATCH/UNVERIFIEDとして残して推測で補完しない。'
  };
}

function numericOrder(v){const n=Number(text(v));return Number.isInteger(n)&&n>=1&&n<=9?n:null;}
function countMap(values){const out={};for(const v of values){const k=text(v);if(k)out[k]=(out[k]||0)+1;}return out;}
function positionTokens(v){return text(v).split('>').map(x=>x.trim()).filter(Boolean);}
function startingPosition(v){return positionTokens(v)[0]||'';}

function aggregateAppearance(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  const starts=mine.filter(r=>numericOrder(r['打順'])!==null);
  const substitutions=mine.filter(r=>numericOrder(r['打順'])===null && text(r['打順']).toUpperCase()!=='P');
  const officialStarts=starts.filter(r=>competitionType(r)==='OFFICIAL');
  const practiceStarts=starts.filter(r=>competitionType(r)==='PRACTICE');
  const practiceFirstStarts=practiceStarts.filter(r=>{const n=practiceGameNumber(r);return n!==null&&n%2===1;});
  const practiceSecondStarts=practiceStarts.filter(r=>{const n=practiceGameNumber(r);return n!==null&&n%2===0;});
  return {
    starts:starts.length,
    substitutions:substitutions.length,
    officialStarts:officialStarts.length,
    practiceStarts:practiceStarts.length,
    practiceFirstStarts:practiceFirstStarts.length,
    practiceSecondStarts:practiceSecondStarts.length,
    battingOrders:countMap(starts.map(r=>String(numericOrder(r['打順'])))),
    startingPositions:countMap(starts.map(r=>startingPosition(r['守備位置']))),
    officialStartingPositions:countMap(officialStarts.map(r=>startingPosition(r['守備位置']))),
    practiceFirstStartingPositions:countMap(practiceFirstStarts.map(r=>startingPosition(r['守備位置']))),
    practiceSecondStartingPositions:countMap(practiceSecondStarts.map(r=>startingPosition(r['守備位置']))),
    recentStartingPositions:countMap(starts.slice(-6).map(r=>startingPosition(r['守備位置']))),
    latestStarts:starts.slice(-6).map(r=>({
      game:gameLabel(r),
      date:dateKey(pick(r,['開催日','対戦日','日付'])),
      opponent:opponentName(r),
      competitionType:competitionType(r),
      practiceRole:competitionType(r)==='PRACTICE'?(practiceGameNumber(r)%2===1?'REGULAR_GAME_1':'CHALLENGE_GAME_2'):'',
      order:numericOrder(r['打順']),
      position:text(r['守備位置'])
    }))
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
    rule:'出場詳細CSVをスタメン・途中出場・実打順・スタメン守備位置の最優先Evidenceとする。公式戦と練習試合を大会名で分離し、練習試合だけ第1試合（奇数＝公式戦想定のレギュラー起用）と第2試合（偶数＝チャレンジ起用）を分ける。打順1〜9の行をスタメン、打順空欄を途中出場として扱い、投手表示用のP行は重複出場として数えない。守備位置が「遊>投」のように連結される場合、スタメン守備位置は先頭の位置だけを採用し、その後の守備移動は守備詳細CSVの実守備実績として別に数える。'
  };
}
