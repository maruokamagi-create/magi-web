(()=>{
  const css=`
  .answer .top{position:relative;display:block;min-height:78px;padding-bottom:2px}
  .answer .top>div:first-child{min-width:0;width:100%}
  .answer .name{white-space:nowrap;font-weight:900;letter-spacing:-.01em}
  .answer .roleSmall{margin-top:3px}
  .answer .confidence{margin-top:2px}
  .answer .badge{position:absolute;right:0;bottom:3px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-weight:900;border:1px solid #cfdbe7;background:#f1f5f9;box-shadow:0 3px 10px rgba(16,36,62,.10);padding:7px 11px;border-radius:999px;min-height:42px}
  .answer .voteIcon{width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:17px;font-weight:950;line-height:1;border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 6px rgba(0,0,0,.22),0 0 0 2px rgba(20,50,80,.08)}
  .answer .voteIcon.yes{background:#16b94f}.answer .voteIcon.cond{background:#1877e8}.answer .voteIcon.hold{background:#f0b718;color:#3a2a00}.answer .voteIcon.no{background:#d73745}
  .answer .voteText{line-height:1.1;font-size:12px}
  .answer .badge.vote-yes{background:#f0fbf5;border-color:#bfe6cf}.answer .badge.vote-cond{background:#eef6ff;border-color:#bfd8fa}.answer .badge.vote-hold{background:#fff9e9;border-color:#ecd88f}.answer .badge.vote-no{background:#fff1f3;border-color:#efc0c6}
  @media(max-width:430px){
    .answer .top{min-height:78px}
    .answer .name{font-size:15px;letter-spacing:-.02em;white-space:nowrap}
    .answer .roleSmall{font-size:10px;max-width:48%;margin-top:4px}
    .answer .confidence{font-size:10px;max-width:48%}
    .answer .badge{right:0;bottom:1px;gap:7px;padding:6px 10px;min-height:40px}
    .answer .voteIcon{width:29px;height:29px;font-size:16px}
    .answer .voteText{font-size:11px}
  }
  @media(max-width:380px){
    .answer .top{min-height:76px}
    .answer .name{font-size:14px;letter-spacing:-.025em}
    .answer .badge{padding:6px 8px;gap:6px}
    .answer .voteIcon{width:27px;height:27px;font-size:15px}
    .answer .voteText{font-size:10px}
  }
  `;
  for(const id of ['magi-layout-v104-style','magi-layout-v105-style','magi-layout-v106-style']){const old=document.getElementById(id);if(old)old.remove()}
  const st=document.createElement('style');st.id='magi-layout-v107-style';st.textContent=css;document.head.appendChild(st);

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
    el.classList.remove('vote-yes','vote-cond','vote-hold','vote-no');
    el.classList.add('vote-'+cls);
    el.innerHTML=`<span class="voteIcon ${cls}">${sym}</span><span class="voteText">${label}</span>`;
  }
  function decorateAll(){['mVote','bVote','cVote'].forEach(id=>decorateBadge(document.getElementById(id)))}
  const oldSet=setPersona;
  setPersona=function(prefix,p){oldSet(prefix,p);decorateBadge(document.getElementById(prefix+'Vote'))};
  decorateAll();
  window.MAGI_LAYOUT_FIX=true;
})();