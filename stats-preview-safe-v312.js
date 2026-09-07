(()=>{
'use strict';
if(window.MAGI_STATS_PREVIEW_SAFE_V313)return;
window.MAGI_STATS_PREVIEW_SAFE_V313=true;
const s=document.createElement('style');
s.id='magi-stats-preview-safe-v313';
s.textContent=`
.statsPreviewBar{
  top:env(safe-area-inset-top,0px)!important;
  padding-left:max(14px,env(safe-area-inset-left,0px))!important;
  padding-right:max(14px,env(safe-area-inset-right,0px))!important;
  box-sizing:border-box!important;
}
.statsPreviewModal{
  padding-top:calc(66px + env(safe-area-inset-top,0px))!important;
  padding-left:max(10px,env(safe-area-inset-left,0px))!important;
  padding-right:max(10px,env(safe-area-inset-right,0px))!important;
  padding-bottom:max(24px,env(safe-area-inset-bottom,0px))!important;
}
`;
document.head.appendChild(s);

function safePrintReport(){
  const source=document.getElementById('statsPdfSource');
  if(!source)return;
  const state=document.getElementById('statsPdfState');
  const w=window.open('','_blank');
  if(!w){if(state)state.textContent='印刷画面を開けませんでした。ブラウザのポップアップ設定を確認してください。';return;}
  const printCss=`
    *{box-sizing:border-box}
    html,body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#07172d}
    .magiPrintReturnBar{position:sticky;top:0;z-index:99999;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#06152b;color:#fff;border-bottom:4px solid #8d1420;padding:calc(10px + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) 10px max(14px,env(safe-area-inset-left,0px))}
    .magiPrintReturnBar b{font-size:17px}.magiPrintReturnBar .btns{display:flex;gap:8px}
    .magiPrintReturnBar button{border:1px solid #41658a;border-radius:12px;min-height:46px;padding:10px 14px;font-size:15px;font-weight:800;background:#17324e;color:#fff}
    .magiPrintReturnBar button.primary{background:#f3f7fb;color:#07111f}
    .statsPaper{padding:12mm}
    .statsHeader,.statsBrand,.statsSeasonHead{display:flex;align-items:center;justify-content:space-between}
    .statsBrand img{width:18mm;height:18mm}.statsBrand div{margin-left:4mm}.statsBrand b{display:block;font-size:18px}
    .statsBrand span,.statsIssue,.statsTitle span,.statsSource,.statsFooter small{font-size:10px;color:#617086}
    .statsTitle{margin:10mm 0 5mm;border-bottom:4px solid #8d1420}.statsTitle h2{font-size:32px;margin:2mm 0}.statsTitle p{font-weight:800}
    .statsSeason{margin-top:6mm}.statsSeasonHead{background:#071b36;color:#fff;padding:3mm}.statsSeasonHead span{font-size:9px;display:block}.statsSeasonHead b{font-size:18px}
    .statsVerified{font-size:10px}.statsFeatured,.statsMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-top:3mm}
    .statsFeature,.statsMetric{border:1px solid #d6dfe8;padding:3mm}.statsFeature{background:#edf3f8}.statsFeature span,.statsMetric span{font-size:9px;color:#617086;display:block}.statsFeature b{font-size:24px}.statsMetric b{font-size:16px}
    .statsSource{margin-top:3mm}.statsFooter{border-top:1px solid #bcc8d4;margin-top:8mm;padding-top:3mm}.statsFooter b,.statsFooter span,.statsFooter small{display:block}
    @media print{.magiPrintReturnBar{display:none!important}@page{size:A4;margin:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.statsPaper{padding:12mm}}
  `;
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>MAGI DATA REPORT</title><style>${printCss}</style></head><body><div class="magiPrintReturnBar"><b>MAGI 印刷・PDF保存</b><div class="btns"><button type="button" onclick="magiReturn()">MAGIに戻る</button><button class="primary" type="button" onclick="window.print()">印刷する</button></div></div>${source.outerHTML}<script>function magiReturn(){try{window.close()}catch(e){}setTimeout(function(){if(!window.closed){try{if(window.opener&&!window.opener.closed){window.opener.focus();history.back();return}}catch(e){}history.back()}},180)}window.addEventListener('afterprint',function(){setTimeout(magiReturn,250)});setTimeout(function(){window.print()},450)<\/script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  if(state)state.textContent='印刷画面を開きました。終了後は「MAGIに戻る」で戻れます。';
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#statsSaveButton');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  safePrintReport();
},true);
})();
