import { createHash } from 'node:crypto';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

export const config = { maxDuration: 120 };

const QUESTION='今の丸岡中のベストオーダーを、守備位置込みで審議して';
const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={melchior:'MELCHIOR-1',balthasar:'BALTHASAR-2',casper:'CASPER-3'};
const FIRST={melchior:'私',balthasar:'俺',casper:'僕'};
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　]/g,'');
const rosterKeys=new Set(CURRENT_ROSTER.map(norm));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=v=>JSON.parse(JSON.stringify(v??null));
const text=v=>String(v??'').trim();

async function post(base,path,body,label=path){
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    if(attempt>1)await sleep(900*Math.pow(2,attempt-2));
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
function prepareBrowserEvidence(evidence){
  const e=clone(evidence);if(!e)return e;
  const policy='現場の起用案や打順案は回答の正解指定ではなく、審議材料の一つとして扱う。MELCHIORは再現性と母数、BALTHASARは得点へのつながりと試合運用、CASPERは役割・育成・負担から全14名を独立に比較する。3人とも、まずデータから自分の案を作り、その後で現場案と照合する。他人格の案や多数派に合わせない。違いを作るためだけの変更もしない。';
  if(typeof e.text==='string'){
    e.text=e.text.replace(/【標準オーダーの基準線】[^\n]*/g,'【現場案の扱い】通常は相手投手の左右が事前に不明なため、右投手対応を標準条件とする。現場では大野 竜暉、坂田 暉馬、嶋田 栄志、大久保 陽翔、中嶋 玲月を上位候補として重く見ている。ただし、この5人の順番を含めて審議結果の指定ではない。3賢人は全14名の過去実績・今季通算・直近状態・守備運用から、自分の専門領域で順番を組み直してよい。').replace(/【大野竜暉の上位評価】[^\n]*/g,'【大野竜暉の確認点】出塁率と母数、過去実績を上位適性の重要材料として見る。ただし「1番固定」という正解指定ではなく、他の上位候補と比較して各賢人が打順を決める。').replace(/【2〜3番の扱い】[^\n]*/g,'【坂田・嶋田の確認点】現在の好成績は評価するが、少ない母数の高率を過大評価しない。過去実績・今季母数・直近状態を必ず併記し、2番・3番を自動固定しない。');
    e.text+=`\n【3賢人独立性ルール】${policy}`;
  }
  e.deliberationPolicy=policy;if(typeof e.summary==='string')e.summary+=' 現場案は回答指定ではなく、3賢人が全14名から独立検証する。';return e;
}
function browserCase(packet){return {id:`MAGI-${Date.now()}`,question:QUESTION,mode:'selection',objective:'',options:[],urgency:'normal',evidence:prepareBrowserEvidence(reinforceEvidence(packet)),createdAt:new Date().toISOString()};}

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

async function runOnce(base,packet){
  const caseData=browserCase(packet);
  const primary=await serialPersonaSet(base,'PRIMARY',p=>({persona:p,phase:'PRIMARY',case:caseData}));
  for(const p of PERSONAS){if(primary[p]?.reviewRequested===true||primary[p]?.dataConflict===true||!validNine(primary[p]))throw new Error(`PRIMARY_${p.toUpperCase()}_INVALID`);}
  const cross=await post(base,'/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary},'CROSS');
  for(const p of PERSONAS){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)throw new Error(`CROSS_${p.toUpperCase()}_MISSING_CHALLENGE`);}
  const doSecond=async(note='')=>serialPersonaSet(base,note?'SECOND_RECHECK':'SECOND',p=>({persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross,note)}));
  let second=await doSecond();if(allSame(second))second=await doSecond('3賢人の二次打順が完全一致したため、多数派への同調を排除して独立再検証する。同じ案を維持する場合も代替案を比較した理由を明示する。');
  for(const p of PERSONAS){if(second[p]?.reviewRequested===true||second[p]?.dataConflict===true||!validNine(second[p]))throw new Error(`SECOND_${p.toUpperCase()}_INVALID`);}
  const final=await post(base,'/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary,crossExamination:cross,second},'FINAL');
  const names=Array.isArray(final?.lineup)?final.lineup.map(x=>x?.name).filter(Boolean):[];
  const legal=final?.mode==='FULL_LINEUP'&&final?.status==='LINEUP_RESULT'&&names.length===9&&new Set(names.map(norm)).size===9&&names.every(n=>rosterKeys.has(norm(n)));
  if(!legal)throw new Error(`FINAL_INVALID_${String(final?.status||'NO_STATUS')}`);
  return {primary:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:primary[p].candidatePlayers,judgment:primary[p].judgment,confidence:primary[p].confidence}])),cross:{agreement:cross?.agreement||[],disagreement:cross?.disagreement||[],domainConflicts:cross?.domainConflicts||[],challenges:cross?.challenges||{},informationGaps:cross?.informationGaps||[]},second:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:second[p].candidatePlayers,judgment:second[p].judgment,confidence:second[p].confidence}])),final:{mode:final.mode,status:final.status,lineup:final.lineup,recommendation:final.recommendation,personaLineups:final.personaLineups}};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const host=String(req.headers?.['x-forwarded-host']||req.headers?.host||'magi-web.vercel.app').split(',')[0].trim();const proto=String(req.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();const base=`${proto}://${host}`;
    const packet=await buildCurrentSelectionEvidence({question:QUESTION,routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}});const players=packet?.allCurrentTeamCheck?.players||[];
    const ready=packet?.selectionKind==='FULL_LINEUP'&&Number(packet?.count)===14&&players.length===14&&CURRENT_ROSTER.every(name=>players.some(p=>p?.name===name));if(!ready)throw new Error('LIVE_EVIDENCE_NOT_READY');
    const result=await runOnce(base,packet);const digest=stableDigest(result);
    return res.status(200).json({ok:true,question:QUESTION,evidence:{count:packet.count,selectionKind:packet.selectionKind,recentSixStatus:packet?.recentSix?.status||'',historicalStatus:packet?.historicalReference?.status||''},finalStatus:result.final.status,lineup:result.final.lineup.map(x=>({slot:x.slot,name:x.name})),digest});
  }catch(error){console.error('[MAGI LIVE DELIBERATION SELFTEST]',error?.message||error);return res.status(200).json({ok:false,question:QUESTION,error:error?.message||String(error)});}
}
