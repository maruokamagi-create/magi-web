(async()=>{
  const parts=[];
  for(let i=0;i<5;i++){
    const r=await fetch('/assets/melchior-v134-'+i+'.txt?v=135',{cache:'no-store'});
    if(!r.ok)throw new Error('portrait chunk '+i+' '+r.status);
    const t=await r.text();
    parts.push(t.replace(/[^A-Za-z0-9+/=]/g,''));
  }
  const S='data:image/webp;base64,'+parts.join('');
  const STYLE=`
.melchiorCard{position:relative!important;overflow:hidden}
.melchiorTop{display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin:0 0 10px;min-height:186px}
.melchiorMeta{flex:1 1 auto;min-width:0;padding-top:2px}
.melchiorPortrait{display:block;width:184px;max-width:52%;height:auto;align-self:flex-start;flex:0 0 auto;pointer-events:none;filter:drop-shadow(0 10px 18px rgba(0,0,0,.38));opacity:1;margin:-8px -8px -12px 0}
@media(max-width:430px){
  .melchiorTop{min-height:198px;gap:0;margin-bottom:8px}
  .melchiorPortrait{width:192px;max-width:55%;margin:-10px -10px -14px -4px}
}
@media(min-width:431px) and (max-width:899px){
  .melchiorTop{min-height:260px}
  .melchiorPortrait{width:272px;max-width:48%;margin:-12px -8px -18px 0}
}
@media(min-width:900px){
  .melchiorTop{min-height:190px}
  .melchiorPortrait{width:176px;max-width:52%;margin:-10px -8px -14px -4px}
}
`;
  const install=()=>{
    if(!document.getElementById('magi-melchior-v135-style')){
      const st=document.createElement('style');
      st.id='magi-melchior-v135-style';
      st.textContent=STYLE;
      document.head.appendChild(st);
    }
  };
  const apply=()=>{
    const card=document.querySelector('.personaGrid .persona');
    if(!card)return false;
    if(card.dataset.melchiorV135==='1')return true;
    const num=card.querySelector(':scope > .num');
    const h3=card.querySelector(':scope > h3');
    const role=card.querySelector(':scope > .role');
    const axis=card.querySelector(':scope > .personaAxis');
    if(!num||!h3||!role||!axis)return false;
    install();
    card.classList.add('melchiorCard');
    const top=document.createElement('div');top.className='melchiorTop';
    const meta=document.createElement('div');meta.className='melchiorMeta';
    [num,h3,role,axis].forEach(n=>meta.appendChild(n));
    const img=document.createElement('img');
    img.className='melchiorPortrait';
    img.alt='MELCHIOR';
    img.decoding='async';
    img.src=S;
    top.append(meta,img);
    card.insertBefore(top,card.firstChild);
    card.dataset.melchiorV135='1';
    return true;
  };
  install();
  const probe=new Image();
  probe.onload=()=>{
    let n=0;
    const t=setInterval(()=>{if(apply()||++n>=100)clearInterval(t)},100);
    window.addEventListener('load',()=>setTimeout(apply,200));
  };
  probe.onerror=()=>console.error('MELCHIOR portrait image decode failed');
  probe.src=S;
})().catch(e=>console.error('MELCHIOR portrait v135',e));
