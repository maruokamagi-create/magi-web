(async()=>{
  const get=async p=>{const r=await fetch(p+'?v=166',{cache:'no-store'});if(!r.ok)throw new Error(p+' '+r.status);return (await r.text()).trim()};
  const make=async(a,b)=>'data:image/webp;base64,'+(await get(a))+(await get(b));
  const style=document.createElement('style');
  style.id='magi-portrait-v166-style';
  style.textContent=`
    .persona{background:#0a1b2e!important;overflow:hidden!important}
    .personaTop{position:relative!important;min-height:190px!important;align-items:flex-start!important}
    .personaMeta{position:relative!important;z-index:2!important;padding-right:150px!important}
    .personaPortrait{
      display:block!important;position:absolute!important;z-index:1!important;
      right:-4px!important;bottom:-10px!important;
      width:172px!important;height:215px!important;max-width:none!important;
      object-fit:contain!important;object-position:center bottom!important;
      margin:0!important;border:0!important;background:transparent!important;
      image-rendering:auto!important;
      filter:drop-shadow(0 10px 16px rgba(0,0,0,.30))!important;
    }
    @media(max-width:430px){
      .personaTop{min-height:184px!important}
      .personaMeta{padding-right:142px!important}
      .personaPortrait{width:164px!important;height:205px!important;right:-7px!important;bottom:-9px!important}
    }
    @media(min-width:431px) and (max-width:899px){
      .personaTop{min-height:218px!important}
      .personaMeta{padding-right:185px!important}
      .personaPortrait{width:205px!important;height:256px!important;right:0!important;bottom:-12px!important}
    }
  `;
  document.head.appendChild(style);
  try{
    const [m,b,c]=await Promise.all([
      make('/assets/portrait-data/melchior-v164-1.txt','/assets/portrait-data/melchior-v165-2.txt'),
      make('/assets/portrait-data/balthasar-v165-1.txt','/assets/portrait-data/balthasar-v165-2.txt'),
      make('/assets/portrait-data/casper-v165-1.txt','/assets/portrait-data/casper-v165-2.txt')
    ]);
    const data=[m,b,c];
    let tries=0,timer;
    const apply=()=>{
      const cards=[...document.querySelectorAll('.persona')];
      if(cards.length>=3){cards.slice(0,3).forEach((card,i)=>{const img=card.querySelector('.personaPortrait');if(img){img.src=data[i];img.removeAttribute('srcset');img.style.visibility='visible'}})}
      if(++tries>=40&&timer)clearInterval(timer);
    };
    apply();timer=setInterval(apply,100);
  }catch(e){console.error('MAGI portrait v166',e)}
})();