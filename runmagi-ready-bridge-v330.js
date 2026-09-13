(()=>{
'use strict';
if(window.MAGI_RUNMAGI_READY_BRIDGE_V330)return;
window.MAGI_RUNMAGI_READY_BRIDGE_V330=true;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function officialEngineReady(){
  return Boolean(
    window.MAGI_ENGINE_V1 &&
    document.getElementById('magi-engine-ui-v187-style')
  );
}
async function bridge(){
  const self=bridge;
  const started=Date.now();
  while(Date.now()-started<30000){
    const current=window.runMagi;
    if(officialEngineReady()&&typeof current==='function'&&current!==self){
      return current.apply(this,arguments);
    }
    await sleep(80);
  }
  throw new Error('正式MAGI審議エンジンの初期化が完了しませんでした');
}

if(typeof window.runMagi!=='function')window.runMagi=bridge;
window.MAGI_RUNMAGI_READY_BRIDGE_FN=bridge;
})();
