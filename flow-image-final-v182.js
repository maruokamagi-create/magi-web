(()=>{
  const V='182';
  const FILES=Array.from({length:12},(_,i)=>`part${String(i).padStart(2,'0')}.bin`);
  const STYLE_ID='magi-flow-final-v182-style';
  let done=false,busy=false;

  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .magiFlowImageSection{margin-top:20px!important;padding-top:0!important;padding-bottom:0!important;background:transparent!important}
      .magiFlowImageWrap{width:100%;max-width:1100px;margin:0 auto;overflow:visible;background:transparent}
      .magiFlowImage{display:block;width:100%;height:auto;margin:0 auto;object-fit:contain;background:transparent}
      @media(max-width:430px){.magiFlowImageSection{margin-top:18px!important}.magiFlowImageWrap{width:100%;max-width:none}}
    `;
    document.head.appendChild(st);
  }

  const findSection=()=>[...document.querySelectorAll('section.section')].find(s=>{
    const h=s.querySelector('.sectionHead h2,h2');
    return h&&h.textContent.trim()==='MAGIの仕組み';
  })||null;

  const getPart=async file=>{
    const r=await fetch(`/assets/magi-flow-final-bin/${file}?v=${V}`,{cache:'no-store'});
    if(!r.ok) throw new Error(`${file}: ${r.status}`);
    return await r.arrayBuffer();
  };

  const apply=async()=>{
    if(done||busy)return;
    const section=findSection();
    if(!section)return;
    busy=true;
    try{
      const buffers=await Promise.all(FILES.map(getPart));
      const objectUrl=URL.createObjectURL(new Blob(buffers,{type:'image/webp'}));
      const img=new Image();
      img.className='magiFlowImage';
      img.alt='MAGIの仕組み。データ取得、相談分類、3賢人審議、最終判断までの流れ';
      img.decoding='async';
      img.loading='eager';
      await new Promise((res,rej)=>{
        img.onload=res;
        img.onerror=()=>rej(new Error('image decode failed'));
        img.src=objectUrl;
      });
      const wrap=document.createElement('div');
      wrap.className='magiFlowImageWrap';
      wrap.appendChild(img);
      section.className='section magiFlowImageSection';
      section.replaceChildren(wrap);
      done=true;
      setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
    }catch(e){
      console.error('MAGI final image v182',e);
    }finally{busy=false}
  };

  apply();
  let tries=0;
  const timer=setInterval(()=>{
    if(done||tries++>120){clearInterval(timer);return;}
    apply();
  },100);
  new MutationObserver(()=>{if(!done)apply()}).observe(document.documentElement,{subtree:true,childList:true});
})();
