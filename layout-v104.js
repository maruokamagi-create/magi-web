(()=>{
  const css=`
  .answer .top{align-items:flex-start}
  .answer .top>div:first-child{min-width:0;flex:1 1 auto}
  .answer .name{white-space:nowrap}
  .answer .badge{flex:0 0 auto;white-space:nowrap}
  @media(max-width:430px){
    .answer .top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;align-items:start}
    .answer .name{font-size:14px;letter-spacing:-.015em;white-space:nowrap}
    .answer .roleSmall{font-size:10px}
    .answer .confidence{font-size:10px}
    .answer .badge{font-size:10px;padding:5px 7px;line-height:1.2;align-self:start}
  }
  @media(max-width:350px){
    .answer .top{grid-template-columns:1fr}
    .answer .badge{justify-self:start;margin-top:2px}
  }
  `;
  const st=document.createElement('style');st.id='magi-layout-v104-style';st.textContent=css;document.head.appendChild(st);
  window.MAGI_LAYOUT_FIX=true;
})();