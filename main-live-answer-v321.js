(()=>{
'use strict';
if(window.MAGI_MAIN_LIVE_ANSWER_V321)return;
window.MAGI_MAIN_LIVE_ANSWER_V321=true;
window.MAGI_MAIN_LIVE_ANSWER_V320=true;
window.MAGI_MAIN_LIVE_ANSWER_V318=true;

const DIRECT_ROUTES=new Set(['BATTING_LOOKUP','PITCHING_LOOKUP','PLAYER_OVERVIEW','TEAM_LOOKUP','CLARIFY']);
let busy=false;
const $=id=>document.getElementById(id);
const txt=v=>String(v??'').trim();

function mainButton(node){return node?.closest?.('button[onclick*="runMagi"]')||null}
function ensurePanel(){
 let p=$('magiLiveAnswerV321');
 if(p)return p;
 const judge=$('judge');
 const card=judge?.querySelector?.('.card');
 if(!judge||!card)return null;
 p=document.createElement('div');
 p.id='magiLiveAnswerV321';
 p.style.cssText='display:none;margin-top:12px;padding:16px;border:1px solid #2f5578;border-left:5px solid #37b579;border-radius:16px;background:rgba(10,27,46,.98);color:#f7f9fc;box-shadow:0 12px 30px rgba(0,0,0,.18)';
 p.innerHTML='<div style="font-size:11px;letter-spacing:.14em;color:#8db0d1;margin-bottom:8px">MAGI VERIFIED LIVE ANSWER</div><div id="magiLiveAnswerTextV321" style="font-size:17px;font-weight:850;line-height:1.65"></div><div id="magiLiveAnswerMetaV321" style="margin-top:10px;font-size:11px;line-height:1.65;color:#a9bdd0"></div>';
 card.insertAdjacentElement('afterend',p);
 return p;
}
function hidePanel(){const p=$('magiLiveAnswerV321');if(p)p.style.display='none'}
function showPanel(result,totalMs){
 const p=ensurePanel();if(!p)return false;
 const answer=$('magiLiveAnswerTextV321'),meta=$('magiLiveAnswerMetaV321');
 if(answer)answer.textContent=txt(result?.answer)||'回答を取得できませんでした。';
 const bits=[];
 const sourceName=txt(result?.source?.name),parser=txt(result?.source?.parser||result?.parser),engine=txt(result?.answerEngineVersion),route=txt(result?.integratedRoute||result?.route);
 if(sourceName)bits.push(`参照：${sourceName}`);
 if(route)bits.push(`処理：${route}`);
 if(parser)bits.push(`読取：${parser}`);
 if(engine)bits.push(`回答：${engine}`);
 if(result?.fastPath)bits.push('高速経路');
 if(Number.isFinite(totalMs))bits.push(`応答：${(totalMs/1000).toFixed(1)}秒`);
 if(meta)meta.textContent=bits.join(' ｜ ');
 const old=$('response');if(old)old.classList.remove('show');
 if($('routeValue'))$('routeValue').textContent=route||'LIVE ANSWER';
 if($('routeBadge'))$('routeBadge').textContent=result?.fastPath?'FAST LIVE':'LIVE';
 if($('routeHelp'))$('routeHelp').textContent=result?.fastPath?'選手と指標が一意に確定したため、AIルーターを省略して検証済みデータへ直接接続しました。':'質問理解 → 検証済みデータ経路 → 回答までを本番ボタンから実行しました。';
 if($('status'))$('status').textContent='MAGI 検証済みライブ回答 完了';
 p.style.display='block';p.scrollIntoView({behavior:'smooth',block:'center'});return true;
}

async function requestJson(url,payload){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),35000);
 try{
  const r=await fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:c.signal});
  let d=null;try{d=await r.json()}catch(_){d=null}
  if(r.ok)return d||{};
  const e=new Error(txt(d?.error)||`${url} ${r.status}`);e.status=r.status;throw e;
 }finally{clearTimeout(t)}
}

async function postLive(question){
 // Obvious one-player stat lookups use a deterministic route first. This avoids a Gemini round-trip.
 try{
  const fast=await requestJson('/api/magi/fast-live',{question});
  if(fast?.handled)return fast;
 }catch(e){
  if(e?.status===401||e?.status===403)throw e;
  console.warn('[MAGI fast live fallback]',e?.message||e);
 }

 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   return await requestJson('/api/magi/health',{mode:'LIVE_QUESTION_ANSWER',question,context:[]});
  }catch(e){
   last=e;
   if(e?.status===401||e?.status===403)throw e;
   if(attempt<2)await new Promise(r=>setTimeout(r,700*(attempt+1)));
  }
 }
 throw last||new Error('LIVE_QUESTION_ANSWER failed');
}
function shouldDisplay(r){return r?.integratedRoute==='VERIFIED_OLD_DETAIL'||DIRECT_ROUTES.has(txt(r?.route))}
function callLegacy(){
 const fn=window.runMagi;
 if(typeof fn==='function'&&!fn.__magiMainLiveCaptureV321)return fn.call(window);
 return undefined;
}
async function execute(btn){
 const q=txt($('q')?.value);if(!q){if($('status'))$('status').textContent='相談内容を入力してください。';return}
 if(busy)return;busy=true;
 const started=performance.now();
 const oldText=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='確認中…'}
 if($('status'))$('status').textContent='質問を理解し、検証済みデータを確認しています…';hidePanel();
 try{
  const r=await postLive(q);
  if(shouldDisplay(r)){showPanel(r,performance.now()-started);return}
  if($('status'))$('status').textContent='この質問は従来のMAGI審議へ引き継ぎます…';
  return callLegacy();
 }catch(e){
  console.warn('[MAGI main live answer v321]',e?.message||e);
  if(e?.status===401){if($('status'))$('status').textContent='LINEログインを確認してください。';return}
  if(e?.status===403){if($('status'))$('status').textContent='利用承認を確認してください。';return}
  if($('status'))$('status').textContent='ライブ回答を取得できなかったため、従来処理へ切り替えます。';
  return callLegacy();
 }finally{if(btn){btn.disabled=false;if(btn.textContent==='確認中…')btn.textContent=oldText||'MAGI実行'}busy=false}
}

document.addEventListener('click',event=>{
 const btn=mainButton(event.target);if(!btn)return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 execute(btn);
},true);

const observer=new MutationObserver(()=>{if($('judge'))ensurePanel()});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensurePanel,{once:true});else ensurePanel();
})();
