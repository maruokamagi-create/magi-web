(()=>{
  'use strict';
  const STYLE_ID='magi-criteria-compact-v281-style';
  if(document.getElementById(STYLE_ID)) return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    @media(max-width:520px){
      .magiCriteriaSection .rulesPanel{padding:9px!important}
      .magiCriteriaSection .criteriaGrid{gap:7px!important}
      .magiCriteriaSection .magiJudgeInner{
        grid-template-columns:minmax(132px,42%) 1fr!important;
        align-items:center!important;
        min-height:108px!important;
      }
      .magiCriteriaSection .magiJudgeMain{
        padding:10px 10px 10px 12px!important;
        gap:10px!important;
      }
      .magiCriteriaSection .magiJudgeSymbol{
        width:52px!important;
        min-width:52px!important;
        height:52px!important;
        font-size:41px!important;
      }
      .magiCriteriaSection .magiJudgeName{
        font-size:20px!important;
        line-height:1.15!important;
      }
      .magiCriteriaSection .magiJudgeCopy{
        align-self:stretch!important;
        justify-content:center!important;
        padding:9px 11px!important;
        border-left:1px solid rgba(255,255,255,.16)!important;
      }
      .magiCriteriaSection .magiJudgeCopy b{
        font-size:15px!important;
        line-height:1.25!important;
        margin-bottom:3px!important;
      }
      .magiCriteriaSection .magiJudgeCopy span{
        font-size:12.5px!important;
        line-height:1.35!important;
      }
      .magiCriteriaSection .magiCriteriaNote{
        margin-top:8px!important;
        padding:9px 10px!important;
        font-size:11.5px!important;
        line-height:1.55!important;
      }
    }
    @media(max-width:390px){
      .magiCriteriaSection .magiJudgeInner{
        grid-template-columns:minmax(126px,41%) 1fr!important;
        min-height:104px!important;
      }
      .magiCriteriaSection .magiJudgeMain{padding:9px 8px 9px 10px!important;gap:8px!important}
      .magiCriteriaSection .magiJudgeCopy{padding:8px 9px!important}
    }
  `;
  document.head.appendChild(style);
})();
