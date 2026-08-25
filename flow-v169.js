(()=>{
  const STYLE_ID='magi-flow-v169-style';
  const SECTION_CLASS='magiFlowSectionV169';

  const css=`
.${SECTION_CLASS} .flowGrid{display:flex!important;flex-direction:column!important;gap:10px!important}
.${SECTION_CLASS} .magiFlowCard{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(132px,34%) 1fr;gap:14px;align-items:center;padding:18px 18px;border:1px solid #315978;border-radius:20px;background:linear-gradient(135deg,rgba(11,31,52,.98),rgba(6,22,39,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
.${SECTION_CLASS} .magiFlowText{align-self:stretch;display:flex;flex-direction:column;justify-content:center;min-width:0}
.${SECTION_CLASS} .magiFlowStep{font-size:46px;line-height:.9;font-weight:950;color:#86baff;letter-spacing:.02em;margin-bottom:14px}
.${SECTION_CLASS} .magiFlowTitle{font-size:24px;line-height:1.2;font-weight:950;color:#fff;margin:0 0 10px}
.${SECTION_CLASS} .magiFlowCopy{font-size:14px;line-height:1.7;color:#c5d5e5;margin:0;font-weight:650}
.${SECTION_CLASS} .magiFlowVisual{min-width:0;width:100%;display:flex;align-items:center;justify-content:center}

/* 01 sources */
.${SECTION_CLASS} .sourceVisual{display:flex;flex-direction:column;align-items:center;width:100%}
.${SECTION_CLASS} .sourceRow{width:100%;display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-items:start}
.${SECTION_CLASS} .sourceItem{text-align:center;position:relative;min-width:0}
.${SECTION_CLASS} .sourceTile{height:58px;border-radius:12px;background:#f7f9fc;border:1px solid #dce6ef;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 18px rgba(0,0,0,.2)}
.${SECTION_CLASS} .sourceTile svg{width:38px;height:38px;display:block}
.${SECTION_CLASS} .sourceLabel{font-size:11px;font-weight:900;color:#fff;margin-top:5px;white-space:nowrap}
.${SECTION_CLASS} .sourceBus{position:relative;width:86%;height:58px;margin-top:2px}
.${SECTION_CLASS} .sourceBus:before{content:'';position:absolute;left:0;right:0;top:16px;height:3px;background:#63a6ff;border-radius:3px;box-shadow:0 0 10px rgba(71,148,255,.25)}
.${SECTION_CLASS} .sourceBus:after{content:'↓';position:absolute;left:50%;top:8px;transform:translateX(-50%);font-size:34px;line-height:1;color:#86bbff;font-weight:900}
.${SECTION_CLASS} .sourceTray{width:70px;height:28px;border:3px solid #dfeeff;border-top:0;border-radius:0 0 10px 10px;position:relative;box-shadow:0 0 14px rgba(80,158,255,.22)}
.${SECTION_CLASS} .sourceTray:before,.${SECTION_CLASS} .sourceTray:after{content:'';position:absolute;top:-8px;width:25px;height:3px;background:#dfeeff}
.${SECTION_CLASS} .sourceTray:before{left:-1px;transform:rotate(20deg);transform-origin:left center}
.${SECTION_CLASS} .sourceTray:after{right:-1px;transform:rotate(-20deg);transform-origin:right center}

/* 02 router */
.${SECTION_CLASS} .routerVisual{width:100%;display:flex;flex-direction:column;align-items:center}
.${SECTION_CLASS} .inputPill{padding:9px 18px;border:1px solid #6384a7;border-radius:999px;background:#081827;color:#fff;font-size:15px;font-weight:900;box-shadow:0 5px 15px rgba(0,0,0,.15)}
.${SECTION_CLASS} .inputPill:before{content:'●';font-size:9px;color:#dcecff;margin-right:8px}
.${SECTION_CLASS} .routerStem{width:3px;height:24px;background:#a9c9e8;position:relative}
.${SECTION_CLASS} .routerNode{width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 0 16px rgba(255,255,255,.65);margin-top:-2px}
.${SECTION_CLASS} .routeBus{position:relative;width:88%;height:34px;margin-top:-8px;border-top:3px solid #547da4}
.${SECTION_CLASS} .routeBus:before,.${SECTION_CLASS} .routeBus:after{content:'';position:absolute;top:-3px;width:3px;height:28px;background:#547da4}
.${SECTION_CLASS} .routeBus:before{left:0}.${SECTION_CLASS} .routeBus:after{right:0}
.${SECTION_CLASS} .routeBoxes{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:-8px}
.${SECTION_CLASS} .routeBox{min-height:54px;border-radius:11px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;line-height:1.25;font-weight:950;padding:7px 5px;color:#fff}
.${SECTION_CLASS} .routeBlue{border:2px solid #3f86ff;background:linear-gradient(135deg,#0e315c,#124a91)}
.${SECTION_CLASS} .routeRed{border:2px solid #ff4a55;background:linear-gradient(135deg,#50191e,#94252b)}
.${SECTION_CLASS} .routeGreen{border:2px solid #69bd42;background:linear-gradient(135deg,#173e24,#285d28)}

/* 03 sages */
.${SECTION_CLASS} .sageVisual{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:start}
.${SECTION_CLASS} .sage{text-align:center;min-width:0}
.${SECTION_CLASS} .sageFace{width:min(92px,100%);aspect-ratio:1;border-radius:50%;overflow:hidden;margin:0 auto 8px;background:#f7f9fc;border:3px solid currentColor;box-shadow:0 8px 22px rgba(0,0,0,.28)}
.${SECTION_CLASS} .sageFace img{width:100%;height:100%;object-fit:cover;object-position:center 19%;display:block}
.${SECTION_CLASS} .sageName{font-size:13px;line-height:1.05;font-weight:950;white-space:nowrap;letter-spacing:-.025em}
.${SECTION_CLASS} .sageAxis{font-size:11px;line-height:1.3;font-weight:900;color:#eef5fb;margin-top:5px;white-space:nowrap}
.${SECTION_CLASS} .sageBlue{color:#4b94ff}.sageRed{color:#ff4c54}.sageGreen{color:#69bf48}

/* 04 merge */
.${SECTION_CLASS} .mergeVisual{width:100%;display:grid;grid-template-columns:minmax(110px,1.15fr) 50px minmax(90px,.9fr);gap:10px;align-items:center}
.${SECTION_CLASS} .mergeSvg{width:100%;height:100px;display:block;overflow:visible}
.${SECTION_CLASS} .decisionCheck{width:50px;height:50px;border-radius:50%;background:#fff;color:#17385e;display:flex;align-items:center;justify-content:center;font-size:31px;font-weight:1000;box-shadow:0 0 18px rgba(255,255,255,.26);position:relative}
.${SECTION_CLASS} .decisionCheck:after{content:'→';position:absolute;left:54px;color:#fff;font-size:24px;font-weight:800}
.${SECTION_CLASS} .decisionBox{border:2px solid #5da3ff;border-radius:11px;background:#081c32;color:#fff;padding:14px 9px;text-align:center;font-size:16px;line-height:1.25;font-weight:950;box-shadow:0 0 14px rgba(54,136,255,.16)}

@media(max-width:520px){
  .${SECTION_CLASS} .magiFlowCard{grid-template-columns:31% 1fr;gap:10px;padding:15px 14px;border-radius:18px}
  .${SECTION_CLASS} .magiFlowStep{font-size:39px;margin-bottom:11px}
  .${SECTION_CLASS} .magiFlowTitle{font-size:20px;margin-bottom:8px}
  .${SECTION_CLASS} .magiFlowCopy{font-size:13px;line-height:1.6}
  .${SECTION_CLASS} .sourceRow{gap:4px}
  .${SECTION_CLASS} .sourceTile{height:46px;border-radius:9px}
  .${SECTION_CLASS} .sourceTile svg{width:31px;height:31px}
  .${SECTION_CLASS} .sourceLabel{font-size:9px;margin-top:4px}
  .${SECTION_CLASS} .sourceBus{height:47px;width:88%}
  .${SECTION_CLASS} .sourceBus:before{top:13px;height:2px}
  .${SECTION_CLASS} .sourceBus:after{top:6px;font-size:27px}
  .${SECTION_CLASS} .sourceTray{width:56px;height:23px;border-width:2px}
  .${SECTION_CLASS} .inputPill{font-size:12px;padding:8px 13px}
  .${SECTION_CLASS} .routerStem{height:19px;width:2px}
  .${SECTION_CLASS} .routerNode{width:13px;height:13px}
  .${SECTION_CLASS} .routeBus{height:29px;border-top-width:2px}
  .${SECTION_CLASS} .routeBus:before,.${SECTION_CLASS} .routeBus:after{width:2px;height:24px;top:-2px}
  .${SECTION_CLASS} .routeBoxes{gap:5px}
  .${SECTION_CLASS} .routeBox{font-size:10px;min-height:46px;padding:5px 3px;border-width:1.5px}
  .${SECTION_CLASS} .sageVisual{gap:4px}
  .${SECTION_CLASS} .sageFace{width:min(70px,100%);border-width:2px;margin-bottom:6px}
  .${SECTION_CLASS} .sageName{font-size:10px}
  .${SECTION_CLASS} .sageAxis{font-size:9px;margin-top:4px}
  .${SECTION_CLASS} .mergeVisual{grid-template-columns:minmax(75px,1.1fr) 42px minmax(72px,.9fr);gap:7px}
  .${SECTION_CLASS} .mergeSvg{height:82px}
  .${SECTION_CLASS} .decisionCheck{width:42px;height:42px;font-size:26px}
  .${SECTION_CLASS} .decisionCheck:after{left:45px;font-size:18px}
  .${SECTION_CLASS} .decisionBox{font-size:13px;padding:11px 5px}
}
@media(max-width:360px){
  .${SECTION_CLASS} .magiFlowCard{grid-template-columns:30% 1fr;padding:13px 11px;gap:8px}
  .${SECTION_CLASS} .magiFlowStep{font-size:34px}
  .${SECTION_CLASS} .magiFlowTitle{font-size:18px}
  .${SECTION_CLASS} .magiFlowCopy{font-size:12px}
  .${SECTION_CLASS} .sourceTile{height:41px}. ${SECTION_CLASS} .sourceTile svg{width:27px;height:27px}
}
`;

  const driveIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 6h12l10 17H28z" fill="#f6bf19"/><path d="M18 6L7 25l6 10 11-19z" fill="#18a05e"/><path d="M13 35h23l5-9H18z" fill="#3777d4"/></svg>`;
  const csvIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h17l8 8v30H12z" fill="#fff" stroke="#2c8b4f" stroke-width="2.5"/><path d="M29 5v9h8" fill="#dff2e5"/><rect x="7" y="22" width="34" height="15" rx="3" fill="#268b48"/><text x="24" y="33" text-anchor="middle" font-size="12" font-family="Arial" font-weight="800" fill="#fff">CSV</text></svg>`;
  const jsonIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="33" text-anchor="middle" font-size="28" font-family="monospace" font-weight="800" fill="#7047ad">{ }</text></svg>`;
  const excelIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="16" y="8" width="26" height="32" rx="2" fill="#31a85a"/><path d="M25 8v32M33 8v32M16 18h26M16 28h26" stroke="#d9f3e1" stroke-width="1.5"/><rect x="5" y="13" width="24" height="25" rx="2" fill="#168044"/><text x="17" y="31" text-anchor="middle" font-size="20" font-family="Arial" font-weight="900" fill="#fff">X</text></svg>`;
  const textIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h18l7 7v31H12z" fill="#fff" stroke="#8291a0" stroke-width="2"/><path d="M30 5v8h7" fill="#e8edf2"/><path d="M17 21h15M17 27h15M17 33h11" stroke="#7f8d9b" stroke-width="2.6" stroke-linecap="round"/></svg>`;

  const html=`
<div class="magiFlowCard flow01">
  <div class="magiFlowText"><div class="magiFlowStep">01</div><h3 class="magiFlowTitle">データ取得</h3><p class="magiFlowCopy">Drive・CSV・JSON・Excel・TEXTなどから材料を集める。</p></div>
  <div class="magiFlowVisual sourceVisual">
    <div class="sourceRow">
      <div class="sourceItem"><div class="sourceTile">${driveIcon}</div><div class="sourceLabel">Drive</div></div>
      <div class="sourceItem"><div class="sourceTile">${csvIcon}</div><div class="sourceLabel">CSV</div></div>
      <div class="sourceItem"><div class="sourceTile">${jsonIcon}</div><div class="sourceLabel">JSON</div></div>
      <div class="sourceItem"><div class="sourceTile">${excelIcon}</div><div class="sourceLabel">Excel</div></div>
      <div class="sourceItem"><div class="sourceTile">${textIcon}</div><div class="sourceLabel">TEXT</div></div>
    </div><div class="sourceBus"></div><div class="sourceTray"></div>
  </div>
</div>
<div class="magiFlowCard flow02">
  <div class="magiFlowText"><div class="magiFlowStep">02</div><h3 class="magiFlowTitle">相談分類</h3><p class="magiFlowCopy">集めた情報を内容に応じて3つのテーマに振り分ける。</p></div>
  <div class="magiFlowVisual routerVisual"><div class="inputPill">相談入力</div><div class="routerStem"></div><div class="routerNode"></div><div class="routeBus"></div><div class="routeBoxes"><div class="routeBox routeBlue">データ相談</div><div class="routeBox routeRed">審議</div><div class="routeBox routeGreen">高度相談</div></div></div>
</div>
<div class="magiFlowCard flow03">
  <div class="magiFlowText"><div class="magiFlowStep">03</div><h3 class="magiFlowTitle">3賢人審議</h3><p class="magiFlowCopy">3人が別視点で評価する。</p></div>
  <div class="magiFlowVisual sageVisual">
    <div class="sage sageBlue"><div class="sageFace"><img src="/portraits/melchior.png?v=169" alt="MELCHIOR"></div><div class="sageName">MELCHIOR</div><div class="sageAxis">解析・論理</div></div>
    <div class="sage sageRed"><div class="sageFace"><img src="/portraits/balthasar.png?v=169" alt="BALTHASAR"></div><div class="sageName">BALTHASAR</div><div class="sageAxis">戦略・経験</div></div>
    <div class="sage sageGreen"><div class="sageFace"><img src="/portraits/casper.png?v=169" alt="CASPER"></div><div class="sageName">CASPER</div><div class="sageAxis">直感・可能性</div></div>
  </div>
</div>
<div class="magiFlowCard flow04">
  <div class="magiFlowText"><div class="magiFlowStep">04</div><h3 class="magiFlowTitle">最終判断</h3><p class="magiFlowCopy">3人の評価を統合し、最適な判断を提示する。</p></div>
  <div class="magiFlowVisual mergeVisual">
    <svg class="mergeSvg" viewBox="0 0 130 100" aria-hidden="true"><path d="M4 18 H50 Q70 18 78 48 L92 50" fill="none" stroke="#4b94ff" stroke-width="5" stroke-linecap="round"/><path d="M4 50 H92" fill="none" stroke="#ff4c54" stroke-width="5" stroke-linecap="round"/><path d="M4 82 H50 Q70 82 78 53 L92 50" fill="none" stroke="#69bf48" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="50" r="8" fill="#fff" filter="drop-shadow(0 0 6px rgba(255,255,255,.5))"/></svg>
    <div class="decisionCheck">✓</div><div class="decisionBox">最適な判断</div>
  </div>
</div>`;

  function mount(){
    const heads=[...document.querySelectorAll('.sectionHead h2')];
    const h=heads.find(n=>n.textContent.trim()==='MAGIの仕組み');
    if(!h)return false;
    const section=h.closest('.section');
    const grid=section&&section.querySelector('.flowGrid');
    if(!section||!grid)return false;
    section.classList.add(SECTION_CLASS);
    if(grid.dataset.flowV169==='1')return true;
    if(!document.getElementById(STYLE_ID)){
      const st=document.createElement('style');st.id=STYLE_ID;st.textContent=css;document.head.appendChild(st);
    }
    grid.innerHTML=html;
    grid.dataset.flowV169='1';
    return true;
  }

  if(mount())return;
  const mo=new MutationObserver(()=>{if(mount())mo.disconnect()});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>40){clearInterval(timer);mo.disconnect()}},150);
})();