(()=>{
'use strict';
let tries=0,loaded=false;
const load=src=>new Promise(r=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=r;document.head.appendChild(s)});
async function boot(){
  tries++;
  const ready=window.MAGI_ACTIVE_VERSION&&window.MAGI_ENGINE_V1&&typeof window.searchDataEvidence==='function'&&typeof window.runMagi==='function';
  if(!ready){if(tries<300)setTimeout(boot,100);return;}
  if(loaded)return;loaded=true;
  if(window.MAGI_CANDIDATE_PRIORITY!=='v220')await load('/evidence-candidate-priority-v212.js?v=224');
  if(window.MAGI_NUMERIC_EVIDENCE_GUARD!=='v220')await load('/numeric-evidence-guard-v220.js?v=224');
  await load('/numeric-integrity-v239.js?v=239');
  await load('/stats-report-v243.js?v=243');
  window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP='v243';
}
boot();
})();
