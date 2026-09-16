(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_UI_V386)return;
window.MAGI_CROSS_DIALOGUE_UI_V386=true;

const P={
  'MELCHIOR-1':{jp:'メルキオール',cls:'mel',img:'/portraits/melchior.png?v=195'},
  'BALTHASAR-2':{jp:'バルタザール',cls:'bal',img:'/portraits/balthasar.png?v=195'},
  'CASPER-3':{jp:'カスパー',cls:'cas',img:'/portraits/casper.png?v=195'}
};
const CONTROL={jp:'MAGI CONTROL',img:'/magi-official-symbol-v125.svg?v=195'};
const JP=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,v.jp]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>(Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean);
let lastResult=null;
let patchScheduled=false;
let dialogueRequestSeq=0;
function personaForSpeaker(value){const s=String(value||'').toUpperCase();for(const [key,persona] of Object.entries(P))if(s.includes(key))return persona;return null}
function dialogueOf(result){return Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[]}
function crossOf(result){return result?.crossExamination||{}}
function short(value,max=82){const s=String(value||'').trim();return s.length>max?s.slice(0,max-1)+'…':s}
function isFullLineup(result){
  const kind=String(result?.case?.selectionKind||result?.final?.mode||'').toUpperCase();
  const q=String(result?.case?.question||'').normalize('NFKC');
  return kind==='FULL_LINEUP'||/(?:ベストオーダー|ベスト打順|1番.{0,40}9番|一番.{0,40}九番)/.test(q);
}
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
  const speaker=personaForSpeaker(turn.speaker)||{jp:String(turn.speaker||''),cls:'',img:''};
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
  const existing=[...body.querySelectorAll('[data-magi-direct-dialogue="true"]')];
  const legacy=[...body.querySelectorAll('.magiExchange')].filter(ex=>/^MAGI CONTROL\s*→/.test(ex.querySelector('.magiSpeaker')?.textContent?.trim()||''));
  if(existing.length===dialogue.length&&!legacy.length&&body.querySelectorAll('[data-magi-control-intervention="true"]').length>=2)return true;
  body.querySelectorAll('[data-magi-direct-dialogue="true"],[data-magi-control-intervention="true"]').forEach(n=>n.remove());
  legacy.forEach(ex=>ex.remove());
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
  const speaker=personaForSpeaker(turn.speaker);if(!speaker)return null;
  const target=JP[turn.target]||String(turn.target||'');
  const row=document.createElement('div');row.className=`magiMsg ${speaker.cls}`;row.dataset.magiDirectDialogue='true';
  row.innerHTML=`<img class="magiAvatar" src="${speaker.img}" alt="${esc(speaker.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(speaker.jp)}<span>${target?`→ ${esc(target)}`:''}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(turn.statement)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  return row;
}
function tagText(row){return String(row?.querySelector?.('.magiJudgeTag')?.textContent||'').normalize('NFKC').trim()}
function isSecondJudgmentRow(row){return /再選定|判定変更|判定維持/.test(tagText(row))}
function isPrimarySelectionRow(row){const t=tagText(row);return /候補：/.test(t)&&!/再選定/.test(t)}
function legacyControlTargetRows(body){
  return [...body.querySelectorAll('.magiMsg.system .magiSender')].filter(n=>/^MAGI CONTROL\s*→/.test(String(n.textContent||'').normalize('NFKC').trim()));
}
function chatNeedsPatch(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const body=document.querySelector('#magiChatView .magiChatBody');if(!body)return false;
  if(legacyControlTargetRows(body).length)return true;
  return body.querySelectorAll('[data-magi-direct-dialogue="true"]').length!==dialogue.length;
}
function patchChat(result){
  const dialogue=dialogueOf(result);if(!dialogue.length)return false;
  const view=document.getElementById('magiChatView');if(!view)return false;
  const body=view.querySelector('.magiChatBody');if(!body)return false;
  if(!chatNeedsPatch(result)&&body.querySelectorAll('[data-magi-control-intervention="true"]').length>=2)return true;
  const msgs=[...body.querySelectorAll('.magiMsg:not(.finalSummary)')];
  const secondStart=msgs.find(isSecondJudgmentRow);if(!secondStart)return false;
  const secondIndex=msgs.indexOf(secondStart);
  const before=msgs.slice(0,secondIndex);
  const primaryRows=before.filter(isPrimarySelectionRow);
  const personaRows=before.filter(row=>row.matches?.('.magiMsg.mel,.magiMsg.bal,.magiMsg.cas'));
  const lastPrimary=primaryRows.at(-1)||personaRows.slice(0,3).at(-1);if(!lastPrimary)return false;

  let node=lastPrimary.nextSibling;
  while(node&&node!==secondStart){const next=node.nextSibling;node.remove();node=next}

  const nodes=[phaseNode('相互検証'),controlChat(controlOpeningText(result),'争点整理')];
  for(const turn of dialogue){const row=dialogueChat(turn);if(row)nodes.push(row)}
  nodes.push(controlChat(controlClosingText(),'相互検証まとめ'),phaseNode('二次判定'));
  for(const item of nodes)body.insertBefore(item,secondStart);
  return true;
}
async function hydrateDialogue(result){
  if(!result||dialogueOf(result).length||!isFullLineup(result)||!result?.primary)return result;
  const seq=++dialogueRequestSeq;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),32000);
  try{
    const res=await fetch('/api/magi/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:'CROSS_EXAMINATION',case:result.case,primary:result.primary}),signal:controller.signal});
    const direct=await res.json().catch(()=>null);
    if(seq!==dialogueRequestSeq||!res.ok||!Array.isArray(direct?.dialogue)||!direct.dialogue.length)return result;
    return {...result,crossExamination:{...(result.crossExamination||{}),...direct}};
  }catch(_){return result}
  finally{clearTimeout(timer)}
}
function schedulePatch(result){
  if(!result)return;
  lastResult=result;
  patchLive(result);
  [0,30,80,160,300,600,1000,1800,3000,6000].forEach(ms=>setTimeout(()=>{if(lastResult!==result)return;patchLive(result);patchChat(result)},ms));
}
async function apply(result){
  if(!result)return;
  const hydrated=await hydrateDialogue(result);
  schedulePatch(hydrated);
}
function installObserver(){
  const root=document.documentElement;if(!root)return;
  new MutationObserver(()=>{
    if(!lastResult||patchScheduled||!chatNeedsPatch(lastResult))return;
    patchScheduled=true;
    setTimeout(()=>{patchScheduled=false;if(lastResult){patchLive(lastResult);patchChat(lastResult)}},25);
  }).observe(root,{childList:true,subtree:true});
}
document.addEventListener('magi:deliberation-result',event=>apply(event.detail||window.MAGI_LAST_DELIBERATION_RESULT||null));
installObserver();
if(window.MAGI_LAST_DELIBERATION_RESULT)apply(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_CROSS_DIALOGUE_UI_META=Object.freeze({version:'cross-dialogue-ui-v386',directPersonaDialogue:true,dialogueHydrationFallback:true,persistentChatObserver:true,controlInterventionRestored:true,preservesSecondJudgment:true,removesDuplicateCrossBlocks:true,phaseOrder:'PRIMARY_CONTROL_DIALOGUE_SECOND'});
})();
