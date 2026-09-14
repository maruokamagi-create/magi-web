(()=>{
'use strict';
if(window.MAGI_UI_TRUTH_V359)return;
window.MAGI_UI_TRUTH_V359=true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function filesOf(evidence){return Array.isArray(evidence?.files)?evidence.files.filter(Boolean):[];}
function currentNumericReady(evidence){
  const c=evidence?.numericEvidenceContract||{};
  return Number(evidence?.count)===14&&c.currentBattingNumbersProvided===true&&Number(c.currentPlayersWithCoreBatting)===14&&filesOf(evidence).some(name=>/2026-2027.*\.xlsm$/i.test(String(name)));
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
function falseGapPattern(){return /(?:2026-2027|今季通算|今季|2025-2026|過去実績|直近6試合|直近六試合|数値データ|打撃詳細データ).{0,90}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている|十分に揃っていない)/s;}
function visibleHasFalseGap(){
  const response=document.getElementById('response');
  return !!(response&&falseGapPattern().test(String(response.textContent||'')));
}
function caseMetaIsTruthful(evidence){
  const text=String(document.getElementById('caseMeta')?.textContent||'');
  const files=filesOf(evidence);
  if(!text.includes(`DATA HUB：${Number(evidence?.count)||0}件参照`))return false;
  return files.length>0&&files.every(name=>text.includes(String(name)));
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
    const kind=String(args?.selectionKind||'').toUpperCase();
    if(kind==='FULL_LINEUP'&&!currentNumericReady(evidence))throw new Error('現チーム14名の数値Evidenceが完全ではないため審議を開始しません');
    const result=await base(args);
    syncCaseMeta(evidence);
    if(kind==='FULL_LINEUP'){
      if(!caseMetaIsTruthful(evidence)){
        clearWrongVisibleResult('DATA HUB表示と正本Evidenceが一致しないため結果を公開しません');
        throw new Error('DATA_HUB_UI_MISMATCH');
      }
      if(visibleHasFalseGap()){
        clearWrongVisibleResult('提供済みの数値を未提供扱いしたため結果を公開しません');
        throw new Error('FALSE_MISSING_DATA_RESULT_BLOCKED');
      }
    }
    return result;
  };
  guarded.meta=Object.freeze({version:'formal-runner-v359-ui-truth',explicitEvidence:true,engineBoundaryEnforced:true,numericFailClosed:true,uiTruthFailClosed:true,semanticFirst:true,localFallback:false});
  window.MAGI_FORMAL_UI_RUNNER_V4=guarded;
  return guarded;
}
window.MAGI_UI_TRUTH_V359_API=Object.freeze({version:'ui-truth-v359',currentNumericReady,syncCaseMeta,visibleHasFalseGap,caseMetaIsTruthful,clearWrongVisibleResult,installFormalRunnerGuard});
})();
