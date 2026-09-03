(()=>{
  'use strict';

  const STYLE_ID='magi-criteria-v282-style';

  const ensureStyle=()=>{
    if(document.getElementById(STYLE_ID)) return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .magiCriteriaSection .sectionHead{align-items:center!important;margin-bottom:12px!important}
      .magiCriteriaSection .sectionHead h2{display:flex!important;align-items:center!important;gap:9px!important}
      .magiCriteriaSection .sectionHead h2:before{content:'◈';color:#4aa8ff;font-size:.9em;filter:drop-shadow(0 0 8px rgba(74,168,255,.65))}
      .magiCriteriaSection .sectionHead span{color:#87a9cc!important;font-size:12px!important;letter-spacing:.08em!important}

      .magiCriteriaSection .rulesPanel{
        padding:14px!important;
        background:linear-gradient(180deg,rgba(7,26,45,.98),rgba(5,20,35,.98))!important;
        border-color:#28577f!important;
        box-shadow:inset 0 0 0 1px rgba(68,146,215,.06),0 14px 34px rgba(0,0,0,.18)!important;
      }
      .magiCriteriaSection .criteriaGrid{
        display:grid!important;
        grid-template-columns:1fr!important;
        gap:10px!important;
      }
      .magiCriteriaSection .criteria{
        min-height:0!important;
        border-radius:14px!important;
        padding:0!important;
        text-align:left!important;
        overflow:hidden!important;
        background:#071827!important;
        color:#fff!important;
        box-shadow:inset 0 0 22px rgba(255,255,255,.018)!important;
      }
      .magiCriteriaSection .magiJudgeInner{
        display:grid!important;
        grid-template-columns:minmax(128px,.88fr) 1.35fr!important;
        align-items:center!important;
        min-height:116px!important;
      }
      .magiCriteriaSection .magiJudgeMain{
        display:flex!important;
        align-items:center!important;
        gap:14px!important;
        padding:18px!important;
        min-width:0!important;
      }
      .magiCriteriaSection .magiJudgeSymbol{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        width:62px!important;
        min-width:62px!important;
        height:62px!important;
        font-size:48px!important;
        font-weight:900!important;
        line-height:1!important;
        text-shadow:0 0 18px currentColor!important;
      }
      .magiCriteriaSection .magiJudgeName{
        font-size:23px!important;
        line-height:1.15!important;
        font-weight:900!important;
        letter-spacing:.01em!important;
      }
      .magiCriteriaSection .magiJudgeCopy{
        align-self:stretch!important;
        display:flex!important;
        flex-direction:column!important;
        justify-content:center!important;
        padding:16px 18px!important;
        border-left:1px solid rgba(255,255,255,.18)!important;
      }
      .magiCriteriaSection .magiJudgeCopy b{
        display:block!important;
        margin-bottom:5px!important;
        font-size:17px!important;
        line-height:1.3!important;
      }
      .magiCriteriaSection .magiJudgeCopy span{
        display:block!important;
        color:#d0dbe6!important;
        font-size:13px!important;
        line-height:1.55!important;
      }

      .magiCriteriaSection .cYes{border:1px solid #37c972!important;background:linear-gradient(90deg,rgba(15,63,39,.92),rgba(5,29,27,.96))!important;box-shadow:inset 0 0 24px rgba(55,201,114,.08),0 0 12px rgba(55,201,114,.08)!important}
      .magiCriteriaSection .cYes .magiJudgeSymbol,.magiCriteriaSection .cYes .magiJudgeName,.magiCriteriaSection .cYes .magiJudgeCopy b{color:#4bd989!important}
      .magiCriteriaSection .cCond{border:1px solid #3398ff!important;background:linear-gradient(90deg,rgba(8,43,75,.95),rgba(4,27,47,.98))!important;box-shadow:inset 0 0 24px rgba(51,152,255,.08),0 0 12px rgba(51,152,255,.07)!important}
      .magiCriteriaSection .cCond .magiJudgeSymbol,.magiCriteriaSection .cCond .magiJudgeName,.magiCriteriaSection .cCond .magiJudgeCopy b{color:#3aa3ff!important}
      .magiCriteriaSection .cHold{border:1px solid #e9ad24!important;background:linear-gradient(90deg,rgba(63,48,6,.94),rgba(35,29,8,.98))!important;box-shadow:inset 0 0 24px rgba(233,173,36,.08),0 0 12px rgba(233,173,36,.07)!important}
      .magiCriteriaSection .cHold .magiJudgeSymbol,.magiCriteriaSection .cHold .magiJudgeName,.magiCriteriaSection .cHold .magiJudgeCopy b{color:#f2b52d!important}
      .magiCriteriaSection .cNo{border:1px solid #eb5260!important;background:linear-gradient(90deg,rgba(67,15,24,.94),rgba(38,11,18,.98))!important;box-shadow:inset 0 0 24px rgba(235,82,96,.08),0 0 12px rgba(235,82,96,.07)!important}
      .magiCriteriaSection .cNo .magiJudgeSymbol,.magiCriteriaSection .cNo .magiJudgeName,.magiCriteriaSection .cNo .magiJudgeCopy b{color:#f05a68!important}

      .magiCriteriaSection .magiCriteriaNote{
        margin-top:9px!important;
        padding:10px 12px!important;
        border:1px solid #2d638f!important;
        border-radius:11px!important;
        background:linear-gradient(90deg,rgba(7,32,55,.98),rgba(5,24,41,.98))!important;
        color:#c8d7e5!important;
        font-size:12px!important;
        line-height:1.55!important;
      }
      .magiCriteriaSection .magiCriteriaNote b{color:#fff!important}
      .magiCriteriaSection .magiCriteriaNote .yesMark{color:#4bd989!important}
      .magiCriteriaSection .magiCriteriaNote .condMark{color:#3aa3ff!important}
      .magiCriteriaSection .magiCriteriaNote .holdMark{color:#f2b52d!important}
      .magiCriteriaSection .magiCriteriaNote .noMark{color:#f05a68!important}

      @media(max-width:520px){
        .magiCriteriaSection .rulesPanel{padding:10px!important}
        .magiCriteriaSection .criteriaGrid{gap:7px!important}
        .magiCriteriaSection .magiJudgeInner{
          grid-template-columns:minmax(132px,42%) 1fr!important;
          align-items:center!important;
          min-height:104px!important;
        }
        .magiCriteriaSection .magiJudgeMain{
          padding:9px 10px 9px 12px!important;
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
          padding:8px 10px!important;
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
          margin-top:7px!important;
          padding:8px 9px!important;
          font-size:11.5px!important;
          line-height:1.45!important;
        }
      }
      @media(max-width:390px){
        .magiCriteriaSection .magiJudgeInner{grid-template-columns:minmax(126px,41%) 1fr!important;min-height:100px!important}
        .magiCriteriaSection .magiJudgeMain{padding:8px 8px 8px 10px!important;gap:8px!important}
        .magiCriteriaSection .magiJudgeCopy{padding:7px 8px!important}
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
    if(head){
      const h2=head.querySelector('h2');
      const span=head.querySelector('span');
      if(h2) h2.textContent='判定基準';
      if(span) span.textContent='4段階評価';
    }

    grid.innerHTML=`
      <div class="criteria cYes"><div class="magiJudgeInner"><div class="magiJudgeMain"><div class="magiJudgeSymbol">◎</div><div class="magiJudgeName">賛成</div></div><div class="magiJudgeCopy"><b>積極的に推奨</b><span>最も前向きな判断です。</span></div></div></div>
      <div class="criteria cCond"><div class="magiJudgeInner"><div class="magiJudgeMain"><div class="magiJudgeSymbol">○</div><div class="magiJudgeName">条件付き賛成</div></div><div class="magiJudgeCopy"><b>条件が整えば推奨</b><span>条件や状況次第で前向きに判断します。</span></div></div></div>
      <div class="criteria cHold"><div class="magiJudgeInner"><div class="magiJudgeMain"><div class="magiJudgeSymbol">△</div><div class="magiJudgeName">判断保留</div></div><div class="magiJudgeCopy"><b>情報不足・再検証</b><span>現時点では判断せず、追加情報や再検証を行います。</span></div></div></div>
      <div class="criteria cNo"><div class="magiJudgeInner"><div class="magiJudgeMain"><div class="magiJudgeSymbol">✕</div><div class="magiJudgeName">反対</div></div><div class="magiJudgeCopy"><b>現時点では非推奨</b><span>リスクや課題が大きく、推奨できない判断です。</span></div></div></div>`;

    const panel=grid.closest('.rulesPanel') || grid.parentElement;
    if(panel){
      let note=panel.querySelector('.magiCriteriaNote');
      if(!note){note=document.createElement('div');note.className='magiCriteriaNote';panel.appendChild(note);}
      note.innerHTML='<b><span class="yesMark">◎</span> と <span class="condMark">○</span> は賛成票として扱います。</b> <span class="holdMark">△</span> は判断保留です。<br><span class="noMark">反対意見・懸念点</span>も、最終判断から除外しません。';
      panel.querySelectorAll('.rulesText').forEach(el=>{if(el!==note && /◎.*○|賛成票|反対意見/.test(el.textContent||'')) el.style.display='none';});
    }
    return true;
  };

  if(!apply()){
    let tries=0;
    const timer=setInterval(()=>{tries+=1;if(apply() || tries>=100) clearInterval(timer);},100);
  }
})();