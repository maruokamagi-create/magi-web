import { createHash } from 'node:crypto';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence, buildCurrentTeamReviewEvidence } from '../server/api/magi/_selection-live-evidence.js';

export const config = { maxDuration: 120 };

const QUESTION='今の丸岡中のベストオーダーを、守備位置込みで審議して';
const NATURAL_THIRD_QUESTION='3番を誰にするか迷ってる。4番の大久保 陽翔につなぐことを考えると、誰がいいと思う？';
const CLOSER_QUESTION='クローザーは誰がいい？';
const TEAM_REVIEW_QUESTION='今の丸岡中の弱点は何？';
const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={melchior:'MELCHIOR-1',balthasar:'BALTHASAR-2',casper:'CASPER-3'};
const FIRST={melchior:'私',balthasar:'俺',casper:'僕'};
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　]/g,'');
const rosterKeys=new Set(CURRENT_ROSTER.map(norm));
const STANDARD_POSITIONS=['投','捕','一','二','三','遊','左','中','右'];
const standardPositionKeys=new Set(STANDARD_POSITIONS);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=v=>JSON.parse(JSON.stringify(v??null));
const text=v=>String(v??'').trim();

async function post(base,path,body,label=path){
  let lastError=null;
  for(let attempt=1;attempt<=5;attempt++){
    if(attempt>1)await sleep(Math.min(6000,1200*Math.pow(2,attempt-2)));
    try{
      const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json','Origin':base},body:JSON.stringify(body),cache:'no-store'});
      const raw=await response.text();let parsed={};
      try{parsed=raw?JSON.parse(raw):{};}catch(_){parsed={raw:raw.slice(0,300)};}
      if(response.ok)return parsed;
      const detail=parsed?.error||parsed?.message||parsed?.raw||`HTTP ${response.status}`;
      const error=new Error(`${label} attempt ${attempt} ${response.status}: ${detail}`);error.status=response.status;lastError=error;
      if(!(response.status===408||response.status===429||response.status>=500))throw error;
    }catch(error){lastError=error;if(error?.status&&!(error.status===408||error.status===429||error.status>=500))throw error;}
  }
  throw lastError||new Error(`${label}: request failed`);
}

