(()=>{
  'use strict';
  const LABEL='MAGI-WEB テスト版';
  const apply=()=>{
    document.title=LABEL;
    const authTitle=document.querySelector('.magiAuthBrand strong');
    if(authTitle && authTitle.textContent!==LABEL) authTitle.textContent=LABEL;
    const heroTitle=document.querySelector('.hero h1');
    if(heroTitle && heroTitle.textContent!==LABEL) heroTitle.textContent=LABEL;
  };
  apply();
  const observer=new MutationObserver(apply);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',apply,{once:true});
})();
