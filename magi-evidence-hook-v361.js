(()=>{
'use strict';
if(window.MAGI_EVIDENCE_HOOK_V361)return;
window.MAGI_EVIDENCE_HOOK_V361=true;
const base=window.MAGI_FORMAL_UI_RUNNER_V3;
if(typeof base!=='function')throw new Error('正式Evidenceランナーを取得できません');
const text=v=>String(v??'').trim();
function resolvedKind(args){
  return text(args?.evidence?.selectionKind||args?.selectionKind||args?.semantic?.selectionKind).toUpperCase();
}
function validate(evidence,kind){
  if(kind!=='FULL_LINEUP')return;
  if(!evidence||Number(evidence.count)!==14)throw new Error('FULL_LINEUPの正本Evidenceが14名分揃っていないため審議を停止しました');
  const players=Array.isArray(evidence?.allCurrentTeamCheck?.players)?evidence.allCurrentTeamCheck.players:[];
  if(players.length!==14)throw new Error('FULL_LINEUPの現チーム14名確認が不完全なため審議を停止しました');
  if(!Array.isArray(evidence.files)||!evidence.files.some(name=>/2026-2027.*\.xlsm$/i.test(String(name))))throw new Error('2026-2027正本XLSMを確認できないため審議を停止しました');
}
const hooked=async function(args={}){
  const evidence=args?.evidence||null;
  const kind=resolvedKind(args);
  validate(evidence,kind);
  const previous=window.searchDataEvidence;
  const explicitSearch=()=>evidence;
  explicitSearch.__magiExplicitEvidence=true;
  window.searchDataEvidence=explicitSearch;
  window.__MAGI_ACTIVE_EXPLICIT_EVIDENCE=evidence;
  try{
    return await base({...args,selectionKind:kind});
  }finally{
    if(window.searchDataEvidence===explicitSearch)window.searchDataEvidence=previous;
    window.__MAGI_ACTIVE_EXPLICIT_EVIDENCE=null;
  }
};
hooked.meta=Object.freeze({version:'evidence-hook-v361',explicitAtExecution:true,kindFromEvidenceFirst:true,failClosed:true});
window.MAGI_FORMAL_UI_RUNNER_V3=hooked;
window.MAGI_EVIDENCE_HOOK_V361_META=hooked.meta;
})();