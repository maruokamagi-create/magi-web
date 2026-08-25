(()=>{
  const fix=()=>{
    const section=[...document.querySelectorAll('section.section')].find(s=>{
      const h=s.querySelector('.sectionHead h2,h2');
      return h&&h.textContent.trim()==='MAGIの仕組み';
    });
    if(!section)return;
    const svg=section.querySelector('.magiFlowSvgWrap svg');
    if(!svg)return;
    svg.setAttribute('width','1122');
    svg.setAttribute('height','1402');
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.style.display='block';
    svg.style.width='100%';
    svg.style.height='auto';
    svg.style.aspectRatio='1122 / 1402';
    svg.style.minHeight='1px';
    const wrap=section.querySelector('.magiFlowSvgWrap');
    if(wrap){
      wrap.style.width='100%';
      wrap.style.maxWidth='1100px';
      wrap.style.margin='0 auto';
      wrap.style.aspectRatio='1122 / 1402';
    }
  };
  fix();
  let n=0;
  const t=setInterval(()=>{fix();if(n++>100)clearInterval(t)},100);
  new MutationObserver(fix).observe(document.documentElement,{subtree:true,childList:true});
})();
