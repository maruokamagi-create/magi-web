(()=>{
'use strict';
if(window.MAGI_UI_POLISH_V365)return;
window.MAGI_UI_POLISH_V365=true;

const style=document.createElement('style');
style.id='magi-ui-polish-v365-style';
style.textContent=`
/* Progress: keep the full progress UI visible and readable. */
#magiDeliberationProgress.magiProgress,
#magiDeliberationProgress.magiProgress.hidden{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  width:100%!important;
  max-height:none!important;
  box-sizing:border-box!important;
  margin:12px 0 8px!important;
  padding:13px 14px!important;
  border:1px solid #315574!important;
  border-radius:13px!important;
  background:linear-gradient(135deg,#071827,#0b2444)!important;
  color:#eaf4ff!important;
}
#magiDeliberationProgress .magiProgressTop,
#magiDeliberationProgress .magiProgressMeta{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  width:100%!important;
}
#magiDeliberationProgress .magiProgressState{
  display:flex!important;
  align-items:center!important;
  gap:9px!important;
  min-width:0!important;
  font-size:13px!important;
  font-weight:900!important;
}
#magiDeliberationProgress .magiProgressPct{
  flex:0 0 auto!important;
  font-size:18px!important;
  font-weight:900!important;
  color:#bfeeff!important;
}
#magiDeliberationProgress .magiPulse{
  display:block!important;
  width:11px!important;
  height:11px!important;
  flex:0 0 11px!important;
  border-radius:50%!important;
  background:#4db8d8!important;
  animation:magiUiPulseV365 1.15s infinite!important;
}
#magiDeliberationProgress .magiProgressTrack{
  display:block!important;
  position:relative!important;
  width:100%!important;
  height:12px!important;
  margin:10px 0 9px!important;
  overflow:hidden!important;
  border:1px solid rgba(108,194,236,.55)!important;
  border-radius:999px!important;
  background:#17354f!important;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.34)!important;
}
#magiDeliberationProgress .magiProgressBar{
  display:block!important;
  height:100%!important;
  width:0;
  min-width:0!important;
  border-radius:999px!important;
  background:linear-gradient(90deg,#37c9e8 0%,#62b8ff 100%)!important;
  box-shadow:0 0 10px rgba(69,194,239,.45)!important;
  transition:width .35s ease!important;
}
#magiDeliberationProgress .magiProgressMeta{
  font-size:10px!important;
  letter-spacing:.08em!important;
  color:#9fbbd4!important;
}
#magiDeliberationProgress .magiProgressMeta b{color:#dff4ff!important;}
#magiDeliberationProgress .magiProgressNote{
  margin-top:7px!important;
  font-size:9px!important;
  color:#708aa2!important;
}
#magiDeliberationProgress.magiProgress.done .magiPulse{
  animation:none!important;
  background:#37b579!important;
}
#magiDeliberationProgress.magiProgress.error .magiPulse{
  animation:none!important;
  background:#e44d63!important;
}

/* MAGI CONTROL: preserve the small outer footprint, enlarge only the official mark inside it. */
#magiChatView .magiMsg.system .magiAvatar{
  width:34px!important;
  height:34px!important;
  padding:1px!important;
  box-sizing:content-box!important;
  flex:0 0 auto!important;
  border-radius:8px!important;
  object-fit:contain!important;
  object-position:center!important;
  background:#0b2444!important;
}

/* MAGI CONTROL: use the same message font size as the three Wise Men. */
#magiChatView .magiMsg.system .magiBubble,
#magiChatView .magiMsg.system .magiSpeechText{
  font-size:14px!important;
}
#magiChatView .magiMsg.system .magiSpeechText{
  line-height:1.58!important;
}

@media(max-width:430px){
  #magiDeliberationProgress .magiProgressTrack{height:11px!important;}
}

@keyframes magiUiPulseV365{
  0%{box-shadow:0 0 0 0 rgba(77,184,216,.7)}
  70%{box-shadow:0 0 0 9px rgba(77,184,216,0)}
  100%{box-shadow:0 0 0 0 rgba(77,184,216,0)}
}
`;
document.head.appendChild(style);

function normalizeWiseNamesText(value){
  return String(value??'')
    .replace(/MELCHIOR(?:-1)?(?:殿|さん|氏)?/gi,'メルキオール')
    .replace(/BALTHASAR(?:-2)?(?:殿|さん|氏)?/gi,'バルタザール')
    .replace(/CASPER(?:-3)?(?:殿|さん|氏)?/gi,'カスパー')
    .replace(/メルキオール(?:殿|さん|氏)/g,'メルキオール')
    .replace(/バルタザール(?:殿|さん|氏)/g,'バルタザール')
    .replace(/カスパー(?:殿|さん|氏)/g,'カスパー');
}
function normalizeWiseNames(root=document){
  const nodes=[];
  if(root?.matches?.('.magiSpeechText,.magiSpeech'))nodes.push(root);
  root?.querySelectorAll?.('.magiSpeechText,.magiSpeech').forEach(el=>nodes.push(el));
  nodes.forEach(el=>{
    const before=el.textContent||'';
    const after=normalizeWiseNamesText(before);
    if(after!==before)el.textContent=after;
  });
}
normalizeWiseNames(document);
const wiseNameObserver=new MutationObserver(mutations=>{
  for(const mutation of mutations){
    if(mutation.type==='characterData'){
      normalizeWiseNames(mutation.target?.parentElement);
      continue;
    }
    mutation.addedNodes.forEach(node=>{
      if(node.nodeType===Node.ELEMENT_NODE)normalizeWiseNames(node);
      else if(node.nodeType===Node.TEXT_NODE)normalizeWiseNames(node.parentElement);
    });
  }
});
if(document.documentElement)wiseNameObserver.observe(document.documentElement,{childList:true,subtree:true,characterData:true});

function ensureProgressVisible(){
  const api=window.MAGI_PROGRESS_V358;
  if(!api||typeof api.update!=='function')return false;
  if(!document.getElementById('magiDeliberationProgress')){
    api.update(0,'審議準備中','READY');
  }
  return !!document.getElementById('magiDeliberationProgress');
}

window.addEventListener('magi:app-ready',ensureProgressVisible,{once:true});
let tries=0;
const boot=setInterval(()=>{
  tries++;
  if(ensureProgressVisible()||tries>=120)clearInterval(boot);
},100);
})();

