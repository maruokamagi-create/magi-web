(async()=>{
  const V='0.10.25', A='125';
  const extras=['/analysis-v093.js?v=125','/generic-v098.js?v=125','/batfix-v100.js?v=125','/role-v101.js?v=125','/pitch-v113.js?v=125','/final-v102.js?v=125','/final-detail-v103.js?v=125','/layout-v112.js?v=125'];
  const load=s=>new Promise(r=>{const x=document.createElement('script');x.src=s;x.onload=r;x.onerror=r;document.head.appendChild(x)});
  const inline=c=>{if(!c||!c.trim())return;const s=document.createElement('script');s.textContent=c;document.body.appendChild(s)};
  const brand=()=>{
    const hero=document.querySelector('.hero'); if(!hero)return;
    if(!document.getElementById('magi-brand-v125-style')){
      const st=document.createElement('style');st.id='magi-brand-v125-style';
      st.textContent=`.magiTitleRow{display:flex;align-items:center;gap:8px;margin:8px 0 10px;min-width:0}.magiTitleRow .magiMainTitle{margin:0;flex:0 0 auto;line-height:1;font-size:42px;letter-spacing:.08em}.magiBrandLockup{display:flex;align-items:center;gap:6px;min-width:0}.magiBrandSymbol{width:48px;height:48px;display:block;flex:0 0 auto;object-fit:contain;image-rendering:auto}.magiBrandCopy{min-width:0;line-height:1.18}.magiBrandEn{font-size:11.5px;font-weight:600;color:#dbe7f4;white-space:nowrap}.magiBrandCatch{margin-top:4px;font-size:11px;font-weight:600;color:#dbe7f4;white-space:nowrap}.hero .jp{margin-top:2px}.hero p{line-height:1.5;margin-top:14px;margin-bottom:14px}@media(max-width:430px){.magiTitleRow{gap:6px;margin:8px 0 10px}.magiTitleRow .magiMainTitle{font-size:34px;letter-spacing:.05em}.magiBrandLockup{gap:4px}.magiBrandSymbol{width:42px;height:42px}.magiBrandEn,.magiBrandCatch{font-size:8.7px;letter-spacing:-.015em}.magiBrandCatch{margin-top:3px}.hero p{line-height:1.5}}`;
      document.head.appendChild(st);
    }
    const h1=hero.querySelector('h1');if(!h1)return;
    h1.classList.add('magiMainTitle');
    let row=h1.closest('.magiTitleRow');
    if(!row){row=document.createElement('div');row.className='magiTitleRow';h1.parentNode.insertBefore(row,h1);row.appendChild(h1)}
    row.querySelectorAll('.magiBrandLockup,.magiBrandSymbolWrap').forEach(n=>n.remove());
    const lock=document.createElement('div');lock.className='magiBrandLockup';
    lock.innerHTML='<img class="magiBrandSymbol" src="/magi-official-symbol-v125.svg?v=125" alt="MAGI 公式3色シンボル"><div class="magiBrandCopy"><div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div></div>';
    row.appendChild(lock);
    const jp=hero.querySelector('.jp');if(jp)jp.textContent='丸岡中野球部の今と未来を支える、3つの人格による戦術解析・意思決定支援システム';
  };
  const versions=()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())n.nodeValue=n.nodeValue.replace(/v0\.(?:9|10)\.\d+/g,'v'+V);window.MAGI_ACTIVE_VERSION=V};
  try{const r=await fetch('/index-legacy-v092.html?v='+A,{cache:'no-store'});if(!r.ok)throw new Error('legacy '+r.status);const p=new DOMParser().parseFromString(await r.text(),'text/html');const scripts=[...p.querySelectorAll('script')].map(s=>({src:s.getAttribute('src')||'',code:s.textContent||''}));p.querySelectorAll('script').forEach(s=>s.remove());document.title='MAGI Web v'+V;p.head.querySelectorAll('style').forEach(o=>{const s=document.createElement('style');s.textContent=o.textContent;document.head.appendChild(s)});document.body.removeAttribute('style');document.body.innerHTML=p.body.innerHTML;for(const s of scripts){if(s.src)await load(s.src);else inline(s.code)}for(const s of extras)await load(s);brand();versions();setTimeout(()=>{brand();versions()},250)}catch(e){document.body.innerHTML='<div style="padding:28px">MAGI v'+V+'の読み込みに失敗しました。<br><small>'+String(e&&e.message||e)+'</small></div>'}
})();