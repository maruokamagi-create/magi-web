(()=>{
'use strict';
if(window.MAGI_WISE_MEN_CHAT_REPAIR_V390)return;
window.MAGI_WISE_MEN_CHAT_REPAIR_V390=true;

const PERSONAS={
  melchior:{key:'melchior',label:'MELCHIOR-1',jp:'メルキオール',cls:'mel',img:'/portraits/melchior.png?v=195'},
  balthasar:{key:'balthasar',label:'BALTHASAR-2',jp:'バルタザール',cls:'bal',img:'/portraits/balthasar.png?v=195'},
  casper:{key:'casper',label:'CASPER-3',jp:'カスパー',cls:'cas',img:'/portraits/casper.png?v=195'}
};
const CONTROL={jp:'MAGI CONTROL',img:'/magi-official-symbol-v125.svg?v=195'};
const BY_LABEL=Object.fromEntries(Object.values(PERSONAS).map(p=>[p.label,p]));
const JP=Object.fromEntries(Object.values(PERSONAS).map(p=>[p.label,p.jp]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>(Array.isArray(v)?v:[]).map(x=>String(x??'').trim()).filter(Boolean);
let scheduled=false,repairing=false,hydrateSeq=0,lastHydrated=null,lastCaseId='';

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
function detailSection(title,values){
  const items=(Array.isArray(values)?values:[values]).map(v=>String(v??'').trim()).filter(Boolean);
  if(!items.length)return'';
  return `<section><b>${esc(title)}</b><ul>${items.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></section>`;
}
function detailHtml(value,phase){
  const parts=[];
  const speech=publicSpeech(value);
  if(value?.primaryReason&&String(value.primaryReason).trim()!==speech)parts.push(detailSection('判断理由',value.primaryReason));
  if(value?.candidateBasis&&String(value.candidateBasis).trim()!==speech)parts.push(detailSection('選定基準',value.candidateBasis));
  parts.push(detailSection('確認事実',list(value?.facts)));
  parts.push(detailSection('分析',list(value?.analysis)));
  parts.push(detailSection('予測・見通し',list(value?.prediction)));
  parts.push(detailSection('懸念・注意点',list(value?.warnings)));
  if(phase==='second'&&value?.changeReason)parts.push(detailSection(value?.changedFromPrimary===true?'変更理由':'維持理由',value.changeReason));
  return parts.filter(Boolean).join('');
}
function personaRow(persona,value,phase){
  const speech=publicSpeech(value);if(!speech)return null;
  const details=detailHtml(value,phase);
  const row=document.createElement('div');row.className=`magiMsg ${persona.cls}`;row.dataset.magiWiseRepair='persona';
  row.innerHTML=`<img class="magiAvatar" src="${persona.img}" alt="${esc(persona.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(persona.jp)}<span>${esc(persona.label)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(speech)}</span><div class="magiMsgActions"><span class="magiJudgeTag">${esc(judgeText(value,phase))}</span>${details?'<button type="button" class="magiWiseDetailToggle" aria-expanded="false">詳細を見る ▾</button>':''}</div>${details?`<div class="magiWiseDetail">${details}</div>`:''}</div></div>`;
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
function controlOpeningText(result){
  const cross=result?.crossExamination||{};
  const disagreement=list(cross.disagreement);
  const agreement=list(cross.agreement);
  if(disagreement.length){
    const topic=disagreement.slice(0,2).map(x=>x.length>62?`${x.slice(0,61)}…`:x).join('／');
    return `一次判断を確認。主な争点は「${topic}」。3賢人はこの点を直接検証してください。`;
  }
  if(agreement.length)return '一次判断を確認。大枠は一致しています。3賢人は一致の根拠と、見直し条件を直接検証してください。';
  return '一次判断を確認。3賢人は打順の相違点と根拠を直接検証してください。';
}
function controlClosingText(){
  return '相互検証をここで区切ります。各賢人は、今のやり取りを踏まえて一次案を維持するか変更するか、二次判定を出してください。';
}
function controlRow(text,label){
  const row=document.createElement('div');row.className='magiMsg system magiMidControl';row.dataset.magiWiseRepair='control';
  row.innerHTML=`<img class="magiAvatar" src="${CONTROL.img}" alt=""><div class="magiMsgCol"><div class="magiSender">MAGI CONTROL<span>${esc(label)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(text)}</span></div></div>`;
  return row;
}
function compactNote(text){
  const d=document.createElement('div');d.className='magiWiseRepairNote';d.textContent=text;return d;
}
function installStyle(){
  if(document.getElementById('magi-wise-men-chat-repair-v390-style'))return;
  const s=document.createElement('style');s.id='magi-wise-men-chat-repair-v390-style';
  s.textContent=`
  .magiWiseDetailToggle{border:0;background:transparent;color:#386b98;font-size:11px;line-height:1.2;font-weight:900;padding:3px 0;min-height:0;cursor:pointer}
  .magiWiseDetail{display:none;margin-top:9px;padding:10px 11px;border-radius:10px;background:#f3f6f9;border:1px solid #d5dee6;color:#4c5d6d;font-size:11px;line-height:1.55}
  .magiWiseDetail.open{display:block}
  .magiWiseDetail section+section{margin-top:9px;padding-top:8px;border-top:1px solid #dde5eb}
  .magiWiseDetail b{display:block;margin-bottom:4px;color:#667d91;font-size:10px}
  .magiWiseDetail ul{margin:0;padding-left:18px}.magiWiseDetail li{margin:3px 0}
  #magiChatView .magiMsg.magiMidControl{justify-content:center;margin:3px 0 13px}
  #magiChatView .magiMsg.magiMidControl .magiAvatar{width:30px!important;height:30px!important;border-radius:8px!important;padding:3px!important;background:#0b2444!important;box-sizing:content-box!important}
  #magiChatView .magiMsg.magiMidControl .magiMsgCol{max-width:86%!important;align-items:center!important}
  #magiChatView .magiMsg.magiMidControl .magiBubble{padding:9px 11px!important;background:#f5f7f9!important;border:1px solid #cad4dd!important}
  #magiChatView .magiMsg.magiMidControl .magiSpeechText{font-size:12px!important;line-height:1.55!important}
  .magiWiseRepairNote{margin:2px 8px 13px;padding:8px 10px;border:1px solid #c9d5df;border-radius:10px;background:#edf2f6;color:#61788c;font-size:11px;line-height:1.55;text-align:center}
  .magiMsg.finalSummary .magiSender{font-weight:900}
  `;
  document.head.appendChild(s);
}
async function hydrateDialogue(result){
  if(!result||!isFullLineup(result))return result;
  const existing=Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[];
  if(existing.length)return result;
  const caseId=String(result?.case?.id||'');
  if(lastHydrated&&lastCaseId===caseId)return lastHydrated;
  const seq=++hydrateSeq;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),32000);
  try{
    const res=await fetch('/api/magi/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:'CROSS_EXAMINATION',case:result.case,primary:result.primary}),signal:controller.signal});
    const direct=await res.json().catch(()=>null);
    if(seq!==hydrateSeq||!res.ok||!Array.isArray(direct?.dialogue)||!direct.dialogue.length)return result;
    const hydrated={...result,crossExamination:{...(result.crossExamination||{}),...direct}};
    lastHydrated=hydrated;lastCaseId=caseId;
    return hydrated;
  }catch(_){return result}
  finally{clearTimeout(timer)}
}
async function repair(){
  if(repairing)return false;
  const base=window.MAGI_LAST_DELIBERATION_RESULT;
  if(!base||!isFullLineup(base))return false;
  const view=document.getElementById('magiChatView');
  const body=view?.querySelector('.magiChatBody');
  const finalCard=body?.querySelector('#magiFinalSummaryCard');
  if(!body||!finalCard)return false;
  repairing=true;
  try{
    const result=await hydrateDialogue(base);
    const primary=personaEntries(result.primary);
    const second=personaEntries(result.second);
    if(primary.length!==3||second.length!==3)return false;
    const dialogue=Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[];
    const signature=JSON.stringify({
      primary:primary.map(([,v])=>[publicSpeech(v),v?.facts,v?.analysis,v?.warnings]),
      dialogue:dialogue.map(v=>[v.speaker,v.target,v.statement]),
      second:second.map(([,v])=>[publicSpeech(v),v?.changedFromPrimary,v?.changeReason,v?.facts,v?.analysis,v?.warnings])
    });
    if(body.dataset.magiWiseRepairSignature===signature)return true;

    installStyle();
    const finalClone=finalCard.cloneNode(true);
    body.innerHTML='';
    body.appendChild(phaseNode('一次判断'));
    primary.forEach(([p,v])=>{const row=personaRow(p,v,'primary');if(row)body.appendChild(row);});

    body.appendChild(phaseNode('相互検証'));
    body.appendChild(controlRow(controlOpeningText(result),'争点整理'));
    if(dialogue.length){
      dialogue.forEach(turn=>{const row=dialogueRow(turn);if(row)body.appendChild(row);});
    }else{
      body.appendChild(compactNote('3賢人の直接対話を取得できませんでした。一次判断と二次判定の詳細は表示しています。'));
    }
    body.appendChild(controlRow(controlClosingText(),'相互検証まとめ'));

    body.appendChild(phaseNode('二次判定'));
    second.forEach(([p,v])=>{const row=personaRow(p,v,'second');if(row)body.appendChild(row);});
    body.appendChild(phaseNode('最終総括'));
    body.appendChild(finalClone);
    body.dataset.magiWiseRepairSignature=signature;
    view.dataset.magiWiseMenChat='v390';
    return true;
  }finally{repairing=false;}
}
function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;repair();});
}

document.addEventListener('click',event=>{
  const btn=event.target.closest?.('.magiWiseDetailToggle');if(!btn)return;
  const detail=btn.closest('.magiBubble')?.querySelector('.magiWiseDetail');if(!detail)return;
  const open=detail.classList.toggle('open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  btn.textContent=open?'詳細を閉じる ▴':'詳細を見る ▾';
});
document.addEventListener('magi:deliberation-result',()=>{
  lastHydrated=null;lastCaseId='';hydrateSeq++;
  [80,250,600,1200,2500,5000].forEach(ms=>setTimeout(repair,ms));
});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.MAGI_WISE_MEN_CHAT_REPAIR_META=Object.freeze({version:'v390',controlRole:'short-moderator-plus-final-summary',primaryDetails:true,secondDetails:true,directDialogueHydration:true});
})();