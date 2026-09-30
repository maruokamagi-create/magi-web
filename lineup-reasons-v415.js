(()=>{
'use strict';
if(window.MAGI_LINEUP_REASONS_V415)return;
window.MAGI_LINEUP_REASONS_V415=true;

const PERSONAS=[
  {key:'melchior',label:'メルキオール'},
  {key:'balthasar',label:'バルタザール'},
  {key:'casper',label:'カスパー'}
];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let statsCache=null,statsPending=null,scheduled=false,lastSignature='';

function injectStyle(){
  if(document.getElementById('magi-lineup-reasons-v415-style'))return;
  const s=document.createElement('style');
  s.id='magi-lineup-reasons-v415-style';
  s.textContent=`
  .magiLineupReasons{margin-top:15px;padding-top:14px;border-top:2px solid #bad7ea;color:#10263b}
  .magiLineupReasonsHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:8px}
  .magiLineupReasonsTitle{font-size:17px;font-weight:950;line-height:1.35;color:#0b2742}
  .magiLineupReasonsSub{font-size:9.5px;font-weight:900;letter-spacing:.09em;color:#54758e;white-space:nowrap}
  .magiLineupReasonsOverview{margin:0 0 10px;padding:10px 11px;border:1px solid #c5dcea;border-radius:10px;background:#f7fbfe;color:#27465e;font-size:11px;line-height:1.65;font-weight:750}
  .magiLineupReasonList{display:grid;grid-template-columns:1fr;gap:8px}
  .magiLineupReasonCard{padding:10px 11px;border:1px solid #c9dce9;border-radius:11px;background:#fff;box-shadow:0 2px 8px rgba(5,30,55,.06)}
  .magiLineupReasonHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
  .magiLineupReasonName{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:950;color:#0b2742}
  .magiLineupReasonSlot{display:inline-flex;align-items:center;justify-content:center;min-width:31px;height:25px;padding:0 7px;border-radius:999px;background:#0b2444;color:#fff;font-size:11px;font-weight:950;white-space:nowrap}
  .magiLineupReasonSupport{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:#e8f3fb;color:#174a6d;border:1px solid #bfd7e8;font-size:9.5px;font-weight:950;white-space:nowrap}
  .magiLineupReasonSupport.strong{background:#e2f5e9;color:#17613a;border-color:#afd8bd}
  .magiLineupReasonSupport.split{background:#fff3dc;color:#7a5412;border-color:#e8d09f}
  .magiLineupReasonLine{margin-top:4px;font-size:11px;line-height:1.62;color:#29465d}
  .magiLineupReasonLine b{color:#0c395d;font-weight:950}
  .magiLineupReasonAlternatives{margin-top:6px;padding-top:6px;border-top:1px dashed #d3e0e9;color:#60788a;font-size:10px;line-height:1.55;font-weight:750}
  .magiLineupReasonWarning{margin-top:9px;padding:9px 10px;border-radius:9px;background:#fff3df;border:1px solid #ead09b;color:#704b0d;font-size:10.5px;line-height:1.6;font-weight:850}
  @media(max-width:430px){
    .magiLineupReasonsTitle{font-size:16px}.magiLineupReasonsOverview{font-size:10.5px}.magiLineupReasonCard{padding:9px 10px}
    .magiLineupReasonName{font-size:12.5px}.magiLineupReasonLine{font-size:10.6px}.magiLineupReasonAlternatives{font-size:9.8px}
  }
  `;
  document.head.appendChild(s);
}

function result(){return window.MAGI_LAST_DELIBERATION_RESULT||null;}
function finalNames(r){return Array.isArray(r?.final?.lineup)?r.final.lineup.map(x=>String(x?.name||'').trim()).filter(Boolean):[];}
function orderOf(v){return Array.isArray(v?.candidatePlayers)?v.candidatePlayers.map(x=>String(x||'').trim()).filter(Boolean):[];}
function personaLabel(key,value,index){
  const raw=String(value?.persona||key||'').toUpperCase();
  if(raw.includes('MELCHIOR'))return'メルキオール';
  if(raw.includes('BALTHASAR'))return'バルタザール';
  if(raw.includes('CASPER'))return'カスパー';
  return PERSONAS[index]?.label||String(key||`WISE-${index+1}`).toUpperCase();
}
function secondEntries(r){
  const c=r?.second;
  if(Array.isArray(c))return c.slice(0,3).map((value,index)=>({key:String(index),label:personaLabel(String(index),value,index),value,order:orderOf(value)}));
  const out=[];
  for(const [index,p] of PERSONAS.entries()){
    const value=c?.[p.key];
    if(value)out.push({key:p.key,label:p.label,value,order:orderOf(value)});
  }
  if(out.length===3)return out;
  return Object.entries(c||{}).slice(0,3).map(([key,value],index)=>({key,label:personaLabel(key,value,index),value,order:orderOf(value)}));
}
function sameOrder(a,b){return a.length===9&&b.length===9&&a.every((x,i)=>norm(x)===norm(b[i]));}
function selectedSource(r,entries,names){
  const from=String(r?.final?.selectedFromPersona||'').trim();
  if(from){
    const e=entries.find(x=>x.key===from||x.label===from||String(x.value?.persona||'').includes(from));
    if(e)return e.label;
  }
  return entries.find(x=>sameOrder(x.order,names))?.label||'';
}
function groupCount(entries){
  const m=new Map();
  for(const e of entries){if(e.order.length!==9)continue;const sig=e.order.map(norm).join('|');m.set(sig,(m.get(sig)||0)+1);}
  return [...m.values()].sort((a,b)=>b-a)[0]||0;
}
function exactSlotSupport(entries,slot,name){return entries.filter(e=>norm(e.order?.[slot-1])===norm(name)).length;}
function slotAlternatives(entries,slot,name){
  return entries.filter(e=>e.order?.[slot-1]&&norm(e.order[slot-1])!==norm(name)).map(e=>`${e.label}：${e.order[slot-1]}`);
}
function hasFallback(entries){return entries.some(e=>e.value?.secondFallbackUsed===true||String(e.value?.secondFallbackReason||'').trim());}

async function loadStats(){
  if(statsCache)return statsCache;
  if(statsPending)return statsPending;
  statsPending=fetch('/api/lineup-batting-stats',{method:'GET',credentials:'same-origin',cache:'no-store'})
    .then(async r=>{const j=await r.json().catch(()=>null);if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);return j;})
    .then(j=>{statsCache=j;return j;})
    .catch(error=>{console.warn('[MAGI lineup reasons stats]',error?.message||error);return null;})
    .finally(()=>{statsPending=null;});
  return statsPending;
}
function num(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null;}
function fmtRate(v){const n=num(v);if(n===null)return'—';return n.toFixed(3).replace(/^0/,'').replace(/-0\./,'-.');}
function fmtInt(v){const n=num(v);return n===null?'—':String(n);}
function statEvidence(slot,st){
  if(!st)return'今季打撃データを取得できなかったため、数値理由は表示しません。';
  const avg=fmtRate(st.AVG),obp=fmtRate(st.OBP),slg=fmtRate(st.SLG),ops=fmtRate(st.OPS),risp=fmtRate(st.RISP);
  const rbi=fmtInt(st.RBI),bb=fmtInt(st.BB),hbp=fmtInt(st.HBP),sb=fmtInt(st.SB);
  if(slot===1)return`出塁率 ${obp}、打率 ${avg}、四球 ${bb}、死球 ${hbp}、盗塁 ${sb}。`;
  if(slot===2)return`打率 ${avg}、出塁率 ${obp}、OPS ${ops}、盗塁 ${sb}。`;
  if(slot===3)return`OPS ${ops}、長打率 ${slg}、得点圏打率 ${risp}、${rbi}打点。`;
  if(slot===4)return`OPS ${ops}、長打率 ${slg}、得点圏打率 ${risp}、${rbi}打点。`;
  if(slot===5)return`OPS ${ops}、長打率 ${slg}、得点圏打率 ${risp}、${rbi}打点。`;
  if(slot===6)return`打率 ${avg}、出塁率 ${obp}、OPS ${ops}、得点圏打率 ${risp}。`;
  if(slot===7)return`打率 ${avg}、出塁率 ${obp}、四球 ${bb}、死球 ${hbp}。`;
  if(slot===8)return`出塁率 ${obp}、四球 ${bb}、死球 ${hbp}、盗塁 ${sb}。`;
  return`出塁率 ${obp}、四球 ${bb}、死球 ${hbp}、盗塁 ${sb}。`;
}
function metricRank(st,key,selectedStats){
  const value=num(st?.[key]);if(value===null)return null;
  const values=selectedStats.map(x=>num(x?.[key])).filter(v=>v!==null);
  if(!values.length)return null;
  const better=values.filter(v=>v>value).length;
  return {rank:better+1,total:values.length,value};
}
function rankText(st,key,label,selectedStats,rate=true){
  const r=metricRank(st,key,selectedStats);if(!r)return'';
  return `${label}は最終${r.total}人中${r.rank}位（${rate?fmtRate(r.value):fmtInt(r.value)}）`;
}
function specificReason(slot,st,selectedStats,support){
  if(!st)return'確認できた打撃数値が不足しているため、審議支持と守備成立を主な根拠として表示しています。';
  const parts=[];
  if(slot===1){
    parts.push(rankText(st,'OBP','出塁率',selectedStats),rankText(st,'SB','盗塁',selectedStats,false));
    return `${parts.filter(Boolean).join('、')}。先頭で出塁と走塁を使う配置意図を、確認できる数値で説明できます。`;
  }
  if(slot===2){
    parts.push(rankText(st,'AVG','打率',selectedStats),rankText(st,'OPS','OPS',selectedStats));
    return `${parts.filter(Boolean).join('、')}。上位で打席を多く回す意味はありますが、2番配置そのものの支持は${support}/3で、ここは審議上の争点です。`;
  }
  if(slot===3){
    parts.push(rankText(st,'OPS','OPS',selectedStats),rankText(st,'SLG','長打率',selectedStats),rankText(st,'RISP','得点圏打率',selectedStats));
    return `${parts.filter(Boolean).join('、')}。上位の走者を返す役割と4番へつなぐ役割の両方を想定した配置です。支持は${support}/3なので別案も残ります。`;
  }
  if(slot===4){
    parts.push(rankText(st,'SLG','長打率',selectedStats),rankText(st,'OPS','OPS',selectedStats),rankText(st,'RISP','得点圏打率',selectedStats));
    return `${parts.filter(Boolean).join('、')}。4番は3賢人の一致度を最優先の根拠としており、打撃数値だけで決めた配置ではありません。`;
  }
  if(slot===5){
    parts.push(rankText(st,'RBI','打点',selectedStats,false),rankText(st,'RISP','得点圏打率',selectedStats),rankText(st,'OPS','OPS',selectedStats));
    return `${parts.filter(Boolean).join('、')}。4番の後ろで得点機会を続ける役として、打点・得点圏・OPSを確認材料にしています。`;
  }
  if(slot===6){
    parts.push(rankText(st,'OBP','出塁率',selectedStats),rankText(st,'OPS','OPS',selectedStats),rankText(st,'RISP','得点圏打率',selectedStats));
    return `${parts.filter(Boolean).join('、')}。中軸後でもう一度走者を作る役割を重視した配置で、支持は${support}/3です。`;
  }
  if(slot===7){
    parts.push(rankText(st,'AVG','打率',selectedStats),rankText(st,'OBP','出塁率',selectedStats));
    return `${parts.filter(Boolean).join('、')}。この位置は打撃数値だけでなく、守備を含む9人全体の成立と${support}/3の審議支持を合わせて決めた配置です。`;
  }
  if(slot===8){
    parts.push(rankText(st,'OBP','出塁率',selectedStats),rankText(st,'BB','四球',selectedStats,false));
    return `${parts.filter(Boolean).join('、')}。下位打線での打撃だけでなく、守備位置を重複なく成立させる条件も含めた配置です。`;
  }
  parts.push(rankText(st,'OBP','出塁率',selectedStats),rankText(st,'BB','四球',selectedStats,false),rankText(st,'SB','盗塁',selectedStats,false));
  return `${parts.filter(Boolean).join('、')}。9番から1番へ打順を戻す接続点として、四球・出塁・走塁を確認材料にしています。`;
}
function overview(r,entries,names){
  const top=groupCount(entries),source=selectedSource(r,entries,names);
  if(top===3)return'3賢人の二次判定が1〜9番まで完全一致しました。下の理由は、各打順について「3賢人の一致」と「確認済みの今季打撃データ」を分けて表示しています。';
  if(top===2)return`3賢人の二次案は2対1に分かれました。多数側の同一打順を最終案として表示しています。${source?`表示案は${source}の二次案と一致します。`:''} 各打順では一致数と反対案も併記します。`;
  return`3賢人の二次案は1対1対1で分かれ、正式な多数派はありません。${source?`表示中は${source}の二次案を参考案として採用しています。`:''} 3案を平均して新しい打順を作るのではなく、実際に3賢人が提示した案の中から、選手構成と打順位置の全体的なずれが最も小さい案を比較用に表示しています。`;
}
function supportText(n){return n===3?'3/3一致':n===2?'2/3支持':n===1?'1/3・争点あり':'0/3・整合要確認';}
function supportClass(n){return n===3?'strong':n<=1?'split':'';}
function reasoningLine(support,slot,name){
  if(support===0)return`3賢人の二次打順案に${slot}番${name}の配置が見つかりません。最終案との整合確認が必要です。`;
  if(support===3)return`3賢人全員が二次判定で${slot}番に${name}を配置。ここは最も合意が強い打順です。`;
  if(support===2)return`3賢人中2人が二次判定で${slot}番に${name}を配置。多数側が同じ位置を支持しています。`;
  return`この${slot}番配置を支持したのは3賢人中1人です。多数一致ではなく、打線全体の比較で選ばれた参考案上の配置です。`;
}
function render(r,data){
  injectStyle();
  const hero=document.querySelector('.magiFinalDecisionHero');
  if(!hero)return false;
  const names=finalNames(r);
  const entries=secondEntries(r).filter(e=>e.order.length===9);
  if(names.length!==9||entries.length!==3)return false;
  const signature=[names.map(norm).join('|'),...entries.map(e=>e.order.map(norm).join('|'))].join('::');
  if(lastSignature===signature&&hero.querySelector('.magiLineupReasons'))return true;
  const old=hero.querySelector('.magiLineupReasons');if(old)old.remove();
  const section=document.createElement('section');section.className='magiLineupReasons';section.setAttribute('aria-label','1番から9番の選定理由');
  const statsMap=new Map((data?.players||[]).map(p=>[norm(p.name),p]));
  const selectedStats=names.map(name=>statsMap.get(norm(name))).filter(Boolean);
  const topGroup=groupCount(entries);
  const heroTitle=hero.querySelector('.magiFinalDecisionTitle');
  const outerVerdict=hero.closest('.final')?.querySelector('.verdict');
  if(topGroup===1){
    if(heroTitle)heroTitle.textContent='公式戦想定 参考ベストオーダー（暫定）';
    if(outerVerdict)outerVerdict.textContent='参考ベストオーダー（暫定）';
  }else{
    if(heroTitle)heroTitle.textContent='公式戦想定 ベストオーダー';
    if(outerVerdict)outerVerdict.textContent='最終ベストオーダー';
  }
  let html=`<div class="magiLineupReasonsHead"><div class="magiLineupReasonsTitle">1〜9番 選定理由</div><div class="magiLineupReasonsSub">WHY THIS ORDER</div></div>`;
  html+=`<div class="magiLineupReasonsOverview">${esc(overview(r,entries,names))}</div>`;
  if(hasFallback(entries)){
    html+='<div class="magiLineupReasonWarning">二次判定に暫定維持データが含まれるため、1〜9番の理由は表示しません。実際の二次判定を取得してから再表示します。</div>';
    section.innerHTML=html;
    const method=hero.querySelector('.magiFinalDecisionMethod'),field=hero.querySelector('.magiFinalFieldingNote');
    if(method)hero.insertBefore(section,method);else if(field)hero.insertBefore(section,field);else hero.appendChild(section);
    lastSignature=signature;hero.dataset.magiLineupReasons='415';return true;
  }
  html+='<div class="magiLineupReasonList">';
  names.forEach((name,index)=>{
    const slot=index+1,support=exactSlotSupport(entries,slot,name),alts=slotAlternatives(entries,slot,name),st=statsMap.get(norm(name));
    html+=`<article class="magiLineupReasonCard"><div class="magiLineupReasonHead"><div class="magiLineupReasonName"><span class="magiLineupReasonSlot">${slot}番</span><span>${esc(name)}</span></div><span class="magiLineupReasonSupport ${supportClass(support)}">${supportText(support)}</span></div>`;
    html+=`<div class="magiLineupReasonLine"><b>審議根拠：</b>${esc(reasoningLine(support,slot,name))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>データ根拠：</b>${esc(statEvidence(slot,st))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>配置理由：</b>${esc(specificReason(slot,st,selectedStats,support))}</div>`;
    if(alts.length)html+=`<div class="magiLineupReasonAlternatives"><b>同じ打順位置の別案：</b> ${esc(alts.join(' ／ '))}</div>`;
    html+='</article>';
  });
  html+='</div>';
  section.innerHTML=html;
  const method=hero.querySelector('.magiFinalDecisionMethod');
  const field=hero.querySelector('.magiFinalFieldingNote');
  if(method)hero.insertBefore(section,method);else if(field)hero.insertBefore(section,field);else hero.appendChild(section);
  lastSignature=signature;
  hero.dataset.magiLineupReasons='415';
  return true;
}
async function apply(){
  const r=result();
  if(!r||String(r?.final?.mode||'').toUpperCase()!=='FULL_LINEUP')return false;
  if(finalNames(r).length!==9)return false;
  const data=await loadStats();
  return render(r,data);
}
function run(){if(scheduled)return;scheduled=true;requestAnimationFrame(async()=>{scheduled=false;await apply().catch(()=>{});});}
document.addEventListener('magi:deliberation-result',()=>run());
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
let tries=0;const timer=setInterval(async()=>{tries++;if(await apply().catch(()=>false)||tries>=240)clearInterval(timer)},200);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();

window.MAGI_LINEUP_REASONS_V415_API=Object.freeze({version:'lineup-reasons-v417',secondEntries,exactSlotSupport,slotAlternatives,selectedSource,sameOrder,metricRank,specificReason});
})();
