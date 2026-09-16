(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_UI_V383)return;
window.MAGI_CROSS_DIALOGUE_UI_V383=true;

const P={
  'MELCHIOR-1':{jp:'メルキオール',cls:'mel',img:'/portraits/melchior.png?v=195'},
  'BALTHASAR-2':{jp:'バルタザール',cls:'bal',img:'/portraits/balthasar.png?v=195'},
  'CASPER-3':{jp:'カスパー',cls:'cas',img:'/portraits/casper.png?v=195'}
};
const CONTROL={jp:'MAGI CONTROL',img:'/magi-official-symbol-v125.svg?v=195'};
const JP=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,v.jp]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>(Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean);
function dialogueOf(result){return Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[]}
function crossOf(result){return result?.crossExamination||{}}
function short(value,max=82){const s=String(value||'').trim();return s.length>max?s.slice(0,max-1)+'…':s}
function controlOpeningText(result){
  const cross=crossOf(result),agreement=list(cross.agreement),disagreement=list(cross.disagreement);
  const allSame=agreement.some(x=>/1番から9番まで一致|打順案.*一致/.test(x));
  if(allSame){
    return 'MAGI CONTROLの見立てでは、3賢人の一次打順案は一致しています。結論だけで終わらせず、この並びを支持する理由と、どんな条件なら見直すのかを互いに確認してください。';
  }
  if(disagreement.length){
    return `MAGI CONTROLの見立てでは、今回の主な争点は「${disagreement.slice(0,2).map(x=>short(x,68)).join('／')}」です。相手が実際に示した根拠に答えながら、現時点のベストオーダーとしてどの並びに最も根拠があるかを詰めてください。`;
  }
  return 'MAGI CONTROLの見立てでは、3賢人の一次判断には確認すべき違いがあります。相手が実際に示した根拠だけを材料に、打順の違いとその理由を直接確かめてください。';
}
function controlClosingText(){
  return 'MAGI CONTROLはここで相互検証を区切ります。次の二次判定では、今のやり取りを踏まえて、自分の一次案を維持するのか変更するのかを各賢人が改めて判断してください。';
}
function liveExchange(turn){
  const d=document.createElement('div');d.className='magiExchange';d.dataset.magiDirectDialogue='true';
  const speaker=P[turn.speaker]||{jp:String(turn.speaker||''),cls:'',img:''};
  const target=JP[turn.target]||String(turn.target||'');
  d.innerHTML=`<div class="magiSpeaker">${esc(speaker.jp)}${target?` → ${esc(target)}`:''}<span class="magiJudge">相互検証</span></div><div class="magiSpeech magiChallenge">${esc(turn.statement)}</div>`;
  return d;
}
function liveControl(text,label){
  const d=document.createElement('div');d.className='magiExchange';d.dataset.magiControlIntervention='true';
  d.innerHTML=`<div class="magiSpeaker">MAGI CONTROL<span class="magiJudge">${esc(label)}</span></div><div class="magiSpeech magiChallenge">${esc(text)}</div>`;
  return d;
}
function patchLive(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const body=document.getElementById('magiLiveBody');if(!body)return false;
  body.querySelectorAll('[data-magi-direct-dialogue="true"],[data-magi-control-intervention="true"]').forEach(n=>n.remove());
  [...body.querySelectorAll('.magiExchange')].forEach(ex=>{
    const speaker=ex.querySelector('.magiSpeaker')?.textContent?.trim()||'';
    if(/^MAGI CONTROL\s*→/.test(speaker))ex.remove();
  });
  const anchor=[...body.querySelectorAll('.magiExchange')].find(ex=>ex.querySelector('.magiSpeech')?.classList.contains('magiReply'))||null;
  const nodes=[liveControl(controlOpeningText(result),'争点整理'),...dialogue.map(liveExchange),liveControl(controlClosingText(),'相互検証まとめ')];
  for(const node of nodes)anchor?body.insertBefore(node,anchor):body.appendChild(node);
  return true;
}
function phaseNode(text){const d=document.createElement('div');d.className='magiChatPhase';d.dataset.magiDialoguePhase='true';d.textContent=text;return d}
function controlChat(text,label){
  const row=document.createElement('div');row.className='magiMsg system';row.dataset.magiControlIntervention='true';
  row.innerHTML=`<img class="magiAvatar" src="${CONTROL.img}" alt=""><div class="magiMsgCol"><div class="magiSender">MAGI CONTROL<span>${esc(label)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(text)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  return row;
}
function dialogueChat(turn){
  const speaker=P[turn.speaker];if(!speaker)return null;
  const target=JP[turn.target]||String(turn.target||'');
  const row=document.createElement('div');row.className=`magiMsg ${speaker.cls}`;row.dataset.magiDirectDialogue='true';
  row.innerHTML=`<img class="magiAvatar" src="${speaker.img}" alt="${esc(speaker.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(speaker.jp)}<span>${esc(turn.speaker)}${target?` → ${esc(target)}`:''}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(turn.statement)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  return row;
}
function patchChat(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const view=document.getElementById('magiChatView');if(!view)return false;
  const body=view.querySelector('.magiChatBody');if(!body)return false;
  body.querySelectorAll('[data-magi-direct-dialogue="true"],[data-magi-control-intervention="true"],[data-magi-dialogue-phase="true"]').forEach(n=>n.remove());
  const msgs=[...body.querySelectorAll('.magiMsg:not(.finalSummary)')];
  if(msgs.length<6)return false;
  const secondStart=msgs[3];
  const secondPhase=[...body.querySelectorAll('.magiChatPhase')].find(n=>String(n.textContent||'').trim()==='二次判定')||null;
  if(secondPhase)secondPhase.remove();
  body.insertBefore(phaseNode('相互検証'),secondStart);
  body.insertBefore(controlChat(controlOpeningText(result),'争点整理'),secondStart);
  for(const turn of dialogue){const row=dialogueChat(turn);if(row)body.insertBefore(row,secondStart)}
  body.insertBefore(controlChat(controlClosingText(),'相互検証まとめ'),secondStart);
  body.insertBefore(secondPhase||phaseNode('二次判定'),secondStart);
  return true;
}
function apply(result){
  if(!result)return;
  patchLive(result);
  [30,80,160,300,600,1000].forEach(ms=>setTimeout(()=>{patchLive(result);patchChat(result)},ms));
}
document.addEventListener('magi:deliberation-result',event=>apply(event.detail||window.MAGI_LAST_DELIBERATION_RESULT||null));
window.MAGI_CROSS_DIALOGUE_UI_META=Object.freeze({version:'cross-dialogue-ui-v383',directPersonaDialogue:true,controlInterventionRestored:true,preservesSecondJudgment:true,phaseOrder:'PRIMARY_CONTROL_DIALOGUE_SECOND'});
})();
