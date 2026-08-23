(async()=>{
  const V='0.10.16';
  const ASSET_VER='116';
  const extras=[
    '/analysis-v093.js?v=116',
    '/generic-v098.js?v=116',
    '/batfix-v100.js?v=116',
    '/role-v101.js?v=116',
    '/pitch-v113.js?v=116',
    '/final-v102.js?v=116',
    '/final-detail-v103.js?v=116',
    '/layout-v112.js?v=116'
  ];

  const loadExternal=(src)=>new Promise((resolve)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=()=>resolve();
    s.onerror=()=>resolve();
    document.head.appendChild(s);
  });

  const runInline=(code)=>{
    if(!code||!code.trim()) return;
    const s=document.createElement('script');
    s.textContent=code;
    document.body.appendChild(s);
  };

  const updateVersions=()=>{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n;
    while((n=walker.nextNode())){
      if(/v0\.(?:9|10)\.\d+/.test(n.nodeValue)){
        n.nodeValue=n.nodeValue.replace(/v0\.(?:9|10)\.\d+/g,'v'+V);
      }
    }
    window.MAGI_ACTIVE_VERSION=V;
  };

  const applyBranding=()=>{
    const hero=document.querySelector('.hero');
    if(!hero) return;

    if(!document.getElementById('magi-brand-v116-style')){
      const st=document.createElement('style');
      st.id='magi-brand-v116-style';
      st.textContent=`
        .magiTitleRow{display:flex;align-items:center;gap:8px;margin:8px 0 10px;min-width:0}
        .magiTitleRow .magiMainTitle{margin:0;flex:0 0 auto;line-height:1;font-size:42px;letter-spacing:.08em}
        .magiBrandLockup{display:flex;align-items:center;gap:6px;min-width:0}
        .magiBrandSymbol{width:42px;height:40px;object-fit:contain;display:block;flex:0 0 auto}
        .magiBrandCopy{min-width:0;line-height:1.18}
        .magiBrandEn{font-size:11.5px;font-weight:600;color:#dbe7f4;white-space:nowrap}
        .magiBrandCatch{margin-top:4px;font-size:11px;font-weight:600;color:#dbe7f4;white-space:nowrap}
        .hero .jp{margin-top:2px}
        @media(max-width:430px){
          .magiTitleRow{gap:6px;margin:8px 0 10px}
          .magiTitleRow .magiMainTitle{font-size:34px;letter-spacing:.05em}
          .magiBrandLockup{gap:4px}
          .magiBrandSymbol{width:32px;height:31px}
          .magiBrandEn{font-size:8.7px;letter-spacing:-.015em}
          .magiBrandCatch{font-size:8.7px;margin-top:3px;letter-spacing:-.015em}
        }
        @media(max-width:360px){
          .magiTitleRow .magiMainTitle{font-size:31px}
          .magiBrandSymbol{width:29px;height:28px}
          .magiBrandEn,.magiBrandCatch{font-size:8px}
        }`;
      document.head.appendChild(st);
    }

    let h1=hero.querySelector('h1');
    if(h1 && !h1.closest('.magiTitleRow')){
      h1.classList.add('magiMainTitle');
      const row=document.createElement('div');
      row.className='magiTitleRow';
      h1.parentNode.insertBefore(row,h1);
      row.appendChild(h1);

      const lockup=document.createElement('div');
      lockup.className='magiBrandLockup';
      lockup.innerHTML='<img class="magiBrandSymbol" src="https://drive.google.com/uc?export=view&id=1wgDVi8YkU7TZEECswhlhJB2RRVofI6Rr" alt="MAGI 公式3色シンボル"><div class="magiBrandCopy"><div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div></div>';
      row.appendChild(lockup);
    }

    const jp=hero.querySelector('.jp');
    if(jp) jp.textContent='丸岡中野球部の未来を支える、3つの人格による戦術解析・意思決定支援システム';
    window.MAGI_HERO_VERSION='1.1.6';
  };

  try{
    const r=await fetch('/index.html?v='+ASSET_VER,{cache:'no-store'});
    if(!r.ok) throw new Error('index.html '+r.status);
    const html=await r.text();
    const parsed=new DOMParser().parseFromString(html,'text/html');

    const scriptInfo=[...parsed.querySelectorAll('script')].map(s=>({
      src:s.getAttribute('src')||'',
      code:s.textContent||''
    }));
    parsed.querySelectorAll('script').forEach(s=>s.remove());

    document.title='MAGI Web v'+V;

    parsed.head.querySelectorAll('style').forEach(old=>{
      const st=document.createElement('style');
      st.textContent=old.textContent;
      document.head.appendChild(st);
    });

    document.body.className=parsed.body.className||'';
    const bodyStyle=parsed.body.getAttribute('style');
    if(bodyStyle) document.body.setAttribute('style',bodyStyle);
    else document.body.removeAttribute('style');
    document.body.innerHTML=parsed.body.innerHTML;

    for(const info of scriptInfo){
      if(info.src) await loadExternal(info.src);
      else runInline(info.code);
    }

    for(const src of extras) await loadExternal(src);

    applyBranding();
    updateVersions();

    setTimeout(()=>{applyBranding();updateVersions();},250);
  }catch(e){
    document.body.innerHTML='<div style="padding:28px;background:#06111f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Noto Sans JP,sans-serif">MAGI v'+V+'の読み込みに失敗しました。<br><small>'+String(e&&e.message||e)+'</small></div>';
  }
})();