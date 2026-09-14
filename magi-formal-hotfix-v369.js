(()=>{
'use strict';
if(window.MAGI_FORMAL_HOTFIX_V369)return;
window.MAGI_FORMAL_HOTFIX_V369=true;

const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v??null));
const text=v=>String(v??'').trim();
const priorSearch=typeof window.searchDataEvidence==='function'?window.searchDataEvidence.bind(window):null;
const engineUiRunner=(window.MAGI_ENGINE_UI_V187===true&&typeof window.runMagi==='function')?window.runMagi.bind(window):null;
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
    const body=text(evidence.text);
    if(!body.includes('【現チーム全14選手・打撃】')||!players.every(p=>body.includes(text(p.name))))throw new Error('3賢人へ渡す数値Evidence本文が不完全です');
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
    AVG:p?.batting?.AVG??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',RBI:p?.batting?.RBI??'',
    OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??''
  }));
}

function reinforceEvidence(evidence){
  const e=clone(evidence)||{};
  const players=currentPlayers(e);
  const currentComplete=players.length===14&&players.every(p=>battingCore(p?.batting));
  const historicalComplete=String(e?.historicalReference?.status||'')==='COMPLETE';
  const recentComplete=String(e?.recentSix?.status||'')==='COMPLETE';
  e.numericEvidenceContract={
    version:'numeric-evidence-contract-v369',
    currentSeason:'2026-2027',
    currentBattingNumbersProvided:currentComplete,
    currentPlayersWithCoreBatting:players.filter(p=>battingCore(p?.batting)).length,
    historicalNumbersProvided:historicalComplete,
    recentSixNumbersProvided:recentComplete,
    instruction:'2026-2027今季通算の数値はCASE.evidence内に提供済みです。提供済み数値を未記載・未確認・未提供扱いしないでください。FULL_LINEUPでは正本数値を根拠として使ってください。'
  };
  e.currentBattingAnchors=compactBatting(players);
  if(historicalComplete&&Array.isArray(e?.historicalReference?.players))e.historicalBattingAnchors=compactBatting(e.historicalReference.players);
  if(recentComplete&&Array.isArray(e?.recentSix?.players))e.recentSixBattingAnchors=e.recentSix.players.map(p=>({name:p.name,games:p.games??'',PA:p?.batting?.PA??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',AVG:p?.batting?.AVG??'',OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??''}));
  const notice=`【重要：数値Evidence確認済み】2026-2027今季通算は現チーム14名全員について打率・打数・OPSを提供済みです。数値が無いとは回答しないでください。${historicalComplete?'2025-2026過去実績も提供済みです。':'2025-2026過去実績は取得状態に従ってください。'}${recentComplete?'直近6試合も提供済みです。':'直近6試合は取得状態に従ってください。'}`;
  e.text=`${notice}\n${text(e.text)}`;
  return e;
}

function validateDelivered(result,selectionKind){
  const kind=String(selectionKind||'').toUpperCase();
  if(kind!=='FULL_LINEUP')return;
  const delivered=result?.case?.evidence;
  if(delivered?.numericEvidenceContract?.currentBattingNumbersProvided!==true)throw new Error('数値Evidenceが3賢人エンジンへ到達していません');
  if(Number(delivered?.numericEvidenceContract?.currentPlayersWithCoreBatting)!==14)throw new Error('現チーム14名の数値Evidenceがエンジン側で不完全です');
}

function bufferedOptions(original){
  const stageMap={
    PRIMARY:[28,'3賢人が数値Evidenceを使って一次独立判断中','INDEPENDENT JUDGMENT'],
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
  options.onRetry=r=>{progress(60,`一時エラーを検出。安全に再試行中（${r?.attempt||2}/3）`,'RETRY');};
  return options;
}

function replay(original,result){
  try{original?.onPrimaryLocked?.(clone(result?.primary));}catch(_){ }
  try{original?.onCrossComplete?.(clone(result?.crossExamination));}catch(_){ }
  try{original?.onSecondComplete?.(clone(result?.second));}catch(_){ }
  try{original?.onStage?.({stage:'FINAL',message:'最終決定を開始'});}catch(_){ }
  try{original?.onFinalComplete?.(clone(result?.final));}catch(_){ }
}

if(!engineUiRunner)return;
window.searchDataEvidence=function(question){if(activeEvidence)return activeEvidence;return priorSearch?priorSearch(question):null;};

const runner=async function({question,evidence=null,selectionKind='',semantic=null}={}){
  if(running)throw new Error('MAGI審議はすでに実行中です');
  const q=$('q');if(!q)throw new Error('MAGI入力欄を取得できません');
  const nextQuestion=text(question||q.value);if(!nextQuestion)throw new Error('相談内容を入力してください');
  validateEvidence(evidence,selectionKind);
  const oldQuestion=q.value;
  const baseEngine=window.MAGI_ENGINE_V1;
  if(!baseEngine||typeof baseEngine.deliberate!=='function')throw new Error('正式3賢人エンジンを取得できません');
  running=true;q.value=nextQuestion;
  try{
    progress(18,'正本Evidenceを確認。3賢人へ数値を直接渡します','CASE / EVIDENCE');
    activeEvidence=reinforceEvidence(evidence);
    const evidenceEngine=Object.freeze({
      version:`${String(baseEngine.version||'MAGI')}+explicit-evidence-v369`,
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
    progress(99,'最終結果のEvidence整合性を確認済み','FINAL VALIDATION');
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
runner.meta=Object.freeze({version:'formal-runner-v369',explicitEvidence:true,engineBoundaryEnforced:true,numericFailClosed:true,semanticFirst:true,localFallback:false,singlePass:true});
window.MAGI_FORMAL_UI_RUNNER_V3=runner;

const guard=window.MAGI_UI_TRUTH_V363_API?.installFormalRunnerGuard?.();
if(typeof guard==='function')window.MAGI_FORMAL_UI_RUNNER_V2=guard;
console.info('[MAGI formal hotfix v369] active: single-pass evidence validation');
})();