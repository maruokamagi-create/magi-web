(()=>{
  'use strict';
  const apply=()=>{
    const card=document.querySelector('.magiAuthCard');
    if(!card) return false;
    const title=card.querySelector('h1');
    const lead=card.querySelector('.magiAuthLead');
    if(title && title.textContent.trim()==='チームアカウントでログイン'){
      title.textContent='MAGI-WEBにログイン';
    }
    if(lead && lead.textContent.includes('Google、またはメールアドレスで本人確認します')){
      lead.textContent='本人確認をしてMAGI-WEBを利用します。初回のみ管理者の承認が必要です。';
    }
    return true;
  };
  if(!apply()){
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(apply() || tries>=80) clearInterval(timer);
    },100);
  }
})();
