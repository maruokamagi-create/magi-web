(()=>{
'use strict';
let tries=0;
const load=src=>new Promise(r=>{const s=document.createElement('script');s.src=src;s.onload=r;s.onerror=r;document.head.appendChild(s)});
async function boot(){
  tries++;
  if(!window.searchDataEvidence){if(tries<120)setTimeout(boot,100);return;}
  if(window.MAGI_CANDIDATE_PRIORITY!=='v220')await load('/evidence-candidate-priority-v212.js?v=220');
  if(window.MAGI_NUMERIC_EVIDENCE_GUARD!=='v220')await load('/numeric-evidence-guard-v220.js?v=220');
  if(window.MAGI_NUMERIC_STRICT_GATE!=='v221')await load('/numeric-integrity-v221.js?v=221');
  window.MAGI_NUMERIC_EVIDENCE_BOOTSTRAP='v221';
}
boot();
})();
