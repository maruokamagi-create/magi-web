(()=>{
  const V='172';
  const STYLE_ID='magi-flow-image-v172-style';
  const PARTS=8;
  let done=false;
  let busy=false;

  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .magiFlowImageSection{margin-top:20px!important}
      .magiFlowImageWrap{width:100%;max-width:1100px;margin:0 auto;overflow:hidden}
      .magiFlowImage{display:block;width:100%;height:auto;margin:0 auto;object-fit:contain}
      @media(max-width:430px){
        .magiFlowImageSection{margin-top:18px!important}
        .magiFlowImageWrap{width:100%}
      }
    `;
    document.head.appendChild(st);
  }

  const findSection=()=>{
    const sections=[...document.querySelectorAll('section.section')];
    return sections.find(section=>{
      const h2=section.querySelector('.sectionHead h2,h2');
      return h2&&h2.textContent.trim()==='MAGIの仕組み';
    })||null;
  };

  const getPart=async i=>{
    const name=String(i).padStart(2,'0');
    const r=await fetch(`/assets/magi-flow-v172/part${name}.txt?v=${V}`);
    if(!r.ok)throw new Error(`MAGI flow image part${name}: ${r.status}`);
    return (await r.text()).trim();
  };

  const apply=async()=>{
    if(done||busy)return;
    const section=findSection();
    if(!section)return;
    busy=true;
    const original=section.innerHTML;
    section.setAttribute('aria-busy','true');
    try{
      const parts=await Promise.all(Array.from({length:PARTS},(_,i)=>getPart(i)));
      const src='data:image/avif;base64,'+parts.join('');
      const img=new Image();
      img.className='magiFlowImage';
      img.alt='MAGIの仕組み。データ取得、相談分類、3賢人審議、最終判断までの流れ';
      img.decoding='async';
      img.loading='eager';
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(new Error('MAGI flow image decode failed'));
        img.src=src;
      });
      const wrap=document.createElement('div');
      wrap.className='magiFlowImageWrap';
      wrap.appendChild(img);
      section.className='section magiFlowImageSection';
      section.innerHTML='';
      section.appendChild(wrap);
      section.removeAttribute('aria-busy');
      done=true;
    }catch(e){
      section.innerHTML=original;
      section.removeAttribute('aria-busy');
      console.error('MAGI flow image v172',e);
    }finally{
      busy=false;
    }
  };

  apply();
  let tries=0;
  const timer=setInterval(()=>{
    if(done||tries++>120){clearInterval(timer);return;}
    apply();
  },100);

  const observer=new MutationObserver(()=>{if(!done)apply();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
