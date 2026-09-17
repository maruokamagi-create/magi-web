(()=>{
'use strict';
if(window.MAGI_CROSS_SPEAKER_LABEL_FIX_V392)return;
window.MAGI_CROSS_SPEAKER_LABEL_FIX_V392=true;

const PLAN=[
  {jp:'メルキオール',label:'MELCHIOR-1',cls:'mel',img:'/portraits/melchior.png?v=195',target:'バルタザール'},
  {jp:'バルタザール',label:'BALTHASAR-2',cls:'bal',img:'/portraits/balthasar.png?v=195',target:'メルキオール'},
  {jp:'カスパー',label:'CASPER-3',cls:'cas',img:'/portraits/casper.png?v=195',target:'バルタザール'}
];
let scheduled=false;

function isAllowedControl(row){
  if(row.classList.contains('magiMidControl')||row.classList.contains('finalSummary'))return true;
  const sender=String(row.querySelector('.magiSender')?.textContent||'').trim();
  return /MAGI CONTROL\s*(?:争点整理|相互検証まとめ|最終総括)/.test(sender);
}

function targetFromSender(sender,fallback){
  const m=String(sender||'').match(/→\s*(メルキオール|バルタザール|カスパー)/);
  return m?.[1]||fallback;
}

function repair(){
  const view=document.getElementById('magiChatView');
  if(!view)return false;
  const rows=[...view.querySelectorAll('.magiMsg')].filter(row=>{
    if(isAllowedControl(row))return false;
    const sender=String(row.querySelector('.magiSender')?.textContent||'').trim();
    return /^MAGI CONTROL\s*→/.test(sender);
  });
  if(!rows.length)return false;

  rows.slice(0,3).forEach((row,index)=>{
    const persona=PLAN[index];
    if(!persona)return;
    const senderEl=row.querySelector('.magiSender');
    const oldSender=String(senderEl?.textContent||'');
    const target=targetFromSender(oldSender,persona.target);

    row.classList.remove('system','ctl');
    row.classList.add(persona.cls);
    row.dataset.magiCrossSpeakerFixed='v392';
    row.removeAttribute('data-magi-control-moderator-suppressed');
    row.style.removeProperty('display');

    const avatar=row.querySelector('.magiAvatar');
    if(avatar){
      avatar.src=persona.img;
      avatar.alt=persona.jp;
    }
    if(senderEl){
      senderEl.innerHTML=`${persona.jp}<span>→ ${target}</span>`;
    }

    const tag=row.querySelector('.magiJudgeTag');
    if(tag)tag.textContent='相互検証';
  });
  return true;
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    repair();
  });
}

repair();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('magi:deliberation-result',()=>[50,150,400,900,1800,3500].forEach(ms=>setTimeout(repair,ms)));

window.MAGI_CROSS_SPEAKER_LABEL_FIX_META=Object.freeze({
  version:'v392',
  scope:'cross-examination-speaker-labels-only',
  wiseMenPrimaryUntouched:true,
  wiseMenDetailsUntouched:true,
  wiseMenSecondUntouched:true,
  controlModeratorUntouched:true
});
})();
