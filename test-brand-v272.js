(()=>{
  'use strict';
  const LABEL='MAGI-WEB テスト版';
  document.title=LABEL;

  const apply=()=>{
    const heroTitle=document.querySelector('.hero h1');
    if(heroTitle) heroTitle.textContent='MAGI';

    const kicker=document.querySelector('.hero .kicker');
    if(kicker && kicker.firstChild && kicker.firstChild.nodeType===Node.TEXT_NODE){
      kicker.firstChild.nodeValue='MAGI-WEB テスト版 / FREE CORE ';
    }

    const authTitle=document.querySelector('.magiAuthBrand strong');
    if(authTitle) authTitle.textContent='MAGI-WEB テスト版';

    return !!heroTitle;
  };

  if(!apply()){
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(apply() || tries>=50) clearInterval(timer);
    },100);
  }
})();
