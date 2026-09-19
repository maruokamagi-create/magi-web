(()=>{
'use strict';
if(window.MAGI_PRODUCTION_STABILITY_V412)return;
window.MAGI_PRODUCTION_STABILITY_V412=true;
const txt=v=>String(v??'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stable=v=>{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{if(!['id','createdAt'].includes(k))o[k]=stable(v[k])});return o}return v};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function key(question,evidence,kind){return 'magi:stable:v412:'+hash(JSON.stringify(stable({question:txt(question).normalize('NFKC'),evidence,kind:txt(kind).toUpperCase()})))}
function get(k){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v?.result||null}catch(_){return null}}
function put(k,result){try{localStorage.setItem(k,JSON.stringify({savedAt:Date.now(),result}))}catch(_){}}
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
 if(typeof baseRunner!=='function'||baseRunner.__magiStableV412)return false;
 const wrapped=async function(args={}){
   await window.MAGI_PRODUCTION_PREFLIGHT_V412();
   const k=key(args.question,args.evidence,args.selectionKind);
   const cached=get(k);
   if(cached){
     window.MAGI_LAST_DELIBERATION_RESULT=JSON.parse(JSON.stringify(cached));
     document.dispatchEvent(new CustomEvent('magi:deliberation-result',{detail:JSON.parse(JSON.stringify(cached))}));
     return cached;
   }
   let last;
   for(let attempt=1;attempt<=2;attempt++){
     try{
       const result=await baseRunner(args);
       if(!result?.primary||!result?.crossExamination||!result?.second||!result?.final)throw new Error('審議結果が途中で欠落したため公開しません');
       put(k,result);
       return result;
     }catch(e){last=e;if(attempt<2){window.MAGI_PROGRESS_V358?.update?.(20,'初回通信を再準備して審議を最初から再実行します','RECOVERY');await sleep(1200);}}
   }
   throw last||new Error('MAGI審議を完了できませんでした');
 };
 wrapped.meta=Object.freeze({...baseRunner.meta,productionStability:'v412',sameInputReplay:true,wholeRunRetry:true,preflight:true});
 wrapped.__magiStableV412=true;
 window.MAGI_FORMAL_UI_RUNNER_V2=wrapped;
 window.MAGI_FORMAL_UI_RUNNER_V3=wrapped;
 return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>400)clearInterval(t)},50);install();
})();