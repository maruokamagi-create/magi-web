(()=>{
'use strict';
if(window.MAGI_CHAT_SINGLE_OWNER_V414)return;
window.MAGI_CHAT_SINGLE_OWNER_V414=true;
function cleanup(){
 const view=document.getElementById('magiChatView');if(!view)return;
 view.dataset.magiChatOwner='canonical-v387';
 // Keep exactly one real Wise Men cross-dialogue path. The v390 repair may
 // replace the canonical body after hydration; in that case its dialogue rows
 // are the only real cross-examination and must not be deleted.
 const canonical=[...view.querySelectorAll('[data-magi-canonical-direct-dialogue="true"]')];
 const repaired=[...view.querySelectorAll('[data-magi-wise-repair="dialogue"]')];
 if(canonical.length)repaired.forEach(n=>n.remove());
 view.querySelectorAll('[data-magi-direct-dialogue="true"]').forEach(n=>n.remove());
 view.querySelectorAll('.magiMsg').forEach(row=>{
   const sender=String(row.querySelector('.magiSender')?.textContent||'').trim();
   if(/^MAGI CONTROL\s*→/.test(sender))row.remove();
 });
}
function run(){cleanup();requestAnimationFrame(cleanup)}
document.addEventListener('magi:deliberation-result',()=>[0,100,300,800,1600].forEach(ms=>setTimeout(run,ms)));
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
run();
window.MAGI_CHAT_SINGLE_OWNER_META=Object.freeze({version:'v414',owner:'chat-ui-canonical-v387',removesLegacyCrossDuplicates:true,doesNotAlterPrimarySecondOrFinal:true});
})();
