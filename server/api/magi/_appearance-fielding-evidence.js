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
let SCORE_ORIGINALS_PROMISE=null;
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
function escapeRegExp(value){return String(value??'').replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');}
const SCORE_ROSTER_PATTERN=[...CURRENT_ROSTER].sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|');
const SCORE_STARTER_RE=new RegExp('((?:[1-9]|DH)(?:\\.(?:[1-9]|DH))*)\\s+先\\s+('+SCORE_ROSTER_PATTERN+')(?=\\s|$)','g');

function scoreKeyFromDef(def){
  return {
    date:text(def?.date),
    opponent:text(def?.opponent),
    gameNo:Number.isInteger(def?.gameNo)?def.gameNo:null,
    stage:text(def?.stage),
    label:text(def?.label),
    category:text(def?.category)
  };
}
function scoreIdentityKey(value){
  const category=text(value?.category);
  if(category==='PRACTICE')return text(value?.date)+'|PRACTICE|'+String(Number(value?.gameNo)||0);
  if(category==='OFFICIAL')return text(value?.date)+'|OFFICIAL|'+text(value?.stage||value?.label);
  return text(value?.date)+'|UNKNOWN|'+text(value?.label);
}
function scorePositionPath(raw){
  return text(raw).split('.').map(code=>SCORE_POSITION_LABEL[code]||code).filter(Boolean).join(' > ');
}
function scoreSourcePath(meta,def){
  const category=def?.category==='OFFICIAL'?'OFFICIAL_公式戦':'PRACTICE_練習試合';
  return 'CANONICAL_SCORE_SHEETS/'+category+'/'+text(meta?.name);
}
async function loadCanonicalScoreSheetOriginals(){
  if(SCORE_FILE_DEFS.length!==11)throw new Error('canonical_score_sheet_count_mismatch:'+SCORE_FILE_DEFS.length);
  if(SCORE_ORIGINALS_PROMISE)return SCORE_ORIGINALS_PROMISE;
  SCORE_ORIGINALS_PROMISE=Promise.all(SCORE_FILE_DEFS.map(async def=>{
    const meta=await getDriveFileMetadata(def.id);
    if(text(meta.mimeType)!=='application/pdf')throw new Error('score_sheet_mime_mismatch:'+def.id+':'+text(meta.mimeType));
    const actual=text(meta.name).normalize('NFKC').replace(/\.pdf$/i,'');
    const expected=def.date+'_'+def.opponent+'_'+def.label+'_スコア原本';
    if(actual!==expected)throw new Error('score_sheet_name_mismatch:'+def.id+':'+actual);
    return {def,key:scoreKeyFromDef(def),file:{...meta,path:scoreSourcePath(meta,def)}};
  }));
  try{return await SCORE_ORIGINALS_PROMISE;}catch(error){SCORE_ORIGINALS_PROMISE=null;throw error;}
}
async function scoreSheetText(original){
  const meta=original?.file||{};
  const cacheKey=String(meta.id)+'|'+String(meta.modifiedTime||'')+'|'+String(meta.size||'');
  const cached=SCORE_TEXT_CACHE.get(cacheKey);
  if(cached)return await cached;
  const task=(async()=>{
    const response=await googleDriveFetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(meta.id)+'?alt=media&supportsAllDrives=true');
    if(!response.ok)throw new Error('score_sheet_fetch_failed:'+meta.id+':'+response.status);
    const buffer=Buffer.from(await response.arrayBuffer());
    const parsed=await pdfParse(buffer);
    const body=String(parsed?.text||'').normalize('NFKC');
    if(!body.includes('丸岡中'))throw new Error('score_sheet_team_text_missing:'+meta.id);
    return body;
  })();
  SCORE_TEXT_CACHE.set(cacheKey,task);
  if(SCORE_TEXT_CACHE.size>16)SCORE_TEXT_CACHE.delete(SCORE_TEXT_CACHE.keys().next().value);
  try{return await task;}catch(error){SCORE_TEXT_CACHE.delete(cacheKey);throw error;}
}
function scoreStarterMatches(body){
  const matches=[];
  SCORE_STARTER_RE.lastIndex=0;
  let match;
  while((match=SCORE_STARTER_RE.exec(body))){
    matches.push({rawPosition:match[1],name:match[2],index:match.index,end:SCORE_STARTER_RE.lastIndex});
  }
  return matches;
}
function fieldingRowsByGame(rows){
  const map=new Map();
  for(const row of rows){
    const date=dateKey(pick(row,['開催日','対戦日','日付']));
    const category=competitionType(row),label=gameLabel(row);
    if(!date||category==='UNKNOWN')continue;
    const gameNo=practiceGameNumber(row);
    const key=scoreIdentityKey({date,category,gameNo,stage:category==='OFFICIAL'?label:'',label});
    const list=map.get(key)||[];
    list.push(row);
    map.set(key,list);
  }
  return map;
}
async function recoverAppearanceFromScoreSheets(originals,fieldingRows){
  const fieldingGames=fieldingRowsByGame(fieldingRows);
  const games=await Promise.all(originals.map(async original=>{
    const body=await scoreSheetText(original);
    const starters=scoreStarterMatches(body);
    const batting=starters.slice(0,9);
    const battingNames=batting.map(x=>x.name);
    const hasDh=batting.some(x=>x.rawPosition.split('.')[0]==='DH');
    const defenseOnly=hasDh&&starters[9]&&starters[9].rawPosition.split('.')[0]==='1'?starters[9]:null;
    const game={...original.key,label:original.key.label||original.key.stage||''};
    const starterRows=batting.map((entry,index)=>({
      開催日:game.date,
      大会名:game.category==='OFFICIAL'?'【公式戦】スコア原本復旧':'【練習試合】スコア原本復旧',
      試合順:game.label,
      相手校:game.opponent,
      打順:String(index+1),
      選手名:entry.name,
      守備位置:scorePositionPath(entry.rawPosition),
      _recoveryRole:'BATTING_STARTER'
    }));
    if(defenseOnly){
      starterRows.push({
        開催日:game.date,
        大会名:game.category==='OFFICIAL'?'【公式戦】スコア原本復旧':'【練習試合】スコア原本復旧',
        試合順:game.label,
        相手校:game.opponent,
        打順:'P',
        選手名:defenseOnly.name,
        守備位置:scorePositionPath(defenseOnly.rawPosition),
        _recoveryRole:'DEFENSE_ONLY_STARTER'
      });
    }

    const actualFieldingRows=fieldingGames.get(scoreIdentityKey(game))||[];
    const fieldingParticipants=new Set(actualFieldingRows.map(row=>text(row['選手名'])).filter(Boolean));
    const starterParticipants=new Set(starterRows.map(row=>text(row['選手名'])).filter(Boolean));
    const substitutions=[];
    const seenSubstitutions=new Set();
    for(const row of actualFieldingRows){
      const name=text(row['選手名']);
      if(!name||starterParticipants.has(name)||seenSubstitutions.has(name))continue;
      seenSubstitutions.add(name);
      substitutions.push({
        開催日:game.date,
        大会名:game.category==='OFFICIAL'?'【公式戦】スコア原本復旧':'【練習試合】スコア原本復旧',
        試合順:game.label,
        相手校:game.opponent,
        打順:'',
        選手名:name,
        守備位置:text(row['守備位置']),
        _recoveryRole:'SUBSTITUTE_FROM_FIELDING_DETAIL'
      });
    }

    const rows=[...starterRows,...substitutions];
    const battingComplete=batting.length===9&&new Set(battingNames).size===9&&battingNames.every(name=>CURRENT_ROSTER.includes(name));
    const startersSupported=starterParticipants.size>0&&[...starterParticipants].every(name=>fieldingParticipants.has(name));
    const participantCoverage=fieldingParticipants.size>0&&rows.length===fieldingParticipants.size;
    return {
      game,
      rows,
      battingComplete,
      startersSupported,
      participantCoverage,
      battingNames,
      defenseOnlyStarter:defenseOnly?.name||'',
      substitutionNames:substitutions.map(row=>row['選手名']),
      recoveredParticipantCount:rows.length,
      fieldingParticipantCount:fieldingParticipants.size
    };
  }));
  const rows=games.flatMap(game=>game.rows);
  const complete=games.length===11&&games.every(game=>game.battingComplete&&game.startersSupported&&game.participantCoverage);
  return {
    status:complete?'COMPLETE':'PARTIAL',
    rows,
    games:games.map(({rows:ignored,...game})=>game),
    gameCount:games.length,
    completeGameCount:games.filter(game=>game.battingComplete&&game.startersSupported&&game.participantCoverage).length,
    rule:'出場詳細CSVが構造破損または守備詳細CSVとの同一内容化で利用不能な場合だけ、登録済み11試合のスコア原本PDFから先発打順・先発守備を復旧する。途中出場は、守備詳細CSVでその試合に実出場した全選手からスコア原本で確定した先発選手を除いた差集合として確定する。先発全員が守備詳細CSVの実出場集合に存在し、復旧後の全参加選手数が一致した試合だけCOMPLETE扱いする。PDFとCSVを独立票として二重加点しない。'
  };
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
async function verifyScoreSheetOriginals(appearanceRows,originals){
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
    recoveryUsed:false,
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
    sources:originals.map(x=>({id:x.file.id,name:x.file.name,path:x.file.path,mimeType:x.file.mimeType,modifiedTime:x.file.modifiedTime,category:x.key.category,priority:'PRIMARY_SCORE_SHEET_VERIFICATION',independentVote:false})),
    rule:'スコア原本は出場詳細CSVと試合結果の一次照合資料。CSVとPDFを同じ試合の独立Evidenceとして二重加点しない。開催日・公式戦/練習試合・対戦相手・公式戦ラウンドまたは練習試合番号で対応確認し、不一致はSOURCE_MISMATCH/UNVERIFIEDとして残して推測で補完しない。'
  };
}
function recoveredScoreSheetEvidence(originals,recovery){
  return {
    status:recovery.status==='COMPLETE'?'RECOVERED':'PARTIAL',
    recoveryUsed:true,
    sourceSet:{folderId:SCORE_SOURCE.folderId,officialFolderId:SCORE_SOURCE.officialFolderId,practiceFolderId:SCORE_SOURCE.practiceFolderId,authority:SCORE_SOURCE.authority,independentVote:false},
    originalCount:originals.length,
    officialOriginalCount:originals.filter(x=>x.key.category==='OFFICIAL').length,
    practiceOriginalCount:originals.filter(x=>x.key.category==='PRACTICE').length,
    appearanceGameCount:recovery.gameCount,
    verifiedCount:recovery.completeGameCount,
    sourceMismatchCount:0,
    unverifiedCount:recovery.gameCount-recovery.completeGameCount,
    verified:[],
    sourceMismatches:[],
    unverified:recovery.games.filter(game=>!game.battingComplete||!game.startersSupported||!game.participantCoverage).map(game=>({game:game.game,reason:'SCORE_SHEET_RECOVERY_INCOMPLETE',battingComplete:game.battingComplete,startersSupported:game.startersSupported,participantCoverage:game.participantCoverage,recoveredParticipantCount:game.recoveredParticipantCount,fieldingParticipantCount:game.fieldingParticipantCount})),
    recoveryGames:recovery.games,
    sources:originals.map(x=>({id:x.file.id,name:x.file.name,path:x.file.path,mimeType:x.file.mimeType,modifiedTime:x.file.modifiedTime,category:x.key.category,priority:'PRIMARY_APPEARANCE_RECOVERY',independentVote:false})),
    rule:recovery.rule
  };
}

