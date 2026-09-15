(()=>{
'use strict';
if(window.MAGI_APP_BOOTSTRAP_V363)return;
window.MAGI_APP_BOOTSTRAP_V363=true;
const REV='363';
let ready=false,failed=false;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`load failed: ${src}`));document.body.appendChild(s);});
function buttonFrom(node){return node?.closest?.('#magiRunButton,button[onclick*="runMagi"]')||null}
function findButton(){return document.getElementById('magiRunButton')||document.querySelector('button[onclick*="runMagi"]')}
function quarantineButton(){const b=findButton();if(!b)return;b.id='magiRunButton';b.type='button';if(!ready){b.disabled=true;if(!failed)b.textContent='MAGI準備中…';}}
function blockLegacyClick(event){const b=buttonFrom(event.target);if(!b||ready)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
function setError(message){failed=true;ready=false;quarantineButton();const b=findButton();if(b){b.disabled=true;b.textContent='MAGI準備エラー'}const st=document.getElementById('status');if(st)st.textContent=`正式MAGIを起動できませんでした：${message}`;console.error('[MAGI bootstrap v363]',message);}
function legacyUiReady(){return Boolean(window.MAGI_ACTIVE_VERSION&&window.MAGI_ENGINE_UI_V187===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&typeof window.runMagi==='function');}
async function waitLegacyUi(){while(!legacyUiReady()){quarantineButton();await sleep(50);}}
function integrityReady(){return window.MAGI_DELIBERATION_INTEGRITY_V349===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&/integrity/i.test(String(window.MAGI_ENGINE_V1.version||''));}
function finalizerReady(){return window.MAGI_LINEUP_FINALIZER_V350===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&/lineup-finalizer-v350/i.test(String(window.MAGI_ENGINE_V1.version||''));}
function progressReady(){return window.MAGI_PROGRESS_V358?.version==='progress-v358-event-driven';}
function uiRunnerGuardReady(){return window.MAGI_UI_RUNNER_GUARD_V359_META?.propagatesErrors===true;}
function formalReady(){return typeof window.MAGI_FORMAL_UI_RUNNER_V3==='function'&&window.MAGI_FORMAL_UI_RUNNER_V3?.meta?.numericFailClosed===true;}
function truthReady(){return window.MAGI_UI_TRUTH_V363_API?.version==='ui-truth-v363';}
function coreGuardReady(){return window.MAGI_CORE_CLIENT_GUARD_V363_META?.runtimeVersion===363;}
function semanticReady(){return typeof window.MAGI_SEMANTIC_RUN_V2==='function'&&String(window.MAGI_CLIENT_VERSION||'')==='362'&&String(window.MAGI_EFFECTIVE_RUNTIME_VERSION||'')==='363';}
async function waitCapability(check){while(!check())await sleep(40);}
function activateButton(){const b=findButton();if(!b)throw new Error('MAGI実行ボタンを取得できません');b.id='magiRunButton';b.type='button';b.dataset.magiEntry='semantic-v363';b.removeAttribute('onclick');b.disabled=false;b.textContent='MAGI実行';}
async function boot(){
  document.addEventListener('click',blockLegacyClick,true);quarantineButton();
  await waitLegacyUi();
  await load(`/deliberation-integrity-v348.js?v=${REV}`);await waitCapability(integrityReady);
  await load(`/lineup-finalizer-v350.js?v=${REV}`);await waitCapability(finalizerReady);
  await load(`/engine-progress-v358.js?v=${REV}`);await waitCapability(progressReady);
  await load(`/magi-ui-runner-guard-v359.js?v=${REV}`);await waitCapability(uiRunnerGuardReady);
  await load('/magi-formal-runner-v358.js?v=366');await waitCapability(formalReady);
  await load('/magi-ui-truth-v363.js?v=365');await waitCapability(truthReady);
  const guarded=window.MAGI_UI_TRUTH_V363_API.installFormalRunnerGuard();
  if(typeof guarded!=='function'||guarded?.meta?.rawPacketValidated!==true)throw new Error('v363 UI truth guardを起動できません');
  window.MAGI_FORMAL_UI_RUNNER_V2=guarded;
  await load(`/magi-core-client-guard-v363.js?v=${REV}`);await waitCapability(coreGuardReady);
  await load(`/main-live-answer-v362.js?v=${REV}`);await waitCapability(semanticReady);
  ready=true;activateButton();
  window.MAGI_APP_RUNTIME=Object.freeze({version:'canonical-app-v363',clientVersion:363,runtimeVersion:363,ready:true,entry:'WINDOW_CAPTURE_SEMANTIC_V2',formalRunner:'V4_RAW_PACKET_TRUTH',progress:'EVENT_DRIVEN_ONLY',rawPacketValidated:true,numericFailClosed:true,uiTruthFailClosed:true,authoritativeEvidenceVisible:true,staleClientFailClosed:true,bootstrapLast:true,localFallback:false,engineVersion:String(window.MAGI_ENGINE_V1?.version||'')});
  document.dispatchEvent(new CustomEvent('magi:app-ready',{detail:window.MAGI_APP_RUNTIME}));
}
boot().catch(error=>setError(error?.message||String(error)));
})();
