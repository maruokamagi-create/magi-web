(()=>{
  const css=`
  .answer .top{align-items:flex-start}
  .answer .top>div:first-child{min-width:0;flex:1 1 auto}
  .answer .name{white-space:nowrap}
  .answer .badge{flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;font-weight:900}
  .answer .voteIcon{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:950;line-height:1;box-shadow:0 2px 5px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.35)}
  .answer .voteIcon.yes{background:#18b94f}.answer .voteIcon.cond{background:#1877e8}.answer .voteIcon.hold{background:#f0b718;color:#3b2b00}.answer .voteIcon.no{background:#d73745}
  .answer .voteText{line-height:1.15}
  @media(max-width:430px){
    .answer .top{display:grid;grid-template-columns:1fr;gap:4px;align-items:start}
    .answer .top>div:first-child{width:100%;min-width:0}
    .answer .name{font-size:15px;letter-spacing:-.02em;white-space:nowrap;overflow:visible}
    .answer .roleSmall{font-size:10px;margin-top:2px}
    .answer .confidence{font-size:10px}
    .answer .badge{justify-self:end;margin-top:3px;font-size:12px;padding:7px 11px;line-height:1.15;border-radius:999px;min-height:40px}
    .answer .voteIcon{width:27px;height:27px;font-size:15px}
  }
  @media(max-width:380px){
    .answer .name{font-size:14px;letter-spacing:-.025em}
    .answer .badge{font-size:11px;padding:6px 9px;min-height:38px}
    .answer .voteIcon{width:25px;height:25px;font-size:14px}
  }
  `;
  for(const id of ['magi-layout-v104-style','magi-layout-v105-style']){const old=document.getElementById(id);if(old)old.remove()}
  const st=document.createElement('style');st.id='magi-layout-v106-style';st.textContent=css;document.head.appendChild(st);

  function decorateBadge(el){
    if(!el)return;
    const raw=(el.dataset.rawVote||el.textContent||'').trim();
    if(!raw)return;
    el.dataset.rawVote=raw;
    let cls='hold',sym='△',label='判断保留';
    if(/◎|賛成/.test(raw)&&!/条件/.test(raw)){cls='yes';sym='◎';label='賛成'}
    else if(/○|条件付き/.test(raw)){cls='cond';sym='○';label='条件付き賛成'}
    else if(/×|✕|反対/.test(raw)){cls='no';sym='×';label='反対'}
    else if(/△|保留/.test(raw)){cls='hold';sym='△';label='判断保留'}
    el.innerHTML=`<span class="voteIcon ${cls}">${sym}</span><span class="voteText">${label}</span>`;
  }
  function decorateAll(){['mVote','bVote','cVote'].forEach(id=>decorateBadge(document.getElementById(id)))}
  const oldSet=setPersona;
  setPersona=function(prefix,p){oldSet(prefix,p);decorateBadge(document.getElementById(prefix+'Vote'))};
  decorateAll();
  window.MAGI_LAYOUT_FIX=true;
})();