(()=>{
  const css=`
  .answer .top{align-items:flex-start}
  .answer .top>div:first-child{min-width:0;flex:1 1 auto}
  .answer .name{white-space:nowrap}
  .answer .badge{flex:0 0 auto;white-space:nowrap}
  @media(max-width:430px){
    .answer .top{display:grid;grid-template-columns:1fr;gap:5px;align-items:start}
    .answer .top>div:first-child{width:100%;min-width:0}
    .answer .name{font-size:15px;letter-spacing:-.02em;white-space:nowrap;overflow:visible}
    .answer .roleSmall{font-size:10px}
    .answer .confidence{font-size:10px}
    .answer .badge{font-size:10px;padding:5px 7px;line-height:1.2;justify-self:end;margin-top:-29px;position:relative;z-index:1}
    .answer .top>div:first-child{padding-right:0}
    .answer .roleSmall,.answer .confidence{max-width:58%}
  }
  @media(max-width:380px){
    .answer .name{font-size:14px;letter-spacing:-.025em}
    .answer .badge{margin-top:2px;justify-self:start}
    .answer .roleSmall,.answer .confidence{max-width:none}
  }
  `;
  const old=document.getElementById('magi-layout-v104-style');if(old)old.remove();
  const st=document.createElement('style');st.id='magi-layout-v105-style';st.textContent=css;document.head.appendChild(st);
  window.MAGI_LAYOUT_FIX=true;
})();