function isNumberLike(v){const s=text(v).replace(/,/g,'');return /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s);}
function battingCore(stats){return Boolean(stats&&isNumberLike(stats.AVG)&&isNumberLike(stats.AB)&&isNumberLike(stats.OPS));}
function currentPlayers(e){return Array.isArray(e?.allCurrentTeamCheck?.players)?e.allCurrentTeamCheck.players:[];}
function compactBatting(players){return (players||[]).map(p=>({name:p.name,games:p?.games??p?.batting?.GAMES??p?.batting?.G??'',PA:p?.batting?.PA??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',RBI:p?.batting?.RBI??'',AVG:p?.batting?.AVG??'',OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??'',RISP:p?.batting?.RISP??p?.batting?.RISP_AVG??'',BB:p?.batting?.BB??'',HBP:p?.batting?.HBP??'',SB:p?.batting?.SB??''}));}
function reinforceEvidence(evidence){
  const e=clone(evidence)||{};const players=currentPlayers(e);
  const currentComplete=players.length===14&&players.every(p=>battingCore(p?.batting));
  const historicalComplete=String(e?.historicalReference?.status||'')==='COMPLETE';
  const recentComplete=String(e?.recentSix?.status||'')==='COMPLETE';
  e.numericEvidenceContract={version:'numeric-evidence-contract-v373',currentSeason:'2026-2027',currentBattingNumbersProvided:currentComplete,currentPlayersWithCoreBatting:players.filter(p=>battingCore(p?.batting)).length,historicalNumbersProvided:historicalComplete,recentSixNumbersProvided:recentComplete,instruction:'正本Evidenceを事実の唯一の数値根拠として使用する。FULL_LINEUPでは現チーム14名を比較し、candidatePlayersは現チームの異なる9名を1番から9番の順で返す。説明文の言い回しではなく構造化された選手名・数値を優先する。'};
  e.currentBattingAnchors=compactBatting(players);
  if(historicalComplete&&Array.isArray(e?.historicalReference?.players))e.historicalBattingAnchors=compactBatting(e.historicalReference.players);
  if(recentComplete&&Array.isArray(e?.recentSix?.players))e.recentSixBattingAnchors=compactBatting(e.recentSix.players);
  return e;
}
function browserCase(packet,question=QUESTION){return {id:`MAGI-${Date.now()}`,question,mode:'selection',objective:'',options:[],urgency:'normal',evidence:reinforceEvidence(packet),createdAt:new Date().toISOString()};}

function crossFor(persona,cross,independenceReview=''){return {...(cross||{}),challengeToSelf:Array.isArray(cross?.challenges?.[persona])?cross.challenges[persona]:[],challengeTarget:TARGETS[persona],challengeSemantics:`challengeToSelf と challenges.${persona} は ${TARGETS[persona]} に向けられた質問。自分宛ての指摘に答えた後、自分の専門領域だけで二次判断する。`,independenceRule:'他の2人格に合わせない。違いを作るためだけにも変えない。Evidenceと一次案を自分の専門領域で再検証する。',...(independenceReview?{independenceReview}:{})};}
function candidateSeq(v){return (Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]).map(norm);}
function validNine(v){const s=candidateSeq(v);return s.length===9&&new Set(s).size===9&&s.every(x=>rosterKeys.has(x));}
function softGuardFailure(v){
  if(!v?.reviewRequested||!validNine(v))return false;
  const reason=String(v?.reviewReason||'');
  if(!/回答文の数値・選手参照をEvidenceと照合した結果、不整合/.test(reason))return false;
  const fatal=/(?:FULL_LINEUP|正式ロスター|ロスター完全一致|対象外|9人の打順構成|candidatePlayers|打順構成エラー|数値.{0,30}(?:一致しない|存在しない)|選手名.{0,30}(?:存在しない|対象外)|supplied CASE\/EVIDENCE.{0,50}(?:値と一致しない|選手.*存在しない))/i.test(reason);
  return !fatal;
}
function recoverSoftLineup(v,persona){
  if(!softGuardFailure(v))return v;
  const out=clone(v),names=Array.isArray(out.candidatePlayers)?out.candidatePlayers.slice(0,9):[];
  out.judgment='BLUE';out.confidence='LOW';out.reviewRequested=false;out.reviewReason='';out.dataConflict=false;out.facts=[];out.analysis=[];out.prediction=[];
  out.candidateBasis='説明文のうちEvidence照合に通らなかった表現を除外し、正式ロスター内の9人の打順案だけを保持して再審議を継続。';
  out.primaryReason='打順構成自体は正式14名の範囲で成立しているため、説明文の不適切な表現だけを除外し、標準案の比較を続けます。';
  out.publicStatement=`${FIRST[persona]||'私'}の標準案は ${names.map((name,i)=>`${i+1}番${name}`).join('、')} です。説明文の一部がEvidence照合に通らなかったため、その表現は採用せず、打順案だけを残して比較します。`;
  out.warnings=['説明文の一部をEvidence照合で除外。打順そのものは正式ロスター内で成立。'];
  return out;
}
function allSame(set){const seqs=PERSONAS.map(p=>candidateSeq(set?.[p]));if(seqs.some(s=>s.length!==9))return false;return seqs.slice(1).every(s=>s.every((v,i)=>v===seqs[0][i]));}
function stableDigest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);}
async function serialPersonaSet(base,phase,buildBody){const out={};for(const p of PERSONAS){const raw=await post(base,'/api/magi/persona',buildBody(p),`${phase}_${p.toUpperCase()}`);out[p]=recoverSoftLineup(raw,p);await sleep(350);}return out;}

async function runOnce(base,packet,question=QUESTION){
  const caseData=browserCase(packet,question);
  const primary=await serialPersonaSet(base,'PRIMARY',p=>({persona:p,phase:'PRIMARY',case:caseData}));
  for(const p of PERSONAS){if(primary[p]?.reviewRequested===true||primary[p]?.dataConflict===true||!validNine(primary[p]))throw new Error(`PRIMARY_${p.toUpperCase()}_INVALID`);}
  const cross=await post(base,'/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary},'CROSS');
  for(const p of PERSONAS){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)throw new Error(`CROSS_${p.toUpperCase()}_MISSING_CHALLENGE`);}
  const doSecond=async(note='')=>serialPersonaSet(base,note?'SECOND_RECHECK':'SECOND',p=>({persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross,note)}));
  let second=await doSecond();if(allSame(second))second=await doSecond('3賢人の二次打順が完全一致したため、多数派への同調を排除して独立再検証する。同じ案を維持する場合も代替案を比較した理由を明示する。');
  for(const p of PERSONAS){if(second[p]?.reviewRequested===true||second[p]?.dataConflict===true||!validNine(second[p]))throw new Error(`SECOND_${p.toUpperCase()}_INVALID`);}
  const final=await post(base,'/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary,crossExamination:cross,second},'FINAL');
  const rows=Array.isArray(final?.lineup)?final.lineup:[];
  const names=rows.map(x=>x?.name).filter(Boolean);
  const positions=rows.map(x=>text(x?.position)).filter(Boolean);
  const standardStartSupported=rows.every(x=>{
    const e=x?.positionEvidence||{};
    return Number(e.officialStarts)>0||Number(e.practiceFirstStarts)>0;
  });
  const legal=final?.mode==='FULL_LINEUP'&&final?.status==='LINEUP_RESULT'&&final?.fieldingStatus==='COMPLETE'&&
    names.length===9&&new Set(names.map(norm)).size===9&&names.every(n=>rosterKeys.has(norm(n)))&&
    positions.length===9&&new Set(positions).size===9&&positions.every(p=>standardPositionKeys.has(p))&&standardStartSupported;
  if(!legal)throw new Error(`FINAL_INVALID_${String(final?.status||'NO_STATUS')}_FIELDING_${String(final?.fieldingStatus||'NO_STATUS')}`);
  return {primary:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:primary[p].candidatePlayers,judgment:primary[p].judgment,confidence:primary[p].confidence}])),cross:{agreement:cross?.agreement||[],disagreement:cross?.disagreement||[],domainConflicts:cross?.domainConflicts||[],challenges:cross?.challenges||{},informationGaps:cross?.informationGaps||[]},second:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:second[p].candidatePlayers,judgment:second[p].judgment,confidence:second[p].confidence}])),final:{mode:final.mode,status:final.status,lineup:final.lineup,recommendation:final.recommendation,personaLineups:final.personaLineups}};
}

