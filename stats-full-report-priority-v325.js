(()=>{
'use strict';
if(window.MAGI_STATS_FULL_REPORT_PRIORITY_V325)return;
window.MAGI_STATS_FULL_REPORT_PRIORITY_V325=true;

const qEl=()=>document.getElementById('q');
const norm=s=>String(s||'').trim();
const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸|適性|継投|先発させ|先発に|クローザー|抑え|ローテ|戦術|采配|任せる|推薦|提案/i;
const pitch=/投手|ピッチャー|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ|投球回|投球数|勝敗|勝利|敗北/i;
const batting=/打撃|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振|犠打|犠飛/i;
const fullReport=/打撃成績|投手成績|成績一覧|一覧|通算|今期|今季|今シーズン|今年|年度|シーズン|直近|最近|レポート/i;

function kind(query){
 const q=norm(query);if(!q||decision.test(q))return'';
 if(pitch.test(q)&&fullReport.test(q))return'pitch';
 if(!pitch.test(q)&&(batting.test(q)&&fullReport.test(q) || /通算成績|成績一覧/.test(q)))return'bat';
 return'';
}
function mainButton(node){
 const b=node?.closest?.('button');if(!b)return null;
 const onclick=String(b.getAttribute?.('onclick')||'');
 if(/runMagi/.test(onclick))return b;
 const t=String(b.textContent||'').trim();
 return /MAGI実行/.test(t)?b:null;
}
function normalizeForLegacy(query,k){
 if(k!=='bat')return query;
 if(/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(query))return query;
 return `${query} 一覧`;
}
let busy=false;
async function runFull(event,btn){
 const input=qEl(),original=norm(input?.value),k=kind(original);if(!k||busy)return false;
 event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();
 busy=true;
 const status=document.getElementById('status'),oldText=btn?.textContent;
 try{
  if(input)input.value=normalizeForLegacy(original,k);
  if(btn){btn.disabled=true;btn.textContent=k==='pitch'?'投手成績を集計中…':'打撃成績を集計中…';}
  if(status)status.textContent=k==='pitch'?'投手成績照会：通算・年度別・相手校別を集計しています…':'打撃成績照会：通算・打順別・相手校別を集計しています…';
  const fn=window.runMagi;
  if(typeof fn!=='function')throw new Error('runMagi unavailable');
  await fn.call(window);
 }catch(e){
  console.warn('[MAGI stats full report priority v325]',e?.message||e);
  if(status)status.textContent='成績一覧を表示できませんでした。もう一度実行してください。';
 }finally{
  if(input)input.value=original;
  if(btn){btn.disabled=false;if(/集計中/.test(btn.textContent||''))btn.textContent=oldText||'MAGI実行';}
  busy=false;
 }
 return true;
}

window.addEventListener('click',e=>{const b=mainButton(e.target);if(b)runFull(e,b)},true);
window.addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.isComposing)return;
 const input=qEl();if(!input||e.target!==input||!kind(input.value))return;
 const b=[...document.querySelectorAll('button')].find(x=>/MAGI実行/.test(String(x.textContent||'')))||null;
 runFull(e,b);
},true);
})();
