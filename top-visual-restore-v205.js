(()=>{
  const V='205';
  const PORTRAITS=[
    ['/portraits/melchior.png?v='+V,'MELCHIOR'],
    ['/portraits/balthasar.png?v='+V,'BALTHASAR'],
    ['/portraits/casper.png?v='+V,'CASPER']
  ];

  const ensureStyle=()=>{
    if(document.getElementById('magi-top-visual-restore-v205-style'))return;
    const st=document.createElement('style');
    st.id='magi-top-visual-restore-v205-style';
    st.textContent=`
      .magiTitleRow{display:flex!important;align-items:center!important;gap:8px!important;margin:8px 0 10px!important;min-width:0!important}
      .magiTitleRow .magiMainTitle{margin:0!important;flex:0 0 auto!important;line-height:1!important;font-size:42px!important;letter-spacing:.08em!important}
      .magiBrandLockup{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important}
      .magiBrandSymbol{width:54px!important;height:54px!important;display:block!important;flex:0 0 auto!important;object-fit:contain!important}
      .magiBrandCopy{min-width:0!important;line-height:1.18!important}
      .magiBrandEn{font-size:11.5px!important;font-weight:600!important;color:#dbe7f4!important;white-space:nowrap!important}
      .magiBrandCatch{margin-top:4px!important;font-size:11px!important;font-weight:600!important;color:#dbe7f4!important;white-space:nowrap!important}

      .personaGrid .persona{overflow:hidden!important}
      .personaGrid .personaTop{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;min-height:163px!important;margin-bottom:8px!important}
      .personaGrid .personaMeta{min-width:0!important;flex:1 1 auto!important}
      .personaGrid .personaPortrait{display:block!important;visibility:visible!important;opacity:1!important;width:131px!important;height:163px!important;max-width:40%!important;object-fit:contain!important;object-position:center bottom!important;flex:0 0 auto!important;margin:8px 4px 0 0!important;border:0!important;background:transparent!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.30))!important}

      @media(max-width:430px){
        .magiTitleRow{gap:6px!important;margin:8px 0 10px!important}
        .magiTitleRow .magiMainTitle{font-size:34px!important;letter-spacing:.05em!important}
        .magiBrandLockup{gap:4px!important}
        .magiBrandSymbol{width:46px!important;height:46px!important}
        .magiBrandEn,.magiBrandCatch{font-size:8.7px!important;letter-spacing:-.015em!important}
        .magiBrandCatch{margin-top:3px!important}
        .personaGrid .personaTop{min-height:163px!important}
        .personaGrid .personaPortrait{width:131px!important;height:163px!important;max-width:40%!important}
      }
      @media(min-width:431px) and (max-width:899px){
        .personaGrid .personaTop{min-height:189px!important}
        .personaGrid .personaPortrait{width:151px!important;height:189px!important;max-width:38%!important}
      }
      @media(min-width:900px){
        .personaGrid .personaTop{min-height:171px!important}
        .personaGrid .personaPortrait{width:137px!important;height:171px!important;max-width:40%!important}
      }
    `;
    document.head.appendChild(st);
  };

  const restoreBrand=()=>{
    const hero=document.querySelector('.hero');
    if(!hero)return false;
    const h1=hero.querySelector('h1');
    if(!h1)return false;
    h1.classList.add('magiMainTitle');
    let row=h1.closest('.magiTitleRow');
    if(!row){
      row=document.createElement('div');
      row.className='magiTitleRow';
      h1.parentNode.insertBefore(row,h1);
      row.appendChild(h1);
    }
    let lock=row.querySelector('.magiBrandLockup');
    if(!lock){
      lock=document.createElement('div');
      lock.className='magiBrandLockup';
      row.appendChild(lock);
    }
    lock.innerHTML='<img class="magiBrandSymbol" src="/magi-official-symbol-v125.svg?v='+V+'" alt="MAGI"><div class="magiBrandCopy"><div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div></div>';
    return true;
  };

  const restorePersonas=()=>{
    const grid=document.querySelector('.personaGrid');
    if(!grid)return false;
    const cards=[...grid.querySelectorAll('.persona')].slice(0,3);
    if(cards.length<3)return false;
    cards.forEach((card,i)=>{
      let top=card.querySelector(':scope > .personaTop');
      if(!top){
        const num=card.querySelector(':scope > .num');
        const h3=card.querySelector(':scope > h3');
        const role=card.querySelector(':scope > .role');
        const axis=card.querySelector(':scope > .personaAxis');
        if(!num||!h3||!role)return;
        top=document.createElement('div');
        top.className='personaTop';
        const meta=document.createElement('div');
        meta.className='personaMeta';
        [num,h3,role,axis].filter(Boolean).forEach(n=>meta.appendChild(n));
        const img=document.createElement('img');
        img.className='personaPortrait';
        img.decoding='async';
        top.append(meta,img);
        card.insertBefore(top,card.firstChild);
      }
      let img=top.querySelector('.personaPortrait');
      if(!img){
        img=document.createElement('img');
        img.className='personaPortrait';
        img.decoding='async';
        top.appendChild(img);
      }
      const [src,alt]=PORTRAITS[i];
      if(!img.src.includes('/portraits/'+['melchior','balthasar','casper'][i]+'.png'))img.src=src;
      img.alt=alt;
      img.removeAttribute('srcset');
    });
    return true;
  };

  const apply=()=>{
    ensureStyle();
    const a=restoreBrand();
    const b=restorePersonas();
    return a&&b;
  };

  let tries=0;
  const timer=setInterval(()=>{
    if(apply()||++tries>=80)clearInterval(timer);
  },100);
  apply();
  window.addEventListener('load',()=>setTimeout(apply,150),{once:true});
})();