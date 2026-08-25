(()=>{
  let objectUrl=null;
  const toBlobUrl=(dataUrl)=>{
    const comma=dataUrl.indexOf(',');
    if(comma<0) throw new Error('invalid data url');
    const meta=dataUrl.slice(0,comma);
    const mime=(meta.match(/^data:([^;]+)/)||[])[1]||'image/jpeg';
    const b64=dataUrl.slice(comma+1).replace(/\s+/g,'');
    const bin=atob(b64);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:mime}));
  };
  const applyMagiFlow=()=>{
    const section=[...document.querySelectorAll('section.section')].find(s=>{
      const h=s.querySelector('.sectionHead h2,h2');
      return h&&h.textContent.trim()==='MAGIの仕組み';
    });
    if(!section||!window.MAGI_FLOW_DATA) return false;
    if(section.dataset.magiFlowApplied==='1') return true;
    try{
      objectUrl=toBlobUrl(window.MAGI_FLOW_DATA);
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
      img.src=objectUrl;
      section.innerHTML='';
      section.style.padding='0';
      section.style.background='transparent';
      section.style.border='0';
      section.appendChild(img);
      return true;
    }catch(e){
      console.error('MAGI flow render failed',e);
      return false;
    }
  };
  let tries=0;
  const timer=setInterval(()=>{
    if(applyMagiFlow()||++tries>=300) clearInterval(timer);
  },100);
  const observer=new MutationObserver(()=>applyMagiFlow());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(()=>observer.disconnect(),30000);
})();