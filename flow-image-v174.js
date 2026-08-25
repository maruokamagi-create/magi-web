(()=>{
  const V='174';
  const STYLE_ID='magi-flow-image-v174-style';
  let done=false,busy=false;
  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');
    st.id=STYLE_ID;
    st.textContent=`
      .magiFlowImageSection{margin-top:20px!important;background:transparent!important}
      .magiFlowImageWrap{width:100%;max-width:1100px;margin:0 auto;overflow:visible;background:transparent}
      .magiFlowImage{display:block;width:100%;height:auto;margin:0 auto;object-fit:contain;background:transparent}
      @media(max-width:430px){.magiFlowImageSection{margin-top:18px!important}.magiFlowImageWrap{width:100%;max-width:none}}
    `;
    document.head.appendChild(st);
  }
  const findSection=()=>[...document.querySelectorAll('section.section')].find(s=>{const h=s.querySelector('.sectionHead h2,h2');return h&&h.textContent.trim()==='MAGIの仕組み'})||null;
  const apply=async()=>{
    if(done||busy)return;
    const section=findSection();
    if(!section)return;
    busy=true;
    const original=section.innerHTML;
    section.setAttribute('aria-busy','true');
    try{
      const img=new Image();
      img.className='magiFlowImage';
      img.alt='MAGIの仕組み。データ取得、相談分類、3賢人審議、最終判断までの流れ';
      img.decoding='async';
      img.loading='eager';
      await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('image decode failed'));img.src=`/assets/magi-flow-v174/magi-flow.avif?v=${V}`});
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
      console.error('MAGI flow image v174',e);
    }finally{busy=false}
  };
  apply();
  let tries=0;
  const timer=setInterval(()=>{if(done||tries++>120){clearInterval(timer);return}apply()},100);
  new MutationObserver(()=>{if(!done)apply()}).observe(document.documentElement,{subtree:true,childList:true});
})();
