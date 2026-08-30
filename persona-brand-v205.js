(()=>{
  const people=[
    {
      key:'MELCHIOR',jp:'メルキオール',role:'VERIFY / 事実検証',color:'#3f86ff',
      quote:'「それは、本当に事実ですか？」',
      lead:'数字や記録を徹底的に確かめ、曖昧なものを事実として扱わない。慎重だが、根拠が揃えば最も強く断言する分析家。',
      roleline:'私の役割：事実を見抜き、揺るがない根拠を示す。'
    },
    {
      key:'BALTHASAR',jp:'バルタザール',role:'DECIDE / 戦術判断',color:'#e44d63',
      quote:'「では、どう勝ちに行く？」',
      lead:'相手、点差、打順、役割、代替案まで組み合わせて勝ち筋を描く。迷うより動く。ただし勢いだけでは決めない戦術家。',
      roleline:'俺の役割：勝利への道筋を描き、最善の一手を選ぶ。'
    },
    {
      key:'CASPER',jp:'カスパー',role:'EVOLVE / 育成評価',color:'#37b579',
      quote:'「その判断で、半年後どうなりますか？」',
      lead:'今の結果だけでなく、選手の成長、役割、負担、チーム全体への影響まで見る。未来の強さにつながるかを考える評価者。',
      roleline:'僕の役割：選手の可能性を見極め、チームの未来を育てる。'
    }
  ];

  const ensureStyle=()=>{
    if(document.getElementById('magi-persona-brand-v205-style'))return;
    const st=document.createElement('style');st.id='magi-persona-brand-v205-style';
    st.textContent=`
      .personaGrid{gap:14px!important}
      .persona{padding:0!important;overflow:hidden!important;background:#0a1b2e!important}
      .personaBrandTop{position:relative;display:flex;min-height:250px;padding:22px 20px 0;align-items:flex-start;overflow:hidden}
      .personaBrandMeta{position:relative;z-index:2;max-width:58%;min-width:0}
      .personaBrandNum{font-size:12px;letter-spacing:.18em;color:#b7c9db;margin-bottom:10px}
      .personaBrandName{font-size:29px;line-height:1.08;font-weight:900;margin:0 0 6px;color:#fff}
      .personaBrandRole{font-size:13px;font-weight:800;letter-spacing:.04em;margin-bottom:14px}
      .personaBrandQuote{font-size:20px;line-height:1.45;font-weight:900;color:#fff;margin-top:16px}
      .personaBrandPortrait{position:absolute!important;right:8px!important;bottom:0!important;width:47%!important;height:92%!important;max-width:none!important;object-fit:contain!important;object-position:right bottom!important;margin:0!important;filter:drop-shadow(0 10px 18px rgba(0,0,0,.34))!important}
      .personaBrandBody{padding:18px 20px 20px;border-top:1px solid rgba(255,255,255,.08)}
      .personaBrandLead{font-size:15px;line-height:1.8;color:#d2deea;margin:0}
      .personaBrandRoleline{margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.10);font-size:13px;line-height:1.65;font-weight:800}
      .personaBrandLead strong{color:#fff}
      @media(max-width:430px){
        .personaGrid{gap:16px!important}
        .personaBrandTop{min-height:260px;padding:20px 16px 0}
        .personaBrandMeta{max-width:58%}
        .personaBrandName{font-size:27px}
        .personaBrandRole{font-size:12px}
        .personaBrandQuote{font-size:18px;line-height:1.5;margin-top:14px}
        .personaBrandPortrait{right:2px!important;width:49%!important;height:90%!important}
        .personaBrandBody{padding:17px 16px 18px}
        .personaBrandLead{font-size:15px;line-height:1.75}
        .personaBrandRoleline{font-size:13px}
      }
      @media(min-width:721px){
        .personaBrandTop{min-height:230px}
        .personaBrandName{font-size:25px}
        .personaBrandQuote{font-size:18px}
        .personaBrandLead{font-size:14px}
      }
    `;
    document.head.appendChild(st);
  };

  const apply=()=>{
    const grid=document.querySelector('.personaGrid');if(!grid)return false;
    const cards=[...grid.querySelectorAll('.persona')].slice(0,3);if(cards.length<3)return false;
    ensureStyle();
    const sec=grid.closest('.section');
    const head=sec?.querySelector('.sectionHead h2'); if(head)head.textContent='3人の専門家';
    const tag=sec?.querySelector('.sectionHead span'); if(tag)tag.textContent='VERIFY × DECIDE × EVOLVE';
    let lead=sec?.querySelector('.personaLead');
    if(!lead&&sec){lead=document.createElement('p');lead.className='personaLead';grid.parentNode.insertBefore(lead,grid)}
    if(lead)lead.textContent='同じ資料を見ても、注目する場所は違う。3人がそれぞれの責任で判断するから、ひとつの見方に偏りません。';

    cards.forEach((card,i)=>{
      const p=people[i];
      let img=card.querySelector('img.personaPortrait, img.personaBrandPortrait');
      if(!img){img=document.createElement('img');img.src=`/portraits/${['melchior','balthasar','casper'][i]}.png?v=205`;img.alt=p.key;img.decoding='async'}
      img.className='personaBrandPortrait';
      card.style.borderTopColor=p.color;
      card.innerHTML='';
      const top=document.createElement('div');top.className='personaBrandTop';
      const meta=document.createElement('div');meta.className='personaBrandMeta';
      meta.innerHTML=`<div class="personaBrandNum">0${i+1} / ${p.key}</div><h3 class="personaBrandName">${p.jp}</h3><div class="personaBrandRole" style="color:${p.color}">${p.role}</div><div class="personaBrandQuote">${p.quote}</div>`;
      top.append(meta,img);
      const body=document.createElement('div');body.className='personaBrandBody';
      body.innerHTML=`<p class="personaBrandLead">${p.lead}</p><div class="personaBrandRoleline" style="color:${p.color}">${p.roleline}</div>`;
      card.append(top,body);
      card.dataset.personaBrand='205';
    });
    return true;
  };

  let tries=0;const t=setInterval(()=>{if(apply()||++tries>100)clearInterval(t)},100);
  window.addEventListener('load',()=>setTimeout(apply,250),{once:true});
})();