(()=>{
'use strict';
const P={
  MELCHIOR:{img:'/portraits/melchior.png?v=195',cls:'mel',name:'MELCHIOR-1',jp:'メルキオール'},
  BALTHASAR:{img:'/portraits/balthasar.png?v=195',cls:'bal',name:'BALTHASAR-2',jp:'バルタザール'},
  CASPER:{img:'/portraits/casper.png?v=195',cls:'cas',name:'CASPER-3',jp:'カスパー'},
  CONTROL:{img:'/magi-official-symbol-v125.svg?v=195',cls:'ctl',name:'MAGI CONTROL',jp:'MAGI CONTROL'}
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function css(){if(document.getElementById('magi-chat-v196-style'))return;const s=document.createElement('style');s.id='magi-chat-v196-style';s.textContent=`
#magiChatView{margin:0 0 14px;background:#dfe8ef;border:1px solid #b8c7d4;border-radius:16px;overflow:hidden;color:#142033;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.magiChatHead{background:#0b2444;color:#fff;padding:12px 15px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #163b62}.magiChatHead b{font-size:14px;letter-spacing:.05em}.magiChatHead small{font-size:9px;letter-spacing:.12em;color:#9fbad3}
.magiChatBody{padding:14px 11px 16px;background:linear-gradient(#dfe8ef,#e8eef3)}
.magiMsg{display:flex;align-items:flex-start;gap:8px;margin:0 0 13px}.magiMsg:last-child{margin-bottom:0}.magiMsg.system{justify-content:center;margin:8px 0 13px}.magiMsg.system .magiAvatar{width:28px;height:28px;border-radius:8px;padding:4px;background:#0b2444}.magiMsg.system .magiMsgCol{max-width:82%;align-items:center}.magiMsg.system .magiBubble{background:#f5f7f9;border-radius:10px;color:#34475b;border:1px solid #cad4dd;font-size:12px;line-height:1.65;box-shadow:none}
.magiAvatar{width:42px;height:42px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;border:1px solid rgba(0,0,0,.14);flex:0 0 auto}.magiAvatar.ctl{object-fit:contain;padding:6px;border-radius:10px}
.magiMsgCol{display:flex;flex-direction:column;align-items:flex-start;min-width:0;max-width:calc(100% - 50px)}.magiSender{font-size:10px;font-weight:900;color:#52677b;margin:0 0 3px 3px;letter-spacing:.03em}.magiSender span{font-weight:700;color:#778b9d;margin-left:5px}
.magiBubble{position:relative;background:#fff;border-radius:4px 16px 16px 16px;padding:11px 13px;font-size:14px;line-height:1.72;color:#16283a;box-shadow:0 1px 2px rgba(0,0,0,.08);word-break:break-word}.magiMsg.mel .magiBubble{border-left:4px solid #1e4f96}.magiMsg.bal .magiBubble{border-left:4px solid #c52b38}.magiMsg.cas .magiBubble{border-left:4px solid #16945c}
.magiJudgeTag{display:inline-block;margin:8px 0 0;font-size:9px;font-weight:900;border-radius:999px;padding:3px 7px;background:#eef3f7;color:#4a6075}.magiMsg.mel .magiJudgeTag{color:#204f8e}.magiMsg.bal .magiJudgeTag{color:#a6222f}.magiMsg.cas .magiJudgeTag{color:#13724a}
.magiEvidenceToggle{border:0;background:transparent;color:#386b98;font-size:11px;font-weight:900;padding:8px 0 0;min-height:0;cursor:pointer}.magiEvidence{display:none;margin-top:8px;padding:9px 10px;border-radius:10px;background:#f3f6f9;border:1px solid #d5dee6;font-size:11px;line-height:1.65;color:#4c5d6d}.magiEvidence.open{display:block}.magiEvidence b{display:block;font-size:9px;letter-spacing:.08em;color:#718394;margin:0 0 4px}.magiEvidence div+div{margin-top:8px}
.magiChatPhase{display:flex;align-items:center;gap:8px;margin:4px 0 12px;color:#738799;font-size:9px;font-weight:900;letter-spacing:.11em}.magiChatPhase:before,.magiChatPhase:after{content:'';height:1px;background:#c3ced8;flex:1}
#magiChatView+.magiResultOrderTitle{display:none!important}.magiResultBundle.magiChatMode .answerWrap,.magiResultBundle.magiChatMode #engineProtocol,.magiResultBundle.magiChatMode #magiThreeWiseTitle,.magiResultBundle.magiChatMode #magiReasonTitle{display:none!important}
@media(max-width:430px){.magiChatBody{padding:12px 8px 14px}.magiAvatar{width:38px;height:38px}.magiMsgCol{max-width:calc(100% - 46px)}.magiBubble{font-size:14px;line-height:1.75;padding:10px 12px}.magiMsg.system .magiMsgCol{max-width:88%}}
`;document.head.appendChild(s)}
function who(text){const t=String(text||'').toUpperCase();if(t.includes('MELCHIOR'))return P.MELCHIOR;if(t.includes('BALTHASAR'))return P.BALTHASAR;if(t.includes('CASPER'))return P.CASPER;if(t.includes('MAGI CONTROL'))return P.CONTROL;return null}
function evidenceFor(person){const map={MELCHIOR:'.answer.m',BALTHASAR:'.answer.b',CASPER:'.answer.c'};const key=Object.keys(P).find(k=>P[k]===person);const card=document.querySelector(map[key]||'');if(!card)return'';const minis=[...card.querySelectorAll('.mini')];if(!minis.length)return'';return minis.map(m=>{const b=m.querySelector('b')?.textContent?.trim()||'詳細';const v=m.querySelector('span')?.textContent?.trim()||'';return v?`<div><b>${esc(b)}</b>${esc(v)}</div>`:''}).join('')}
function addPhase(body,text){const d=document.createElement('div');d.className='magiChatPhase';d.textContent=text;body.appendChild(d)}
function build(){css();const bundle=document.getElementById('magiResultBundle');const live=document.getElementById('magiLiveTranscript');const final=bundle?.querySelector('.final');if(!bundle||!live||!final||document.getElementById('magiChatView'))return false;const exchanges=[...live.querySelectorAll('.magiExchange')];if(exchanges.length<3)return false;
 const box=document.createElement('section');box.id='magiChatView';box.innerHTML='<div class="magiChatHead"><b>MAGI 公開審議</b><small>THREE WISE MEN CHAT</small></div><div class="magiChatBody"></div>';const body=box.querySelector('.magiChatBody');
 let seenPrimary=new Set(),phase=0;
 exchanges.forEach(ex=>{const speaker=ex.querySelector('.magiSpeaker')?.textContent?.trim()||'';const speech=ex.querySelector('.magiSpeech')?.textContent?.trim()||'';const judge=ex.querySelector('.magiJudge')?.textContent?.trim()||'';const person=who(speaker);if(!person||!speech)return;
   const isControl=person===P.CONTROL;const isReply=ex.querySelector('.magiSpeech')?.classList.contains('magiReply');
   if(isControl&&phase<1){addPhase(body,'相互検証');phase=1}else if(isReply&&phase<2){addPhase(body,'二次判定');phase=2}
   const row=document.createElement('div');row.className=`magiMsg ${isControl?'system':person.cls}`;
   const evKey=person.name;let ev='';if(!isControl&&!seenPrimary.has(evKey)){ev=evidenceFor(person);seenPrimary.add(evKey)}
   row.innerHTML=`<img class="magiAvatar ${isControl?'ctl':''}" src="${person.img}" alt=""><div class="magiMsgCol"><div class="magiSender">${esc(person.jp)}<span>${esc(person.name)}</span></div><div class="magiBubble">${esc(speech)}${judge?`<div class="magiJudgeTag">${esc(judge)}</div>`:''}${ev?`<button type="button" class="magiEvidenceToggle">根拠を見る ▾</button><div class="magiEvidence">${ev}</div>`:''}</div></div>`;
   body.appendChild(row);
 });
 box.querySelectorAll('.magiEvidenceToggle').forEach(btn=>btn.addEventListener('click',()=>{const ev=btn.nextElementSibling;const open=ev.classList.toggle('open');btn.textContent=open?'根拠を閉じる ▴':'根拠を見る ▾'}));
 bundle.classList.add('magiChatMode');final.insertAdjacentElement('afterend',box);return true}
function watch(){let tries=0;const tick=()=>{tries++;if(build()||tries>120)return;setTimeout(tick,250)};tick();const status=document.getElementById('status');if(status)new MutationObserver(()=>{if(/審議完了|正式審議完了/.test(status.textContent))setTimeout(build,120)}).observe(status,{childList:true,subtree:true,characterData:true})}
let n=0;const boot=setInterval(()=>{n++;if(document.getElementById('status')){clearInterval(boot);watch()}else if(n>80)clearInterval(boot)},250);
})();
