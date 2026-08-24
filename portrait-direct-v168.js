(()=>{
  const V='168';
  const defs=[
    ['MELCHIOR','/assets/portraits/melchior.png?v='+V],
    ['BALTHASAR','/assets/portraits/balthasar.png?v='+V],
    ['CASPER','/assets/portraits/casper.png?v='+V]
  ];
  const style=document.createElement('style');
  style.id='magi-portrait-direct-v168-style';
  style.textContent=`
    .persona{overflow:hidden!important}
    .personaTop{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;margin-bottom:8px!important}
    .personaMeta{min-width:0!important;flex:1 1 auto!important}
    .personaPortrait{display:block!important;width:158px!important;height:auto!important;max-width:46%!important;object-fit:contain!important;object-position:center top!important;align-self:flex-start!important;flex:0 0 auto!important;margin:-22px -2px 0 0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;image-rendering:auto!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.28))!important}
    @media(max-width:430px){.personaPortrait{width:158px!important;max-width:46%!important;margin-top:-22px!important}}
    @media(min-width:431px) and (max-width:899px){.personaPortrait{width:184px!important;max-width:42%!important;margin-top:-24px!important}}
    @media(min-width:900px){.personaPortrait{width:164px!important;max-width:44%!important;margin-top:-22px!important}}
  `;
  document.head.appendChild(style);
  let tries=0;
  const apply=()=>{
    const imgs=[...document.querySelectorAll('img.personaPortrait')];
    if(imgs.length>=3){
      defs.forEach(([alt,src],i)=>{
        const img=imgs[i]; if(!img)return;
        img.src=src; img.alt=alt; img.removeAttribute('srcset'); img.removeAttribute('width'); img.removeAttribute('height'); img.decoding='async';
      });
    }
    if(++tries<60)setTimeout(apply,100);
  };
  apply();
})();