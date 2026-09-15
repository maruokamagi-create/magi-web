(()=>{
'use strict';
if(window.MAGI_FORMAL_RUNNER_V373)return;
window.MAGI_FORMAL_RUNNER_V373=true;

const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v??null));
const text=v=>String(v??'').trim();
const engineUiRunner=(window.MAGI_ENGINE_UI_V187===true&&typeof window.runMagi==='function')?window.runMagi.bind(window):null;
const priorSearch=typeof window.searchDataEvidence==='function'?window.searchDataEvidence.bind(window):null;
let activeEvidence=null;
let running=false;

function progress(pct,label,step){
  const api=window.MAGI_PROGRESS_V358;
  if(api?.update)api.update(pct,label,step);
  else document.dispatchEvent(new CustomEvent('magi:progress',{detail:{pct,label,step}}));
}
function progressError(label){window.MAGI_PROGRESS_V358?.error?.(label);}
function isNumberLike(v){const s=text(v).replace(/,/g,'');return /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s);}
function battingCore(stats){return Boolean(stats&&isNumberLike(stats.AVG)&&isNumberLike(stats.AB)&&isNumberLike(stats.OPS));}
function currentPlayers(e){return Array.isArray(e?.allCurrentTeamCheck?.players)?e.allCurrentTeamCheck.players:[];}

function validateEvidence(evidence,selectionKind){
  const kind=String(selectionKind||'').toUpperCase();
  if(kind!=='FULL_LINEUP'&&kind!=='PITCHING_PLAN')return;
  if(!evidence||typeof evidence!=='object')throw new Error('正本Evidenceを取得できなかったため審議を停止しました');
  if(Number(evidence.count)!==14)throw new Error(`現チーム14名のEvidenceが揃っていません（${Number(evidence.count)||0}/14）`);
  if(!Array.isArray(evidence.files)||!evidence.files.some(name=>/2026-2027.*\.xlsm$/i.test(String(name))))throw new Error('2026-2027正本XLSMを確認できないため審議を停止しました');
  const players=currentPlayers(evidence);
  if(players.length!==14)throw new Error('現チーム14名の正本確認結果が不完全です');
  if(kind==='FULL_LINEUP'){
    const complete=players.filter(p=>battingCore(p?.batting));
    if(complete.length!==14)throw new Error(`今季の打率・打数・OPSが全員分揃っていません（${complete.length}/14）`);
  }
  if(kind==='PITCHING_PLAN'){
    const withPitching=players.filter(p=>p?.pitching&&Object.keys(p.pitching).length).length;
    if(withPitching<1)throw new Error('投手正本データを確認できないため投手運用審議を停止しました');
  }
}

function compactBatting(players){
  return players.map(p=>({
    name:p.name,
    games:p?.games??p?.batting?.GAMES??p?.batting?.G??'',
    PA:p?.batting?.PA??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',RBI:p?.batting?.RBI??'',
    AVG:p?.batting?.AVG??'',OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??'',
    RISP:p?.batting?.RISP??p?.batting?.RISP_AVG??'',BB:p?.batting?.BB??'',HBP:p?.batting?.HBP??'',SB:p?.batting?.SB??''
  }));
}

function reinforceEvidence(evidence){
  const e=clone(evidence)||{};
  const players=currentPlayers(e);
  const currentComplete=players.length===14&&players.every(p=>battingCore(p?.batting));
  const historicalComplete=String(e?.historicalReference?.status||'')==='COMPLETE';
  const recentComplete=String(e?.recentSix?.status||'')==='COMPLETE';
  e.numericEvidenceContract={
    version:'numeric-evidence-contract-v373',
    currentSeason:'2026-2027',
    currentBattingNumbersProvided:currentComplete,
    currentPlayersWithCoreBatting:players.filter(p=>battingCore(p?.batting)).length,
    historicalNumbersProvided:historicalComplete,
    recentSixNumbersProvided:recentComplete,
    instruction:'正本Evidenceを事実の唯一の数値根拠として使用する。FULL_LINEUPでは現チーム14名を比較し、candidatePlayersは現チームの異なる9名を1番から9番の順で返す。説明文の言い回しではなく構造化された選手名・数値を優先する。'
  };
  e.currentBattingAnchors=compactBatting(players);
  if(historicalComplete&&Array.isArray(e?.historicalReference?.players))e.historicalBattingAnchors=compactBatting(e.historicalReference.players);
  if(recentComplete&&Array.isArray(e?.recentSix?.players))e.recentSixBattingAnchors=compactBatting(e.recentSix.players);
  return e;
}

