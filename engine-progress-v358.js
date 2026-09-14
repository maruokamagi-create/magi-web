(()=>{
'use strict';
if(window.MAGI_PROGRESS_V358)return;

const ID='magiDeliberationProgress';
let last={pct:0,label:'待機中',step:'READY'};
let startedAt=0,finishedAt=0,timer=null;
const fmt=seconds=>{const s=Math.max(0,Math.floor(seconds));const m=Math.floor(s/60),r=s%60;return m?`${m}分${String(r).padStart(2,'0')}秒`:`${r}秒`};

function injectCss(){
  if(document.getElementById('magi-progress-v358-style'))return;
  const st=document.createElement('style');
  st.id='magi-progress-v358-style';
  st.textContent=`#${ID}.magiProgress{display:block!important}.magiProgressBar{transition:width .35s ease!important}`;
  document.head.appendChild(st);
}
function ensure(){
  let box=document.getElementById(ID);
  if(box)return box;
  const status=document.getElementById('status');
  if(!status)return null;
  box=document.createElement('div');box.id=ID;box.className='magiProgress hidden';
  box.innerHTML='<div class="magiProgressTop"><div class="magiProgressState"><span class="magiPulse" aria-hidden="true"></span><span id="magiProgressLabel">待機中</span></div><div class="magiProgressPct" id="magiProgressPct">0%</div></div><div class="magiProgressTrack"><div class="magiProgressBar" id="magiProgressBar"></div></div><div class="magiProgressMeta"><span id="magiProgressStep">READY</span><span><span id="magiTimeLabel">経過</span> <b id="magiElapsed">0秒</b></span></div><div class="magiProgressNote">進捗率は実際のMAGI処理段階に連動します。</div>';
  status.parentNode.insertBefore(box,status);
  return box;
}
function stopClock(done=false){
  if(done&&startedAt&&!finishedAt)finishedAt=Date.now();
  if(timer){clearInterval(timer);timer=null;}
  const e=document.getElementById('magiElapsed');
  if(e&&startedAt)e.textContent=fmt(((finishedAt||Date.now())-startedAt)/1000);
  const label=document.getElementById('magiTimeLabel');if(label)label.textContent=finishedAt?'所要時間':'経過';
}
function startClock(){
  if(startedAt&&!finishedAt)return;
  startedAt=Date.now();finishedAt=0;
  const tick=()=>{const e=document.getElementById('magiElapsed');if(e&&startedAt&&!finishedAt)e.textContent=fmt((Date.now()-startedAt)/1000)};
  tick();timer=setInterval(tick,1000);
}
function render(next,{force=false}={}){
  const box=ensure();if(!box)return;
  injectCss();
  const pct=Math.max(0,Math.min(100,Number(next?.pct)||0));
  if(!force&&pct<last.pct&&next?.step!=='RESET')return;
  last={pct,label:String(next?.label||last.label),step:String(next?.step||last.step)};
  box.classList.remove('hidden','done','error');
  if(last.step==='ERROR')box.classList.add('error');
  if(last.pct===100)box.classList.add('done');
  const label=document.getElementById('magiProgressLabel'),p=document.getElementById('magiProgressPct'),bar=document.getElementById('magiProgressBar'),step=document.getElementById('magiProgressStep');
  if(label)label.textContent=last.label;if(p)p.textContent=`${last.pct}%`;if(bar)bar.style.width=`${last.pct}%`;if(step)step.textContent=last.step;
  if(last.pct>0&&last.pct<100&&last.step!=='ERROR')startClock();
  if(last.pct===100||last.step==='ERROR')stopClock(true);
}
function reset(label='質問を理解中'){
  stopClock(false);startedAt=0;finishedAt=0;last={pct:0,label:'待機中',step:'READY'};
  const e=document.getElementById('magiElapsed');if(e)e.textContent='0秒';
  render({pct:5,label,step:'SEMANTIC UNDERSTANDING'},{force:true});
}
function update(pct,label,step){render({pct,label,step});}
function complete(label='MAGI 審議完了'){render({pct:100,label,step:'FINAL DECISION'});}
function error(label='審議を停止しました'){render({pct:Math.max(last.pct,10),label,step:'ERROR'},{force:true});}

window.MAGI_PROGRESS_V358=Object.freeze({version:'progress-v358-event-driven',reset,update,complete,error});
document.addEventListener('magi:progress',event=>{
  const d=event?.detail||{};
  if(d.reset)return reset(d.label||'質問を理解中');
  if(d.error)return error(d.label||'審議を停止しました');
  if(d.done)return complete(d.label||'MAGI 審議完了');
  update(d.pct,d.label,d.step);
});

document.addEventListener('click',event=>{
  const b=event.target?.closest?.('#magiRunButton,[data-magi-entry="semantic"]');
  if(b&&!b.disabled)reset('質問全体の意味を理解中');
},true);

function fromStatus(text){
  const t=String(text||'');
  if(/質問内容を理解|質問の意味/.test(t))return{pct:8,label:'質問全体の意味を理解中',step:'SEMANTIC UNDERSTANDING'};
  if(/正本Evidence|正本データ/.test(t))return{pct:18,label:'正本Evidenceを確認中',step:'CASE / EVIDENCE'};
  if(/処理を停止|エラー|失敗/.test(t))return{error:true,label:'処理を停止しました'};
  if(/回答完了|審議完了/.test(t))return{done:true,label:'MAGI 審議完了'};
  return null;
}
function observeStatus(){
  const s=document.getElementById('status');if(!s)return false;
  const sync=()=>{const d=fromStatus(s.textContent);if(!d)return;if(d.error)error(d.label);else if(d.done)complete(d.label);else update(d.pct,d.label,d.step)};
  new MutationObserver(sync).observe(s,{childList:true,subtree:true,characterData:true});sync();return true;
}
let tries=0;const boot=setInterval(()=>{tries++;injectCss();ensure();if(observeStatus()||tries>100)clearInterval(boot)},100);
})();
