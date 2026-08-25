(()=>{
  const V='171';
  const portraits=[
    {file:'melchior',alt:'MELCHIOR'},
    {file:'balthasar',alt:'BALTHASAR'},
    {file:'casper',alt:'CASPER'}
  ];

  if(!document.getElementById('magi-persona-png-fix-v171-style')){
    const st=document.createElement('style');
    st.id='magi-persona-png-fix-v171-style';
    st.textContent=`
      .personaGrid .personaPortrait{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        width:131px!important;
        height:163px!important;
        max-width:40%!important;
        margin:8px 4px 0 0!important;
      }
      @media(min-width:431px) and (max-width:899px){
        .personaGrid .personaPortrait{
          width:151px!important;
          height:189px!important;
          max-width:38%!important;
        }
      }
      @media(min-width:900px){
        .personaGrid .personaPortrait{
          width:137px!important;
          height:171px!important;
          max-width:40%!important;
        }
      }
    `;
    document.head.appendChild(st);
  }

  const apply=()=>{
    const grid=document.querySelector('.personaGrid');
    if(!grid)return false;
    const cards=[...grid.querySelectorAll('.persona')].slice(0,3);
    if(cards.length<3)return false;

    cards.forEach((card,i)=>{
      let top=card.querySelector('.personaTop');
      if(!top)return;
      let img=top.querySelector('.personaPortrait');
      if(!img){
        img=document.createElement('img');
        img.className='personaPortrait';
        top.appendChild(img);
      }
      const want=`/portraits/${portraits[i].file}.png?v=${V}`;
      if(!img.getAttribute('src') || !img.getAttribute('src').includes(`/portraits/${portraits[i].file}.png`)){
        img.src=want;
      }
      img.removeAttribute('srcset');
      img.alt=portraits[i].alt;
      img.dataset.portraitVersion='png-'+V;
      img.decoding='async';
    });
    return true;
  };

  let busy=false;
  const safeApply=()=>{
    if(busy)return;
    busy=true;
    try{apply();}finally{setTimeout(()=>{busy=false},0)}
  };

  safeApply();
  let count=0;
  const timer=setInterval(()=>{
    safeApply();
    count++;
    if(count>=150)clearInterval(timer);
  },100);

  const observer=new MutationObserver(()=>safeApply());
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  window.addEventListener('load',safeApply,{once:true});
})();
