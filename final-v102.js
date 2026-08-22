(()=>{
  const css=`
  .final{position:relative;margin-top:0;padding:20px 18px 19px;border:1px solid #355a7d;border-top:4px solid #4db8d8;border-radius:0 0 16px 16px;background:linear-gradient(145deg,#071a34 0%,#0a2240 100%);box-shadow:none}
  .final::before{display:none}
  .final .title{font-size:12px;letter-spacing:.16em;color:#9dbbd7;font-weight:800}
  .final .verdict{margin:8px 0 12px;padding:0 0 9px;border-radius:0;font-size:31px;line-height:1.15;font-weight:900;letter-spacing:.02em;background:transparent;color:#fff;border:0;border-bottom:1px solid rgba(77,184,216,.55);box-shadow:none}
  .final .verdict::before{display:inline-block;margin-right:.35em;font-size:.70em;line-height:1;vertical-align:.08em;font-weight:900;letter-spacing:.08em}
  .final .votes{margin-top:8px;gap:8px}.final .vote{font-size:11px;padding:7px 10px;border-color:#355674;background:#061426}
  .final .note{font-size:12px;line-height:1.75;color:#cbd9e7}.final .humanDecision{font-size:12px;line-height:1.7;color:#eef5fb}
  .final.decision-yes{border-top-color:#20c779}.final.decision-yes .verdict{border-bottom-color:rgba(32,199,121,.55)}.final.decision-yes .verdict::before{content:'● ◎';color:#20c779}
  .final.decision-cond{border-top-color:#2f86ff}.final.decision-cond .verdict{border-bottom-color:rgba(47,134,255,.58)}.final.decision-cond .verdict::before{content:'● ○';color:#2f86ff}
  .final.decision-hold{border-top-color:#f2b91d}.final.decision-hold .verdict{border-bottom-color:rgba(242,185,29,.58)}.final.decision-hold .verdict::before{content:'● △';color:#f2b91d}
  .final.decision-no{border-top-color:#e04452}.final.decision-no .verdict{border-bottom-color:rgba(224,68,82,.58)}.final.decision-no .verdict::before{content:'● ×';color:#e04452}
  @media(max-width:430px){.final{padding:19px 14px 18px}.final .verdict{font-size:29px;padding-bottom:8px}.final .verdict::before{font-size:.68em;margin-right:.3em}.final .title{font-size:11px}.final .vote{font-size:11px;padding:7px 9px}.final .note,.final .humanDecision{font-size:12px}}
  `;
  const old=document.getElementById('magi-final-v102-style');if(old)old.remove();
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