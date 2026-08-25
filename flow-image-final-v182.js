(()=>{
  const applyMagiFlow=()=>{
    const section=[...document.querySelectorAll('section.section')].find(s=>{
      const h=s.querySelector('.sectionHead h2,h2');
      return h&&h.textContent.trim()==='MAGIの仕組み';
    });
    if(!section||!window.MAGI_FLOW_DATA) return false;
    if(section.dataset.magiFlowApplied==='1') return true;
    section.dataset.magiFlowApplied='1';
    section.innerHTML='';
    section.style.padding='0';
    section.style.background='transparent';
    section.style.border='0';
    const img=document.createElement('img');
    img.src=window.MAGI_FLOW_DATA;
    img.alt='MAGIの仕組み';
    img.style.display='block';
    img.style.width='100%';
    img.style.height='auto';
    img.style.borderRadius='0';
    img.style.margin='0';
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