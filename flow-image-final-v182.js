(()=>{
  const applyMagiFlow=()=>{
    const section=[...document.querySelectorAll('section.section')].find(s=>{
      const h=s.querySelector('.sectionHead h2,h2');
      return h&&h.textContent.trim()==='MAGIの仕組み';
    });
    if(!section) return false;
    if(section.dataset.magiFlowApplied==='1') return true;
    const img=document.createElement('img');
    img.alt='MAGIの仕組み';
    img.decoding='async';
    img.loading='eager';
    img.style.display='block';
    img.style.width='100%';
    img.style.height='auto';
    img.style.margin='0';
    img.onload=()=>{ section.dataset.magiFlowApplied='1'; };
    img.onerror=()=>{ section.dataset.magiFlowApplied=''; };
    img.src='/assets/magi-flow-transparent.png';
    section.innerHTML='';
    section.style.padding='0';
    section.style.background='transparent';
    section.style.border='0';
    section.appendChild(img);
    return true;
  };
  let tries=0;
  const timer=setInterval(()=>{
    if(applyMagiFlow()||++tries>=300) clearInterval(timer);
  },100);
  const observer=new MutationObserver(()=>applyMagiFlow());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>observer.disconnect(),30000);
})();