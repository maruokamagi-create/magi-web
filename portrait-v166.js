(async()=>{
  const V='166';
  const get=async p=>{const r=await fetch(p+'?v='+V,{cache:'no-store'});if(!r.ok)throw new Error(p+' '+r.status);return (await r.text()).trim()};
  const make=async p=>'data:image/webp;base64,'+(await get(p));
  const style=document.createElement('style');
  style.id='magi-portrait-v166-style';
  style.textContent=`
    .persona{background:#0a1b2e!important;overflow:visible!important}
    .personaTop{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;min-height:181px!important}
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
    const [m,b,c]=await Promise.all([
      make('/assets/portrait-data-v166/melchior-v166.txt'),
      make('/assets/portrait-data-v166/balthasar-v166.txt'),
      make('/assets/portrait-data-v166/casper-v166.txt')
    ]);
    const data=[m,b,c];
    let tries=0;
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
            img.style.visibility='visible';
            img.decoding='async';
          }
        });
      }
      if(++tries>=60)clearInterval(timer);
    };
    apply();
    const timer=setInterval(apply,100);
  }catch(e){console.error('MAGI portrait v166',e)}
})();
