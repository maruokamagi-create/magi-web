(()=>{
'use strict';
if(window.MAGI_FORMAL_RUNNER_V358)return;
window.MAGI_FORMAL_RUNNER_V358=true;

const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v??null));
const text=v=>String(v??'').trim();
const originalSearch=typeof window.searchDataEvidence==='function'?window.searchDataEvidence.bind(window):null;
const engineUiRunner=(window.MAGI_ENGINE_UI_V187===true&&typeof window.runMagi==='function')?window.runMagi.bind(window):null;
let activeEvidence=null;
let running=false;

function progress(pct,label,step){
  const api=window.MAGI_PROGRESS_V358;
  if(api?.update)api.update(pct,label,step);
  else document.dispatchEvent(new CustomEvent('magi:progress',{detail:{pct,label,step}}));
}
function progressError(label){const api=window.MAGI_PROGRESS_V358;if(api?.error)api.error(label);}
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
  return players.map(p=>({name:p.name,AVG:p?.batting?.AVG??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',RBI:p?.batting?.RBI??'',OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??''}));
}
function reinforceEvidence(evidence,attempt=1){
  const e=clone(evidence)||{};
  const players=currentPlayers(e);
  const currentComplete=players.length===14&&players.every(p=>battingCore(p?.batting));
  const historicalComplete=String(e?.historicalReference?.status||'')==='COMPLETE';
  const recentComplete=String(e?.recentSix?.status||'')==='COMPLETE';
  e.numericEvidenceContract={
    version:'numeric-evidence-contract-v358',
    attempt,
    currentSeason:'2026-2027',
    currentBattingNumbersProvided:currentComplete,
    currentPlayersWithCoreBatting:players.filter(p=>battingCore(p?.batting)).length,
    historicalNumbersProvided:historicalComplete,
    recentSixNumbersProvided:recentComplete,
    instruction:'2026-2027今季通算の数値はCASE.evidence内に提供済みです。提供済み数値を「未記載」「確認できない」「提供されていない」と記述してはいけません。FULL_LINEUPでは各人格が具体的な数値を根拠として使ってください。'
  };
  e.currentBattingAnchors=compactBatting(players);
  if(historicalComplete&&Array.isArray(e?.historicalReference?.players))e.historicalBattingAnchors=compactBatting(e.historicalReference.players);
  if(recentComplete&&Array.isArray(e?.recentSix?.players))e.recentSixBattingAnchors=e.recentSix.players.map(p=>({name:p.name,games:p.games??'',PA:p?.batting?.PA??'',AB:p?.batting?.AB??'',H:p?.batting?.H??'',AVG:p?.batting?.AVG??'',OBP:p?.batting?.OBP??'',SLG:p?.batting?.SLG??'',OPS:p?.batting?.OPS??''}));
  const notice=`【重要：数値Evidence確認済み】2026-2027今季通算は現チーム14名全員について打率・打数・OPSを提供済みです。数値が無いとは回答しないでください。${historicalComplete?'2025-2026過去実績も提供済みです。':'2025-2026過去実績は取得状態に従ってください。'}${recentComplete?'直近6試合も提供済みです。':'直近6試合は取得状態に従ってください。'}`;
  e.text=`${notice}\n${text(e.text)}`;
  return e;
}
function resultText(value){
  if(!value||typeof value!=='object')return'';
  return [value.candidateBasis,...(Array.isArray(value.facts)?value.facts:[]),...(Array.isArray(value.analysis)?value.analysis:[]),value.primaryReason,value.publicStatement,...(Array.isArray(value.warnings)?value.warnings:[])].map(text).filter(Boolean).join('。');
}
function metricAnchorCount(value){
  const s=resultText(value);
  const m=s.match(/(?:打率|OPS|出塁率|長打率|打数|打席|安打|打点)\s*(?:[:：=はが]?\s*)?(?:\.\d+|0\.\d+|\d+(?:\.\d+)?)/gi);
  return m?m.length:0;
}
function falseNumericGap(value,evidence){
  const s=resultText(value);
  if(!s)return false;
  const currentComplete=Number(evidence?.numericEvidenceContract?.currentPlayersWithCoreBatting)===14;
  if(currentComplete&&/(?:2026-2027|今季通算|今季|数値データ|打撃成績).{0,42}(?:提供データに含まれていない|含まれていません|未記載|確認できない|確認できません|提供されていない|提供されていません|一切提供|集計不能)/s.test(s))return true;
  if(currentComplete&&/(?:過去実績、?\s*)?今季通算.{0,50}(?:数値|データ).{0,24}(?:ない|未記載|確認できない)/s.test(s))return true;
  if(evidence?.numericEvidenceContract?.historicalNumbersProvided&&/(?:2025-2026|過去実績).{0,42}(?:含まれていない|未記載|確認できない|提供されていない)/s.test(s))return true;
  if(evidence?.numericEvidenceContract?.recentSixNumbersProvided&&/(?:直近6試合|直近六試合).{0,42}(?:集計不能|未記載|確認できない|提供されていない)/s.test(s))return true;
  return false;
}
function validateResult(result,evidence,selectionKind){
  const kind=String(selectionKind||'').toUpperCase();
  if(kind!=='FULL_LINEUP')return {ok:true,issues:[]};
  const issues=[];
  const delivered=result?.case?.evidence;
  if(delivered?.numericEvidenceContract?.currentBattingNumbersProvided!==true)issues.push('engine did not receive current numeric Evidence contract');
  if(Number(delivered?.numericEvidenceContract?.currentPlayersWithCoreBatting)!==14)issues.push('engine current numeric coverage is not 14/14');
  for(const phase of ['primary','second']){
    const set=result?.[phase]||{};
    for(const persona of ['melchior','balthasar','casper']){
      const row=set?.[persona];
      if(falseNumericGap(row,delivered||evidence))issues.push(`${phase}.${persona}: supplied numeric Evidence was described as missing`);
      if(metricAnchorCount(row)<2)issues.push(`${phase}.${persona}: concrete batting metrics are too thin`);
    }
  }
  return {ok:issues.length===0,issues};
}
function bufferedOptions(original,attempt){
  const captured={};
  const stageMap=attempt===1?{
    PRIMARY:[28,'3賢人が数値Evidenceを使って一次独立判断中','INDEPENDENT JUDGMENT'],
    CROSS:[54,'一次判断を照合し、クロス審議中','CROSS EXAMINATION'],
    SECOND:[72,'クロス審議を受けて二次判断中','SECOND JUDGMENT'],
    INDEPENDENCE_RECHECK:[80,'3案の独立性を再確認中','INDEPENDENCE RECHECK'],
    FINAL:[88,'最終判断を集約中','FINAL DECISION']
  }:{
    PRIMARY:[91,'数値Evidenceを再確認して再審議中','EVIDENCE RECHECK'],
    CROSS:[93,'再審議のクロス検証中','CROSS RECHECK'],
    SECOND:[95,'再審議の二次判断中','SECOND RECHECK'],
    INDEPENDENCE_RECHECK:[96,'独立性を再確認中','INDEPENDENCE RECHECK'],
    FINAL:[97,'再審議の最終判断を検証中','FINAL VALIDATION']
  };
  const options={...original};
  options.onStage=s=>{captured.stage=s;const v=stageMap[String(s?.stage||'')];if(v)progress(v[0],v[1],v[2]);};
  options.onPrimaryLocked=p=>{captured.primary=clone(p);};
  options.onCrossComplete=c=>{captured.cross=clone(c);};
  options.onSecondComplete=s=>{captured.second=clone(s);};
  options.onFinalComplete=f=>{captured.final=clone(f);};
  options.onRetry=r=>{progress(attempt===1?60:94,`一時エラーを検出。安全に再試行中（${r?.attempt||2}/3）`,'RETRY');};
  return {options,captured};
}
function replay(original,result){
  try{original?.onPrimaryLocked?.(clone(result?.primary));}catch(_){ }
  try{original?.onCrossComplete?.(clone(result?.crossExamination));}catch(_){ }
  try{original?.onSecondComplete?.(clone(result?.second));}catch(_){ }
  try{original?.onStage?.({stage:'FINAL',message:'最終決定を開始'});}catch(_){ }
  try{original?.onFinalComplete?.(clone(result?.final));}catch(_){ }
}

if(!engineUiRunner)throw new Error('正式3賢人UIランナーを取得できません');
window.searchDataEvidence=function(question){if(activeEvidence)return activeEvidence;return originalSearch?originalSearch(question):null;};

window.MAGI_FORMAL_UI_RUNNER_V3=async function({question,evidence=null,selectionKind='',semantic=null}={}){
  if(running)throw new Error('MAGI審議はすでに実行中です');
  const q=$('q');if(!q)throw new Error('MAGI入力欄を取得できません');
  const nextQuestion=text(question||q.value);if(!nextQuestion)throw new Error('相談内容を入力してください');
  validateEvidence(evidence,selectionKind);
  const oldQuestion=q.value;const baseEngine=window.MAGI_ENGINE_V1;
  if(!baseEngine||typeof baseEngine.deliberate!=='function')throw new Error('正式3賢人エンジンを取得できません');
  running=true;q.value=nextQuestion;
  let acceptedResult=null;
  try{
    progress(18,'正本Evidenceを確認。3賢人へ数値を直接渡します','CASE / EVIDENCE');
    for(let attempt=1;attempt<=2;attempt++){
      activeEvidence=reinforceEvidence(evidence,attempt);
      if(attempt===2)progress(90,'数値Evidenceの使用不足を検出。結果を公開せず再審議します','EVIDENCE RECHECK');
      let capturedOriginalOptions=null;
      const evidenceEngine=Object.freeze({
        version:`${String(baseEngine.version||'MAGI')}+explicit-evidence-v358`,
        personas:Array.isArray(baseEngine.personas)?baseEngine.personas.slice():[],
        deliberate:async(input,options={})=>{
          capturedOriginalOptions=options;
          const {options:buffered}=bufferedOptions(options,attempt);
          const enforcedInput={...input,evidence:clone(activeEvidence)};
          const result=await baseEngine.deliberate(enforcedInput,buffered);
          const check=validateResult(result,activeEvidence,selectionKind);
          if(!check.ok){const err=new Error(`NUMERIC_EVIDENCE_RESULT_INVALID: ${check.issues.slice(0,6).join(' / ')}`);err.evidenceIssues=check.issues;throw err;}
          acceptedResult=result;
          replay(capturedOriginalOptions,result);
          return result;
        }
      });
      window.MAGI_ENGINE_V1=evidenceEngine;
      try{
        const result=await engineUiRunner();
        if(acceptedResult){
          const delivered=acceptedResult?.case?.evidence;
          if(String(selectionKind||'').toUpperCase()==='FULL_LINEUP'&&Number(delivered?.numericEvidenceContract?.currentPlayersWithCoreBatting)!==14)throw new Error('数値Evidenceのエンジン到達確認に失敗しました');
          progress(99,'最終結果のEvidence整合性を確認済み','FINAL VALIDATION');
        }
        return result;
      }catch(error){
        if(attempt<2&&/NUMERIC_EVIDENCE_RESULT_INVALID/.test(String(error?.message||'')))continue;
        throw error;
      }finally{
        window.MAGI_ENGINE_V1=baseEngine;
      }
    }
    throw new Error('数値Evidenceを使った審議結果を確定できませんでした');
  }catch(error){
    progressError('数値Evidenceの整合性を確保できず審議を停止しました');
    throw error;
  }finally{
    activeEvidence=null;q.value=oldQuestion;window.MAGI_ENGINE_V1=baseEngine;running=false;
  }
};
window.MAGI_FORMAL_UI_RUNNER_V3.meta=Object.freeze({version:'formal-runner-v358',explicitEvidence:true,engineBoundaryEnforced:true,numericFailClosed:true,semanticFirst:true,localFallback:false});
})();
