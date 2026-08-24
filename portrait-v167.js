(async()=>{
  const V='167';
  const fetchPortrait=async(name)=>{
    const r=await fetch(`/assets/portrait-data-v167/${name}-v167.txt?v=${V}`,{cache:'no-store'});
    if(!r.ok) throw new Error(`${name} ${r.status}`);
    return 'data:image/avif;base64,'+(await r.text()).trim();
  };

  const style=document.createElement('style');
  style.id='magi-portrait-v167-style';
  style.textContent=`
    .persona{background:#0a1b2e!important;overflow:hidden!important}
    .personaTop{
      display:flex!important;
      align-items:flex-start!important;
      justify-content:space-between!important;
      gap:10px!important;
      min-height:181px!important;
      margin-bottom:8px!important;
    }
    .personaMeta{min-width:0!important;flex:1 1 auto!important}
    .personaPortrait{
      display:block!important;
      width:145px!important;
      height:181px!important;
      max-width:45%!important;
      aspect-ratio:4/5!important;
      object-fit:contain!important;
      object-position:center bottom!important;
      flex:0 0 auto!important;
      margin:-2px -2px 0 0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      image-rendering:auto!important;
      filter:drop-shadow(0 8px 14px rgba(0,0,0,.30))!important;
    }
    @media(max-width:430px){
      .personaTop{min-height:181px!important}
      .personaPortrait{width:145px!important;height:181px!important;max-width:45%!important}
    }
    @media(min-width:431px) and (max-width:899px){
      .personaTop{min-height:210px!important}
      .personaPortrait{width:168px!important;height:210px!important;max-width:42%!important}
    }
    @media(min-width:900px){
      .personaTop{min-height:190px!important}
      .personaPortrait{width:152px!important;height:190px!important;max-width:44%!important}
    }
  `;
  document.head.appendChild(style);

  try{
    const data=await Promise.all([
      fetchPortrait('melchior'),
      fetchPortrait('balthasar'),
      fetchPortrait('casper')
    ]);

    let tries=0;
    let timer=null;
    const apply=()=>{
      const cards=[...document.querySelectorAll('.persona')];
      if(cards.length>=3){
        cards.slice(0,3).forEach((card,i)=>{
          const img=card.querySelector('.personaPortrait');
          if(!img)return;
          if(img.dataset.portraitVersion!==V){
            img.src=data[i];
            img.removeAttribute('srcset');
            img.removeAttribute('width');
            img.removeAttribute('height');
            img.dataset.portraitVersion=V;
            img.alt=['MELCHIOR','BALTHASAR','CASPER'][i];
            img.decoding='async';
            img.style.visibility='visible';
          }
        });
      }
      tries++;
      if(tries>=60&&timer)clearInterval(timer);
    };
    apply();
    timer=setInterval(apply,100);
  }catch(e){
    console.error('MAGI portrait v167',e);
  }
})();
