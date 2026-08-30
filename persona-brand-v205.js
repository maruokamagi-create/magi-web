(()=>{
  const people=[
    {key:'MELCHIOR',jp:'メルキオール',role:'VERIFY / 事実検証',color:'#3f86ff',job:'記録を調べて、\n「何が事実か」を確定する人。',quote:'「それは、本当に事実ですか？」',works:[['▥','記録を読む','打率・OPS・投手成績などを確認'],['⌕','条件で比べる','期間・相手・起用法の違いを比較'],['◇','不足を見抜く','母数不足・矛盾・未確認情報を止める']],roleline:'私の役割：確かな事実と、まだ断定できないことを分ける。'},
    {key:'BALTHASAR',jp:'バルタザール',role:'DECIDE / 戦術判断',color:'#e44d63',job:'集めた事実から、\n「どう戦えば勝ちに近づくか」を決める人。',quote:'「では、どう勝ちに行く？」',works:[['⚑','勝ち筋を組む','打順・守備・先発・継投を設計'],['⚔','次の手を持つ','代打・継投・配置変更など代替案を用意'],['♜','状況で切り替える','相手・点差・イニングで最善手を変える']],roleline:'俺の役割：勝利への道筋を描き、その場の最善手を選ぶ。'},
    {key:'CASPER',jp:'カスパー',role:'EVOLVE / 育成評価',color:'#37b579',job:'選手とチームを見て、\n「この判断が未来の強さにつながるか」を考える人。',quote:'「その判断で、半年後どうなりますか？」',works:[['♧','成長を見極める','技術・実戦経験・役割の変化を評価'],['●●','影響を考える','責任・役割・チーム全体への影響を確認'],['⌁','未来を設計する','育成と起用を将来の強さにつなげる']],roleline:'僕の役割：選手の可能性を見極め、チームの未来につなげる。'}
  ];
  const ensureStyle=()=>{
    if(document.getElementById('magi-persona-brand-v209-style'))return;
    const st=document.createElement('style');st.id='magi-persona-brand-v209-style';
    st.textContent=`
      .personaGrid{gap:12px!important}.persona{padding:0!important;overflow:hidden!important;background:#091a2c!important}
      .personaBrandCard{position:relative;min-height:390px;padding:20px 18px 16px;display:grid;grid-template-columns:minmax(0,56%) minmax(0,44%);grid-template-rows:auto auto auto 1fr auto;column-gap:10px;overflow:hidden}
      .personaBrandMeta{grid-column:1;grid-row:1;position:relative;z-index:3;min-width:0}.personaBrandNum{font-size:12px;letter-spacing:.18em;color:#b7c9db;margin-bottom:8px}
      .personaBrandName{font-size:29px;line-height:1.08;font-weight:900;margin:0 0 4px;color:#fff}.personaBrandRole{font-size:13px;font-weight:900;letter-spacing:.03em;margin-bottom:13px}
      .personaBrandJob{grid-column:1;grid-row:2;position:relative;z-index:3;white-space:pre-line;font-size:17px;line-height:1.5;font-weight:900;color:#fff;margin:8px 0 0;max-width:100%}
      .personaBrandQuote{grid-column:1;grid-row:3;position:relative;z-index:3;font-size:13px;line-height:1.5;font-weight:800;color:#b9cadb;margin-top:10px}
      .personaBrandPortrait{grid-column:2;grid-row:1/6;align-self:end;justify-self:end;width:108%!important;height:100%!important;max-width:none!important;object-fit:contain!important;object-position:right bottom!important;margin:0!important;filter:drop-shadow(0 10px 18px rgba(0,0,0,.34))!important;z-index:1}
      .personaBrandTools{grid-column:1;grid-row:4;position:relative;z-index:3;align-self:end;margin-top:14px}.personaToolLabel{font-size:11px;letter-spacing:.12em;color:#8fa9c2;margin-bottom:8px}
      .personaWorks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.personaWork{min-width:0;padding:8px 7px;border:1px solid;border-radius:9px;background:rgba(2,12,24,.55)}
      .personaWorkTop{display:flex;align-items:center;gap:5px;margin-bottom:4px}.personaWorkIcon{font-size:16px;line-height:1}.personaWork b{font-size:11.5px;line-height:1.25}.personaWork span{display:block;font-size:9.8px;line-height:1.42;color:#bac9d8}
      .personaBrandRoleline{grid-column:1;grid-row:5;position:relative;z-index:3;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;line-height:1.5;font-weight:900}
      @media(max-width:430px){
        .personaBrandCard{min-height:405px;padding:18px 14px 14px;grid-template-columns:minmax(0,58%) minmax(0,42%);column-gap:6px}
        .personaBrandName{font-size:27px}.personaBrandRole{font-size:12px}.personaBrandJob{font-size:16px;line-height:1.48;margin-top:8px}.personaBrandQuote{font-size:12px}
        .personaBrandPortrait{width:118%!important;height:98%!important;transform:translateX(5px)}.personaWorks{gap:5px}.personaWork{padding:7px 6px}.personaWork b{font-size:10.7px}.personaWork span{font-size:9.2px}.personaBrandRoleline{font-size:12px}
      }
      @media(max-width:380px){.personaBrandCard{grid-template-columns:minmax(0,60%) minmax(0,40%)}.personaBrandJob{font-size:15.5px}.personaBrandPortrait{width:122%!important}}
      @media(min-width:721px){.personaBrandCard{min-height:355px;grid-template-columns:minmax(0,60%) minmax(0,40%)}.personaBrandPortrait{width:96%!important}.personaBrandName{font-size:25px}.personaBrandJob{font-size:15px}.personaWork span{font-size:9.5px}}
    `;document.head.appendChild(st);
  };
  const apply=()=>{
    const grid=document.querySelector('.personaGrid');if(!grid)return false;const cards=[...grid.querySelectorAll('.persona')].slice(0,3);if(cards.length<3)return false;ensureStyle();
    const sec=grid.closest('.section');const head=sec?.querySelector('.sectionHead h2');if(head)head.textContent='3人の専門家';const tag=sec?.querySelector('.sectionHead span');if(tag)tag.textContent='VERIFY × DECIDE × EVOLVE';
    let lead=sec?.querySelector('.personaLead');if(!lead&&sec){lead=document.createElement('p');lead.className='personaLead';grid.parentNode.insertBefore(lead,grid)}if(lead)lead.textContent='同じ資料を見ても、注目する場所は違う。3人がそれぞれの責任で判断するから、ひとつの見方に偏りません。';
    cards.forEach((card,i)=>{const p=people[i];let img=card.querySelector('img.personaPortrait, img.personaBrandPortrait');if(!img){img=document.createElement('img');img.src=`/portraits/${['melchior','balthasar','casper'][i]}.png?v=209`;img.alt=p.key;img.decoding='async'}img.className='personaBrandPortrait';card.style.borderTopColor=p.color;card.innerHTML='';
      const wrap=document.createElement('div');wrap.className='personaBrandCard';
      const meta=document.createElement('div');meta.className='personaBrandMeta';meta.innerHTML=`<div class="personaBrandNum">0${i+1} / ${p.key}</div><h3 class="personaBrandName">${p.jp}</h3><div class="personaBrandRole" style="color:${p.color}">${p.role}</div>`;
      const job=document.createElement('div');job.className='personaBrandJob';job.textContent=p.job;
      const quote=document.createElement('div');quote.className='personaBrandQuote';quote.textContent=p.quote;
      const tools=document.createElement('div');tools.className='personaBrandTools';tools.innerHTML=`<div class="personaToolLabel">この人が見る領域</div><div class="personaWorks">${p.works.map(w=>`<div class="personaWork" style="border-color:${p.color}88"><div class="personaWorkTop"><span class="personaWorkIcon" style="color:${p.color}">${w[0]}</span><b style="color:${p.color}">${w[1]}</b></div><span>${w[2]}</span></div>`).join('')}</div>`;
      const role=document.createElement('div');role.className='personaBrandRoleline';role.style.color=p.color;role.textContent=p.roleline;
      wrap.append(meta,job,quote,tools,role,img);card.appendChild(wrap);card.dataset.personaBrand='209';
    });return true;
  };
  let tries=0;const t=setInterval(()=>{if(apply()||++tries>100)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,250),{once:true});
})();