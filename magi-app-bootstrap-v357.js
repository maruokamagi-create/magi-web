(()=>{
'use strict';
if(window.MAGI_APP_BOOTSTRAP_V357)return;
window.MAGI_APP_BOOTSTRAP_V357=true;

const REV='357';
let ready=false;
let failed=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const load=src=>new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src=src;
  s.async=false;
  s.onload=resolve;
  s.onerror=()=>reject(new Error(`load failed: ${src}`));
  document.body.appendChild(s);
});

function buttonFrom(node){return node?.closest?.('#magiRunButton,button[onclick*="runMagi"]')||null}
function findButton(){return document.getElementById('magiRunButton')||document.querySelector('button[onclick*="runMagi"]')}
function quarantineButton(){
  const b=findButton();
  if(!b)return;
  b.id='magiRunButton';
  b.type='button';
  if(!ready){
    b.disabled=true;
    if(!failed)b.textContent='MAGI準備中…';
  }
}
function blockLegacyClick(event){
  const b=buttonFrom(event.target);
  if(!b||ready)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
function installBootGuard(){
  document.addEventListener('click',blockLegacyClick,true);
  quarantineButton();
}
function setError(message){
  failed=true;
  ready=false;
  quarantineButton();
  const b=findButton();
  if(b){b.disabled=true;b.textContent='MAGI準備エラー'}
  const st=document.getElementById('status');
  if(st)st.textContent=`正式MAGIを起動できませんでした：${message}`;
  console.error('[MAGI stabilization bootstrap]',message);
}
function legacyUiReady(){
  return Boolean(
    window.MAGI_ACTIVE_VERSION&&
    window.MAGI_ENGINE_UI_V187===true&&
    window.MAGI_ENGINE_V1&&
    typeof window.MAGI_ENGINE_V1.deliberate==='function'&&
    typeof window.runMagi==='function'
  );
}
async function waitLegacyUi(){
  while(!legacyUiReady()){
    quarantineButton();
    await sleep(50);
  }
}
function integrityReady(){
  return window.MAGI_DELIBERATION_INTEGRITY_V349===true&&
    window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&
    /integrity/i.test(String(window.MAGI_ENGINE_V1.version||''));
}
function finalizerReady(){
  return window.MAGI_LINEUP_FINALIZER_V350===true&&
    window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&
    /lineup-finalizer-v350/i.test(String(window.MAGI_ENGINE_V1.version||''));
}
function formalRunnerReady(){return typeof window.MAGI_FORMAL_UI_RUNNER_V2==='function'&&window.MAGI_FORMAL_UI_RUNNER_V2?.meta?.explicitEvidence===true}
function semanticReady(){return typeof window.MAGI_SEMANTIC_RUN_V1==='function'}
async function waitCapability(check){while(!check())await sleep(40)}
function activateButton(){
  const b=findButton();
  if(!b)throw new Error('MAGI実行ボタンを取得できません');
  b.id='magiRunButton';
  b.type='button';
  b.dataset.magiEntry='semantic';
  b.removeAttribute('onclick');
  b.disabled=false;
  b.textContent='MAGI実行';
}

async function boot(){
  installBootGuard();
  await waitLegacyUi();

  await load(`/deliberation-integrity-v348.js?v=${REV}`);
  await waitCapability(integrityReady);

  await load(`/lineup-finalizer-v350.js?v=${REV}`);
  await waitCapability(finalizerReady);

  await load(`/magi-formal-runner-v357.js?v=${REV}`);
  await waitCapability(formalRunnerReady);

  await load(`/main-live-answer-v329.js?v=${REV}`);
  await waitCapability(semanticReady);

  ready=true;
  activateButton();
  window.MAGI_APP_RUNTIME=Object.freeze({
    version:'canonical-app-v357',
    ready:true,
    entry:'GEMINI_SEMANTIC_FIRST',
    formalRunner:'V2_EXPLICIT_EVIDENCE',
    localFallback:false,
    engineVersion:String(window.MAGI_ENGINE_V1?.version||'')
  });
  document.dispatchEvent(new CustomEvent('magi:app-ready',{detail:window.MAGI_APP_RUNTIME}));
}

boot().catch(error=>setError(error?.message||String(error)));
})();
