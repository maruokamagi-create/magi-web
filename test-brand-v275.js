(()=>{
  'use strict';
  const PAGE_TITLE='MAGI-WEB テスト版';
  document.title=PAGE_TITLE;

  const ensureStyle=()=>{
    if(document.getElementById('magi-test-brand-v275-style')) return;
    const style=document.createElement('style');
    style.id='magi-test-brand-v275-style';
    style.textContent='.hero .free{white-space:nowrap!important;word-break:keep-all!important}';
    document.head.appendChild(style);
  };

  const apply=()=>{
    ensureStyle();

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