(()=>{
'use strict';
if(window.MAGI_QUESTION_SAMPLES_V388)return;
window.MAGI_QUESTION_SAMPLES_V388=true;

const SAMPLES=[
  {label:'ベストオーダーを審議して',value:'現在の選手データと起用実績をもとに、現時点のベストオーダーを審議してください。'},
  {label:'現在のエース候補を審議して',value:'現在の投手データと起用実績をもとに、現在のエースは誰が適任か審議してください。'},
  {label:'次の試合の先発・継投案を考えて',value:'現在の投手データをもとに、次の試合の先発投手と継投案を審議してください。'},
  {label:'今のチームの改善課題を審議して',value:'現在のチームデータと直近の試合内容をもとに、今のチームで改善すべき課題を審議してください。'},
  {label:'選手のスタメン起用を審議して',value:'〇〇選手をスタメン起用すべきか、データ・戦術・チームへの影響の3視点で審議してください。'}
];

function addQuestionSampleStyle(){
  if(document.getElementById('magi-question-samples-v388-style'))return;
  const s=document.createElement('style');
  s.id='magi-question-samples-v388-style';
  s.textContent=`.magiQuestionSamples{margin:10px 0 2px}.magiQuestionSamplesLabel{display:block;margin:0 0 6px;font-size:12px;font-weight:800;letter-spacing:.02em;color:#aac0d5}.magiQuestionSamplesSelect{width:100%;min-height:46px;border-radius:12px;border:1px solid #355a7a;background:#0b2135;color:#fff;padding:10px 38px 10px 12px;font:inherit;font-size:14px;font-weight:750;outline:none;cursor:pointer}.magiQuestionSamplesSelect:focus{border-color:#6ca2dc;box-shadow:0 0 0 3px rgba(63,134,255,.14)}.magiQuestionSamplesHint{margin:6px 1px 0;font-size:11px;line-height:1.5;color:#8fa8bf}@media(max-width:430px){.magiQuestionSamplesSelect{font-size:15px;min-height:48px}.magiQuestionSamplesLabel{font-size:12px}.magiQuestionSamplesHint{font-size:11px}}`;
  document.head.appendChild(s);
}

function dispatchQuestionEvents(q){
  q.dispatchEvent(new Event('input',{bubbles:true}));
  q.dispatchEvent(new Event('change',{bubbles:true}));
}

function injectQuestionSamples(){
  const q=document.getElementById('q');
  if(!q||document.getElementById('magiQuestionSampleSelect'))return false;
  addQuestionSampleStyle();
  const wrap=document.createElement('div');
  wrap.className='magiQuestionSamples';
  wrap.id='magiQuestionSamples';
  const label=document.createElement('label');
  label.className='magiQuestionSamplesLabel';
  label.htmlFor='magiQuestionSampleSelect';
  label.textContent='質問サンプル（任意）';
  const select=document.createElement('select');
  select.id='magiQuestionSampleSelect';
  select.className='magiQuestionSamplesSelect';
  select.setAttribute('aria-label','質問サンプルを選ぶ');
  select.innerHTML='<option value="">▼ 質問サンプルを選ぶ</option>'+SAMPLES.map((sample,index)=>`<option value="${index}">${sample.label}</option>`).join('');
  const hint=document.createElement('div');
  hint.className='magiQuestionSamplesHint';
  hint.textContent='選ぶと下の入力欄に入ります。選択後も自由に書き換えられます。';
  wrap.append(label,select,hint);
  q.parentNode.insertBefore(wrap,q);
  const oldSampleButton=q.closest('.card')?.querySelector('button[onclick="sample()"]');
  if(oldSampleButton)oldSampleButton.style.display='none';
  select.addEventListener('change',()=>{
    if(select.value==='')return;
    const sample=SAMPLES[Number(select.value)];
    if(!sample)return;
    q.value=sample.value;
    dispatchQuestionEvents(q);
    q.focus();
    q.setSelectionRange?.(q.value.length,q.value.length);
  });
  q.addEventListener('input',()=>{
    const index=SAMPLES.findIndex(sample=>sample.value===q.value);
    const next=index>=0?String(index):'';
    if(select.value!==next)select.value=next;
  });
  return true;
}

if(!injectQuestionSamples()){
  const observer=new MutationObserver(()=>{
    if(injectQuestionSamples())observer.disconnect();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',injectQuestionSamples,{once:true});
}
})();
