(()=>{
'use strict';
if(window.MAGI_MAIN_LIVE_ANSWER_V323)return;
window.MAGI_MAIN_LIVE_ANSWER_V323=true;
window.MAGI_MAIN_LIVE_ANSWER_V322=true;
window.MAGI_MAIN_LIVE_ANSWER_V321=true;
window.MAGI_MAIN_LIVE_ANSWER_V320=true;
window.MAGI_MAIN_LIVE_ANSWER_V318=true;

const DIRECT_ROUTES=new Set(['BATTING_LOOKUP','PITCHING_LOOKUP','PLAYER_OVERVIEW','TEAM_LOOKUP','DOCUMENT_SEARCH','GENERAL_QUESTION','CLARIFY']);
let busy=false;
const $=id=>document.getElementById(id);
const txt=v=>String(v??'').trim();
function mainButton(node){return node?.closest?.('button[onclick*="runMagi"]')||null}

function ensurePanel(){
 let p=$('magiLiveAnswerV323');if(p)return p;
 const judge=$('judge'),card=judge?.querySelector?.('.card');if(!judge||!card)return null;
 p=document.createElement('div');p.id='magiLiveAnswerV323';
 p.style.cssText='display:none;margin-top:12px;padding:16px;border:1px solid #2f5578;border-left:5px solid #37b579;border-radius:16px;background:rgba(10,27,46,.98);color:#f7f9fc;box-shadow:0 12px 30px rgba(0,0,0,.18)';
 p.innerHTML='<div style="font-size:11px;letter-spacing:.14em;color:#8db0d1;margin-bottom:8px">MAGI VERIFIED ANSWER</div><div id="magiLiveAnswerTextV323" style="font-size:17px;font-weight:850;line-height:1.65"></div><div id="magiLiveAnswerMetaV323" style="margin-top:10px;font-size:11px;line-height:1.65;color:#a9bdd0"></div>';
 card.insertAdjacentElement('afterend',p);return p;
}
function hidePanel(){const p=$('magiLiveAnswerV323');if(p)p.style.display='none'}
function showPanel(result,totalMs){
 const p=ensurePanel();if(!p)return false;
 const answer=$('magiLiveAnswerTextV323'),meta=$('magiLiveAnswerMetaV323');
 if(answer)answer.textContent=txt(result?.answer||result?.clarificationQuestion)||'回答を取得できませんでした。';
 const bits=[],sourceName=txt(result?.source?.name),parser=txt(result?.source?.parser||result?.parser),engine=txt(result?.answerEngineVersion),route=txt(result?.integratedRoute||result?.route);
 if(sourceName)bits.push(`参照：${sourceName}`);if(route)bits.push(`処理：${route}`);if(parser)bits.push(`読取：${parser}`);if(engine)bits.push(`回答：${engine}`);
 if(result?.fastPath)bits.push('高速経路');if(result?.cacheHit)bits.push('解析済みキャッシュ');if(result?.coreVersion)bits.push('CORE');if(Number.isFinite(totalMs))bits.push(`応答：${(totalMs/1000).toFixed(1)}秒`);
 if(meta)meta.textContent=bits.join(' ｜ ');
 const old=$('response');if(old)old.classList.remove('show');
 if($('routeValue'))$('routeValue').textContent=route||'LIVE ANSWER';if($('routeBadge'))$('routeBadge').textContent=result?.fastPath?'FAST LIVE':'LIVE';
 if($('routeHelp'))$('routeHelp').textContent='質問の意味を理解し、必要な根拠を確認して回答しました。';if($('status'))$('status').textContent='MAGI 回答完了';
 p.style.display='block';p.scrollIntoView({behavior:'smooth',block:'center'});return true;
}

async function requestJson(url,payload){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),40000);
 try{
  const r=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:c.signal});
  let d=null;try{d=await r.json()}catch(_){d=null}
  if(r.ok)return d||{};const e=new Error(txt(d?.error)||`${url} ${r.status}`);e.status=r.status;throw e;
 }finally{clearTimeout(t)}
}
async function requestWithRetry(url,payload){
 let last;for(let attempt=0;attempt<3;attempt++){
  try{return await requestJson(url,payload)}catch(e){last=e;if(e?.status===401||e?.status===403)throw e;if(attempt<2)await new Promise(r=>setTimeout(r,700*(attempt+1)))}
 }throw last||new Error('request failed');
}
async function postCore(question){
 const core=await requestWithRetry('/api/magi/core',{question,context:[]});
 if(core?.handled!==false)return core;
 return requestWithRetry('/api/magi/health',{mode:'LIVE_QUESTION_ANSWER',question,context:[]});
}
function shouldDisplay(r){return r?.integratedRoute==='VERIFIED_OLD_DETAIL'||DIRECT_ROUTES.has(txt(r?.route))}
function formalRun(){const fn=window.runMagi;return typeof fn==='function'?fn:null}
function callLegacy(){const fn=formalRun();return fn?fn.call(window):undefined}

