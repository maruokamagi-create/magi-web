(async()=>{
  const parts=await Promise.all([0,1,2,3,4].map(i=>fetch('/assets/melchior-v134-'+i+'.txt?v=134',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('portrait chunk '+i);return r.text()})));
  const S='data:image/webp;base64,'+parts.join('');
  const STYLE=`
.melchiorCard{position:relative!important;overflow:hidden}
.melchiorTop{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin:0 0 8px}
.melchiorMeta{flex:1 1 auto;min-width:0}
.melchiorPortrait{display:block;width:150px;height:auto;flex:0 0 auto;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.35));opacity:1}
@media(max-width:430px){
  .melchiorTop{gap:4px;margin-bottom:8px}
  .melchiorPortrait{width:160px;margin-right:-4px;margin-top:-4px}
}
@media(min-width:431px) and (max-width:899px){
  .melchiorPortrait{width:220px;margin-right:-2px;margin-top:-4px}
}
@media(min-width:900px){
  .melchiorPortrait{width:150px;margin-right:-4px;margin-top:-4px}
}
`;
  const apply=()=>{
    if(!document.getElementById('magi-melchior-v134-style')){
      const st=document.createElement('style');
      st.id='magi-melchior-v134-style';
      st.textContent=STYLE;
      document.head.appendChild(st);
    }
    const card=document.querySelector('.personaGrid .persona');
    if(!card||card.dataset.melchiorV134==='1')return;
    const num=card.querySelector(':scope > .num');
    const h3=card.querySelector(':scope > h3');
    const role=card.querySelector(':scope > .role');
    const axis=card.querySelector(':scope > .personaAxis');
    if(!num||!h3||!role||!axis)return;
    card.classList.add('melchiorCard');
    const top=document.createElement('div');top.className='melchiorTop';
    const meta=document.createElement('div');meta.className='melchiorMeta';
    [num,h3,role,axis].forEach(n=>meta.appendChild(n));
    const img=document.createElement('img');
    img.className='melchiorPortrait';
    img.alt='MELCHIOR';
    img.src=S;
    top.append(meta,img);
    card.insertBefore(top,card.firstChild);
    card.dataset.melchiorV134='1';
  };
  let n=0;
  const t=setInterval(()=>{apply();if(++n>=50)clearInterval(t)},100);
  window.addEventListener('load',()=>setTimeout(apply,400));
})().catch(e=>console.error('MELCHIOR portrait v134',e));
