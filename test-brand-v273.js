(()=>{
  'use strict';
  const LABEL='MAGI-WEB テスト版';
  const apply=()=>{
    if(document.title!==LABEL) document.title=LABEL;
    const authTitle=document.querySelector('.magiAuthBrand strong');
    if(authTitle && authTitle.textContent!==LABEL) authTitle.textContent=LABEL;
    const heroTitle=document.querySelector('.hero h1');
    if(heroTitle && heroTitle.textContent!==LABEL) heroTitle.textContent=LABEL;
  };
  apply();
  const root=document.body||document.documentElement;
  const observer=new MutationObserver(apply);
  observer.observe(root,{childList:true,subtree:true});
  window.addEventListener('load',()=>{apply();setTimeout(()=>observer.disconnect(),3000)},{once:true});
  setTimeout(()=>observer.disconnect(),8000);
})();
