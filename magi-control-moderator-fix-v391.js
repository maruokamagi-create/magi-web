(()=>{
'use strict';
if(window.MAGI_CONTROL_MODERATOR_FIX_V391)return;
window.MAGI_CONTROL_MODERATOR_FIX_V391=true;

const style=document.createElement('style');
style.id='magi-control-moderator-fix-v391-style';
style.textContent=`
/* Keep the three Wise Men untouched. Suppress only legacy MAGI CONTROL turns that behave like a fourth debater. */
#magiChatView .magiMsg.system[data-magi-canonical-control="true"]:not(.magiMidControl):not(.finalSummary){display:none!important}
`;
document.head.appendChild(style);

function suppressLegacyControl(root=document){
  const rows=[];
  if(root?.matches?.('#magiChatView .magiMsg.system'))rows.push(root);
  root?.querySelectorAll?.('#magiChatView .magiMsg.system').forEach(row=>rows.push(row));
  rows.forEach(row=>{
    if(row.classList.contains('magiMidControl')||row.classList.contains('finalSummary'))return;
    const sender=String(row.querySelector('.magiSender')?.textContent||'').trim();
    if(/^MAGI CONTROL/.test(sender)){
      row.dataset.magiControlModeratorSuppressed='true';
      row.style.setProperty('display','none','important');
    }
  });
}

suppressLegacyControl(document);
new MutationObserver(mutations=>{
  for(const mutation of mutations){
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType===Node.ELEMENT_NODE)suppressLegacyControl(node);
    });
  }
}).observe(document.documentElement,{childList:true,subtree:true});

window.MAGI_CONTROL_MODERATOR_FIX_META=Object.freeze({
  version:'v391',
  wiseMenUntouched:true,
  controlMode:'moderator-only',
  allowedMidControl:['争点整理','相互検証まとめ'],
  suppressFourthDebaterControl:true
});
})();
