(()=>{
'use strict';
if(window.MAGI_UI_TRUTH_V359)return;
window.MAGI_UI_TRUTH_V359=true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function syncCaseMeta(evidence,result){
  const meta=document.getElementById('caseMeta');
  if(!meta||!evidence)return;
  const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  const id=result?.case?.id||`MAGI-${Date.now()}`;
  const mode=result?.case?.mode==='selection'?'選択審議':'賛否審議';
  const files=Array.isArray(evidence.files)?evidence.files.filter(Boolean):[];
  meta.innerHTML=`審議日：${date}<br>審議案件番号：${esc(id)}<br>審議方式：${mode}<br>DATA HUB：${Number(evidence.count)||0}件参照<br>参照ファイル：${esc(files.join('、'))}<br>ENGINE：Gemini v1.0`;
}
function falseGapPattern(){return /(?:2026-2027|今季通算|今季|2025-2026|過去実績|直近6試合|直近六試合|数値データ|打撃詳細データ).{0,70}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|欠損している|欠けている|十分に揃っていない)/s;}
function textTree(value,out=[]){
  if(typeof value==='string'){out.push(value);return out;}
  if(Array.isArray(value)){value.forEach(v=>textTree(v,out));return out;}
  if(value&&typeof value==='object')Object.values(value).forEach(v=>textTree(v,out));
  return out;
}
function resultHasFalseGap(result,evidence){
  const c=evidence?.numericEvidenceContract||{};
  if(!c.currentBattingNumbersProvided)return false;
  const strings=textTree({crossExamination:result?.crossExamination,final:result?.final});
  const re=falseGapPattern();
  return strings.some(s=>re.test(String(s||'')));
}
function visibleHasFalseGap(){
  const response=document.getElementById('response');
  return !!(response&&falseGapPattern().test(response.textContent||''));
}
function clearWrongVisibleResult(message){
  const response=document.getElementById('response');
  if(response)response.classList.remove('show');
  const status=document.getElementById('status');
  if(status)status.textContent=message;
}
window.MAGI_UI_TRUTH_V359_API=Object.freeze({
  version:'ui-truth-v359',
  syncCaseMeta,
  resultHasFalseGap,
  visibleHasFalseGap,
  clearWrongVisibleResult
});
})();