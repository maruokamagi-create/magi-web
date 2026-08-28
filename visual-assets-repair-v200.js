(()=>{
  'use strict';
  const VERSION='200';
  const portraits=['melchior','balthasar','casper'];

  const ensureStyle=()=>{
    if(document.getElementById('magi-visual-assets-repair-style')) return;
    const st=document.createElement('style');
    st.id='magi-visual-assets-repair-style';
    st.textContent=`
      .magiTitleRow{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important}
      .magiBrandLockup{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important}
      .magiBrandSymbol{display:block!important;visibility:visible!important;opacity:1!important;width:46px!important;height:46px!important;flex:0 0 46px!important;object-fit:contain!important}
      .magiBrandCopy{display:block!important;min-width:0!important;line-height:1.18!important}
      .magiBrandEn,.magiBrandCatch{display:block!important;visibility:visible!important;opacity:1!important;color:#dbe7f4!important;white-space:nowrap!important}
      .magiBrandEn{font-size:8.7px!important}.magiBrandCatch{font-size:8.7px!important;margin-top:3px!important}
      .personaTop{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important}
      .personaMeta{min-width:0!important;flex:1 1 auto!important}
      .personaGrid .personaPortrait{display:block!important;visibility:visible!important;opacity:1!important;width:131px!important;height:163px!important;max-width:40%!important;flex:0 0 auto!important;object-fit:contain!important;object-position:center top!important;margin:8px 4px 0 0!important;background:transparent!important;border:0!important;filter:drop-shadow(0 8px 14px rgba(0,0,0,.28))!important}
      @media(min-width:431px){.magiBrandSymbol{width:54px!important;height:54px!important;flex-basis:54px!important}.magiBrandEn{font-size:11.5px!important}.magiBrandCatch{font-size:11px!important}.personaGrid .personaPortrait{width:151px!important;height:189px!important;max-width:38%!important}}
    `;
    document.head.appendChild(st);
  };

  const repair=()=>{
    ensureStyle();
    let ok=true;
    const hero=document.querySelector('.hero');
    const h1=hero&&hero.querySelector('h1');
    if(!hero||!h1){ok=false;} else {
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
      let logo=lock.querySelector('.magiBrandSymbol');
      if(!logo){
        logo=document.createElement('img');
        logo.className='magiBrandSymbol';
        logo.alt='MAGI 公式3色シンボル';
        lock.prepend(logo);
      }
      logo.src='/magi-official-symbol-v125.svg?v='+VERSION;
      let copy=lock.querySelector('.magiBrandCopy');
      if(!copy){
        copy=document.createElement('div');
        copy.className='magiBrandCopy';
        copy.innerHTML='<div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div>';
        lock.appendChild(copy);
      }
    }

    const grid=document.querySelector('.personaGrid');
    const cards=grid?[...grid.querySelectorAll('.persona')].slice(0,3):[];
    if(cards.length<3){ok=false;} else {
      cards.forEach((card,i)=>{
        let top=card.querySelector('.personaTop');
        if(!top){
          const first=card.firstElementChild;
          top=document.createElement('div');
          top.className='personaTop';
          const meta=document.createElement('div');
          meta.className='personaMeta';
          while(card.firstChild && card.firstChild!==first?.nextSibling){break;}
          // Preserve all existing text: wrap the heading block only when possible.
          const num=card.querySelector('.num');
          const h3=card.querySelector('h3');
          const role=card.querySelector('.role');
          [num,h3,role].forEach(n=>{if(n)meta.appendChild(n)});
          top.appendChild(meta);
          card.insertBefore(top,card.firstChild);
        }
        let img=top.querySelector('.personaPortrait');
        if(!img){
          img=document.createElement('img');
          img.className='personaPortrait';
          top.appendChild(img);
        }
        img.alt=portraits[i].toUpperCase();
        img.src='/portraits/'+portraits[i]+'.png?v='+VERSION;
      });
    }
    return ok;
  };

  let tries=0;
  const timer=setInterval(()=>{
    repair();
    tries++;
    if(tries>=120) clearInterval(timer);
  },100);
  repair();
  window.addEventListener('load',repair,{once:true});
})();
