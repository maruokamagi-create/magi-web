(()=>{
  const V='173';
  const FILES=['part00.txt','part01.txt','part02a.txt','part02b.txt','part03.txt','part04a.txt','part04b.txt','part05.txt','part06.txt','part07.txt'];
  const STYLE_ID='magi-flow-image-v173-style';
  let done=false,busy=false;
  if(!document.getElementById(STYLE_ID)){
    const st=document.createElement('style');st.id=STYLE_ID;
    st.textContent=`.magiFlowImageSection{margin-top:20px!important}.magiFlowImageWrap{width:100%;max-width:1100px;margin:0 auto;overflow:hidden}.magiFlowImage{display:block;width:100%;height:auto;margin:0 auto;object-fit:contain}@media(max-width:430px){.magiFlowImageSection{margin-top:18px!important}.magiFlowImageWrap{width:100%}}`;
    document.head.appendChild(st);
  }
  const findSection=()=>[...document.querySelectorAll('section.section')].find(s=>{const h=s.querySelector('.sectionHead h2,h2');return h&&h.textContent.trim()==='MAGIの仕組み'})||null;
  const getPart=async file=>{const r=await fetch(`/assets/magi-flow-v173/${file}?v=${V}`,{cache:'no-store'});if(!r.ok)throw new Error(`${file}: ${r.status}`);return (await r.text()).trim()};
  const apply=async()=>{
    if(done||busy)return;const section=findSection();if(!section)return;busy=true;const original=section.innerHTML;section.setAttribute('aria-busy','true');
    try{
      const parts=await Promise.all(FILES.map(getPart));
      const img=new Image();img.className='magiFlowImage';img.alt='MAGIの仕組み。データ取得、相談分類、3賢人審議、最終判断までの流れ';img.decoding='async';img.loading='eager';
      await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(new Error('image decode failed'));img.src='data:image/avif;base64,'+parts.join('')});
      const wrap=document.createElement('div');wrap.className='magiFlowImageWrap';wrap.appendChild(img);section.className='section magiFlowImageSection';section.innerHTML='';section.appendChild(wrap);section.removeAttribute('aria-busy');done=true;
    }catch(e){section.innerHTML=original;section.removeAttribute('aria-busy');console.error('MAGI flow image v173',e)}finally{busy=false}
  };
  apply();let tries=0;const timer=setInterval(()=>{if(done||tries++>120){clearInterval(timer);return}apply()},100);new MutationObserver(()=>{if(!done)apply()}).observe(document.documentElement,{subtree:true,childList:true});
})();
