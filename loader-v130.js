(async()=>{
  const V='0.10.30', A='130';
  const extras=['/analysis-v093.js?v=130','/generic-v098.js?v=130','/batfix-v100.js?v=130','/role-v101.js?v=130','/pitch-v113.js?v=130','/final-v102.js?v=130','/final-detail-v103.js?v=130','/layout-v112.js?v=130'];
  const load=s=>new Promise(r=>{const x=document.createElement('script');x.src=s;x.onload=r;x.onerror=r;document.head.appendChild(x)});
  const inline=c=>{if(!c||!c.trim())return;const s=document.createElement('script');s.textContent=c;document.body.appendChild(s)};
  const brand=()=>{
    const hero=document.querySelector('.hero'); if(!hero)return;
    if(!document.getElementById('magi-brand-v130-style')){
      const st=document.createElement('style');st.id='magi-brand-v130-style';
      st.textContent=`.magiTitleRow{display:flex;align-items:center;gap:8px;margin:8px 0 10px;min-width:0}.magiTitleRow .magiMainTitle{margin:0;flex:0 0 auto;line-height:1;font-size:42px;letter-spacing:.08em}.magiBrandLockup{display:flex;align-items:center;gap:6px;min-width:0}.magiBrandSymbol{width:54px;height:54px;display:block;flex:0 0 auto;object-fit:contain;image-rendering:auto}.magiBrandCopy{min-width:0;line-height:1.18}.magiBrandEn{font-size:11.5px;font-weight:600;color:#dbe7f4;white-space:nowrap}.magiBrandCatch{margin-top:4px;font-size:11px;font-weight:600;color:#dbe7f4;white-space:nowrap}.hero .jp{margin-top:2px}.hero p{line-height:1.5;margin-top:14px;margin-bottom:14px}.hero p.magiIntroRef{line-height:1.2}.personaLead{font-size:13px;line-height:1.55;color:#a9bdd0;margin:-2px 0 12px}.personaAxis{display:block;font-size:13px;font-weight:900;margin:2px 0 8px;color:#fff}.pBlue .personaAxis{color:#7eb0ff}.pRed .personaAxis{color:#ff7d8f}.pGreen .personaAxis{color:#67d39d}.persona .role{font-size:14px}.persona p{margin-top:8px;margin-bottom:8px}@media(max-width:430px){.magiTitleRow{gap:6px;margin:8px 0 10px}.magiTitleRow .magiMainTitle{font-size:34px;letter-spacing:.05em}.magiBrandLockup{gap:4px}.magiBrandSymbol{width:46px;height:46px}.magiBrandEn,.magiBrandCatch{font-size:8.7px;letter-spacing:-.015em}.magiBrandCatch{margin-top:3px}.hero p{line-height:1.5}.hero p.magiIntroRef{line-height:1.2}.personaLead{font-size:13px;line-height:1.55}.personaAxis{font-size:13px}.persona .role{font-size:14px}}`;
      document.head.appendChild(st);
    }
    const h1=hero.querySelector('h1');if(!h1)return;
    h1.classList.add('magiMainTitle');
    let row=h1.closest('.magiTitleRow');
    if(!row){row=document.createElement('div');row.className='magiTitleRow';h1.parentNode.insertBefore(row,h1);row.appendChild(h1)}
    row.querySelectorAll('.magiBrandLockup,.magiBrandSymbolWrap').forEach(n=>n.remove());
    const lock=document.createElement('div');lock.className='magiBrandLockup';
    lock.innerHTML='<img class="magiBrandSymbol" src="/magi-official-symbol-v125.svg?v=130" alt="MAGI 公式3色シンボル"><div class="magiBrandCopy"><div class="magiBrandEn">Maruoka Advanced Game Intelligence</div><div class="magiBrandCatch">知りたいことから、伝えたいことまで。</div></div>';
    row.appendChild(lock);
    const jp=hero.querySelector('.jp');if(jp)jp.textContent='丸岡中野球部の今と未来を支える、3つの人格による戦術解析・意思決定支援システム';
    [...hero.querySelectorAll('p')].forEach(p=>{if(p.textContent.includes('データ・戦術・人の3視点で審議'))p.classList.add('magiIntroRef')});
  };
  const personaCopy=()=>{
    const grid=document.querySelector('.personaGrid');if(!grid)return;
    const section=grid.closest('.section');
    if(section&&!section.querySelector('.personaLead')){
      const lead=document.createElement('p');lead.className='personaLead';lead.textContent='メルキオールが事実を整理し、バルタザールが勝ち筋を組み、カスパーが人とチームへの影響を確かめます。3人が別々の基準で審議することで、ひとつの見方に偏らない判断を目指します。';
      grid.parentNode.insertBefore(lead,grid);
    }
    const cards=[...grid.querySelectorAll('.persona')];if(cards.length<3)return;
    cards[0].innerHTML='<div class="num">01 / MELCHIOR</div><h3>メルキオール</h3><div class="role">データ解析担当</div><span class="personaAxis">事実を確かめる</span><p>成績や記録、比較できる材料から「実際に何が起きているか」を整理します。感覚や印象より根拠を優先し、材料が足りない時は無理に断定しません。</p><ul><li>打率・OPS・投手成績などの数値確認</li><li>期間別・相手別・起用別の比較</li><li>「分かること／まだ分からないこと」の切り分け</li></ul>';
    cards[1].innerHTML='<div class="num">02 / BALTHASAR</div><h3>バルタザール</h3><div class="role">戦術演算担当</div><span class="personaAxis">勝ち筋を組み立てる</span><p>メルキオールが示した事実を材料に、「では、どう戦うか」を考えます。相手、点差、イニング、選手構成を見ながら、勝利につながる選択肢と切り替え条件を組み立てます。</p><ul><li>打順・守備位置・先発・継投・代打</li><li>相手や試合展開に応じた代替案</li><li>攻める／守る判断とリスク管理</li></ul>';
    cards[2].innerHTML='<div class="num">03 / CASPER</div><h3>カスパー</h3><div class="role">選手評価担当</div><span class="personaAxis">人とチームを見る</span><p>数字だけでは見えない「人の状態」を担当します。成長、意欲、責任感、周囲との関係、役割の負担まで含め、短期の勝敗だけでなくチームが長く良くなるかを考えます。</p><ul><li>成長・意欲・責任感・自発性</li><li>声掛け・信頼・チーム内への影響</li><li>役割の偏りや負担、育成面の懸念</li></ul>';
  };
  const versions=()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())n.nodeValue=n.nodeValue.replace(/v0\.(?:9|10)\.\d+/g,'v'+V);window.MAGI_ACTIVE_VERSION=V};
  try{const r=await fetch('/index-legacy-v092.html?v='+A,{cache:'no-store'});if(!r.ok)throw new Error('legacy '+r.status);const p=new DOMParser().parseFromString(await r.text(),'text/html');const scripts=[...p.querySelectorAll('script')].map(s=>({src:s.getAttribute('src')||'',code:s.textContent||''}));p.querySelectorAll('script').forEach(s=>s.remove());document.title='MAGI Web v'+V;p.head.querySelectorAll('style').forEach(o=>{const s=document.createElement('style');s.textContent=o.textContent;document.head.appendChild(s)});document.body.removeAttribute('style');document.body.innerHTML=p.body.innerHTML;for(const s of scripts){if(s.src)await load(s.src);else inline(s.code)}for(const s of extras)await load(s);brand();personaCopy();versions();setTimeout(()=>{brand();personaCopy();versions()},250)}catch(e){document.body.innerHTML='<div style="padding:28px">MAGI v'+V+'の読み込みに失敗しました。<br><small>'+String(e&&e.message||e)+'</small></div>'}
})();