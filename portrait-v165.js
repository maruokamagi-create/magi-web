(async()=>{
  const get=async p=>{const r=await fetch(p+'?v=165',{cache:'no-store'});if(!r.ok)throw new Error(p+' '+r.status);return (await r.text()).trim()};
  const make=async(a,b)=>'data:image/webp;base64,'+(await get(a))+(await get(b));
  const style=document.createElement('style');
  style.id='magi-portrait-v165-style';
  style.textContent=`.persona{background:#0a1b2e!important}.personaPortrait{display:block!important;width:136px!important;max-width:43%!important;height:auto!important;aspect-ratio:1/1!important;object-fit:contain!important;flex:0 0 auto!important;margin:-4px -2px 0 0!important;image-rendering:auto!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.32))!important;border:0!important;background:transparent!important}@media(max-width:430px){.personaPortrait{width:140px!important;max-width:45%!important}}@media(min-width:431px) and (max-width:899px){.personaPortrait{width:168px!important;max-width:40%!important}}`;
  document.head.appendChild(style);
  try{
    const [m,b,c]=await Promise.all([
      make('/assets/portrait-data/melchior-v164-1.txt','/assets/portrait-data/melchior-v165-2.txt'),
      make('/assets/portrait-data/balthasar-v165-1.txt','/assets/portrait-data/balthasar-v165-2.txt'),
      make('/assets/portrait-data/casper-v165-1.txt','/assets/portrait-data/casper-v165-2.txt')
    ]);
    const data=[m,b,c];
    let tries=0;
    const apply=()=>{
      const cards=[...document.querySelectorAll('.persona')];
      if(cards.length>=3){cards.slice(0,3).forEach((card,i)=>{const img=card.querySelector('.personaPortrait');if(img&&img.src!==data[i]){img.src=data[i];img.removeAttribute('srcset');img.style.visibility='visible'}})}
      if(++tries>=30)clearInterval(timer);
    };
    apply();
    const timer=setInterval(apply,100);
  }catch(e){console.error('MAGI portrait v165',e)}
})();