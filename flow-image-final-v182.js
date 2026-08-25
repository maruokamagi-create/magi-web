(()=>{
  const removeMagiFlow=()=>{
    const section=[...document.querySelectorAll('section.section')].find(s=>{
      const h=s.querySelector('.sectionHead h2,h2');
      return h&&h.textContent.trim()==='MAGIの仕組み';
    });
    if(section) section.remove();
  };

  removeMagiFlow();

  const observer=new MutationObserver(removeMagiFlow);
  observer.observe(document.documentElement,{subtree:true,childList:true});

  let tries=0;
  const timer=setInterval(()=>{
    removeMagiFlow();
    if(++tries>=300){
      clearInterval(timer);
      observer.disconnect();
    }
  },100);
})();
