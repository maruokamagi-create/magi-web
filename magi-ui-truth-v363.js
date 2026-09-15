(()=>{
'use strict';
if(window.MAGI_UI_TRUTH_V363)return;
window.MAGI_UI_TRUTH_V363=true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>String(v??'').trim();
function filesOf(evidence){return Array.isArray(evidence?.files)?evidence.files.filter(Boolean):[];}
function playersOf(evidence){return Array.isArray(evidence?.allCurrentTeamCheck?.players)?evidence.allCurrentTeamCheck.players:[];}
function isNumberLike(v){const s=text(v).replace(/,/g,'');return /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s);}
function battingCore(stats){return Boolean(stats&&isNumberLike(stats.AVG)&&isNumberLike(stats.AB)&&isNumberLike(stats.OPS));}
function currentNumericReady(evidence){
  const players=playersOf(evidence);
  return Number(evidence?.count)===14&&players.length===14&&players.every(p=>battingCore(p?.batting))&&filesOf(evidence).some(name=>/2026-2027.*\.xlsm$/i.test(String(name)));
}
function syncCaseMeta(evidence){
  const meta=document.getElementById('caseMeta');
  if(!meta||!evidence)return;
  const html=String(meta.innerHTML||'');
  const files=filesOf(evidence).map(esc).join('、');
  if(/DATA HUB\s*：/.test(html)){
    meta.innerHTML=html
      .replace(/DATA HUB\s*：[^<]*/,'DATA HUB：'+(Number(evidence.count)||0)+'件参照')
      .replace(/参照ファイル\s*：[^<]*/,'参照ファイル：'+files);
    return;
  }
  meta.insertAdjacentHTML('beforeend',`<br>DATA HUB：${Number(evidence.count)||0}件参照<br>参照ファイル：${files}`);
}
const missingPattern=/(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている|十分に揃っていない)/;
const currentSeasonPattern=/(?:2026-2027|今季通算|今季)/;
const battingEvidencePattern=/(?:打撃|打率|打数|打席|安打|出塁率|長打率|OPS|打点|得点圏|四球|死球|犠打|犠飛|盗塁)/i;
const genericNumericPattern=/(?:数値データ|成績データ|正本数値)/;
const fieldingPattern=/(?:守備|守備位置|ポジション|失策|捕球|送球|刺殺|補殺)/;
function hasFalseCurrentGap(body){
  return String(body||'').split(/[。！？\n]+/).some(sentence=>{
    const s=sentence.trim();
    if(!s||!missingPattern.test(s))return false;
    if(currentSeasonPattern.test(s)&&battingEvidencePattern.test(s))return true;
    if(genericNumericPattern.test(s)&&!fieldingPattern.test(s))return true;
    return false;
  });
}
function historicalGapPattern(){return /(?:2025-2026|過去実績).{0,90}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている)/s;}
function recentGapPattern(){return /(?:直近6試合|直近六試合|打撃詳細データ).{0,90}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている)/s;}
function visibleHasFalseGap(evidence){
  const response=document.getElementById('response');
  const body=String(response?.textContent||'');
  if(!body)return false;
  if(currentNumericReady(evidence)&&hasFalseCurrentGap(body))return true;
  if(String(evidence?.historicalReference?.status||'')==='COMPLETE'&&historicalGapPattern().test(body))return true;
  if(String(evidence?.recentSix?.status||'')==='COMPLETE'&&recentGapPattern().test(body))return true;
  return false;
}
function caseMetaIsTruthful(evidence){
  const body=String(document.getElementById('caseMeta')?.textContent||'');
  const files=filesOf(evidence);
  if(!body.includes(`DATA HUB：${Number(evidence?.count)||0}件参照`))return false;
  return files.length>0&&files.every(name=>body.includes(String(name)));
}
function clearWrongVisibleResult(message){
  const response=document.getElementById('response');
  if(response)response.classList.remove('show');
  const status=document.getElementById('status');
  if(status)status.textContent=message;
  window.MAGI_PROGRESS_V358?.error?.(message);
}
function installFormalRunnerGuard(){
  const base=window.MAGI_FORMAL_UI_RUNNER_V3;
  if(typeof base!=='function')throw new Error('v358正式ランナーを取得できません');
  const guarded=async function(args={}){
    const evidence=args?.evidence||null;
    const kind=String(args?.selectionKind||evidence?.selectionKind||'').toUpperCase();
    if(kind==='FULL_LINEUP'&&!currentNumericReady(evidence))throw new Error('現チーム14名の正本打撃数値が完全ではないため審議を開始しません');
    const result=await base({...args,selectionKind:kind});
    syncCaseMeta(evidence);
    if(kind==='FULL_LINEUP'){
      if(!caseMetaIsTruthful(evidence)){
        clearWrongVisibleResult('DATA HUB表示と正本Evidenceが一致しないため結果を公開しません');
        throw new Error('DATA_HUB_UI_MISMATCH');
      }
      if(visibleHasFalseGap(evidence)){
        clearWrongVisibleResult('提供済みの打撃数値を未提供扱いしたため結果を公開しません');
        throw new Error('FALSE_MISSING_DATA_RESULT_BLOCKED');
      }
    }
    return result;
  };
  guarded.meta=Object.freeze({version:'formal-runner-v363-ui-truth',explicitEvidence:true,rawPacketValidated:true,engineBoundaryEnforced:true,numericFailClosed:true,uiTruthFailClosed:true,semanticFirst:true,localFallback:false});
  window.MAGI_FORMAL_UI_RUNNER_V4=guarded;
  return guarded;
}
window.MAGI_UI_TRUTH_V363_API=Object.freeze({version:'ui-truth-v363',currentNumericReady,syncCaseMeta,visibleHasFalseGap,caseMetaIsTruthful,clearWrongVisibleResult,installFormalRunnerGuard});
})();
