(()=>{
'use strict';
if(window.MAGI_CROSS_DIALOGUE_ROUTER_V380)return;
window.MAGI_CROSS_DIALOGUE_ROUTER_V380=true;

const nativeFetch=window.fetch.bind(window);
function requestUrl(input){try{return typeof input==='string'?input:(input&&input.url)||''}catch(_){return''}}
function debateKind(caseData){
  const kind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  if(['FULL_LINEUP','PITCHING_PLAN','PITCHING_ROLE','BATTING_ORDER'].includes(kind))return kind;
  const q=String(caseData?.question||'').normalize('NFKC');
  if(/(?:ベストオーダー|ベスト打順)/.test(q)||/(?:打順|オーダー|打線).{0,16}(?:どうする|どう組|組んで|組む|考えて|考える|決めて|決める|作って|作る)/.test(q)||/1番.{0,40}9番|一番.{0,40}九番/.test(q))return'FULL_LINEUP';
  if(/(?:投手|ピッチャー).{0,16}(?:継投|運用|プラン)|先発.{0,30}(?:第2投手|クローザー|抑え)/.test(q))return'PITCHING_PLAN';
  if(/(?:クローザー|抑え).{0,20}(?:誰|だれ|候補|選ぶ|選んで|決めて|いい)/.test(q))return'PITCHING_ROLE';
  if(/[1-9１-９一二三四五六七八九]番(?:打者)?.{0,20}(?:誰|だれ|候補|選ぶ|選んで|決めて|いい)/.test(q))return'BATTING_ORDER';
  return'';
}
function supportedDebate(caseData){return!!debateKind(caseData)}
function payloadFrom(init){
  try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch(_){return null}
}
window.fetch=async function(input,init={}){
  const url=requestUrl(input);
  if(/\/api\/magi\/orchestrate(?:\?|$)/.test(url)){
    const payload=payloadFrom(init);
    if(payload?.phase==='CROSS_EXAMINATION'&&supportedDebate(payload?.case)){
      try{
        const direct=await nativeFetch('/api/magi/dialogue',init);
        if(direct?.ok)return direct;
        if(Number(direct?.status)<500)return direct;
      }catch(_){ }
      return nativeFetch(input,init);
    }
  }
  return nativeFetch(input,init);
};
window.MAGI_CROSS_DIALOGUE_ROUTER_META=Object.freeze({version:'cross-dialogue-router-v430',supportedKinds:['FULL_LINEUP','BATTING_ORDER','PITCHING_ROLE','PITCHING_PLAN'],safeFallback:true});
})();
