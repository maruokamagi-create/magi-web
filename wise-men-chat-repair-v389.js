(()=>{
'use strict';
if(window.MAGI_WISE_MEN_CHAT_REPAIR_V389)return;
window.MAGI_WISE_MEN_CHAT_REPAIR_V389=true;

const PERSONAS={
  melchior:{key:'melchior',label:'MELCHIOR-1',jp:'メルキオール',cls:'mel',img:'/portraits/melchior.png?v=195'},
  balthasar:{key:'balthasar',label:'BALTHASAR-2',jp:'バルタザール',cls:'bal',img:'/portraits/balthasar.png?v=195'},
  casper:{key:'casper',label:'CASPER-3',jp:'カスパー',cls:'cas',img:'/portraits/casper.png?v=195'}
};
const BY_LABEL=Object.fromEntries(Object.values(PERSONAS).map(p=>[p.label,p]));
const JP=Object.fromEntries(Object.values(PERSONAS).map(p=>[p.label,p.jp]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scheduled=false;

function isFullLineup(result){
  const kind=String(result?.case?.selectionKind||result?.final?.mode||'').toUpperCase();
  const question=String(result?.case?.question||'').normalize('NFKC');
  return kind==='FULL_LINEUP'||/(?:ベストオーダー|ベスト打順|1番.{0,40}9番|一番.{0,40}九番)/.test(question);
}
function personaEntries(block){
  return Object.values(PERSONAS).map(p=>[p,block?.[p.key]]).filter(([,value])=>value&&typeof value==='object');
}
function publicSpeech(value){
  return String(value?.publicStatement||value?.primaryReason||value?.candidateBasis||'').trim();
}
function judgeText(value,phase){
  if(phase==='primary')return '一次判断';
  return value?.changedFromPrimary===true?'判定変更':'判定維持';
}
function phaseNode(text){
  const d=document.createElement('div');d.className='magiChatPhase';d.textContent=text;return d;
}
function personaRow(persona,value,phase){
  const speech=publicSpeech(value);if(!speech)return null;
  const row=document.createElement('div');row.className=`magiMsg ${persona.cls}`;row.dataset.magiWiseRepair='persona';
  row.innerHTML=`<img class="magiAvatar" src="${persona.img}" alt="${esc(persona.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(persona.jp)}<span>${esc(persona.label)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(speech)}</span><div class="magiMsgActions"><span class="magiJudgeTag">${esc(judgeText(value,phase))}</span></div></div></div>`;
  return row;
}
function dialogueRow(turn){
  const persona=BY_LABEL[String(turn?.speaker||'').toUpperCase()];
  const speech=String(turn?.statement||'').trim();
  if(!persona||!speech)return null;
  const target=JP[String(turn?.target||'').toUpperCase()]||String(turn?.target||'').trim();
  const row=document.createElement('div');row.className=`magiMsg ${persona.cls}`;row.dataset.magiWiseRepair='dialogue';
  row.innerHTML=`<img class="magiAvatar" src="${persona.img}" alt="${esc(persona.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(persona.jp)}<span>${target?`→ ${esc(target)}`:''}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(speech)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  return row;
}
function compactNote(text){
  const d=document.createElement('div');d.className='magiWiseRepairNote';d.textContent=text;return d;
}
function installStyle(){
  if(document.getElementById('magi-wise-men-chat-repair-v389-style'))return;
  const s=document.createElement('style');s.id='magi-wise-men-chat-repair-v389-style';
  s.textContent=`#magiChatView .magiMsg.system:not(.finalSummary){display:none!important}.magiWiseRepairNote{margin:2px 8px 13px;padding:8px 10px;border:1px solid #c9d5df;border-radius:10px;background:#edf2f6;color:#61788c;font-size:11px;line-height:1.55;text-align:center}.magiMsg.finalSummary .magiSender{font-weight:900}`;
  document.head.appendChild(s);
}
function repair(){
  const result=window.MAGI_LAST_DELIBERATION_RESULT;
  if(!result||!isFullLineup(result))return false;
  const view=document.getElementById('magiChatView');
  const body=view?.querySelector('.magiChatBody');
  const finalCard=body?.querySelector('#magiFinalSummaryCard');
  if(!body||!finalCard)return false;
  const primary=personaEntries(result.primary);
  const second=personaEntries(result.second);
  if(primary.length!==3||second.length!==3)return false;
  const dialogue=Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[];
  const signature=JSON.stringify({
    primary:primary.map(([,v])=>publicSpeech(v)),
    dialogue:dialogue.map(v=>[v.speaker,v.target,v.statement]),
    second:second.map(([,v])=>[publicSpeech(v),v.changedFromPrimary])
  });
  if(body.dataset.magiWiseRepairSignature===signature)return true;

  installStyle();
  const finalClone=finalCard.cloneNode(true);
  body.innerHTML='';
  body.appendChild(phaseNode('一次判断'));
  primary.forEach(([p,v])=>{const row=personaRow(p,v,'primary');if(row)body.appendChild(row);});
  body.appendChild(phaseNode('相互検証'));
  if(dialogue.length){
    dialogue.forEach(turn=>{const row=dialogueRow(turn);if(row)body.appendChild(row);});
  }else{
    body.appendChild(compactNote('3賢人の直接対話を取得できませんでした。一次判断と二次判定はそのまま表示します。'));
  }
  body.appendChild(phaseNode('二次判定'));
  second.forEach(([p,v])=>{const row=personaRow(p,v,'second');if(row)body.appendChild(row);});
  body.appendChild(phaseNode('最終総括'));
  body.appendChild(finalClone);
  body.dataset.magiWiseRepairSignature=signature;
  view.dataset.magiWiseMenChat='v389';
  return true;
}
function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;repair();});
}

document.addEventListener('magi:deliberation-result',()=>{
  [80,250,600,1200,2500,5000].forEach(ms=>setTimeout(repair,ms));
});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.MAGI_WISE_MEN_CHAT_REPAIR_META=Object.freeze({version:'v389',controlRole:'final-summary-only',primaryFromResult:true,secondFromResult:true,directDialogueFromResult:true});
})();
