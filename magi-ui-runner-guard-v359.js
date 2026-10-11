(()=>{
'use strict';
if(window.MAGI_UI_RUNNER_GUARD_V359)return;
const base=typeof window.runMagi==='function'?window.runMagi.bind(window):null;
if(!base)throw new Error('正式3賢人UIランナーを取得できません');
window.MAGI_UI_RUNNER_GUARD_V359=true;
window.runMagi=async function(...args){
  const result=await base(...args);
  const status=String(document.getElementById('status')?.textContent||'');
  if(/MAGI正式審議エラー|正式審議を完了できませんでした/.test(status)){
    const errBox=document.querySelector('.engineError');
    const detail=String(errBox?.textContent||status).replace(/\s+/g,' ').trim();
    // The UI catches the actual persona HTTP error to preserve public logs.
    // Propagate that same Error to the formal runner instead of losing its
    // stage, sanitized failure class and HTTP status in a text-only wrapper.
    const underlying=window.MAGI_LAST_UI_DELIBERATION_ERROR;
    if(underlying&&typeof underlying==='object'&&typeof underlying.message==='string')throw underlying;
    throw new Error(detail||'正式3賢人UIが審議エラーを検出しました');
  }
  return result;
};
window.MAGI_UI_RUNNER_GUARD_V359_META=Object.freeze({version:'ui-runner-guard-v359',propagatesErrors:true,localFallback:false});
})();
