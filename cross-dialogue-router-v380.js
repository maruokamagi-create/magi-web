(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_ROUTER_V380)return;
window.MAGI_CROSS_DIALOGUE_ROUTER_V380=true;

const nativeFetch=window.fetch.bind(window);
function requestUrl(input){try{return typeof input==='string'?input:(input&&input.url)||''}catch(_){return''}}
function fullLineup(caseData){
  const q=String(caseData?.question||'').normalize('NFKC');
  if(/(?:ベストオーダー|ベスト打順)/.test(q))return true;
  if(/(?:打順|オーダー|打線).{0,16}(?:どうする|どう組|組んで|組む|考えて|考える|決めて|決める|作って|作る)/.test(q))return true;
  if(/(?:組んで|組む|作って|作る|考えて|考える).{0,12}(?:打順|オーダー|打線)/.test(q))return true;
  return /1番.{0,40}9番|一番.{0,40}九番/.test(q);
}
function payloadFrom(init){
  try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch(_){return null}
}
window.fetch=function(input,init={}){
  const url=requestUrl(input);
  if(/\/api\/magi\/orchestrate(?:\?|$)/.test(url)){
    const payload=payloadFrom(init);
    if(payload?.phase==='CROSS_EXAMINATION'&&fullLineup(payload?.case)){
      return nativeFetch('/api/magi/dialogue',init);
    }
  }
  return nativeFetch(input,init);
};
window.MAGI_CROSS_DIALOGUE_ROUTER_META=Object.freeze({version:'cross-dialogue-router-v380',fullLineupOnly:true});
})();
