(()=>{
'use strict';
if(window.MAGI_CORE_CLIENT_GUARD_V361)return;
window.MAGI_CORE_CLIENT_GUARD_V361=true;
const nativeFetch=window.fetch.bind(window);
const RUNTIME_VERSION='361';
window.fetch=function(input,init){
  try{
    const raw=typeof input==='string'?input:input?.url;
    const url=new URL(String(raw||''),location.href);
    if(url.pathname==='/api/magi/core'){
      const next={...(init||{})};
      const headers=new Headers(next.headers||(typeof input!=='string'&&input?.headers)||undefined);
      headers.set('X-MAGI-Runtime-Version',RUNTIME_VERSION);
      next.headers=headers;
      return nativeFetch(input,next);
    }
  }catch(_){ }
  return nativeFetch(input,init);
};
window.MAGI_RUNTIME_CLIENT_VERSION=RUNTIME_VERSION;
window.MAGI_CORE_CLIENT_GUARD_V361_META=Object.freeze({version:'core-client-guard-v361',runtimeVersion:361,coreOnly:true});
})();