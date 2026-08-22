(()=>{
  const css=`
  .answer .top{position:relative;display:block;min-height:78px;padding-bottom:2px}
  .answer .top>div:first-child{min-width:0;width:100%}
  .answer .name{white-space:nowrap;font-weight:900;letter-spacing:-.01em}
  .answer .roleSmall{margin-top:3px}
  .answer .confidence{margin-top:2px}
  .answer .badge{position:absolute;right:0;bottom:3px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-weight:900;border:1px solid #d4dde7;background:#eef2f6;box-shadow:none;padding:7px 11px;border-radius:999px;min-height:42px}
  .answer .voteIcon{width:22px;height:22px;border-radius:50%;display:inline-block;flex:0 0 auto;box-shadow:0 2px 5px rgba(0,0,0,.20)}
  .answer .voteIcon.yes{background:#18b94f}.answer .voteIcon.cond{background:#1877e8}.answer .voteIcon.hold{background:#f0b718}.answer .voteIcon.no{background:#d73745}
  .answer .voteText{line-height:1.1;font-size:12px;font-weight:900}
  @media(max-width:430px){
    .answer .top{min-height:78px}
    .answer .name{font-size:15px;letter-spacing:-.02em;white-space:nowrap}
    .answer .roleSmall{font-size:10px;max-width:48%;margin-top:4px}
    .answer .confidence{font-size:10px;max-width:48%}
    .answer .badge{right:0;bottom:1px;gap:7px;padding:6px 10px;min-height:40px}
    .answer .voteIcon{width:21px;height:21px}
    .answer .voteText{font-size:11px}
  }
  @media(max-width:380px){
    .answer .top{min-height:76px}
    .answer .name{font-size:14px;letter-spacing:-.025em}
    .answer .badge{padding:6px 8px;gap:6px}
    .answer .voteIcon{width:20px;height:20px}
    .answer .voteText{font-size:10px}
  }
  `;
  for(const id of ['magi-layout-v104-style','magi-layout-v105-style','magi-layout-v106-style','magi-layout-v107-style','magi-layout-v108-style','magi-layout-v109-style','magi-layout-v110-style']){const old=document.getElementById(id);if(old)old.remove()}
  const st=document.createElement('style');st.id='magi-layout-v111-style';st.textContent=css;document.head.appendChild(st);

  function decorateBadge(el){
    if(!el)return;
    const raw=(el.dataset.rawVote||el.textContent||'').trim();
    if(!raw)return;
    el.dataset.rawVote=raw;
    let cls='hold',label='△ 判断保留';
    if(/◎|賛成/.test(raw)&&!/条件/.test(raw)){cls='yes';label='◎ 賛成'}
    else if(/○|条件付き/.test(raw)){cls='cond';label='○ 条件付き賛成'}
    else if(/×|✕|反対/.test(raw)){cls='no';label='× 反対'}
    else if(/△|保留/.test(raw)){cls='hold';label='△ 判断保留'}
    el.innerHTML=`<span class="voteIcon ${cls}" aria-hidden="true"></span><span class="voteText">${label}</span>`;
  }
  function decorateAll(){['mVote','bVote','cVote'].forEach(id=>decorateBadge(document.getElementById(id)))}
  const oldSet=setPersona;
  setPersona=function(prefix,p){oldSet(prefix,p);decorateBadge(document.getElementById(prefix+'Vote'))};
  decorateAll();
  window.MAGI_LAYOUT_FIX=true;
})();