(()=>{
  const STYLE=`
.melchiorCard{position:relative!important;overflow:hidden}
.melchiorTop{display:flex;align-items:flex-start;justify-content:space-between;gap:4px;margin:0 0 8px;min-height:145px}
.melchiorMeta{flex:1 1 auto;min-width:0;padding-top:2px}
.melchiorPortrait{display:block;width:138px;max-width:44%;height:auto;align-self:flex-start;flex:0 0 auto;pointer-events:none;filter:drop-shadow(0 8px 14px rgba(0,0,0,.38));margin:-6px -6px -9px 0}
@media(max-width:430px){
  .melchiorTop{min-height:149px;gap:0;margin-bottom:8px}
  .melchiorPortrait{width:144px;max-width:46%;margin:-7px -7px -10px -3px}
}
@media(min-width:431px) and (max-width:899px){
  .melchiorTop{min-height:195px}
  .melchiorPortrait{width:204px;max-width:42%;margin:-9px -6px -13px 0}
}
@media(min-width:900px){
  .melchiorTop{min-height:143px}
  .melchiorPortrait{width:132px;max-width:44%;margin:-7px -6px -10px -3px}
}
`;

  if(!document.getElementById('magi-melchior-v138-style')){
    const st=document.createElement('style');
    st.id='magi-melchior-v138-style';
    st.textContent=STYLE;
    document.head.appendChild(st);
  }

  const apply=()=>{
    const card=document.querySelector('.personaGrid .persona');
    if(!card)return false;
    if(card.dataset.melchiorV138==='1')return true;

    const num=card.querySelector(':scope > .num');
    const h3=card.querySelector(':scope > h3');
    const role=card.querySelector(':scope > .role');
    const axis=card.querySelector(':scope > .personaAxis');
    if(!num||!h3||!role||!axis)return false;

    card.classList.add('melchiorCard');
    const top=document.createElement('div');
    top.className='melchiorTop';

    const meta=document.createElement('div');
    meta.className='melchiorMeta';
    [num,h3,role,axis].forEach(n=>meta.appendChild(n));

    const img=document.createElement('img');
    img.className='melchiorPortrait';
    img.alt='MELCHIOR';
    img.decoding='async';
    img.src='/assets/melchior.webp?v=138';

    top.append(meta,img);
    card.insertBefore(top,card.firstChild);
    card.dataset.melchiorV138='1';
    return true;
  };

  let n=0;
  const t=setInterval(()=>{if(apply()||++n>=100)clearInterval(t)},100);
  window.addEventListener('load',()=>setTimeout(apply,200));
})();
