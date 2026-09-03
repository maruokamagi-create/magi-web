(()=>{
  'use strict';
  const id='magi-criteria-tag-white-v284-style';
  if(document.getElementById(id)) return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    .magiCriteriaSection .magiJudgeTag{
      color:#f4f7fb!important;
      background:transparent!important;
      border-radius:0!important;
      box-shadow:none!important;
      border-top:0!important;
      border-right:0!important;
      border-bottom:0!important;
      text-shadow:none!important;
      -webkit-text-fill-color:#f4f7fb!important;
    }
    .magiCriteriaSection .cYes .magiJudgeTag,
    .magiCriteriaSection .cCond .magiJudgeTag,
    .magiCriteriaSection .cHold .magiJudgeTag,
    .magiCriteriaSection .cNo .magiJudgeTag{
      color:#f4f7fb!important;
      -webkit-text-fill-color:#f4f7fb!important;
      background:transparent!important;
      box-shadow:none!important;
    }
  `;
  document.head.appendChild(style);
})();