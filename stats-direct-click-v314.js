(()=>{
'use strict';
if(window.MAGI_STATS_DIRECT_CLICK_V314)return;
window.MAGI_STATS_DIRECT_CLICK_V314=true;

function isLookup(q){
 q=String(q||'');
 const pitch=/投手|ピッチャー|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ|投球回|投球数|勝敗|勝利|敗北/i.test(q);
 if(pitch)return false;
 const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
 const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return stat&&request&&!decision;
}

function waitForStatsBridge(){
 return new Promise(resolve=>{
  let tries=0;
  const tick=()=>{
   const fn=window.runMagi;
   if(typeof fn==='function'&&fn.__magiStatsServerBridgeV313){resolve(fn);return;}
   if(++tries>=60){resolve(null);return;}
   setTimeout(tick,25);
  };
  tick();
 });
}

let busy=false;
document.addEventListener('click',async event=>{
 const btn=event.target?.closest?.('button[onclick*="runMagi"]');
 if(!btn)return;
 const query=(document.getElementById('q')?.value||'').trim();
 if(!isLookup(query))return;

 // 打撃成績照会だけは通常の3賢人 onclick に到達させない。投手照会は投手専用ルートへ渡す。
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 if(busy)return;
 busy=true;

 const oldText=btn.textContent;
 const status=document.getElementById('status');
 btn.disabled=true;
 btn.textContent='成績照会中…';
 if(status)status.textContent='成績照会：全選手共通データを確認しています…';
 try{
  const bridge=await waitForStatsBridge();
  if(!bridge){
   if(status)status.textContent='成績照会処理を準備できませんでした。もう一度実行してください。';
   return;
  }
  await bridge.call(window);
 }catch(e){
  console.warn('[MAGI stats direct click v314]',e?.message||e);
  if(status)status.textContent='成績照会でエラーが発生しました。もう一度実行してください。';
 }finally{
  btn.disabled=false;
  if(btn.textContent==='成績照会中…')btn.textContent=oldText||'MAGI実行';
  busy=false;
 }
},true);
})();
