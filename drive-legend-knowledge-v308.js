(()=>{
'use strict';
if(window.MAGI_DRIVE_KNOWLEDGE_LEGEND_V308)return;
window.MAGI_DRIVE_KNOWLEDGE_LEGEND_V308=true;

function apply(){
  const legend=document.getElementById('driveLegend');
  if(!legend)return false;
  legend.innerHTML='<b>ファイル利用の意味</b><div class="driveLegendRow"><span class="driveLegendTag indexed">読込対象</span><span>.xlsm と .csv だけをMAGIの質問・審議に利用します。</span></div><div class="driveLegendRow"><span class="driveLegendTag listed">対象外</span><span>PDF・画像・Googleドキュメント・その他の形式は内容を読み込みません。</span></div>';
  return true;
}

if(!apply()){
  const observer=new MutationObserver(()=>{if(apply())observer.disconnect()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
