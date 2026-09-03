(()=>{
  'use strict';
  const id='magi-criteria-tag-white-v284-style';
  if(document.getElementById(id)) return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    .magiCriteriaSection .magiJudgeRow{
      min-height:64px!important;
    }
    .magiCriteriaSection .magiJudgeTag{
      color:#f4f7fb!important;
      background:transparent!important;
      border:0!important;
      border-radius:0!important;
      box-shadow:none!important;
      text-shadow:none!important;
      -webkit-text-fill-color:#f4f7fb!important;
      padding-left:10px!important;
    }
    .magiCriteriaSection .cYes .magiJudgeTag,
    .magiCriteriaSection .cCond .magiJudgeTag,
    .magiCriteriaSection .cHold .magiJudgeTag,
    .magiCriteriaSection .cNo .magiJudgeTag{
      color:#f4f7fb!important;
      -webkit-text-fill-color:#f4f7fb!important;
      background:transparent!important;
      border:0!important;
      box-shadow:none!important;
    }
    @media(max-width:520px){
      .magiCriteriaSection .magiJudgeRow{
        height:40px!important;
        min-height:40px!important;
        padding:0 8px!important;
        box-sizing:border-box!important;
      }
      .magiCriteriaSection .magiJudgeSymbol{
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        font-size:30px!important;
      }
      .magiCriteriaSection .criteriaGrid{
        gap:5px!important;
      }
      .magiCriteriaSection .magiJudgeTag{
        padding-left:5px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();