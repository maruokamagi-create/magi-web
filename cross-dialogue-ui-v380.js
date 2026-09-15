(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_UI_V381)return;
window.MAGI_CROSS_DIALOGUE_UI_V381=true;

const P={
  'MELCHIOR-1':{jp:'メルキオール',cls:'mel',img:'/portraits/melchior.png?v=195'},
  'BALTHASAR-2':{jp:'バルタザール',cls:'bal',img:'/portraits/balthasar.png?v=195'},
  'CASPER-3':{jp:'カスパー',cls:'cas',img:'/portraits/casper.png?v=195'}
};
const JP=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,v.jp]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dialogueOf(result){return Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[]}
function liveExchange(turn){
  const d=document.createElement('div');d.className='magiExchange';d.dataset.magiDirectDialogue='true';
  const speaker=P[turn.speaker]||{jp:String(turn.speaker||''),cls:'',img:''};
  const target=JP[turn.target]||String(turn.target||'');
  d.innerHTML=`<div class="magiSpeaker">${esc(speaker.jp)}${target?` → ${esc(target)}`:''}<span class="magiJudge">相互検証</span></div><div class="magiSpeech magiChallenge">${esc(turn.statement)}</div>`;
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
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const view=document.getElementById('magiChatView');if(!view)return false;
  const body=view.querySelector('.magiChatBody');if(!body)return false;
  body.querySelectorAll('[data-magi-dialogue-phase="true"]').forEach(n=>n.remove());
  const msgs=[...body.querySelectorAll('.magiMsg:not(.finalSummary)')];
  if(msgs.length<3+dialogue.length)return false;
  const start=3;
  const phase=document.createElement('div');phase.className='magiChatPhase';phase.dataset.magiDialoguePhase='true';phase.textContent='相互検証';
  body.insertBefore(phase,msgs[start]||null);
  dialogue.forEach((turn,i)=>{
    const msg=msgs[start+i];if(!msg)return;
    const speaker=P[turn.speaker];if(!speaker)return;
    const target=JP[turn.target]||String(turn.target||'');
    msg.className=`magiMsg ${speaker.cls}`;
    msg.dataset.magiDirectDialogue='true';
    const avatar=msg.querySelector('.magiAvatar');if(avatar){avatar.src=speaker.img;avatar.alt=speaker.jp}
    const sender=msg.querySelector('.magiSender');if(sender)sender.innerHTML=`${esc(speaker.jp)}<span>${esc(speaker.label||turn.speaker)}${target?` → ${esc(target)}`:''}</span>`;
    const speech=msg.querySelector('.magiSpeechText');if(speech)speech.textContent=String(turn.statement||'');
    const judge=msg.querySelector('.magiJudgeTag');if(judge)judge.textContent='相互検証';
  });
  return true;
}
function apply(result){
  if(!result)return;
  patchLive(result);
  [30,80,160,300,600,1000].forEach(ms=>setTimeout(()=>{patchLive(result);patchChat(result)},ms));
}
document.addEventListener('magi:deliberation-result',event=>apply(event.detail||window.MAGI_LAST_DELIBERATION_RESULT||null));
window.MAGI_CROSS_DIALOGUE_UI_META=Object.freeze({version:'cross-dialogue-ui-v381',directPersonaDialogue:true,controlIdentityRemoved:true});
})();
