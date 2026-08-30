(()=>{
  'use strict';

  const PLAYERS=[
    '北 淳志','坂本 陸','櫻川 莉大','佐々木 悠成','下田 涼歩','前川 夢斗','増田 晃大','宮嵜 翔','宮村 龍',
    '井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都',
    '上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'
  ];
  const WISE=[
    ['メルヒオール','メルキオール'],['メルキオル','メルキオール'],
    ['バルタサール','バルタザール'],['バルタザル','バルタザール'],
    ['カスパール','カスパー'],['キャスパー','カスパー'],
    ['BALTHAZAR','BALTHASAR'],['CASPAR','CASPER']
  ];
  const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function normalizeNames(text){
    let out=String(text??'');
    for(const [a,b] of WISE) out=out.split(a).join(b);
    for(const official of PLAYERS){
      const [surname,given]=official.split(' ');
      out=out.split(surname+given).join(official);
      out=out.replace(new RegExp(`${escRe(surname)}[\\s　]+${escRe(given)}`,'g'),official);
    }
    return out;
  }

  function visibleCandidatePlayers(){
    const text=[...document.querySelectorAll('#v1,#v2,#v3,.magiJudgeTag,.magiVoteState')]
      .map(n=>n.textContent||'').join(' ');
    return PLAYERS.filter(p=>text.includes(p));
  }

  function disambiguateDuplicateSurnames(text){
    let out=String(text??'');
    const candidateSet=visibleCandidatePlayers();
    const bySurname=new Map();
    for(const p of PLAYERS){
      const [surname]=p.split(' ');
      if(!bySurname.has(surname)) bySurname.set(surname,[]);
      bySurname.get(surname).push(p);
    }
    for(const [surname,all] of bySurname){
      if(all.length<2) continue;
      const selected=candidateSet.filter(p=>p.startsWith(surname+' '));
      if(selected.length!==1) continue;
      const official=selected[0],given=official.split(' ')[1];
      out=out.replace(new RegExp(`${escRe(surname)}(?![\\s　]*${escRe(given)})(?![\\s　]*${all.filter(x=>x!==official).map(x=>escRe(x.split(' ')[1])).join('|')})`,'g'),official);
    }
    return out;
  }

  function normalizeNodeText(root){
    if(!root) return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const before=node.nodeValue||'';
      const after=disambiguateDuplicateSurnames(normalizeNames(before));
      if(after!==before) node.nodeValue=after;
    }
  }

  function playerNamesFrom(text){
    const s=normalizeNames(text);
    return PLAYERS.filter(p=>s.includes(p));
  }

  function compactCondition(raw){
    const s=normalizeNames(String(raw||'').trim());
    if(!s)return'';
    if(/小標本|サンプル|試合数|打席数/.test(s)) return '現チームの試合数・打席数が増えたとき';
    if(/対戦相手|相手投手|レベル|公式戦/.test(s)) return '対戦レベルが上がった後の成績を確認できたとき';
    if(/大久保 陽翔/.test(s)&&/低下|不振|状態|波|変化/.test(s)) return '大久保 陽翔の打撃状態がさらに変化したとき';
    if(/再現|継続|好成績|数値/.test(s)) return '現在の好成績が継続・再現できるか確認できたとき';
    const first=s.split(/[。]/)[0].trim();
    return first.length>52?first.slice(0,50)+'…':first;
  }

  function polishFinal(){
    const title=document.querySelector('.final .title');
    if(!title||!/選択審議/.test(title.textContent||'')) return;

    const verdict=document.getElementById('verdict');
    const reason=document.getElementById('reason');
    const next=document.getElementById('next');
    if(verdict){
      const t=disambiguateDuplicateSurnames(normalizeNames(verdict.textContent||''));
      if(t!==verdict.textContent) verdict.textContent=t;
    }

    const centers=playerNamesFrom(verdict?.textContent||'');
    if(reason){
      let t=disambiguateDuplicateSurnames(normalizeNames(reason.textContent||''));
      const m=t.match(/クリーンナップ有力候補：([^。]+)。?/);
      if(m){
        const candidates=playerNamesFrom(m[1]).filter(p=>!centers.includes(p));
        const replacement=candidates.length?`中心候補と組ませる有力候補：${candidates.join('・')}。`:'';
        t=t.replace(m[0],replacement).replace(/。{2,}/g,'。').trim();
      }
      if(t!==reason.textContent) reason.textContent=t;
    }

    if(next){
      let t=disambiguateDuplicateSurnames(normalizeNames(next.textContent||''));
      const marker='再検討条件：';
      const pos=t.indexOf(marker);
      if(pos>=0){
        const prefix=t.slice(0,pos).trim();
        const raw=t.slice(pos+marker.length).split(/／|\n/).map(x=>x.trim()).filter(Boolean);
        const compact=[];
        for(const x of raw){
          const c=compactCondition(x);
          if(c&&!compact.includes(c))compact.push(c);
          if(compact.length>=3)break;
        }
        const numbered=compact.map((x,i)=>`${['①','②','③'][i]} ${x}`).join('　');
        t=[prefix,numbered?`${marker}${numbered}`:''].filter(Boolean).join('　');
      }
      if(t!==next.textContent) next.textContent=t;
    }
  }

  let lock=false;
  function apply(){
    if(lock)return;lock=true;
    try{
      const response=document.getElementById('response');
      const chat=document.getElementById('magiChatView');
      normalizeNodeText(response);
      normalizeNodeText(chat);
      polishFinal();
    }finally{lock=false}
  }

  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,60)}
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  const status=document.getElementById('status');
  if(status)new MutationObserver(schedule).observe(status,{subtree:true,childList:true,characterData:true});
  schedule();
})();
