(()=>{
'use strict';
if(window.MAGI_APP_BOOTSTRAP_V363)return;
window.MAGI_APP_BOOTSTRAP_V363=true;
const REV='376';
let ready=false,failed=false;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error(`load failed: ${src}`));document.body.appendChild(s);});
function buttonFrom(node){return node?.closest?.('#magiRunButton,button[onclick*="runMagi"]')||null}
function findButton(){return document.getElementById('magiRunButton')||document.querySelector('button[onclick*="runMagi"]')}
function quarantineButton(){const b=findButton();if(!b)return;b.id='magiRunButton';b.type='button';if(!ready){b.disabled=true;if(!failed)b.textContent='MAGI準備中…';}}
function blockLegacyClick(event){const b=buttonFrom(event.target);if(!b||ready)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
function setError(message){failed=true;ready=false;quarantineButton();const b=findButton();if(b){b.disabled=true;b.textContent='MAGI準備エラー'}const st=document.getElementById('status');if(st)st.textContent=`正式MAGIを起動できませんでした：${message}`;console.error('[MAGI bootstrap canonical]',message);}
function legacyUiReady(){return Boolean(window.MAGI_ACTIVE_VERSION&&window.MAGI_ENGINE_UI_V187===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&typeof window.runMagi==='function');}
async function waitLegacyUi(){while(!legacyUiReady()){quarantineButton();await sleep(50);}}
function integrityReady(){return window.MAGI_DELIBERATION_INTEGRITY_V349===true&&window.MAGI_DELIBERATION_SERIAL_V374===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&/serial-integrity/i.test(String(window.MAGI_ENGINE_V1.version||''));}
function finalizerReady(){return window.MAGI_LINEUP_FINALIZER_V350===true&&window.MAGI_ENGINE_V1&&typeof window.MAGI_ENGINE_V1.deliberate==='function'&&/lineup-finalizer-v350/i.test(String(window.MAGI_ENGINE_V1.version||''));}
function progressReady(){return window.MAGI_PROGRESS_V358?.version==='progress-v358-event-driven';}
function uiRunnerGuardReady(){return window.MAGI_UI_RUNNER_GUARD_V359_META?.propagatesErrors===true;}
function formalReady(){return window.MAGI_FORMAL_RUNNER_V373_READY===true&&typeof window.MAGI_FORMAL_UI_RUNNER_V2==='function'&&window.MAGI_FORMAL_UI_RUNNER_V2?.meta?.structuredValidationOnly===true;}
function coreGuardReady(){return window.MAGI_CORE_CLIENT_GUARD_V363_META?.runtimeVersion===363;}
function semanticReady(){return typeof window.MAGI_SEMANTIC_RUN_V2==='function'&&String(window.MAGI_CLIENT_VERSION||'')==='362'&&String(window.MAGI_EFFECTIVE_RUNTIME_VERSION||'')==='363';}
async function waitCapability(check){while(!check())await sleep(40);}
function activateButton(){const b=findButton();if(!b)throw new Error('MAGI実行ボタンを取得できません');b.id='magiRunButton';b.type='button';b.dataset.magiEntry='semantic-v376';b.removeAttribute('onclick');b.disabled=false;b.textContent='MAGI実行';}
async function boot(){
  document.addEventListener('click',blockLegacyClick,true);quarantineButton();
  await waitLegacyUi();
  await load(`/deliberation-integrity-v348.js?v=${REV}`);await waitCapability(integrityReady);
  await load(`/lineup-finalizer-v350.js?v=${REV}`);await waitCapability(finalizerReady);
  await load(`/engine-progress-v358.js?v=${REV}`);await waitCapability(progressReady);
  await load(`/magi-ui-runner-guard-v359.js?v=${REV}`);await waitCapability(uiRunnerGuardReady);
  await load(`/magi-formal-runner-v373.js?v=${REV}`);await waitCapability(formalReady);
  await load(`/magi-core-client-guard-v363.js?v=${REV}`);await waitCapability(coreGuardReady);
  await load(`/main-live-answer-v362.js?v=${REV}`);await waitCapability(semanticReady);
  ready=true;activateButton();
  window.MAGI_APP_RUNTIME=Object.freeze({version:'canonical-app-v376',clientVersion:363,runtimeVersion:363,ready:true,entry:'WINDOW_CAPTURE_SEMANTIC_V2',formalRunner:'V373_SINGLE_PATH',progress:'EVENT_DRIVEN_ONLY',rawPacketValidated:true,numericFailClosed:true,structuredValidationOnly:true,proseBlocking:false,authoritativeEvidenceVisible:true,staleClientFailClosed:true,bootstrapLast:true,localFallback:false,teamPolicy:'MARUOKA_PRACTICAL_LINEUP_POLICY_20260916',engineVersion:String(window.MAGI_ENGINE_V1?.version||'')});
  document.dispatchEvent(new CustomEvent('magi:app-ready',{detail:window.MAGI_APP_RUNTIME}));
}
boot().catch(error=>setError(error?.message||String(error)));
})();