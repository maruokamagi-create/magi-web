(()=>{
'use strict';
if(window.MAGI_DRIVE_KNOWLEDGE_LEGEND_V308)return;
window.MAGI_DRIVE_KNOWLEDGE_LEGEND_V308=true;

function apply(){
  const legend=document.getElementById('driveLegend');
  if(!legend)return false;
  legend.innerHTML='<b>ファイル利用の意味</b><div class="driveLegendRow"><span class="driveLegendTag indexed">重要資料</span><span>現・旧チームの正本と、権限に応じた顧問・指導者資料です。PDFを含め、MAGIが本文まで利用できます。</span></div><div class="driveLegendRow"><span class="driveLegendTag listed">必要時取得</span><span>詳細データやレポート等は一括読込せず、質問に必要な時だけ取得します。写真・映像は一覧確認のみです。</span></div>';
  return true;
}

if(!apply()){
  const observer=new MutationObserver(()=>{if(apply())observer.disconnect()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