function numericOrder(v){const n=Number(text(v));return Number.isInteger(n)&&n>=1&&n<=9?n:null;}
function countMap(values){const out={};for(const v of values){const k=text(v);if(k)out[k]=(out[k]||0)+1;}return out;}
function positionTokens(v){return text(v).split('>').map(x=>x.trim()).filter(Boolean);}
function startingPosition(v){return positionTokens(v)[0]||'';}

function aggregateAppearance(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  const starts=mine.filter(r=>numericOrder(r['打順'])!==null || text(r['打順']).toUpperCase()==='P');
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
  const [appearance,fielding,originals]=await Promise.all([
    readCsvById(APPEARANCE_FILE_ID,'出場詳細2026-2027.csv'),
    readCsvById(FIELDING_FILE_ID,'守備詳細2026-2027.csv'),
    loadCanonicalScoreSheetOriginals()
  ]);
  const canonicalIntegrity=appearanceIntegrity(appearance.rows);
  const duplicateSourceContent=appearance.meta.id!==fielding.meta.id&&appearance.digest===fielding.digest;
  const canonicalAppearanceUsable=canonicalIntegrity.status==='COMPLETE'&&!duplicateSourceContent;

  let appearanceRows=appearance.rows;
  let integrity=canonicalIntegrity;
  let appearanceSourceMode='CURRENT_CSV';
  let recovery=null;
  let scoreSheets=null;

  if(canonicalAppearanceUsable){
    scoreSheets=await verifyScoreSheetOriginals(appearance.rows,originals);
  }else{
    recovery=await recoverAppearanceFromScoreSheets(originals,fielding.rows);
    if(recovery.status==='COMPLETE'){
      appearanceRows=recovery.rows;
      integrity=appearanceIntegrity(appearanceRows);
      appearanceSourceMode='SCORE_SHEET_RECOVERY';
    }
    scoreSheets=recoveredScoreSheetEvidence(originals,recovery);
  }

  const appearanceUsable=integrity.status==='COMPLETE'&&(canonicalAppearanceUsable||recovery?.status==='COMPLETE');
  const players=CURRENT_ROSTER.map(name=>({
    name,
    appearance:appearanceUsable
      ? {status:'COMPLETE',sourceMode:appearanceSourceMode,...aggregateAppearance(name,appearanceRows)}
      : {status:'UNAVAILABLE',reason:duplicateSourceContent?'DUPLICATE_SOURCE_CONTENT_AND_RECOVERY_INCOMPLETE':'INCOMPLETE_BATTING_ORDER_ROWS'},
    fielding:{status:'COMPLETE',...aggregateFielding(name,fielding.rows)}
  }));

  const issues=[];
  const warnings=[];
  if(duplicateSourceContent)warnings.push('現在の出場詳細CSVは守備詳細CSVと内容SHA-256が一致しており、出場詳細の正本としては利用していない。');
  if(canonicalIntegrity.status!=='COMPLETE')warnings.push('現在の出場詳細CSVの打順1〜9が揃う試合は '+canonicalIntegrity.completeGameCount+'/'+canonicalIntegrity.gameCount+'。');
  if(appearanceSourceMode==='SCORE_SHEET_RECOVERY')warnings.push('登録済み11試合のスコア原本PDFから先発打順・先発守備・途中出場を読み取り、守備詳細CSVの参加選手集合と照合して代替Evidenceを構成した。');
  if(!appearanceUsable)issues.push('出場詳細CSVが利用不能で、スコア原本からの復旧も完全成立しなかったため、スタメン/途中出場・実打順は未確認扱い。');

  return {
    status:appearanceUsable?'COMPLETE':'PARTIAL',
    appearanceStatus:appearanceUsable?'COMPLETE':'UNAVAILABLE',
    appearanceSourceMode,
    fieldingStatus:'COMPLETE',
    integrity,
    canonicalIntegrity,
    sourceIntegrity:{
      status:appearanceSourceMode==='SCORE_SHEET_RECOVERY'?'RECOVERED_FROM_SCORE_SHEETS':(duplicateSourceContent?'SOURCE_MISMATCH':'COMPLETE'),
      duplicateSourceContent,
      canonicalAppearanceUsable,
      appearanceDigest:appearance.digest,
      fieldingDigest:fielding.digest,
      recoveryStatus:recovery?.status||'NOT_USED'
    },
    issues,
    warnings,
    recovery:recovery?{status:recovery.status,gameCount:recovery.gameCount,completeGameCount:recovery.completeGameCount,games:recovery.games,rule:recovery.rule}:null,
    sources:[
      {id:appearance.meta.id,name:appearance.meta.name,mimeType:appearance.meta.mimeType,modifiedTime:appearance.meta.modifiedTime,priority:appearanceSourceMode==='CURRENT_CSV'?'PRIMARY_APPEARANCE_DETAIL':'CORRUPT_CANONICAL_APPEARANCE_REFERENCE',usedForDecision:appearanceSourceMode==='CURRENT_CSV'},
      {id:fielding.meta.id,name:fielding.meta.name,mimeType:fielding.meta.mimeType,modifiedTime:fielding.meta.modifiedTime,priority:'PRIMARY_FIELDING_DETAIL'}
    ],
    scoreSheets,
    players,
    rule:appearanceSourceMode==='SCORE_SHEET_RECOVERY'
      ? '現在の出場詳細CSVは構造破損を検出したため判断に使用せず、登録済み11試合のスコア原本PDFを代替正本としてスタメン・途中出場・実打順・先発守備位置を復旧した。復旧結果は守備詳細CSVの各試合参加選手集合と一致した場合だけCOMPLETEとし、PDFとCSVを独立票として二重加点しない。'
      : '出場詳細CSVをスタメン・途中出場・実打順・スタメン守備位置の最優先Evidenceとする。守備詳細CSVの実守備位置は別系統の実績として利用し、スコア原本は一次照合資料として用いる。'
  };
}
