(()=>{
  'use strict';

  const STYLE_ID='magi-criteria-v283-style';

  const ensureStyle=()=>{
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .magiCriteriaSection .sectionHead{align-items:center!important;margin-bottom:12px!important}
      .magiCriteriaSection .sectionHead h2{display:flex!important;align-items:center!important;gap:9px!important}
      .magiCriteriaSection .sectionHead h2:before{content:'◈';color:#4aa8ff;font-size:.9em;filter:drop-shadow(0 0 8px rgba(74,168,255,.65))}
      .magiCriteriaSection .sectionHead span{color:#87a9cc!important;font-size:12px!important;letter-spacing:.08em!important}

      .magiCriteriaSection .rulesPanel{padding:12px!important;background:linear-gradient(180deg,rgba(7,26,45,.98),rgba(5,20,35,.98))!important;border-color:#28577f!important;box-shadow:inset 0 0 0 1px rgba(68,146,215,.06),0 14px 34px rgba(0,0,0,.18)!important}
      .magiCriteriaSection .criteriaGrid{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
      .magiCriteriaSection .criteria{min-height:0!important;border-radius:14px!important;padding:0!important;text-align:left!important;overflow:hidden!important;color:#fff!important}
      .magiCriteriaSection .magiJudgeRow{display:grid!important;grid-template-columns:64px minmax(150px,.9fr) 1fr!important;align-items:center!important;min-height:92px!important;padding:0 16px!important}
      .magiCriteriaSection .magiJudgeSymbol{display:flex!important;align-items:center!important;justify-content:center!important;width:52px!important;height:52px!important;font-size:42px!important;font-weight:900!important;line-height:1!important;text-shadow:0 0 18px currentColor!important}
      .magiCriteriaSection .magiJudgeName{font-size:22px!important;line-height:1!important;font-weight:900!important;white-space:nowrap!important;word-break:keep-all!important}
      .magiCriteriaSection .magiJudgeTag{padding-left:16px!important;border-left:1px solid rgba(255,255,255,.16)!important;font-size:16px!important;line-height:1!important;font-weight:800!important;white-space:nowrap!important;word-break:keep-all!important}

      .magiCriteriaSection .cYes{border:1px solid #37c972!important;background:linear-gradient(90deg,rgba(15,63,39,.92),rgba(5,29,27,.96))!important;box-shadow:inset 0 0 24px rgba(55,201,114,.08),0 0 12px rgba(55,201,114,.08)!important}
      .magiCriteriaSection .cYes .magiJudgeSymbol,.magiCriteriaSection .cYes .magiJudgeName,.magiCriteriaSection .cYes .magiJudgeTag{color:#4bd989!important}
      .magiCriteriaSection .cCond{border:1px solid #3398ff!important;background:linear-gradient(90deg,rgba(8,43,75,.95),rgba(4,27,47,.98))!important;box-shadow:inset 0 0 24px rgba(51,152,255,.08),0 0 12px rgba(51,152,255,.07)!important}
      .magiCriteriaSection .cCond .magiJudgeSymbol,.magiCriteriaSection .cCond .magiJudgeName,.magiCriteriaSection .cCond .magiJudgeTag{color:#3aa3ff!important}
      .magiCriteriaSection .cHold{border:1px solid #e9ad24!important;background:linear-gradient(90deg,rgba(63,48,6,.94),rgba(35,29,8,.98))!important;box-shadow:inset 0 0 24px rgba(233,173,36,.08),0 0 12px rgba(233,173,36,.07)!important}
      .magiCriteriaSection .cHold .magiJudgeSymbol,.magiCriteriaSection .cHold .magiJudgeName,.magiCriteriaSection .cHold .magiJudgeTag{color:#f2b52d!important}
      .magiCriteriaSection .cNo{border:1px solid #eb5260!important;background:linear-gradient(90deg,rgba(67,15,24,.94),rgba(38,11,18,.98))!important;box-shadow:inset 0 0 24px rgba(235,82,96,.08),0 0 12px rgba(235,82,96,.07)!important}
      .magiCriteriaSection .cNo .magiJudgeSymbol,.magiCriteriaSection .cNo .magiJudgeName,.magiCriteriaSection .cNo .magiJudgeTag{color:#f05a68!important}

      .magiCriteriaSection .magiCriteriaNote{margin-top:8px!important;padding:9px 11px!important;border:1px solid #2d638f!important;border-radius:11px!important;background:linear-gradient(90deg,rgba(7,32,55,.98),rgba(5,24,41,.98))!important;color:#c8d7e5!important;font-size:12px!important;line-height:1.5!important}
      .magiCriteriaSection .magiCriteriaNote b{color:#fff!important}.magiCriteriaSection .magiCriteriaNote .yesMark{color:#4bd989!important}.magiCriteriaSection .magiCriteriaNote .condMark{color:#3aa3ff!important}.magiCriteriaSection .magiCriteriaNote .holdMark{color:#f2b52d!important}.magiCriteriaSection .magiCriteriaNote .noMark{color:#f05a68!important}

      @media(max-width:520px){
        .magiCriteriaSection .rulesPanel{padding:9px!important}
        .magiCriteriaSection .criteriaGrid{gap:7px!important}
        .magiCriteriaSection .magiJudgeRow{grid-template-columns:46px 1fr auto!important;min-height:72px!important;padding:0 10px!important;column-gap:7px!important}
        .magiCriteriaSection .magiJudgeSymbol{width:42px!important;height:42px!important;font-size:35px!important}
        .magiCriteriaSection .magiJudgeName{font-size:18px!important;letter-spacing:-.02em!important;white-space:nowrap!important}
        .magiCriteriaSection .magiJudgeTag{padding-left:8px!important;font-size:13px!important;letter-spacing:-.02em!important;white-space:nowrap!important}
        .magiCriteriaSection .magiCriteriaNote{margin-top:7px!important;padding:8px 9px!important;font-size:11.5px!important;line-height:1.45!important}
      }
      @media(max-width:360px){
        .magiCriteriaSection .magiJudgeRow{grid-template-columns:42px 1fr auto!important;padding:0 8px!important;column-gap:5px!important}
        .magiCriteriaSection .magiJudgeSymbol{width:38px!important;height:38px!important;font-size:32px!important}
        .magiCriteriaSection .magiJudgeName{font-size:17px!important}
        .magiCriteriaSection .magiJudgeTag{font-size:12px!important;padding-left:6px!important}
      }
    `;
    document.head.appendChild(style);
  };

  const apply=()=>{
    const grid=document.querySelector('.criteriaGrid');
    if(!grid) return false;
    ensureStyle();
    const section=grid.closest('.section');
    if(section) section.classList.add('magiCriteriaSection');
    const head=section?.querySelector('.sectionHead');
    if(head){const h2=head.querySelector('h2');const span=head.querySelector('span');if(h2)h2.textContent='判定基準';if(span)span.textContent='4段階評価';}

    grid.innerHTML=`
      <div class="criteria cYes"><div class="magiJudgeRow"><div class="magiJudgeSymbol">◎</div><div class="magiJudgeName">賛成</div><div class="magiJudgeTag">積極的に推奨</div></div></div>
      <div class="criteria cCond"><div class="magiJudgeRow"><div class="magiJudgeSymbol">○</div><div class="magiJudgeName">条件付き賛成</div><div class="magiJudgeTag">条件が整えば推奨</div></div></div>
      <div class="criteria cHold"><div class="magiJudgeRow"><div class="magiJudgeSymbol">△</div><div class="magiJudgeName">判断保留</div><div class="magiJudgeTag">情報不足・再検証</div></div></div>
      <div class="criteria cNo"><div class="magiJudgeRow"><div class="magiJudgeSymbol">✕</div><div class="magiJudgeName">反対</div><div class="magiJudgeTag">現時点では非推奨</div></div></div>`;

    const panel=grid.closest('.rulesPanel') || grid.parentElement;
    if(panel){
      let note=panel.querySelector('.magiCriteriaNote');
      if(!note){note=document.createElement('div');note.className='magiCriteriaNote';panel.appendChild(note);}
      note.innerHTML='<b><span class="yesMark">◎</span> と <span class="condMark">○</span> は賛成票。</b> <span class="holdMark">△</span> は保留。<span class="noMark">反対意見・懸念点</span>も最終判断に残します。';
      panel.querySelectorAll('.rulesText').forEach(el=>{if(el!==note && /◎.*○|賛成票|反対意見/.test(el.textContent||''))el.style.display='none';});
    }
    return true;
  };

  if(!apply()){
    let tries=0;
    const timer=setInterval(()=>{tries+=1;if(apply() || tries>=100)clearInterval(timer);},100);
  }
})();