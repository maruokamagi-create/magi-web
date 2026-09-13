(()=>{
'use strict';
if(window.MAGI_RUNTIME_V1_BOOTING)return;
window.MAGI_RUNTIME_V1_BOOTING=true;

const RUNTIME_VERSION='1.1.0';
const ASSET_REV='353';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`load failed: ${src}`));document.body.appendChild(s)});
let ready=false;
let formalRunner=null;
let observer=null;

function isFormalRunner(fn){
  if(typeof fn!=='function'||!window.MAGI_ENGINE_V1)return false;
  try{return /MAGI_ENGINE_V1\.deliberate/.test(Function.prototype.toString.call(fn))}catch(_){return false}
}
function integrityReady(){
  const engine=window.MAGI_ENGINE_V1;
  return Boolean(
    window.MAGI_DELIBERATION_INTEGRITY_V349===true &&
    engine && typeof engine.deliberate==='function' &&
    /integrity/i.test(String(engine.version||''))
  );
}
function lineupFinalizerReady(){
  const engine=window.MAGI_ENGINE_V1;
  return Boolean(
    window.MAGI_LINEUP_FINALIZER_V350===true &&
    engine && typeof engine.deliberate==='function' &&
    /lineup-finalizer-v350/i.test(String(engine.version||''))
  );
}
function semanticRouterReady(){return typeof window.MAGI_SEMANTIC_RUN_V1==='function'}
function getRunButton(){
  return document.getElementById('magiRunButton')||document.querySelector('#judge .actions button.primary,button[onclick*="runMagi"]');
}
function quarantineButton(){
  const b=getRunButton();
  if(!b)return;
  b.id='magiRunButton';
  b.type='button';
  b.dataset.magiRun='formal';
  b.removeAttribute('onclick');
  if(!ready){b.disabled=true;if(!/準備|エラー/.test(b.textContent||''))b.textContent='MAGI準備中…';}
}
function installQuarantine(){
  quarantineButton();
  if(observer)return;
  observer=new MutationObserver(quarantineButton);
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
function setRuntimeError(message){
  ready=false;
  quarantineButton();
  const b=getRunButton();if(b){b.disabled=true;b.textContent='MAGI準備エラー';}
  const st=document.getElementById('status');if(st)st.textContent=`正式MAGIを起動できませんでした：${message}`;
  console.error('[MAGI runtime v1]',message,{engineVersion:window.MAGI_ENGINE_V1?.version||null});
}
function normalizeVisibleVersion(){
  const st=document.getElementById('status');
  if(st&&/FREE CORE v0\.(?:9|10)\./.test(st.textContent||''))st.textContent=(st.textContent||'').replace(/v0\.(?:9|10)\.\d+/g,`v${window.MAGI_VERSION||'0.11.18'}`);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let n;while((n=walker.nextNode())){if(String(n.nodeValue||'').trim()==='LOCAL HISTORY')n.nodeValue='審議履歴';}
}
async function waitFor(predicate,ms){
  const started=Date.now();
  while(Date.now()-started<ms){if(predicate())return true;await sleep(50)}
  return false;
}
async function waitForFormalRunner(){
  const started=Date.now();
  while(Date.now()-started<45000){
    quarantineButton();
    const fn=window.runMagi;
    if(window.MAGI_ACTIVE_VERSION&&isFormalRunner(fn))return fn.bind(window);
    await sleep(50);
  }
  return null;
}
function lockCompatibilityEntry(){
  const compatibilityRun=function(){return window.MAGI_FORMAL_UI_RUNNER_V1.apply(window,arguments)};
  try{
    Object.defineProperty(window,'runMagi',{value:compatibilityRun,writable:false,configurable:false,enumerable:true});
  }catch(_){window.runMagi=compatibilityRun}
}
async function boot(){
  installQuarantine();
  formalRunner=await waitForFormalRunner();
  if(!formalRunner)return setRuntimeError('正式3賢人UIランナーを取得できません');

  Object.defineProperty(window,'MAGI_FORMAL_UI_RUNNER_V1',{value:formalRunner,writable:false,configurable:false,enumerable:false});
  lockCompatibilityEntry();

  await load(`/deliberation-integrity-v348.js?v=${ASSET_REV}`);
  if(!(await waitFor(integrityReady,12000)))return setRuntimeError(`整合性レイヤー未成立（engine=${window.MAGI_ENGINE_V1?.version||'unknown'}）`);

  await load(`/lineup-finalizer-v350.js?v=${ASSET_REV}`);
  if(!(await waitFor(lineupFinalizerReady,12000)))return setRuntimeError(`打順最終集約レイヤー未成立（engine=${window.MAGI_ENGINE_V1?.version||'unknown'}）`);

  await load(`/main-live-answer-v329.js?v=${ASSET_REV}`);
  if(!(await waitFor(semanticRouterReady,12000)))return setRuntimeError('質問理解ルーターを起動できません');

  ready=true;
  window.MAGI_RUNTIME_V1=Object.freeze({
    mode:'FORMAL_ONLY',ready:true,version:RUNTIME_VERSION,
    engineVersion:String(window.MAGI_ENGINE_V1?.version||''),
    localFallback:false
  });
  const b=getRunButton();
  if(b){b.disabled=false;b.textContent='MAGI実行';b.removeAttribute('onclick');b.dataset.magiRun='formal';}
  normalizeVisibleVersion();
  document.dispatchEvent(new CustomEvent('magi:runtime-ready',{detail:window.MAGI_RUNTIME_V1}));
}

installQuarantine();
boot().catch(err=>setRuntimeError(err?.message||String(err)));
})();