async function deliberateWithResolvedEvidence(result){
 const fn=formalRun();if(!fn)throw new Error('正式MAGI審議エンジンを呼び出せません');
 const packet=result?.evidencePacket||null;
 const oldSearch=window.searchDataEvidence,oldRoute=window.routeQuestion;
 if(packet?.text){
  window.searchDataEvidence=()=>packet;
 }
 window.routeQuestion=()=>({
  type:packet?.text?'data':'judge',
  label:'質問理解 → 証拠取得 → 3賢人審議',
  help:packet?.text?'MAGIが質問から必要資料を特定し、その内容を審議材料として渡します。':'質問内容を3賢人の正式審議へ渡します。'
 });
 if($('routeValue'))$('routeValue').textContent='DELIBERATION';if($('routeBadge'))$('routeBadge').textContent='MAGI';
 if($('routeHelp'))$('routeHelp').textContent=packet?.text?'必要な資料をMAGIが自動取得し、その内容を根拠に3賢人が審議します。':'質問内容を3賢人が正式審議します。';
 if($('status'))$('status').textContent=packet?.text?`資料「${packet.files?.[0]||''}」を取得。3賢人審議を開始します…`:'3賢人審議を開始します…';
 try{return await fn.call(window)}finally{
  if(oldSearch)window.searchDataEvidence=oldSearch;else try{delete window.searchDataEvidence}catch(_){}
  if(oldRoute)window.routeQuestion=oldRoute;else try{delete window.routeQuestion}catch(_){}
 }
}

async function execute(btn){
 const q=txt($('q')?.value);if(!q){if($('status'))$('status').textContent='相談内容を入力してください。';return}
 if(busy)return;busy=true;const started=performance.now(),oldText=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='確認中…'}hidePanel();
 if($('status'))$('status').textContent='質問の意味を理解し、必要な情報を確認しています…';
 try{
  const r=await postCore(q);
  if(r?.action==='DELIBERATE'||r?.route==='DELIBERATION')return await deliberateWithResolvedEvidence(r);
  if(shouldDisplay(r)){showPanel(r,performance.now()-started);return}
  if($('status'))$('status').textContent='既存のMAGI処理へ引き継ぎます…';return await callLegacy();
 }catch(e){
  console.warn('[MAGI main core v323]',e?.message||e);
  if(e?.status===401){if($('status'))$('status').textContent='LINEログインを確認してください。';return}
  if(e?.status===403){if($('status'))$('status').textContent='利用承認を確認してください。';return}
  if($('status'))$('status').textContent='CORE処理を完了できなかったため、既存処理へ切り替えます。';return await callLegacy();
 }finally{if(btn){btn.disabled=false;if(btn.textContent==='確認中…')btn.textContent=oldText||'MAGI実行'}busy=false}
}

document.addEventListener('click',event=>{
 const btn=mainButton(event.target);if(!btn)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();execute(btn);
},true);
const observer=new MutationObserver(()=>{if($('judge'))ensurePanel()});observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePanel,{once:true});else ensurePanel();
})();
