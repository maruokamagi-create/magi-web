import { createHash } from 'node:crypto';
import pdfParse from 'pdf-parse';
import { fetchDriveFileContent, getDriveFileMetadata, googleDriveFetch } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';
import { evidenceSource } from './_evidence-source-map.js';
import { decodeCsv, parseCsv } from './_recent-batting-form.js';

const APPEARANCE_FILE_ID=process.env.MAGI_CURRENT_APPEARANCE_FILE_ID||evidenceSource('CURRENT_APPEARANCE_DETAIL').id;
const FIELDING_FILE_ID=process.env.MAGI_CURRENT_FIELDING_FILE_ID||evidenceSource('CURRENT_FIELDING_DETAIL').id;
const text=v=>String(v??'').trim();
const SCORE_SOURCE=evidenceSource('CURRENT_SCORE_SHEETS');
const SCORE_FILE_DEFS=Array.isArray(SCORE_SOURCE?.files)?SCORE_SOURCE.files:[];
const SCORE_TEXT_CACHE=new Map();
const SCORE_POSITION_LABEL=Object.freeze({'1':'投','2':'捕','3':'一','4':'二','5':'三','6':'遊','7':'左','8':'中','9':'右',DH:'DH',PH:'PH',PR:'PR'});

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
function appearanceIntegrity(rows){
  const groups=new Map();
  for(const row of rows){
    const date=dateKey(pick(row,['開催日','対戦日','日付']));
    const opponent=opponentName(row),label=gameLabel(row);
    if(!date||!opponent)continue;
    const key=`${date}|${opponent}|${label}`;
    const group=groups.get(key)||{date,opponent,label,rowCount:0,orders:[]};
    group.rowCount+=1;
    const order=numericOrder(row['打順']);
    if(order!==null)group.orders.push(order);
    groups.set(key,group);
  }
  const games=[...groups.values()].map(group=>{
    const unique=[...new Set(group.orders)].sort((a,b)=>a-b);
    const complete=group.orders.length===9&&unique.length===9&&unique.every((v,i)=>v===i+1);
    return {...group,uniqueOrders:unique,complete};
  });
  const incomplete=games.filter(game=>!game.complete);
  return {
    status:games.length>0&&incomplete.length===0?'COMPLETE':'PARTIAL',
    gameCount:games.length,
    completeGameCount:games.length-incomplete.length,
    numericBattingOrderRows:games.reduce((sum,game)=>sum+game.orders.length,0),
    incompleteGames:incomplete.map(({date,opponent,label,rowCount,orders,uniqueOrders})=>({date,opponent,label,rowCount,numericOrderRows:orders.length,uniqueOrders})),
    rule:'出場詳細CSVは各試合で打順1〜9が各1件ずつ存在して初めて、スタメン/途中出場・実打順のEvidenceとしてCOMPLETE扱いする。欠損時は0件起用と解釈せずPARTIALにする。'
  };
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
  const buffer=fetched.buffer;
  return {
    meta,
    digest:createHash('sha256').update(buffer).digest('hex'),
    rows:parseCsv(decodeCsv(buffer)).filter(r=>text(r['選手名']))
  };
}

export async function buildAppearanceFieldingEvidence(){
  const [appearance,fielding]=await Promise.all([
    readCsvById(APPEARANCE_FILE_ID,'出場詳細2026-2027.csv'),
    readCsvById(FIELDING_FILE_ID,'守備詳細2026-2027.csv')
  ]);
  const scoreSheets=await verifyScoreSheetOriginals(appearance.rows);
  const integrity=appearanceIntegrity(appearance.rows);
  const duplicateSourceContent=appearance.meta.id!==fielding.meta.id&&appearance.digest===fielding.digest;
  const appearanceUsable=integrity.status==='COMPLETE'&&!duplicateSourceContent;
  const players=CURRENT_ROSTER.map(name=>({
    name,
    appearance:appearanceUsable
      ? {status:'COMPLETE',...aggregateAppearance(name,appearance.rows)}
      : {status:'UNAVAILABLE',reason:duplicateSourceContent?'DUPLICATE_SOURCE_CONTENT':'INCOMPLETE_BATTING_ORDER_ROWS'},
    fielding:{status:'COMPLETE',...aggregateFielding(name,fielding.rows)}
  }));
  const issues=[];
  if(duplicateSourceContent)issues.push('出場詳細CSVと守備詳細CSVの内容SHA-256が一致しており、別正本として扱えない。');
  if(integrity.status!=='COMPLETE')issues.push(`出場詳細CSVの打順1〜9が揃う試合は ${integrity.completeGameCount}/${integrity.gameCount}。スタメン/途中出場・実打順は未確認扱い。`);
  return {
    status:issues.length?'PARTIAL':'COMPLETE',
    appearanceStatus:appearanceUsable?'COMPLETE':'UNAVAILABLE',
    fieldingStatus:'COMPLETE',
    integrity,
    sourceIntegrity:{
      status:duplicateSourceContent?'SOURCE_MISMATCH':'COMPLETE',
      duplicateSourceContent,
      appearanceDigest:appearance.digest,
      fieldingDigest:fielding.digest
    },
    issues,
    sources:[
      {id:appearance.meta.id,name:appearance.meta.name,mimeType:appearance.meta.mimeType,modifiedTime:appearance.meta.modifiedTime,priority:'PRIMARY_APPEARANCE_DETAIL'},
      {id:fielding.meta.id,name:fielding.meta.name,mimeType:fielding.meta.mimeType,modifiedTime:fielding.meta.modifiedTime,priority:'PRIMARY_FIELDING_DETAIL'}
    ],
    scoreSheets,
    players,
    rule:'出場詳細CSVをスタメン・途中出場・実打順・スタメン守備位置の最優先Evidenceとする。ただし打順1〜9の構造欠損や守備詳細との内容重複を検出した場合はPARTIALとして、0件起用や実打順を推測しない。守備詳細CSVの実守備位置は別系統の実績として利用できるが、壊れた出場詳細の代替としてスタメン/途中出場を推定しない。'
  };
}
