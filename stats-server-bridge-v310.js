(()=>{
'use strict';
if(window.MAGI_STATS_SERVER_BRIDGE_V310)return;
window.MAGI_STATS_SERVER_BRIDGE_V310=true;

const isLookup=q=>{
  q=String(q||'');
  const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
  const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
  const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
  return stat&&request&&!decision;
};

async function hydrateServerStats(query){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(`/api/stats/player?q=${encodeURIComponent(query)}`,{
      cache:'no-store',credentials:'same-origin',signal:controller.signal
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data?.ok||!Array.isArray(data.records)||!data.records.length)return false;
    try{
      dataRecords=dataRecords.filter(x=>!x?.__magiServerStatsV310);
      for(const rec of data.records){
        const columns=Array.isArray(rec.columns)?rec.columns.map(v=>String(v??'')):[];
        const values=Array.isArray(rec.values)?rec.values.map(v=>v==null?'':String(v)):[];
        dataRecords.push({
          source:'drive',
          fileId:String(rec.fileId||''),
          fileName:String(rec.fileName||''),
          sheetName:String(rec.sheetName||''),
          rowNumber:Number(rec.rowNumber||0),
          columns,
          values,
          display:values.map((v,i)=>v?`${columns[i]||`列${i+1}`}=${v}`:'').filter(Boolean).join(' | '),
          searchable:`${rec.fileName||''} ${rec.sheetName||''} ${columns.join(' ')} ${values.join(' ')}`.toLowerCase(),
          __magiServerStatsV310:true
        });
      }
      window.MAGI_STATS_SERVER_LAST={target:data.target||'',seasons:data.seasons||[],count:data.records.length};
      return true;
    }catch(e){
      console.warn('[MAGI stats bridge] inject',e?.message||e);
      return false;
    }
  }catch(e){
    console.warn('[MAGI stats bridge] fetch',e?.name==='AbortError'?'timeout':e?.message||e);
    return false;
  }finally{clearTimeout(timer)}
}

function install(){
  if(window.MAGI_STATS_SERVER_BRIDGE_INSTALLED)return true;
  if(!window.MAGI_STATS_REPORT_FN||typeof window.runMagi!=='function')return false;
  const original=window.MAGI_STATS_REPORT_FN;
  const wrapped=async function(...args){
    const query=(document.getElementById('q')?.value||'').trim();
    if(isLookup(query)){
      const status=document.getElementById('status');
      if(status)status.textContent='成績照会：サーバー正本を確認しています…';
      await hydrateServerStats(query);
    }
    return original.apply(this,args);
  };
  wrapped.__magiStatsServerBridgeV310=true;
  window.runMagi=wrapped;
  window.MAGI_STATS_REPORT_FN=wrapped;
  window.MAGI_STATS_SERVER_BRIDGE_INSTALLED=true;
  window.MAGI_STATS_SERVER_BRIDGE='v310';
  return true;
}

let tries=0;
(function wait(){
  tries++;
  if(install())return;
  if(tries<400)setTimeout(wait,100);
})();
})();
