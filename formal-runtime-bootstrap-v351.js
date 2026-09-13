(()=>{
'use strict';
if(window.MAGI_FORMAL_RUNTIME_BOOTSTRAP_V351)return;
window.MAGI_FORMAL_RUNTIME_BOOTSTRAP_V351=true;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`load failed: ${src}`));document.body.appendChild(s)});
function formalRunnerReady(){
  const fn=window.runMagi;
  if(typeof fn!=='function'||!window.MAGI_ENGINE_V1||!document.getElementById('magi-engine-ui-v187-style'))return false;
  try{return /MAGI_ENGINE_V1\.deliberate/.test(Function.prototype.toString.call(fn))}catch(_){return false}
}
async function waitLegacyComplete(){
  const started=Date.now();
  while(Date.now()-started<45000){
    if(window.MAGI_ACTIVE_VERSION&&formalRunnerReady())return true;
    await sleep(80);
  }
  return false;
}
async function boot(){
  const ok=await waitLegacyComplete();
  if(!ok){console.error('[MAGI formal bootstrap] legacy loader did not finish');return}
  await load('/deliberation-integrity-v348.js?v=351');
  const started=Date.now();
  while(Date.now()-started<10000){
    if(String(window.MAGI_ENGINE_V1?.version||'').includes('1.1.0-integrity'))break;
    await sleep(50);
  }
  await load('/lineup-finalizer-v350.js?v=351');
  await load('/main-live-answer-v329.js?v=351');
  window.MAGI_FORMAL_RUNTIME_READY_V351=true;
  document.dispatchEvent(new CustomEvent('magi:formal-runtime-ready'));
}
boot().catch(err=>console.error('[MAGI formal bootstrap]',err));
})();