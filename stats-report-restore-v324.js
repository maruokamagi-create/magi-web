(()=>{
'use strict';
if(window.MAGI_STATS_REPORT_RESTORE_V324)return;
window.MAGI_STATS_REPORT_RESTORE_V324=true;

function isBattingReportQuery(q){
 q=String(q||'').trim();
 const pitch=/投手|ピッチャー|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ|投球回|投球数|勝敗|勝利|敗北/i.test(q);
 if(pitch)return false;
 const batting=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
 const report=/通算|打撃成績|成績一覧|一覧|直近|最近|年度成績|全年度|シーズン/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return batting&&report&&!decision;
}
function mainButton(node){return node?.closest?.('button[onclick*="runMagi"]')||null}
function waitForStatsBridge(ms=5000){
 return new Promise(resolve=>{
  const started=Date.now();
  const tick=()=>{
   const fn=window.runMagi;
   if(typeof fn==='function'&&window.MAGI_STATS_REPORT_FN&&window.MAGI_STATS_SERVER_BRIDGE_INSTALLED){resolve(fn);return;}
   if(Date.now()-started>=ms){resolve(typeof fn==='function'&&window.MAGI_STATS_REPORT_FN?fn:null);return;}
   setTimeout(tick,40);
  };
  tick();
 });
}
let busy=false;
window.addEventListener('click',async event=>{
 const btn=mainButton(event.target);if(!btn)return;
 const query=(document.getElementById('q')?.value||'').trim();
 if(!isBattingReportQuery(query))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 if(busy)return;busy=true;
 const oldText=btn.textContent,status=document.getElementById('status');
 btn.disabled=true;btn.textContent='打撃成績を集計中…';
 if(status)status.textContent='打撃成績照会：旧・現チームの正本データを集計しています…';
 try{
  const fn=await waitForStatsBridge();
  if(!fn){if(status)status.textContent='打撃成績一覧を準備できませんでした。もう一度実行してください。';return;}
  await fn.call(window);
 }catch(e){
  console.warn('[MAGI batting report restore v324]',e?.message||e);
  if(status)status.textContent='打撃成績一覧の表示でエラーが発生しました。もう一度実行してください。';
 }finally{
  btn.disabled=false;if(btn.textContent==='打撃成績を集計中…')btn.textContent=oldText||'MAGI実行';busy=false;
 }
},true);
})();
