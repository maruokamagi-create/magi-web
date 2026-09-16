(()=>{
'use strict';
if(window.MAGI_CHAT_UI_CANONICAL_V387)return;
window.MAGI_CHAT_UI_CANONICAL_V387=true;

const P={
  MELCHIOR:{img:'/portraits/melchior.png?v=195',cls:'mel',name:'MELCHIOR-1',jp:'メルキオール'},
  BALTHASAR:{img:'/portraits/balthasar.png?v=195',cls:'bal',name:'BALTHASAR-2',jp:'バルタザール'},
  CASPER:{img:'/portraits/casper.png?v=195',cls:'cas',name:'CASPER-3',jp:'カスパー'},
  CONTROL:{img:'/magi-official-symbol-v125.svg?v=195',cls:'ctl',name:'MAGI CONTROL',jp:'MAGI CONTROL'}
};
const JP={'MELCHIOR-1':'メルキオール','BALTHASAR-2':'バルタザール','CASPER-3':'カスパー'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let renderSeq=0;
let hydrateSeq=0;

function css(){
  if(document.getElementById('magi-chat-v387-style'))return;
  const s=document.createElement('style');s.id='magi-chat-v387-style';
  s.textContent=`#magiChatView{margin:0 0 14px;background:#dfe8ef;border:1px solid #b8c7d4;border-radius:16px;overflow:hidden;color:#142033;box-shadow:0 8px 24px rgba(0,0,0,.12)}.magiChatHead{background:#0b2444;color:#fff;padding:12px 15px;display:flex;justify-content:space-between}.magiChatBody{padding:14px 11px 16px;background:linear-gradient(#dfe8ef,#e8eef3)}.magiMsg{display:flex;align-items:flex-start;gap:8px;margin:0 0 13px}.magiAvatar{width:42px;height:42px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;flex:0 0 auto}.magiMsgCol{display:flex;flex-direction:column;align-items:flex-start;min-width:0;max-width:calc(100% - 50px)}.magiSender{font-size:10px;font-weight:900;color:#52677b;margin:0 0 3px 3px;line-height:1.25}.magiSender span{color:#778b9d;margin-left:5px}.magiBubble{background:#fff;border-radius:4px 16px 16px 16px;padding:11px 13px;color:#16283a;box-shadow:0 1px 2px rgba(0,0,0,.08);font-size:14px;line-height:normal}.magiSpeechText{display:block;font-size:14px;line-height:1.58;letter-spacing:0;word-break:normal;overflow-wrap:anywhere}.magiMsg.mel .magiBubble{border-left:4px solid #1e4f96}.magiMsg.bal .magiBubble{border-left:4px solid #c52b38}.magiMsg.cas .magiBubble{border-left:4px solid #16945c}.magiMsgActions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;line-height:1}.magiJudgeTag{display:inline-flex;align-items:center;margin:0;font-size:9px;line-height:1;font-weight:900;border-radius:999px;padding:5px 7px;background:#eef3f7}.magiMsg.mel .magiJudgeTag{color:#204f8e}.magiMsg.bal .magiJudgeTag{color:#a6222f}.magiMsg.cas .magiJudgeTag{color:#13724a}.magiEvidenceToggle{border:0;background:transparent;color:#386b98;font-size:11px;line-height:1.2;font-weight:900;padding:3px 0;min-height:0}.magiEvidence{display:none;margin-top:8px;padding:9px 10px;border-radius:10px;background:#f3f6f9;border:1px solid #d5dee6;font-size:11px;line-height:1.55;color:#4c5d6d}.magiEvidence.open{display:block}.magiEvidence b{display:block;font-size:9px;color:#718394;margin-bottom:4px;line-height:1.3}.magiEvidence ul{margin:4px 0 0;padding-left:18px}.magiEvidence li{margin:3px 0;line-height:1.5}.magiChatPhase{display:flex;align-items:center;gap:8px;margin:6px 0 12px;color:#738799;font-size:9px;line-height:1;font-weight:900}.magiChatPhase:before,.magiChatPhase:after{content:'';height:1px;background:#c3ced8;flex:1}.magiMsg.system{justify-content:center}.magiMsg.system .magiAvatar{width:28px;height:28px;border-radius:8px;padding:4px;background:#0b2444}.magiMsg.system .magiMsgCol{max-width:86%;align-items:center}.magiMsg.system .magiBubble{background:#f5f7f9;border:1px solid #cad4dd;font-size:12px}.magiMsg.system .magiSpeechText{font-size:12px;line-height:1.55}.magiMsg.finalSummary .magiMsgCol{max-width:92%;align-items:stretch}.magiMsg.finalSummary .magiBubble{background:#fff;border:2px solid #8fa7ba;padding:13px}.magiMsg.finalSummary .magiSpeechText{font-size:13px;line-height:1.65}.magiSummaryBadge{display:inline-flex;align-self:flex-start;margin:0 0 10px;padding:6px 10px;border-radius:999px;background:#0b2444;color:#fff;font-size:11px;font-weight:950;letter-spacing:.05em}.magiSummaryLead{font-size:13px;font-weight:800;line-height:1.65;margin-bottom:9px}.magiSummarySection{margin-top:9px;padding-top:9px;border-top:1px solid #d7e0e7}.magiSummarySection b{display:block;margin-bottom:4px;font-size:10px;letter-spacing:.05em;color:#526b80}.magiSummarySection p,.magiSummarySection ul{margin:0;font-size:12px;line-height:1.6;color:#1e3346}.magiSummarySection ul{padding-left:18px}.magiSummarySection li{margin:3px 0}.magiResultBundle.magiChatMode .answerWrap,.magiResultBundle.magiChatMode #engineProtocol,.magiResultBundle.magiChatMode #magiThreeWiseTitle,.magiResultBundle.magiChatMode #magiReasonTitle{display:none!important}@media(max-width:430px){.magiChatBody{padding:12px 8px}.magiAvatar{width:38px;height:38px}.magiMsgCol{max-width:calc(100% - 46px)}.magiBubble{padding:10px 12px}.magiSpeechText{font-size:14px;line-height:1.56}.magiMsg.finalSummary .magiMsgCol{max-width:91%}}`;
  document.head.appendChild(s);
}

function who(t){
  const u=String(t||'').toUpperCase();
  if(u.includes('MELCHIOR'))return P.MELCHIOR;
  if(u.includes('BALTHASAR'))return P.BALTHASAR;
  if(u.includes('CASPER'))return P.CASPER;
  if(u.includes('MAGI CONTROL'))return P.CONTROL;
  return null;
}
function currentResult(){return window.MAGI_LAST_DELIBERATION_RESULT||null}
function summaryApi(){return window.MAGI_CONTROL_SUMMARY_V377||null}
function isFullLineup(result){const k=String(result?.case?.selectionKind||result?.final?.mode||'').toUpperCase();const q=String(result?.case?.question||'').normalize('NFKC');return k==='FULL_LINEUP'||/(?:ベストオーダー|ベスト打順|1番.{0,40}9番|一番.{0,40}九番)/.test(q)}
function dialogueOf(result){return Array.isArray(result?.crossExamination?.dialogue)?result.crossExamination.dialogue.filter(x=>x?.speaker&&x?.statement):[]}
function parseExchange(ex){
  const speaker=ex.querySelector('.magiSpeaker')?.textContent?.trim()||'';
  const speech=ex.querySelector('.magiSpeech')?.textContent?.trim()||'';
  const judge=ex.querySelector('.magiJudge')?.textContent?.trim()||'';
  const person=who(speaker);
  const isReply=!!ex.querySelector('.magiSpeech')?.classList.contains('magiReply');
  return {speaker,speech,judge,person,isReply,isControl:person===P.CONTROL};
}
function bullets(text){const parts=String(text||'').split(/\s*／\s*|[。]\s*/).map(x=>x.trim()).filter(Boolean);return parts.slice(0,4).map(x=>`<li>${esc(x.length>90?x.slice(0,88)+'…':x)}</li>`).join('')}
function evidenceFor(person){const map={MELCHIOR:'.answer.m',BALTHASAR:'.answer.b',CASPER:'.answer.c'},key=Object.keys(P).find(k=>P[k]===person),card=document.querySelector(map[key]||'');if(!card)return'';return [...card.querySelectorAll('.mini')].map(m=>{const b=m.querySelector('b')?.textContent?.trim()||'詳細',v=m.querySelector('span')?.textContent?.trim()||'',items=bullets(v);return items?`<div><b>${esc(b)}</b><ul>${items}</ul></div>`:''}).join('')}
function addPhase(body,t){const d=document.createElement('div');d.className='magiChatPhase';d.textContent=t;body.appendChild(d)}
function controlOpeningText(result){
  const cross=result?.crossExamination||{};
  const agreement=Array.isArray(cross.agreement)?cross.agreement:[];
  const disagreement=Array.isArray(cross.disagreement)?cross.disagreement:[];
  if(agreement.some(x=>/1番から9番まで一致|打順案.*一致/.test(String(x))))return 'MAGI CONTROLの見立てでは、3賢人の一次打順案は一致しています。結論だけで終わらせず、この並びを支持する理由と、どんな条件なら見直すのかを互いに確認してください。';
  if(disagreement.length)return `MAGI CONTROLの見立てでは、今回の主な争点は「${disagreement.slice(0,2).map(x=>String(x).slice(0,68)).join('／')}」です。相手が実際に示した根拠に答えながら、現時点のベストオーダーとしてどの並びに最も根拠があるかを詰めてください。`;
  return 'MAGI CONTROLの見立てでは、3賢人の一次判断には確認すべき違いがあります。相手が実際に示した根拠だけを材料に、打順の違いとその理由を直接確かめてください。';
}
function controlClosingText(){return 'MAGI CONTROLはここで相互検証を区切ります。次の二次判定では、今のやり取りを踏まえて、自分の一次案を維持するのか変更するのかを各賢人が改めて判断してください。'}
function personRow(body,item,seen,result){
  const person=item.person;if(!person||person===P.CONTROL||!item.speech)return;
  let ev='';if(!seen.has(person.name)){ev=evidenceFor(person);seen.add(person.name)}
  let speech=item.speech;const api=summaryApi();if(api?.sanitizeSpeech&&result)speech=api.sanitizeSpeech(speech,result)||speech;
  const row=document.createElement('div');row.className=`magiMsg ${person.cls}`;
  const actions=(item.judge||ev)?`<div class="magiMsgActions">${item.judge?`<span class="magiJudgeTag">${esc(item.judge)}</span>`:''}${ev?'<button type="button" class="magiEvidenceToggle">根拠を見る ▾</button>':''}</div>`:'';
  row.innerHTML=`<img class="magiAvatar" src="${person.img}" alt="${esc(person.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(person.jp)}<span>${esc(person.name)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(speech)}</span>${actions}${ev?`<div class="magiEvidence">${ev}</div>`:''}</div></div>`;
  body.appendChild(row);
}
function directRow(body,turn,result){
  const person=who(turn.speaker);if(!person||person===P.CONTROL)return;
  let speech=String(turn.statement||'').trim();const api=summaryApi();if(api?.sanitizeSpeech&&result)speech=api.sanitizeSpeech(speech,result)||speech;
  const target=JP[turn.target]||String(turn.target||'');
  const row=document.createElement('div');row.className=`magiMsg ${person.cls}`;row.dataset.magiCanonicalDirectDialogue='true';
  row.innerHTML=`<img class="magiAvatar" src="${person.img}" alt="${esc(person.jp)}"><div class="magiMsgCol"><div class="magiSender">${esc(person.jp)}<span>${target?`→ ${esc(target)}`:''}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(speech)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  body.appendChild(row);
}
function controlRow(body,text,label){
  const row=document.createElement('div');row.className='magiMsg system';row.dataset.magiCanonicalControl='true';
  row.innerHTML=`<img class="magiAvatar" src="${P.CONTROL.img}" alt=""><div class="magiMsgCol"><div class="magiSender">MAGI CONTROL<span>${esc(label)}</span></div><div class="magiBubble"><span class="magiSpeechText">${esc(text)}</span><div class="magiMsgActions"><span class="magiJudgeTag">相互検証</span></div></div></div>`;
  body.appendChild(row);
}
function summarySection(title,body){if(!body)return'';return `<div class="magiSummarySection"><b>${esc(title)}</b>${Array.isArray(body)?`<ul>${body.filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<p>${esc(body)}</p>`}</div>`}
function fallbackSummaryText(){const verdict=document.getElementById('verdict')?.textContent?.trim()||'',reason=document.getElementById('reason')?.textContent?.trim()||'',next=document.getElementById('next')?.textContent?.trim()||'';if(!verdict&&!reason)return'';const parts=[];if(verdict)parts.push(`3賢人の一次判断、相互検証、二次判定を踏まえ、MAGIは「${verdict}」を最終結果としました。`);if(reason)parts.push(`主な理由は、${reason}${/[。！？!?]$/.test(reason)?'':'。'}`);if(next)parts.push(`なお、${next}${/[。！？!?]$/.test(next)?'':'。'}`);return parts.join('')}
function addFinalSummary(body,result){
  const model=summaryApi()?.build?.(result)||null,fallback=model?'':fallbackSummaryText();if(!model&&!fallback)return;
  addPhase(body,'最終総括');
  const row=document.createElement('div');row.id='magiFinalSummaryCard';row.className='magiMsg system finalSummary';
  let inner='';if(model){if(model.label)inner+=`<span class="magiSummaryBadge">${esc(model.label)}</span>`;if(model.decisionLead)inner+=`<div class="magiSummaryLead">${esc(model.decisionLead)}</div>`;if(model.decisiveReasons?.length)inner+=summarySection('決め手',model.decisiveReasons);if(model.mainDisagreement)inner+=summarySection('最大の争点',model.mainDisagreement);if(model.majorChanges?.length)inner+=summarySection('相互検証後の変更',model.majorChanges);if(model.minorityPersona&&model.minorityOpinion)inner+=summarySection(`少数意見：${model.minorityPersona}`,model.minorityOpinion);if(model.reDeliberationConditions?.length)inner+=summarySection('再審議条件',model.reDeliberationConditions)}else inner=`<span class="magiSpeechText">${esc(fallback)}</span>`;
  row.innerHTML=`<img class="magiAvatar" src="${P.CONTROL.img}" alt=""><div class="magiMsgCol"><div class="magiSender">MAGI CONTROL<span>最終総括</span></div><div class="magiBubble">${inner}</div></div>`;
  body.appendChild(row);
}
async function waitForDom(seq){
  for(let i=0;i<120;i++){
    if(seq!==renderSeq)return null;
    const bundle=document.getElementById('magiResultBundle'),live=document.getElementById('magiLiveTranscript'),final=bundle?.querySelector('.final');
    if(bundle&&live&&final&&live.querySelectorAll('.magiExchange').length>=3)return{bundle,live,final};
    await sleep(250);
  }
  return null;
}
async function hydrateDialogue(result){
  if(!result||dialogueOf(result).length||!isFullLineup(result)||!result?.primary)return result;
  const seq=++hydrateSeq,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),32000);
  try{
    const res=await fetch('/api/magi/dialogue',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:'CROSS_EXAMINATION',case:result.case,primary:result.primary}),signal:controller.signal});
    const direct=await res.json().catch(()=>null);
    if(seq!==hydrateSeq||!res.ok||!Array.isArray(direct?.dialogue)||!direct.dialogue.length)return result;
    return {...result,crossExamination:{...(result.crossExamination||{}),...direct}};
  }catch(_){return result}finally{clearTimeout(timer)}
}
function renderGeneric(body,items,result){
  const seen=new Set();let phase=0;
  for(const item of items){
    if(item.isControl){
      if(phase<1){addPhase(body,'相互検証');phase=1}
      controlRow(body,item.speech,item.judge||'相互検証');
    }else{
      if(item.isReply&&phase<2){addPhase(body,'二次判定');phase=2}
      personRow(body,item,seen,result);
    }
  }
}
function renderFullLineup(body,items,result){
  const seen=new Set();
  const primary=items.filter(x=>x.person&&x.person!==P.CONTROL&&!x.isReply).slice(0,3);
  const second=items.filter(x=>x.person&&x.person!==P.CONTROL&&x.isReply).slice(0,3);
  for(const item of primary)personRow(body,item,seen,result);
  addPhase(body,'相互検証');
  const dialogue=dialogueOf(result);
  if(dialogue.length){
    controlRow(body,controlOpeningText(result),'争点整理');
    dialogue.forEach(turn=>directRow(body,turn,result));
    controlRow(body,controlClosingText(),'相互検証まとめ');
  }else{
    controlRow(body,'3賢人の直接対話を取得できなかったため、誤った相互検証は表示しません。一次判断と二次判定だけを残します。','相互検証を保留');
  }
  addPhase(body,'二次判定');
  for(const item of second)personRow(body,item,seen,result);
}
function wireEvidence(box){box.querySelectorAll('.magiEvidenceToggle').forEach(btn=>btn.onclick=()=>{const ev=btn.closest('.magiBubble').querySelector('.magiEvidence'),open=ev.classList.toggle('open');btn.textContent=open?'根拠を閉じる ▴':'根拠を見る ▾'})}
async function render(result){
  if(!result)return false;
  const seq=++renderSeq;
  const dom=await waitForDom(seq);if(!dom||seq!==renderSeq)return false;
  const hydrated=isFullLineup(result)?await hydrateDialogue(result):result;if(seq!==renderSeq)return false;
  window.MAGI_LAST_DELIBERATION_RESULT=hydrated;
  const items=[...dom.live.querySelectorAll('.magiExchange')].map(parseExchange).filter(x=>x.person&&x.speech);
  const old=document.getElementById('magiChatView');if(old)old.remove();
  css();
  const box=document.createElement('section');box.id='magiChatView';box.dataset.magiCanonicalChat='v387';box.innerHTML='<div class="magiChatHead"><b>MAGI 公開審議</b><small>THREE WISE MEN CHAT</small></div><div class="magiChatBody"></div>';
  const body=box.querySelector('.magiChatBody');
  if(isFullLineup(hydrated))renderFullLineup(body,items,hydrated);else renderGeneric(body,items,hydrated);
  addFinalSummary(body,hydrated);wireEvidence(box);
  dom.bundle.classList.add('magiChatMode');dom.final.insertAdjacentElement('afterend',box);
  return true;
}
function trigger(result){render(result||currentResult())}
document.addEventListener('magi:deliberation-result',event=>trigger(event.detail||currentResult()));
let boot=0;const timer=setInterval(()=>{boot++;const result=currentResult();if(result){clearInterval(timer);trigger(result)}else if(boot>160)clearInterval(timer)},250);
const statusTimer=setInterval(()=>{const status=document.getElementById('status');if(!status)return;if(status.dataset.magiCanonicalChatWatch)return;status.dataset.magiCanonicalChatWatch='true';new MutationObserver(()=>{if(/審議完了|正式審議完了|選択審議完了/.test(status.textContent||''))trigger(currentResult())}).observe(status,{childList:true,subtree:true,characterData:true});clearInterval(statusTimer)},250);
window.MAGI_CHAT_UI_CANONICAL_META=Object.freeze({version:'chat-ui-canonical-v387',singleRenderPath:true,fullLineupNeverRendersLegacyControlTargetRows:true,directDialogueHydration:true,phaseOrder:'PRIMARY_CONTROL_DIRECT_DIALOGUE_CONTROL_SECOND_FINAL'});
})();
