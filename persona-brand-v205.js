(()=>{
  const people=[
    {key:'MELCHIOR',jp:'メルキオール',role:'VERIFY / 事実検証',color:'#3f86ff',job:'記録を調べて、「何が事実か」を確定する人。',quote:'「それは、本当に事実ですか？」',works:[['記録を読む','打率・OPS・投手成績などを確認'],['条件で比べる','期間・相手・起用法の違いを比較'],['不足を見抜く','母数不足・矛盾・未確認情報を止める']],roleline:'私の役割：確かな事実と、まだ断定できないことを分ける。'},
    {key:'BALTHASAR',jp:'バルタザール',role:'DECIDE / 戦術判断',color:'#e44d63',job:'集めた事実から、「どう戦えば勝ちに近づくか」を決める人。',quote:'「では、どう勝ちに行く？」',works:[['勝ち筋を組む','打順・守備・先発・継投を設計'],['次の手を持つ','代打・継投・配置変更など代替案を用意'],['状況で切り替える','相手・点差・イニングで最善手を変える']],roleline:'俺の役割：勝利への道筋を描き、その場の最善手を選ぶ。'},
    {key:'CASPER',jp:'カスパー',role:'EVOLVE / 育成評価',color:'#37b579',job:'選手とチームを見て、「この判断が未来の強さにつながるか」を考える人。',quote:'「その判断で、半年後どうなりますか？」',works:[['成長を見る','技術・実戦経験・役割の変化を評価'],['負担を見る','出場機会・責任・役割の偏りを確認'],['チームを見る','個人だけでなく全体への影響まで考える']],roleline:'僕の役割：選手の可能性を見極め、チームの未来につなげる。'}
  ];
  const ensureStyle=()=>{
    if(document.getElementById('magi-persona-brand-v208-style'))return;
    const st=document.createElement('style');st.id='magi-persona-brand-v208-style';
    st.textContent=`
      .personaGrid{gap:14px!important}.persona{padding:0!important;overflow:hidden!important;background:#0a1b2e!important}
      .personaBrandTop{position:relative;display:flex;min-height:242px;padding:20px 20px 0;align-items:flex-start;overflow:hidden}
      .personaBrandMeta{position:relative;z-index:2;max-width:52%;min-width:0}.personaBrandNum{font-size:12px;letter-spacing:.18em;color:#b7c9db;margin-bottom:9px}
      .personaBrandName{font-size:29px;line-height:1.08;font-weight:900;margin:0 0 5px;color:#fff}.personaBrandRole{font-size:13px;font-weight:900;letter-spacing:.04em;margin-bottom:12px}
      .personaBrandJob{font-size:17px;line-height:1.55;font-weight:900;color:#fff;margin:12px 0 0}.personaBrandQuote{font-size:13px;line-height:1.55;font-weight:800;color:#b9cadb;margin-top:12px}
      .personaBrandPortrait{position:absolute!important;right:5px!important;bottom:0!important;width:48%!important;height:92%!important;max-width:none!important;object-fit:contain!important;object-position:right bottom!important;margin:0!important;filter:drop-shadow(0 10px 18px rgba(0,0,0,.34))!important}
      .personaBrandBody{padding:16px 18px 18px;border-top:1px solid rgba(255,255,255,.08)}.personaWorkTitle{font-size:11px;letter-spacing:.14em;color:#8fa9c2;margin:0 0 9px;font-weight:800}
      .personaWorks{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.personaWork{min-width:0;padding:10px 9px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(3,15,28,.42)}
      .personaWork b{display:block;font-size:12px;line-height:1.35;margin-bottom:5px}.personaWork span{display:block;font-size:10.5px;line-height:1.5;color:#b9cadb}.personaBrandRoleline{margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.10);font-size:13px;line-height:1.6;font-weight:900}
      @media(max-width:430px){
        .personaGrid{gap:16px!important}.personaBrandTop{min-height:250px;padding:18px 16px 0}.personaBrandMeta{max-width:50%;width:50%;padding-right:8px;box-sizing:border-box}
        .personaBrandName{font-size:27px}.personaBrandRole{font-size:12px}.personaBrandJob{font-size:16px;line-height:1.52;margin-top:11px}.personaBrandQuote{font-size:12px;margin-top:10px}
        .personaBrandPortrait{right:0!important;width:48%!important;height:90%!important}.personaBrandBody{padding:15px 14px 17px}.personaWorks{gap:6px}.personaWork{padding:9px 7px}.personaWork b{font-size:11.5px}.personaWork span{font-size:10px;line-height:1.45}.personaBrandRoleline{font-size:12.5px}
      }
      @media(max-width:380px){.personaBrandMeta{max-width:48%;width:48%;padding-right:10px}.personaBrandPortrait{width:50%!important}.personaBrandJob{font-size:15.5px}}
      @media(min-width:721px){.personaBrandTop{min-height:228px}.personaBrandName{font-size:25px}.personaBrandJob{font-size:15px}}
    `;document.head.appendChild(st);
  };
  const apply=()=>{
    const grid=document.querySelector('.personaGrid');if(!grid)return false;const cards=[...grid.querySelectorAll('.persona')].slice(0,3);if(cards.length<3)return false;ensureStyle();
    const sec=grid.closest('.section');const head=sec?.querySelector('.sectionHead h2');if(head)head.textContent='3人の専門家';const tag=sec?.querySelector('.sectionHead span');if(tag)tag.textContent='VERIFY × DECIDE × EVOLVE';
    let lead=sec?.querySelector('.personaLead');if(!lead&&sec){lead=document.createElement('p');lead.className='personaLead';grid.parentNode.insertBefore(lead,grid)}if(lead)lead.textContent='同じ資料を、3人が違う役割で見る。事実を確かめる人、勝ち筋を決める人、選手とチームの未来を見る人。';
    cards.forEach((card,i)=>{const p=people[i];let img=card.querySelector('img.personaPortrait, img.personaBrandPortrait');if(!img){img=document.createElement('img');img.src=`/portraits/${['melchior','balthasar','casper'][i]}.png?v=208`;img.alt=p.key;img.decoding='async'}img.className='personaBrandPortrait';card.style.borderTopColor=p.color;card.innerHTML='';
      const top=document.createElement('div');top.className='personaBrandTop';const meta=document.createElement('div');meta.className='personaBrandMeta';meta.innerHTML=`<div class="personaBrandNum">0${i+1} / ${p.key}</div><h3 class="personaBrandName">${p.jp}</h3><div class="personaBrandRole" style="color:${p.color}">${p.role}</div><div class="personaBrandJob">${p.job}</div><div class="personaBrandQuote">${p.quote}</div>`;top.append(meta,img);
      const body=document.createElement('div');body.className='personaBrandBody';body.innerHTML=`<div class="personaWorkTitle">この人がすること</div><div class="personaWorks">${p.works.map(w=>`<div class="personaWork" style="border-color:${p.color}55"><b style="color:${p.color}">${w[0]}</b><span>${w[1]}</span></div>`).join('')}</div><div class="personaBrandRoleline" style="color:${p.color}">${p.roleline}</div>`;card.append(top,body);card.dataset.personaBrand='208';});return true;
  };
  let tries=0;const t=setInterval(()=>{if(apply()||++tries>100)clearInterval(t)},100);window.addEventListener('load',()=>setTimeout(apply,250),{once:true});
})();