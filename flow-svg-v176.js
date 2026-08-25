(()=>{
  const STYLE_ID='magi-flow-svg-v176-style';
  let done=false;

  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .magiFlowSvgSection{margin-top:18px!important;background:transparent!important}
      .magiFlowSvgWrap{width:100%;max-width:1100px;margin:0 auto;background:transparent}
      .magiFlowSvgWrap svg{display:block;width:100%;height:auto;overflow:visible}
      @media(max-width:430px){.magiFlowSvgWrap{width:100%;max-width:none}}
    `;
    document.head.appendChild(st);
  }

  const findSection=()=>[...document.querySelectorAll('section.section')].find(s=>{
    const h=s.querySelector('.sectionHead h2,h2');
    return h && h.textContent.trim()==='MAGIの仕組み';
  })||null;

  const svgMarkup=`
  <svg viewBox="0 0 1122 1402" role="img" aria-labelledby="magiFlowTitle magiFlowDesc" xmlns="http://www.w3.org/2000/svg">
    <title id="magiFlowTitle">MAGIの仕組み</title>
    <desc id="magiFlowDesc">データ取得、相談分類、3賢人審議、最終判断までの流れ</desc>
    <defs>
      <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="smallGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <clipPath id="clipM"><circle cx="453" cy="893" r="91"/></clipPath>
      <clipPath id="clipB"><circle cx="699" cy="893" r="91"/></clipPath>
      <clipPath id="clipC"><circle cx="944" cy="893" r="91"/></clipPath>
      <linearGradient id="cardFill" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#071a30"/><stop offset="1" stop-color="#031223"/></linearGradient>
      <linearGradient id="blueBorder" x1="0" x2="1"><stop offset="0" stop-color="#7ed8ff"/><stop offset="0.5" stop-color="#3797ff"/><stop offset="1" stop-color="#8ce2ff"/></linearGradient>
    </defs>
    <text x="31" y="70" fill="#fff" font-size="55" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">MAGIの仕組み</text>
    <g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="27" font-weight="800">
      <text x="687" y="62" fill="#4ca3ff">INPUT</text><text x="778" y="62" fill="#b7cadf">→</text>
      <text x="820" y="62" fill="#ff4d57">JUDGE</text><text x="925" y="62" fill="#b7cadf">→</text>
      <text x="966" y="62" fill="#69d241">DECISION</text>
    </g>
    <rect x="24" y="100" width="1074" height="340" rx="27" fill="url(#cardFill)" stroke="url(#blueBorder)" stroke-width="2.6" filter="url(#smallGlow)"/>
    <text x="55" y="205" fill="#52a9ff" font-size="82" font-weight="900" font-family="Arial,sans-serif">01</text>
    <text x="151" y="198" fill="#fff" font-size="43" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">データ取得</text>
    <g fill="#fff" font-size="28" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif"><text x="55" y="263">Drive・CSV・JSON・</text><text x="55" y="305">Excel・TEXTなどから</text><text x="55" y="347">材料を集める。</text></g>
    <g transform="translate(405 130)"><rect width="101" height="101" rx="17" fill="#f7f8fa"/><path d="M42 18h21l25 43H67z" fill="#f6bf19"/><path d="M42 18L17 61l12 21 25-43z" fill="#16a05d"/><path d="M29 82h50l12-21H42z" fill="#3777d4"/><text x="50" y="128" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">Drive</text></g>
    <g transform="translate(535 130)"><rect width="101" height="101" rx="17" fill="#f7f8fa"/><path d="M29 13h34l16 16v60H29z" fill="#fff" stroke="#2e944f" stroke-width="3"/><path d="M63 13v18h16" fill="#e5f4e8"/><rect x="20" y="49" width="70" height="31" rx="5" fill="#238c47"/><text x="55" y="71" text-anchor="middle" fill="#fff" font-size="20" font-weight="900">CSV</text><text x="50" y="128" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">CSV</text></g>
    <g transform="translate(665 130)"><rect width="101" height="101" rx="17" fill="#f7f8fa"/><text x="50" y="70" text-anchor="middle" fill="#7047ad" font-size="55" font-weight="900" font-family="monospace">{ }</text><text x="50" y="128" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">JSON</text></g>
    <g transform="translate(795 130)"><rect width="101" height="101" rx="17" fill="#f7f8fa"/><rect x="36" y="18" width="50" height="66" rx="5" fill="#2aa454"/><path d="M53 18v66M70 18v66M36 40h50M36 61h50" stroke="#d9f3e1" stroke-width="2"/><rect x="14" y="29" width="47" height="52" rx="4" fill="#168044"/><text x="37" y="65" text-anchor="middle" fill="#fff" font-size="33" font-weight="900">X</text><text x="50" y="128" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">Excel</text></g>
    <g transform="translate(925 130)"><rect width="101" height="101" rx="17" fill="#f7f8fa"/><path d="M29 18h44l12 12v56H29z" fill="#fff" stroke="#8795a2" stroke-width="3"/><path d="M73 18v14h12" fill="#e8edf2"/><path d="M40 45h33M40 57h33M40 69h25" stroke="#8795a2" stroke-width="4" stroke-linecap="round"/><text x="50" y="128" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">TEXT</text></g>
    <path d="M454 284v20M585 284v20M715 284v20M845 284v20M975 284v20M454 304H975M715 304v54" fill="none" stroke="#5db0ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#smallGlow)"/>
    <path d="M703 347l12 14 12-14" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M657 373l58-17 58 17-17 44h-82z" fill="#0b3e76" stroke="#67c6ff" stroke-width="5" filter="url(#smallGlow)"/>
    <text x="791" y="405" fill="#41a9ff" font-size="29" font-weight="800">情報を集約</text>
    <rect x="24" y="460" width="1074" height="276" rx="27" fill="url(#cardFill)" stroke="url(#blueBorder)" stroke-width="2.6" filter="url(#smallGlow)"/>
    <text x="55" y="559" fill="#52a9ff" font-size="82" font-weight="900" font-family="Arial,sans-serif">02</text>
    <text x="151" y="552" fill="#fff" font-size="43" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">相談分類</text>
    <g fill="#fff" font-size="27" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif"><text x="55" y="625">集めた情報を内容に応じて</text><text x="55" y="667">3つのテーマに</text><text x="55" y="709">振り分ける。</text></g>
    <rect x="553" y="478" width="255" height="65" rx="33" fill="#06182b" stroke="#74a6d7" stroke-width="2"/><path d="M601 499c-16 0-28 9-28 20 0 8 7 15 17 18l-3 10 15-8c15 0 27-9 27-20s-12-20-28-20z" fill="#fff"/><text x="656" y="522" fill="#fff" font-size="26" font-weight="900">相談入力</text>
    <path d="M680 543v32" stroke="#fff" stroke-width="4"/><circle cx="680" cy="583" r="13" fill="#fff" filter="url(#smallGlow)"/><path d="M680 584H474v44M680 584v44M680 584H904v44" fill="none" stroke="#67a7df" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M474 628v14" stroke="#4a9cff" stroke-width="5"/><path d="M680 628v14" stroke="#ff4c55" stroke-width="5"/><path d="M904 628v14" stroke="#6bd23c" stroke-width="5"/>
    <rect x="368" y="642" width="212" height="67" rx="18" fill="#08213d" stroke="#4a9cff" stroke-width="3"/><text x="474" y="684" text-anchor="middle" fill="#fff" font-size="25" font-weight="900">⌕ データ相談</text><rect x="587" y="642" width="186" height="67" rx="18" fill="#311218" stroke="#ff4c55" stroke-width="3"/><text x="680" y="684" text-anchor="middle" fill="#fff" font-size="25" font-weight="900">◎ 審議</text><rect x="790" y="642" width="225" height="67" rx="18" fill="#102814" stroke="#6bd23c" stroke-width="3"/><text x="902" y="684" text-anchor="middle" fill="#fff" font-size="25" font-weight="900">↗ 高度相談</text>
    <rect x="24" y="756" width="1074" height="309" rx="27" fill="url(#cardFill)" stroke="url(#blueBorder)" stroke-width="2.6" filter="url(#smallGlow)"/>
    <text x="55" y="855" fill="#52a9ff" font-size="82" font-weight="900" font-family="Arial,sans-serif">03</text><text x="55" y="925" fill="#fff" font-size="43" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">3賢人審議</text><g fill="#fff" font-size="27" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif"><text x="55" y="981">3人が別視点で</text><text x="55" y="1022">評価する。</text></g>
    <circle cx="453" cy="893" r="95" fill="#f4f7fa" stroke="#4c9dff" stroke-width="4" filter="url(#smallGlow)"/><image href="/portraits/melchior.png?v=170" x="362" y="802" width="182" height="182" preserveAspectRatio="xMidYMid slice" clip-path="url(#clipM)"/><circle cx="699" cy="893" r="95" fill="#170a0e" stroke="#ff4c55" stroke-width="4" filter="url(#smallGlow)"/><image href="/portraits/balthasar.png?v=170" x="608" y="802" width="182" height="182" preserveAspectRatio="xMidYMid slice" clip-path="url(#clipB)"/><circle cx="944" cy="893" r="95" fill="#07190c" stroke="#70d43d" stroke-width="4" filter="url(#smallGlow)"/><image href="/portraits/casper.png?v=170" x="853" y="802" width="182" height="182" preserveAspectRatio="xMidYMid slice" clip-path="url(#clipC)"/>
    <g text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="900"><text x="453" y="1014" fill="#4c9dff">MELCHIOR</text><text x="699" y="1014" fill="#ff4c55">BALTHASAR</text><text x="944" y="1014" fill="#70d43d">CASPER</text></g><g text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif" font-size="24" font-weight="800"><text x="453" y="1047" fill="#4c9dff">解析・論理</text><text x="699" y="1047" fill="#ff4c55">戦略・経験</text><text x="944" y="1047" fill="#70d43d">直感・可能性</text></g>
    <rect x="24" y="1086" width="1074" height="286" rx="27" fill="url(#cardFill)" stroke="url(#blueBorder)" stroke-width="2.6" filter="url(#smallGlow)"/>
    <text x="55" y="1190" fill="#52a9ff" font-size="82" font-weight="900" font-family="Arial,sans-serif">04</text><text x="151" y="1181" fill="#fff" font-size="43" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">最終判断</text><g fill="#fff" font-size="27" font-weight="600" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif"><text x="55" y="1240">3人の評価を統合し、</text><text x="55" y="1282">最適な判断を</text><text x="55" y="1324">提示する。</text></g>
    <path d="M453 1048v55c0 28 26 36 58 58l38 26" fill="none" stroke="#4c9dff" stroke-width="6" stroke-linecap="round" filter="url(#smallGlow)"/><path d="M699 1048v58c0 29-27 37-62 56l-88 47" fill="none" stroke="#ff4c55" stroke-width="6" stroke-linecap="round" filter="url(#smallGlow)"/><path d="M944 1048v58c0 26-29 33-70 43l-325 61" fill="none" stroke="#70d43d" stroke-width="6" stroke-linecap="round" filter="url(#smallGlow)"/><circle cx="549" cy="1210" r="17" fill="#fff" filter="url(#softGlow)"/><path d="M572 1210h112" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M671 1197l16 13-16 13" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="746" cy="1210" r="48" fill="#0b2340" stroke="#fff" stroke-width="5" filter="url(#smallGlow)"/><path d="M723 1208l16 17 31-38" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M798 1210h52" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M838 1197l16 13-16 13" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="865" y="1166" width="194" height="88" rx="18" fill="#071a30" stroke="#4c9dff" stroke-width="4" filter="url(#smallGlow)"/><text x="962" y="1223" text-anchor="middle" fill="#fff" font-size="31" font-weight="900" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif">最適な判断</text>
  </svg>`;

  const apply=()=>{
    if(done)return;
    const section=findSection();
    if(!section)return;
    const wrap=document.createElement('div');
    wrap.className='magiFlowSvgWrap';
    wrap.innerHTML=svgMarkup;
    section.className='section magiFlowSvgSection';
    section.innerHTML='';
    section.appendChild(wrap);
    done=true;
  };

  apply();
  let tries=0;
  const timer=setInterval(()=>{if(done||tries++>120){clearInterval(timer);return;}apply();},100);
  new MutationObserver(()=>{if(!done)apply();}).observe(document.documentElement,{subtree:true,childList:true});
})();
