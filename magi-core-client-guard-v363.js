(()=>{
'use strict';
if(window.MAGI_CORE_CLIENT_GUARD_V363)return;
window.MAGI_CORE_CLIENT_GUARD_V363=true;
const nativeFetch=window.fetch.bind(window);
const VERSION='363';
window.fetch=function(input,init){
  try{
    const raw=typeof input==='string'?input:input?.url;
    const url=new URL(String(raw||''),location.href);
    if(url.pathname==='/api/magi/core'){
      const next={...(init||{})};
      const headers=new Headers(next.headers||(typeof input!=='string'&&input?.headers)||undefined);
      headers.set('X-MAGI-Client-Version',VERSION);
      headers.set('X-MAGI-Runtime-Version',VERSION);
      next.headers=headers;
      return nativeFetch(input,next);
    }
  }catch(_){ }
  return nativeFetch(input,init);
};
window.MAGI_EFFECTIVE_CLIENT_VERSION=VERSION;
window.MAGI_EFFECTIVE_RUNTIME_VERSION=VERSION;
window.MAGI_CORE_CLIENT_GUARD_V363_META=Object.freeze({version:'core-client-guard-v363',clientVersion:363,runtimeVersion:363,coreOnly:true,overridesLegacyHeaders:true});
})();