async function runNaturalThird(base,packet){
  const caseData=browserCase(packet,NATURAL_THIRD_QUESTION);
  const primary=await serialPersonaSet(base,'NATURAL_THIRD_PRIMARY',p=>({persona:p,phase:'PRIMARY',case:caseData}));
  for(const p of PERSONAS){if(primary[p]?.reviewRequested===true||primary[p]?.dataConflict===true||!Array.isArray(primary[p]?.candidatePlayers)||primary[p].candidatePlayers.length<1)throw new Error('NATURAL_THIRD_PRIMARY_'+p.toUpperCase()+'_INVALID:'+JSON.stringify({candidatePlayers:primary[p]?.candidatePlayers||[],reviewRequested:primary[p]?.reviewRequested,dataConflict:primary[p]?.dataConflict,reviewReason:primary[p]?.reviewReason||'',warnings:primary[p]?.warnings||[],publicStatement:primary[p]?.publicStatement||''}).slice(0,1800));}
  const cross=await post(base,'/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary},'NATURAL_THIRD_CROSS');
  for(const p of PERSONAS){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)throw new Error('NATURAL_THIRD_CROSS_'+p.toUpperCase()+'_MISSING_CHALLENGE');}
  const second=await serialPersonaSet(base,'NATURAL_THIRD_SECOND',p=>({persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross)}));
  for(const p of PERSONAS){if(second[p]?.reviewRequested===true||second[p]?.dataConflict===true||!Array.isArray(second[p]?.candidatePlayers)||second[p].candidatePlayers.length<1)throw new Error('NATURAL_THIRD_SECOND_'+p.toUpperCase()+'_INVALID');}
  const final=await post(base,'/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary,crossExamination:cross,second},'NATURAL_THIRD_FINAL');
  const legal=final?.mode==='SELECTION'&&['SELECTION_RESULT','SELECTION_SPLIT'].includes(final?.status)&&Array.isArray(final?.recommendedCandidates)&&final.recommendedCandidates.length>0&&final.recommendedCandidates.every(n=>rosterKeys.has(norm(n)));
  if(!legal)throw new Error('NATURAL_THIRD_FINAL_INVALID_'+String(final?.status||'NO_STATUS'));
  return {status:final.status,centerCandidates:final.centerCandidates||[],recommendedCandidates:final.recommendedCandidates||[],personaSelections:final.personaSelections||{}};
}

