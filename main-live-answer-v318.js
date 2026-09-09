(()=>{
'use strict';
if(window.MAGI_MAIN_LIVE_ANSWER_V318)return;
window.MAGI_MAIN_LIVE_ANSWER_V318=true;

const DIRECT_ROUTES=new Set(['BATTING_LOOKUP','PITCHING_LOOKUP','PLAYER_OVERVIEW','TEAM_LOOKUP','CLARIFY']);
let busy=false;
let installedOriginal=null;

const $=id=>document.getElementById(id);
const txt=v=>String(v??'').trim();

function ensurePanel(){
 let panel=$('magiLiveAnswerV318');
 if(panel)return panel;
 const judge=$('judge');
 const card=judge?.querySelector?.('.card');
 if(!judge||!card)return null;
 panel=document.createElement('div');
 panel.id='magiLiveAnswerV318';
 panel.style.cssText='display:none;margin-top:12px;padding:16px;border:1px solid #2f5578;border-left:5px solid #37b579;border-radius:16px;background:rgba(10,27,46,.98);color:#f7f9fc;box-shadow:0 12px 30px rgba(0,0,0,.18)';
 panel.innerHTML='<div style="font-size:11px;letter-spacing:.14em;color:#8db0d1;margin-bottom:8px">MAGI VERIFIED LIVE ANSWER</div><div id="magiLiveAnswerTextV318" style="font-size:17px;font-weight:850;line-height:1.65"></div><div id="magiLiveAnswerMetaV318" style="margin-top:10px;font-size:11px;line-height:1.65;color:#a9bdd0"></div>';
 card.insertAdjacentElement('afterend',panel);
 return panel;
}

function hidePanel(){
 const p=$('magiLiveAnswerV318');
 if(p)p.style.display='none';
}

function showPanel(result,question){
 const panel=ensurePanel();
 if(!panel)return false;
 const answer=$('magiLiveAnswerTextV318');
 const meta=$('magiLiveAnswerMetaV318');
 if(answer)answer.textContent=txt(result?.answer)||'回答を取得できませんでした。';
 const sourceName=txt(result?.source?.name);
 const parser=txt(result?.source?.parser||result?.parser);
 const engine=txt(result?.answerEngineVersion);
 const route=txt(result?.integratedRoute||result?.route);
 const bits=[];
 if(sourceName)bits.push(`参照：${sourceName}`);
 if(route)bits.push(`処理：${route}`);
 if(parser)bits.push(`読取：${parser}`);
 if(engine)bits.push(`回答：${engine}`);
 if(meta)meta.textContent=bits.join(' ｜ ');
 const oldResponse=$('response');
 if(oldResponse)oldResponse.classList.remove('show');
 const routeValue=$('routeValue');
 if(routeValue)routeValue.textContent=route||'LIVE ANSWER';
 const routeBadge=$('routeBadge');
 if(routeBadge)routeBadge.textContent='LIVE';
 const routeHelp=$('routeHelp');
 if(routeHelp)routeHelp.textContent='質問理解 → 検証済みデータ経路 → 回答までを本番ボタンから実行しました。';
 const status=$('status');
 if(status)status.textContent='MAGI 検証済みライブ回答 完了';
 panel.style.display='block';
 panel.scrollIntoView({behavior:'smooth',block:'center'});
 try{
  window.dispatchEvent(new CustomEvent('magi:live-answer',{detail:{question,result}}));
 }catch(_){ }
 return true;
}

async function postLive(question){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch('/api/magi/health',{
   method:'POST',
   credentials:'same-origin',
   cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({mode:'LIVE_QUESTION_ANSWER',question,context:[]}),
   signal:controller.signal
  });
  let data=null;
  try{data=await response.json()}catch(_){data=null}
  if(!response.ok){
   const err=new Error(txt(data?.error)||`LIVE_QUESTION_ANSWER ${response.status}`);
   err.status=response.status;
   throw err;
  }
  return data||{};
 }finally{clearTimeout(timer)}
}

function shouldDisplay(result){
 if(result?.integratedRoute==='VERIFIED_OLD_DETAIL')return true;
 if(DIRECT_ROUTES.has(txt(result?.route)))return true;
 return false;
}

async function liveRun(original){
 const q=txt($('q')?.value);
 if(!q)return original.apply(window,arguments);
 if(busy)return;
 busy=true;
 const status=$('status');
 if(status)status.textContent='質問を理解し、検証済みデータを確認しています…';
 hidePanel();
 try{
  const result=await postLive(q);
  if(shouldDisplay(result)){
   showPanel(result,q);
   return result;
  }
  // 判断・資料検索・高度相談など、まだライブ回答に正式接続していない経路は既存処理へ戻す。
  if(status)status.textContent='この質問は従来のMAGI処理へ引き継ぎます…';
  return await original.call(window);
 }catch(error){
  console.warn('[MAGI main live answer v318]',error?.message||error);
  // 通信・一時障害で既存機能まで止めない。401/403は認証画面側の案内を優先する。
  if(error?.status===401||error?.status===403){
   if(status)status.textContent=error.status===401?'LINEログインを確認してください。':'利用承認を確認してください。';
   return;
  }
  if(status)status.textContent='ライブ回答を取得できなかったため、従来処理へ切り替えます。';
  return await original.call(window);
 }finally{
  busy=false;
 }
}

function install(){
 const fn=window.runMagi;
 if(typeof fn!=='function')return false;
 if(fn.__magiMainLiveAnswerV318)return true;
 installedOriginal=fn;
 const wrapped=function(){return liveRun(installedOriginal)};
 wrapped.__magiMainLiveAnswerV318=true;
 wrapped.__magiMainLiveOriginal=fn;
 window.runMagi=wrapped;
 return true;
}

let tries=0;
const timer=setInterval(()=>{
 tries++;
 install();
 if(tries>=160)clearInterval(timer);
},125);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensurePanel();install()},{once:true});
else{ensurePanel();install()}
})();
