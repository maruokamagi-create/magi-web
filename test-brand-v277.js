(()=>{
  'use strict';
  const PAGE_TITLE='MAGI-WEB テスト版';
  document.title=PAGE_TITLE;

  const ensureStyle=()=>{
    if(document.getElementById('magi-test-brand-v277-style')) return;
    const style=document.createElement('style');
    style.id='magi-test-brand-v277-style';
    style.textContent=`
      .hero .kicker{
        display:flex!important;
        align-items:center!important;
        flex-wrap:nowrap!important;
        width:100%!important;
        gap:6px!important;
        white-space:nowrap!important;
      }
      .hero .magiEnvLabel{
        white-space:nowrap!important;
        flex:0 1 auto!important;
        min-width:0!important;
      }
      .hero .free{
        margin-left:auto!important;
        white-space:nowrap!important;
        word-break:keep-all!important;
        flex:0 0 auto!important;
      }
      @media(max-width:430px){
        .hero .kicker{font-size:9.5px!important;letter-spacing:.10em!important;gap:4px!important}
        .hero .free{font-size:8px!important;letter-spacing:.06em!important;padding:3px 5px!important}
      }
      @media(max-width:360px){
        .hero .kicker{font-size:8.5px!important;letter-spacing:.07em!important;gap:3px!important}
        .hero .free{font-size:7.2px!important;padding:3px 4px!important}
      }
    `;
    document.head.appendChild(style);
  };

  const apply=()=>{
    ensureStyle();

    const heroTitle=document.querySelector('.hero h1');
    if(heroTitle) heroTitle.textContent='MAGI';

    const kicker=document.querySelector('.hero .kicker');
    if(kicker && !kicker.querySelector('.magiEnvLabel')){
      kicker.innerHTML='<span class="magiEnvLabel">MAGI-WEB テスト版 / FREE CORE</span><span class="free">NO PAID AI API</span>';
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