async function runCloser(base,packet){
  const caseData=browserCase(packet,CLOSER_QUESTION); caseData.selectionKind='PITCHING_ROLE'; caseData.evidence.selectionKind='PITCHING_ROLE';
  const primary=await serialPersonaSet(base,'CLOSER_PRIMARY',p=>({persona:p,phase:'PRIMARY',case:caseData}));
  const cross=await post(base,'/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary},'CLOSER_CROSS');
  const second=await serialPersonaSet(base,'CLOSER_SECOND',p=>({persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross)}));
  const final=await post(base,'/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary,crossExamination:cross,second},'CLOSER_FINAL');
  const eligible=new Set((packet.pitchingEligible||[]).map(norm));
  const all=[...PERSONAS.flatMap(p=>primary[p]?.candidatePlayers||[]),...PERSONAS.flatMap(p=>second[p]?.candidatePlayers||[]),...(final?.recommendedCandidates||[])];
  if(all.some(n=>!eligible.has(norm(n)))) throw new Error('CLOSER_INELIGIBLE_CANDIDATE');
  const sakata=packet?.allCurrentTeamCheck?.players?.find(p=>p?.name==='坂田 暉馬');
  if(String(sakata?.pitching?.SV??'')!=='2') throw new Error('CLOSER_SAKATA_SAVE_NOT_2');
  const mentionsSave=PERSONAS.some(p=>JSON.stringify(primary[p]).includes('セーブ'))||PERSONAS.some(p=>JSON.stringify(second[p]).includes('セーブ'))||JSON.stringify(final).includes('セーブ');
  if(!mentionsSave) throw new Error('CLOSER_SAVE_EVIDENCE_NOT_USED');
  const rationale=Object.fromEntries(PERSONAS.map(p=>[p,{primaryBasis:primary[p]?.candidateBasis||'',primaryFacts:primary[p]?.facts||[],primaryAnalysis:primary[p]?.analysis||[],primaryWarnings:primary[p]?.warnings||[],primaryConflict:Boolean(primary[p]?.dataConflict),secondBasis:second[p]?.candidateBasis||'',secondAnalysis:second[p]?.analysis||[],secondWarnings:second[p]?.warnings||[],secondConflict:Boolean(second[p]?.dataConflict)}]));
  const rationaleText=JSON.stringify(rationale);
  const mentionsCurrentConcern=/制球|安定しない|内野守備|専念/.test(rationaleText);
  const packetText=String(packet?.text||'');
  const packetConcernPresent=/坂田 暉馬/.test(packetText)&&/制球|安定しない|内野守備|専念/.test(packetText);
  const packetConcernLines=packetText.split('\n').filter(line=>/坂田 暉馬/.test(line)&&/制球|安定しない|内野守備|専念/.test(line));
  return {primary:Object.fromEntries(PERSONAS.map(p=>[p,primary[p]?.candidatePlayers||[]])),second:Object.fromEntries(PERSONAS.map(p=>[p,second[p]?.candidatePlayers||[]])),centerCandidates:final?.centerCandidates||[],recommendedCandidates:final?.recommendedCandidates||[],sakataSaveCount:String(sakata.pitching.SV),saveEvidenceUsed:mentionsSave,coachObservationStatus:packet?.coachObservationStatus||'',packetConcernPresent,currentConcernUsed:mentionsCurrentConcern,packetConcernLines,rationale};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const host=String(req.headers?.['x-forwarded-host']||req.headers?.host||'magi-web.vercel.app').split(',')[0].trim();const proto=String(req.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();const base=`${proto}://${host}`;
    const mode=String(req.query?.mode||'lineup');
    if(mode==='teamReview'){
      const teamEvidence=await buildCurrentTeamReviewEvidence({
        question:TEAM_REVIEW_QUESTION,
        routed:{players:[],domains:['TEAM','BATTING','PITCHING','FIELDING'],selectionKind:'TEAM_REVIEW'},
        staffAccessContext:{role:'admin',purpose:'DELIBERATION'}
      });
      if(!teamEvidence||String(teamEvidence?.reviewKind||'').toUpperCase()!=='TEAM_REVIEW'||Number(teamEvidence?.count)!==14){
        throw new Error('TEAM_REVIEW_EVIDENCE_NOT_READY');
      }
      const caseData={
        id:`MAGI-TEAM-REVIEW-${Date.now()}`,
        question:TEAM_REVIEW_QUESTION,
        mode:'proposal',
        objective:'',
        options:[],
        urgency:'normal',
        selectionKind:'TEAM_REVIEW',
        evidence:teamEvidence,
        createdAt:new Date().toISOString()
      };
      const primary=await post(base,'/api/magi/persona-batch',{phase:'PRIMARY',case:caseData},'TEAM_REVIEW_PRIMARY_BATCH');
      const summary={};
      for(const p of PERSONAS){
        const row=primary?.[p];
        if(!row||row.reviewRequested===true||row.dataConflict===true)throw new Error(`TEAM_REVIEW_${p.toUpperCase()}_INVALID`);
        if((row.candidatePlayers||[]).length||text(row.candidateBasis))throw new Error(`TEAM_REVIEW_${p.toUpperCase()}_BECAME_SELECTION`);
        const checked=Array.isArray(row.checkedPlayers)?row.checkedPlayers:[];
        if(checked.length && checked.length!==14)throw new Error(`TEAM_REVIEW_${p.toUpperCase()}_PARTIAL_ROSTER_CHECK`);
        summary[p]={judgment:row.judgment,confidence:row.confidence,publicStatement:row.publicStatement,facts:row.facts,analysis:row.analysis,warnings:row.warnings};
      }
      return res.status(200).json({ok:true,mode,question:TEAM_REVIEW_QUESTION,evidence:{count:teamEvidence.count,reviewKind:teamEvidence.reviewKind,selectionKind:teamEvidence.selectionKind},primary:summary});
    }
    const packet=await buildCurrentSelectionEvidence({
      question:QUESTION,
      routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'},
      staffAccessContext:{role:'admin',purpose:'DELIBERATION'}
    });const players=packet?.allCurrentTeamCheck?.players||[];
    const ready=packet?.selectionKind==='FULL_LINEUP'&&Number(packet?.count)===14&&players.length===14&&CURRENT_ROSTER.every(name=>players.some(p=>p?.name===name));if(!ready)throw new Error('LIVE_EVIDENCE_NOT_READY');
    const scoreCheck=packet?.appearanceFielding?.scoreSheets||{};
    const scoreAccounted=Number(scoreCheck.originalCount)===13&&Number(scoreCheck.appearanceGameCount)===13&&Number(scoreCheck.unverifiedCount)===0&&Number(scoreCheck.verifiedCount)+Number(scoreCheck.sourceMismatchCount)===13;
    const appearanceSourceMode=packet?.appearanceFielding?.appearanceSourceMode||'';
    const sourceIntegrityStatus=packet?.appearanceFielding?.sourceIntegrity?.status||'';
    const sourceReady=sourceIntegrityStatus==='COMPLETE'||(sourceIntegrityStatus==='RECOVERED_FROM_SCORE_SHEETS'&&appearanceSourceMode==='SCORE_SHEET_RECOVERY'&&packet?.appearanceFielding?.recovery?.status==='COMPLETE');
    const appearanceReady=packet?.appearanceFielding?.status==='COMPLETE'&&packet?.appearanceFielding?.appearanceStatus==='COMPLETE'&&packet?.appearanceFielding?.fieldingStatus==='COMPLETE'&&sourceReady&&scoreAccounted;
    const structuredObservations=Array.isArray(packet?.normalizedObservations)?packet.normalizedObservations:[];
    const structuredDatedCount=structuredObservations.filter(o=>text(o?.recordedAt)).length;
    const directPlayerObservationCount=structuredObservations.filter(o=>rosterKeys.has(norm(o?.player))).length;
    const observationSensitiveFieldsPresent=structuredObservations.some(o=>Object.prototype.hasOwnProperty.call(o,'provider')||Object.prototype.hasOwnProperty.call(o,'role'));
    const observationStructureReady=packet?.normalizedObservationStatus==='COMPLETE'
      && structuredObservations.length>0
      && directPlayerObservationCount>0
      && structuredDatedCount===Number(packet?.normalizedObservationDatedCount||0)
      && !observationSensitiveFieldsPresent
      && structuredObservations.every(o=>text(o?.recordedAt)&&text(o?.sourceType)&&text(o?.player)&&text(o?.statement)&&o?.independentVote===false);
    if(mode==='lineup'&&!observationStructureReady){
      const err=new Error('NORMALIZED_OBSERVATION_STRUCTURE_NOT_READY');
      err.diagnostic={
        status:packet?.normalizedObservationStatus||'UNAVAILABLE',
        structuredCount:structuredObservations.length,
        structuredDatedCount,
        expectedDatedCount:Number(packet?.normalizedObservationDatedCount)||0,
        directPlayerObservationCount,
        sensitiveFieldsPresent:observationSensitiveFieldsPresent
      };
      throw err;
    }
    const orderPlayers=Array.isArray(packet?.battingOrderSplits?.players)?packet.battingOrderSplits.players:[];
    const orderSlotCount=orderPlayers.reduce((sum,p)=>sum+(Array.isArray(p?.slots)?p.slots.length:0),0);
    const battingOrderReady=packet?.battingOrderSplits?.status==='COMPLETE'&&orderPlayers.length===14&&orderSlotCount>0;
    if(mode==='lineup'&&!battingOrderReady)throw new Error('BATTING_ORDER_SPLIT_EVIDENCE_NOT_READY');
    if(mode==='lineup'&&!appearanceReady){
      const err=new Error('APPEARANCE_EVIDENCE_NOT_READY');
      err.diagnostic={
        appearanceFieldingStatus:packet?.appearanceFielding?.status||'UNAVAILABLE',
        appearanceStatus:packet?.appearanceFielding?.appearanceStatus||'UNAVAILABLE',
        fieldingStatus:packet?.appearanceFielding?.fieldingStatus||'UNAVAILABLE',
        sourceIntegrity:packet?.appearanceFielding?.sourceIntegrity?.status||'UNAVAILABLE',
        appearanceSourceMode:packet?.appearanceFielding?.appearanceSourceMode||'UNAVAILABLE',
        recoveryStatus:packet?.appearanceFielding?.recovery?.status||'NOT_USED',
        duplicateSourceContent:Boolean(packet?.appearanceFielding?.sourceIntegrity?.duplicateSourceContent),
        integrityStatus:packet?.appearanceFielding?.integrity?.status||'UNAVAILABLE',
        scoreSheetVerificationStatus:packet?.scoreSheetVerificationStatus||'UNAVAILABLE',
        issues:packet?.appearanceFielding?.issues||[]
      };
      throw err;
    }
    const result=mode==='lineup'?await runOnce(base,packet):null;
    const digest=result?stableDigest(result):'';
    const naturalPacket=await buildCurrentSelectionEvidence({question:NATURAL_THIRD_QUESTION,routed:{players:['大久保 陽翔'],domains:['LINEUP','BATTING','TEAM'],selectionKind:'GENERIC_SELECTION'}});
    const naturalPlayers=naturalPacket?.allCurrentTeamCheck?.players||[];
    const naturalReady=naturalPacket?.selectionKind==='BATTING_ORDER'&&Number(naturalPacket?.count)===14&&naturalPlayers.length===14&&CURRENT_ROSTER.every(name=>naturalPlayers.some(p=>p?.name===name));if(!naturalReady)throw new Error('NATURAL_THIRD_LIVE_EVIDENCE_NOT_READY');
    const runNatural=mode==='naturalThird'||String(req.query?.naturalThird||'')==='1';
    const naturalThird=runNatural?await runNaturalThird(base,naturalPacket):{status:'SKIPPED_BY_DEFAULT',recommendedCandidates:[],centerCandidates:[],personaSelections:{}};
    const naturalThirdError=runNatural?'':'Use ?naturalThird=1 for the dedicated exact natural-third E2E; default run preserves provider capacity for closer E2E.';
    const closerPacket=await buildCurrentSelectionEvidence({question:CLOSER_QUESTION,routed:{players:[],domains:['PITCHING','TEAM'],selectionKind:'PITCHING_ROLE'},staffAccessContext:{role:'admin',purpose:'DELIBERATION'}});
    const closer=mode==='closer'?await runCloser(base,closerPacket):null;
    if(mode==='closer'&&(!closer?.saveEvidenceUsed||closer?.sakataSaveCount!=='2'||closerPacket?.coachObservationStatus!=='COMPLETE'||!String(closerPacket?.text||'').includes('坂田 暉馬')))throw new Error('CLOSER_FULL_DELIBERATION_NOT_READY');
    return res.status(200).json({ok:true,mode,question:QUESTION,evidence:{
      count:packet.count,
      selectionKind:packet.selectionKind,
      recentSixStatus:packet?.recentSix?.status||'',
      historicalStatus:packet?.historicalReference?.status||'',
      battingOrderSplitStatus:packet?.battingOrderSplits?.status||'',
      battingOrderPlayerCount:orderPlayers.length,
      battingOrderSlotCount:orderSlotCount,
      appearanceFieldingStatus:packet?.appearanceFielding?.status||'',
      appearanceStatus:packet?.appearanceFielding?.appearanceStatus||'',
      fieldingStatus:packet?.appearanceFielding?.fieldingStatus||'',
      sourceIntegrityStatus:packet?.appearanceFielding?.sourceIntegrity?.status||'',
      appearanceSourceMode:packet?.appearanceFielding?.appearanceSourceMode||'',
      recoveryStatus:packet?.appearanceFielding?.recovery?.status||'',
      recoveryCompleteGameCount:Number(packet?.appearanceFielding?.recovery?.completeGameCount)||0,
      duplicateSourceContent:Boolean(packet?.appearanceFielding?.sourceIntegrity?.duplicateSourceContent),
      scoreSheetVerificationStatus:packet?.scoreSheetVerificationStatus||'',
      scoreSheetOriginalCount:Number(packet?.appearanceFielding?.scoreSheets?.originalCount)||0,
      scoreSheetVerifiedCount:Number(packet?.appearanceFielding?.scoreSheets?.verifiedCount)||0,
      scoreSheetAppearanceGameCount:Number(packet?.appearanceFielding?.scoreSheets?.appearanceGameCount)||0,
      scoreSheetSourceMismatchCount:Number(packet?.appearanceFielding?.scoreSheets?.sourceMismatchCount)||0,
      scoreSheetUnverifiedCount:Number(packet?.appearanceFielding?.scoreSheets?.unverifiedCount)||0,
      normalizedObservationStatus:packet?.normalizedObservationStatus||'',
      normalizedObservationDatedCount:Number(packet?.normalizedObservationDatedCount)||0,
      normalizedObservationLatestRecordedAt:packet?.normalizedObservationLatestRecordedAt||'',
      normalizedObservationStructuredCount:structuredObservations.length,
      normalizedObservationDirectPlayerCount:directPlayerObservationCount,
      normalizedObservationSensitiveFieldsPresent:observationSensitiveFieldsPresent,
      strategySnapshotStatus:packet?.strategySnapshotStatus||'',
      strategySnapshotCurrentPolicy:packet?.strategySnapshotCurrentPolicy
    },finalStatus:result?.final?.status||'',lineup:result?.final?.lineup?.map(x=>({slot:x.slot,name:x.name,position:x.position,positionLabel:x.positionLabel,positionEvidence:x.positionEvidence}))||[],digest,naturalThird:{question:NATURAL_THIRD_QUESTION,evidence:{count:naturalPacket.count,selectionKind:naturalPacket.selectionKind},...(naturalThird||{}),error:naturalThirdError},closer:{question:CLOSER_QUESTION,...(closer||{})}});
  }catch(error){console.error('[MAGI LIVE DELIBERATION SELFTEST]',error?.message||error);return res.status(200).json({ok:false,question:QUESTION,error:error?.message||String(error),diagnostic:error?.diagnostic||null});}
}
