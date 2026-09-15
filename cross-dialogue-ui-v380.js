(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_UI_V380)return;
window.MAGI_CROSS_DIALOGUE_UI_V380=true;

const JP={
  'MELCHIOR-1':'メルキオール',
  'BALTHASAR-2':'バルタザール',
  'CASPER-3':'カスパー'
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dialogueOf(result){return Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[]}
function liveExchange(turn){
  const d=document.createElement('div');d.className='magiExchange';d.dataset.magiDirectDialogue='true';
  const target=JP[turn.target]||String(turn.target||'');
  d.innerHTML=`<div class="magiSpeaker">${esc(turn.speaker)}${target?` → ${esc(target)}`:''}<span class="magiJudge">相互検証</span></div><div class="magiSpeech magiChallenge">${esc(turn.statement)}</div>`;
  return d;
}
function patchLive(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const body=document.getElementById('magiLiveBody');if(!body)return false;
  body.querySelectorAll('[data-magi-direct-dialogue="true"]').forEach(n=>n.remove());
  [...body.querySelectorAll('.magiExchange')].forEach(ex=>{
    const speaker=ex.querySelector('.magiSpeaker')?.textContent?.trim()||'';
    if(/^MAGI CONTROL\s*→/.test(speaker))ex.remove();
  });
  const anchor=[...body.querySelectorAll('.magiExchange')].find(ex=>ex.querySelector('.magiSpeech')?.classList.contains('magiReply'))||null;
  for(const turn of dialogue){const node=liveExchange(turn);anchor?body.insertBefore(node,anchor):body.appendChild(node)}
  return true;
}
function patchChat(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return;
  const view=document.getElementById('magiChatView');if(!view)return;
  const body=view.querySelector('.magiChatBody');if(!body)return;
  body.querySelectorAll('[data-magi-dialogue-phase="true"]').forEach(n=>n.remove());
  const msgs=[...body.querySelectorAll('.magiMsg:not(.finalSummary)')];
  if(msgs.length<6)return;
  const start=3;
  const phase=document.createElement('div');phase.className='magiChatPhase';phase.dataset.magiDialoguePhase='true';phase.textContent='相互検証';
  body.insertBefore(phase,msgs[start]||null);
  dialogue.forEach((turn,i)=>{
    const msg=msgs[start+i];if(!msg)return;
    const meta=msg.querySelector('.magiSender span');
    const target=JP[turn.target]||String(turn.target||'');
    if(meta)meta.textContent=target?`→ ${target}`:String(turn.speaker||'');
  });
}
function apply(result){patchLive(result);[40,100,220,420].forEach(ms=>setTimeout(()=>{patchLive(result);patchChat(result)},ms))}
document.addEventListener('magi:deliberation-result',event=>apply(event.detail||window.MAGI_LAST_DELIBERATION_RESULT||null));
window.MAGI_CROSS_DIALOGUE_UI_META=Object.freeze({version:'cross-dialogue-ui-v380',directPersonaDialogue:true});
})();
