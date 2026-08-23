(()=>{
  const hero=document.querySelector('section.hero');
  if(!hero||hero.dataset.magiBrandV115==='1')return;
  hero.dataset.magiBrandV115='1';

  const style=document.createElement('style');
  style.id='magi-hero-v115-style';
  style.textContent=`
    .magiTitleRow{display:flex;align-items:center;gap:10px;margin:7px 0 8px;min-width:0}
    .magiTitleRow .magiMainTitle{margin:0;flex:0 0 auto;line-height:1;font-size:42px;letter-spacing:.08em}
    .magiBrandLockup{display:flex;align-items:center;gap:7px;min-width:0;transform:translateY(1px)}
    .magiBrandSymbol{width:48px;height:42px;object-fit:contain;display:block;flex:0 0 auto}
    .magiBrandCopy{min-width:0;line-height:1.2}
    .magiBrandEn{font-size:12px;font-weight:500;color:#dbe7f4;white-space:nowrap;letter-spacing:0}
    .magiBrandCatch{margin-top:5px;font-size:12px;font-weight:500;color:#dbe7f4;white-space:nowrap}
    .hero .jp{margin-top:4px}
    @media(max-width:430px){
      .magiTitleRow{gap:8px;margin-top:8px;margin-bottom:10px}
      .magiTitleRow .magiMainTitle{font-size:36px;letter-spacing:.06em}
      .magiBrandLockup{gap:5px}
      .magiBrandSymbol{width:39px;height:36px}
      .magiBrandEn{font-size:10px;letter-spacing:-.01em}
      .magiBrandCatch{font-size:10px;margin-top:4px;letter-spacing:-.01em}
    }
    @media(max-width:360px){
      .magiTitleRow{gap:6px}
      .magiTitleRow .magiMainTitle{font-size:33px}
      .magiBrandLockup{gap:4px}
      .magiBrandSymbol{width:34px;height:32px}
      .magiBrandEn,.magiBrandCatch{font-size:9px}
    }
  `;
  document.head.appendChild(style);

  const h1=hero.querySelector('h1');
  if(h1){
    h1.classList.add('magiMainTitle');
    const row=document.createElement('div');
    row.className='magiTitleRow';
    h1.parentNode.insertBefore(row,h1);
    row.appendChild(h1);

    const lockup=document.createElement('div');
    lockup.className='magiBrandLockup';
    lockup.innerHTML=`<img class="magiBrandSymbol" src="https://drive.google.com/uc?export=view&id=1wgDVi8YkU7TZEECswhlhJB2RRVofI6Rr" alt="MAGI 公式3色シンボル"><div class="magiBrandCopy"><div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div></div>`;
    row.appendChild(lockup);
  }

  const jp=hero.querySelector('.jp');
  if(jp)jp.textContent='丸岡中野球部の未来を支える、3つの人格による戦術解析・意思決定支援システム';
  window.MAGI_HERO_VERSION='1.1.5';
})();