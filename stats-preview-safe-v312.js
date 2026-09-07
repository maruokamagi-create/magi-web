(()=>{
'use strict';
if(window.MAGI_STATS_PREVIEW_SAFE_V312)return;
window.MAGI_STATS_PREVIEW_SAFE_V312=true;
const s=document.createElement('style');
s.id='magi-stats-preview-safe-v312';
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
})();
