(()=>{
'use strict';
if(window.MAGI_DRIVE_INDEX_RESILIENCE_V303)return;
window.MAGI_DRIVE_INDEX_RESILIENCE_V303=true;

const nativeFetch=window.fetch.bind(window);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const RETRY_DELAYS=[350,900];
const RETRY_STATUS=new Set([502,503,504]);

function requestUrl(input){
  try{return typeof input==='string'?input:(input&&input.url)||''}catch(_){return''}
}
function retryableNetworkError(error){
  if(!error||error.name==='AbortError')return false;
  const message=String(error?.message||error);
  return error instanceof TypeError||/(?:Load failed|Failed to fetch|NetworkError|network request|network connection|fetch failed)/i.test(message);
}
async function oneIndexAttempt(input,init={}){
  const next={...init};
  delete next.signal;
  const controller=new AbortController();
  next.signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(),30000);
  try{return await nativeFetch(input,next)}finally{clearTimeout(timer)}
}

window.fetch=async function(input,init={}){
  const url=requestUrl(input);
  if(!/\/api\/drive\/index(?:\?|$)/.test(url))return nativeFetch(input,init);

  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await oneIndexAttempt(input,init);
      if(RETRY_STATUS.has(Number(response?.status))&&attempt<2){
        await sleep(RETRY_DELAYS[attempt]||900);
        continue;
      }
      return response;
    }catch(error){
      lastError=error;
      if(!retryableNetworkError(error)||attempt>=2)throw error;
      await sleep(RETRY_DELAYS[attempt]||900);
    }
  }
  throw lastError||new Error('Drive index failed');
};

window.MAGI_DRIVE_INDEX_RESILIENCE_META=Object.freeze({
  version:'drive-index-resilience-v303',
  attempts:3,
  retryStatus:[502,503,504],
  networkRetry:true
});
})();
