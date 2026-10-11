(()=>{
'use strict';
if(window.MAGI_PRODUCTION_STABILITY_V412)return;
window.MAGI_PRODUCTION_STABILITY_V412=true;
const txt=v=>String(v??'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function hasLegacySecondFallback(result){
 const second=result?.second;
 if(!second||typeof second!=='object')return false;
 const stack=[second];
 while(stack.length){
  const value=stack.pop();
  if(!value||typeof value!=='object')continue;
  if(value.secondFallbackUsed===true||txt(value.secondFallbackReason))return true;
  for(const child of Object.values(value)){
   if(child&&typeof child==='object')stack.push(child);
   else if(typeof child==='string'&&/二次判定で一時的な通信障害|一次判断を暫定維持/.test(child))return true;
  }
 }
 return false;
}
function complete(result){return Boolean(result?.primary&&result?.crossExamination&&result?.second&&result?.final)}
function ready(){return window.MAGI_APP_RUNTIME?.ready===true&&typeof window.MAGI_FORMAL_UI_RUNNER_V2==='function'&&window.MAGI_PROGRESS_V358?.version==='progress-v358-event-driven'&&window.MAGI_DELIBERATION_SERIAL_V374===true}
async function warm(){const start=Date.now();while(!ready()&&Date.now()-start<30000)await sleep(100);if(!ready())throw new Error('MAGIの全機能が準備完了していないため審議を開始しません');}
const base=window.fetch.bind(window);
async function preflight(){const checks=['/api/drive/index'];for(const url of checks){let ok=false,last;for(let i=0;i<3&&!ok;i++){try{const r=await base(url,{cache:'no-store',credentials:'same-origin'});ok=r.ok;if(!ok)last=new Error('HTTP '+r.status)}catch(e){last=e}if(!ok)await sleep(500*(i+1))}if(!ok)throw new Error('DATA HUBの初回準備に失敗しました'+(last?.message?'：'+last.message:''));}}
let warmPromise=null;
window.MAGI_PRODUCTION_PREFLIGHT_V412=()=>warmPromise||(warmPromise=(async()=>{await warm();await preflight();return true})().catch(e=>{warmPromise=null;throw e}));
window.addEventListener('load',()=>{window.MAGI_PRODUCTION_PREFLIGHT_V412().catch(()=>{})},{once:true});

let installed=false;
function install(){
 const baseRunner=window.MAGI_FORMAL_UI_RUNNER_V2;
 if(typeof baseRunner!=='function')return false;
 if(baseRunner.__magiStableV417)return true;
 const wrapped=async function(args={}){
   await window.MAGI_PRODUCTION_PREFLIGHT_V412();
   // A late FINAL error cannot authorize restarting the three paid persona
   // generations. Leave the current failure and previous logs intact.
   // No silent cached decision may stand in for a failed live deliberation.
   const result=await baseRunner(args);
   if(!complete(result))throw new Error('審議結果が途中で欠落したため公開しません');
   if(hasLegacySecondFallback(result))throw new Error('旧式の暫定二次判定を検出しました。再実行は利用者の確認後に行ってください');
   return result;
 };
 wrapped.meta=Object.freeze({...baseRunner.meta,productionStability:'v418',sameInputReplay:false,wholeRunRetry:false,preflight:true});
 wrapped.__magiStableV417=true;
 window.MAGI_FORMAL_UI_RUNNER_V2=wrapped;
 window.MAGI_FORMAL_UI_RUNNER_V3=wrapped;
 window.MAGI_PRODUCTION_STABILITY_V417_READY=true;
 document.dispatchEvent(new CustomEvent('magi:production-stability-ready',{detail:{version:'v417'}}));
 return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>400)clearInterval(t)},50);install();
})();

