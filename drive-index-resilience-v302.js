(()=>{
'use strict';
if(window.MAGI_DRIVE_INDEX_RESILIENCE_V302)return;
window.MAGI_DRIVE_INDEX_RESILIENCE_V302=true;

const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init={}){
  let url='';
  try{url=typeof input==='string'?input:(input&&input.url)||''}catch(_){}
  if(!/\/api\/drive\/index(?:\?|$)/.test(url))return nativeFetch(input,init);

  const next={...init};
  delete next.signal;
  const controller=new AbortController();
  next.signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(),30000);
  return nativeFetch(input,next).finally(()=>clearTimeout(timer));
};
})();
