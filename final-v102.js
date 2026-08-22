(()=>{
  const css=`
  .final{position:relative;margin-top:0;padding:24px 20px 22px;border:2px solid #5f8fb8;border-top:7px solid #4db8d8;border-radius:0 0 18px 18px;background:linear-gradient(145deg,#071a34 0%,#0b2a50 100%);box-shadow:0 14px 34px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06)}
  .final::before{content:'FINAL DECISION';display:inline-block;margin-bottom:8px;padding:5px 9px;border-radius:999px;background:rgba(77,184,216,.14);border:1px solid rgba(77,184,216,.45);color:#bfefff;font-size:10px;font-weight:900;letter-spacing:.16em}
  .final .title{font-size:13px;letter-spacing:.16em;color:#a9cbe8;font-weight:800}
  .final .verdict{margin:10px 0 14px;padding:13px 14px;border-radius:13px;font-size:38px;line-height:1.12;font-weight:950;letter-spacing:.03em;background:#f5f8fc;color:#07172d;border-left:8px solid #4db8d8;box-shadow:0 7px 18px rgba(0,0,0,.18)}
  .final .votes{margin-top:10px;gap:9px}.final .vote{font-size:12px;padding:9px 11px;border-color:#3d6285;background:#06172a}
  .final .note{font-size:13px;line-height:1.8;color:#e0ebf5}.final .humanDecision{font-size:13px;line-height:1.7;color:#fff}
  .final.decision-yes{border-top-color:#20c779}.final.decision-yes .verdict{border-left-color:#20c779;background:#f4fff9}.final.decision-yes::before{color:#bff5d7;border-color:rgba(32,199,121,.48);background:rgba(32,199,121,.13)}
  .final.decision-cond{border-top-color:#2f86ff}.final.decision-cond .verdict{border-left-color:#2f86ff;background:#f5f9ff}.final.decision-cond::before{color:#c9e2ff;border-color:rgba(47,134,255,.48);background:rgba(47,134,255,.13)}
  .final.decision-hold{border-top-color:#f2b91d}.final.decision-hold .verdict{border-left-color:#f2b91d;background:#fffbef}.final.decision-hold::before{color:#ffe8a1;border-color:rgba(242,185,29,.5);background:rgba(242,185,29,.13)}
  .final.decision-no{border-top-color:#e04452}.final.decision-no .verdict{border-left-color:#e04452;background:#fff5f6}.final.decision-no::before{color:#ffc7cd;border-color:rgba(224,68,82,.5);background:rgba(224,68,82,.13)}
  @media(max-width:430px){.final{padding:22px 14px 20px}.final .verdict{font-size:34px;padding:14px 13px}.final .title{font-size:12px}.final .vote{font-size:12px;padding:9px 10px}.final .note,.final .humanDecision{font-size:13px}}
  `;
  const st=document.createElement('style');st.id='magi-final-v102-style';st.textContent=css;document.head.appendChild(st);
  function decorate(){
    const box=document.querySelector('.final'),v=document.querySelector('.final .verdict');if(!box||!v)return;
    box.classList.remove('decision-yes','decision-cond','decision-hold','decision-no');
    const t=(v.textContent||'').trim();
    if(/否決/.test(t))box.classList.add('decision-no');
    else if(/保留/.test(t))box.classList.add('decision-hold');
    else if(/条件付き/.test(t))box.classList.add('decision-cond');
    else if(/可決/.test(t))box.classList.add('decision-yes');
  }
  const target=document.querySelector('.final .verdict');if(target)new MutationObserver(decorate).observe(target,{childList:true,subtree:true,characterData:true});
  decorate();
  window.MAGI_FINAL_EMPHASIS=true;
})();