function validateDelivered(result,selectionKind){
  const kind=String(selectionKind||'').toUpperCase();
  if(kind!=='FULL_LINEUP')return;
  const delivered=result?.case?.evidence;
  if(delivered?.numericEvidenceContract?.currentBattingNumbersProvided!==true)throw new Error('数値Evidenceが3賢人エンジンへ到達していません');
  if(Number(delivered?.numericEvidenceContract?.currentPlayersWithCoreBatting)!==14)throw new Error('現チーム14名の数値Evidenceがエンジン側で不完全です');
  const finalLineup=result?.final?.lineup;
  if(!Array.isArray(finalLineup)||finalLineup.length!==9)throw new Error('最終ベストオーダーが9人で確定していません');
  const names=finalLineup.map(v=>text(v?.name)).filter(Boolean);
  if(names.length!==9||new Set(names.map(v=>v.normalize('NFKC').replace(/[\s　]/g,''))).size!==9)throw new Error('最終ベストオーダーに重複または欠落があります');
}

function bufferedOptions(original){
  const stageMap={
    PRIMARY:[28,'3賢人が正本Evidenceで一次独立判断中','INDEPENDENT JUDGMENT'],
    CROSS:[54,'一次判断を照合し、クロス審議中','CROSS EXAMINATION'],
    SECOND:[72,'クロス審議を受けて二次判断中','SECOND JUDGMENT'],
    INDEPENDENCE_RECHECK:[80,'3案の独立性を再確認中','INDEPENDENCE RECHECK'],
    FINAL:[88,'最終判断を集約中','FINAL DECISION']
  };
  const options={...original};
  options.onStage=s=>{const v=stageMap[String(s?.stage||'')];if(v)progress(v[0],v[1],v[2]);};
  options.onPrimaryLocked=()=>{};
  options.onCrossComplete=()=>{};
  options.onSecondComplete=()=>{};
  options.onFinalComplete=()=>{};
  options.onRetry=r=>{progress(60,`一時エラーを検出。再試行中（${r?.attempt||2}/3）`,'RETRY');};
  return options;
}

function replay(original,result){
  try{original?.onPrimaryLocked?.(clone(result?.primary));}catch(_){ }
  try{original?.onCrossComplete?.(clone(result?.crossExamination));}catch(_){ }
  try{original?.onSecondComplete?.(clone(result?.second));}catch(_){ }
  try{original?.onStage?.({stage:'FINAL',message:'最終決定を開始'});}catch(_){ }
  try{original?.onFinalComplete?.(clone(result?.final));}catch(_){ }
}

if(!engineUiRunner)throw new Error('正式3賢人UIランナーを取得できません');
if(!window.MAGI_ENGINE_V1||typeof window.MAGI_ENGINE_V1.deliberate!=='function')throw new Error('正式3賢人エンジンを取得できません');

window.searchDataEvidence=function(question){if(activeEvidence)return activeEvidence;return priorSearch?priorSearch(question):null;};

const runner=async function({question,evidence=null,selectionKind='',semantic=null}={}){
  if(running)throw new Error('MAGI審議はすでに実行中です');
  const q=$('q');if(!q)throw new Error('MAGI入力欄を取得できません');
  const nextQuestion=text(question||q.value);if(!nextQuestion)throw new Error('相談内容を入力してください');
  validateEvidence(evidence,selectionKind);
  const oldQuestion=q.value;
  const baseEngine=window.MAGI_ENGINE_V1;
  running=true;q.value=nextQuestion;
  try{
    progress(18,'正本Evidenceを固定。3賢人審議を開始します','CASE / EVIDENCE');
    activeEvidence=reinforceEvidence(evidence);
    const evidenceEngine=Object.freeze({
      version:`${String(baseEngine.version||'MAGI')}+explicit-evidence-v373`,
      personas:Array.isArray(baseEngine.personas)?baseEngine.personas.slice():[],
      deliberate:async(input,options={})=>{
        const enforcedInput={...input,evidence:clone(activeEvidence)};
        const result=await baseEngine.deliberate(enforcedInput,bufferedOptions(options));
        validateDelivered(result,selectionKind);
        replay(options,result);
        return result;
      }
    });
    window.MAGI_ENGINE_V1=evidenceEngine;
    const result=await engineUiRunner();
    progress(99,'最終結果の構造・Evidence整合性を確認済み','FINAL VALIDATION');
    return result;
  }catch(error){
    progressError('正式審議を完了できませんでした');
    throw error;
  }finally{
    activeEvidence=null;
    q.value=oldQuestion;
    window.MAGI_ENGINE_V1=baseEngine;
    running=false;
  }
};

runner.meta=Object.freeze({
  version:'formal-runner-v373-single-path',
  explicitEvidence:true,
  rawPacketValidated:true,
  engineBoundaryEnforced:true,
  numericFailClosed:true,
  structuredValidationOnly:true,
  proseBlocking:false,
  singlePass:true,
  localFallback:false
});
window.MAGI_FORMAL_UI_RUNNER_V3=runner;
window.MAGI_FORMAL_UI_RUNNER_V2=runner;
window.MAGI_FORMAL_RUNNER_V373_READY=true;
console.info('[MAGI formal runner v373] single-path runner active');
})();