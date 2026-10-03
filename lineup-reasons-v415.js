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
function finalRows(r){return Array.isArray(r?.final?.lineup)?r.final.lineup:[];}
function finalNames(r){return finalRows(r).map(x=>String(x?.name||'').trim()).filter(Boolean);}
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
function num(v){
  const s=String(v??'').trim().replace(/,/g,'');
  if(!s)return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
function fmtRate(v){const n=num(v);if(n===null)return'—';return n.toFixed(3).replace(/^0/,'').replace(/-0\./,'-.');}
function fmtInt(v){const n=num(v);return n===null?'—':String(Math.trunc(n));}
function flatBatting(player){
  if(!player)return null;
  const b=player?.batting&&typeof player.batting==='object'?player.batting:player;
  return {name:String(player?.name||b?.name||'').trim(),games:player?.games??b?.games??null,...b};
}
function mapPlayers(players){return new Map((players||[]).map(p=>flatBatting(p)).filter(p=>p?.name).map(p=>[norm(p.name),p]));}
function evidenceLayers(r,fallback){
  const e=r?.case?.evidence||{};
  const current=Array.isArray(e?.allCurrentTeamCheck?.players)&&e.allCurrentTeamCheck.players.length?e.allCurrentTeamCheck.players:(fallback?.players||[]);
  const recent=String(e?.recentSix?.status||'')==='COMPLETE'?(e.recentSix.players||[]):[];
  const historical=String(e?.historicalReference?.status||'')==='COMPLETE'?(e.historicalReference.players||[]):[];
  const usage=Array.isArray(e?.appearanceFielding?.players)?e.appearanceFielding.players:[];
  return {
    evidence:e,
    currentMap:mapPlayers(current),
    currentAll:current.map(flatBatting).filter(Boolean),
    recentMap:mapPlayers(recent),
    historicalMap:mapPlayers(historical),
    usageMap:new Map(usage.map(p=>[norm(p?.name),p])),
    recentMeta:e?.recentSix||{},
    historicalMeta:e?.historicalReference||{},
    observationStatus:String(e?.normalizedObservationStatus||''),
    observationCount:Number(e?.normalizedObservationDatedCount)||0,
    observationLatest:String(e?.normalizedObservationLatestRecordedAt||'').trim(),
    observations:Array.isArray(e?.normalizedObservations)?e.normalizedObservations:[]
  };
}
function hasStructuredBattingEvidence(r){
  return Array.isArray(r?.case?.evidence?.allCurrentTeamCheck?.players)&&r.case.evidence.allCurrentTeamCheck.players.length===14;
}

function statEvidence(slot,st){
  if(!st)return'今季通算の打撃データを取得できなかったため、数値を補完しません。';
  const avg=fmtRate(st.AVG),obp=fmtRate(st.OBP),slg=fmtRate(st.SLG),ops=fmtRate(st.OPS),risp=fmtRate(st.RISP);
  const ab=fmtInt(st.AB),rbi=fmtInt(st.RBI),bb=fmtInt(st.BB),hbp=fmtInt(st.HBP),sb=fmtInt(st.SB);
  if(slot===1)return ab+'打数、出塁率 '+obp+'、打率 '+avg+'、四球 '+bb+'、死球 '+hbp+'、盗塁 '+sb+'。';
  if(slot===2)return ab+'打数、打率 '+avg+'、出塁率 '+obp+'、OPS '+ops+'、盗塁 '+sb+'。';
  if(slot>=3&&slot<=5)return ab+'打数、OPS '+ops+'、長打率 '+slg+'、得点圏打率 '+risp+'、'+rbi+'打点。';
  if(slot===6)return ab+'打数、打率 '+avg+'、出塁率 '+obp+'、OPS '+ops+'、得点圏打率 '+risp+'。';
  if(slot===7)return ab+'打数、打率 '+avg+'、出塁率 '+obp+'、四球 '+bb+'、死球 '+hbp+'。';
  return ab+'打数、出塁率 '+obp+'、四球 '+bb+'、死球 '+hbp+'、盗塁 '+sb+'。';
}
function metricRank(st,key,allStats){
  const value=num(st?.[key]);if(value===null)return null;
  const values=(allStats||[]).map(x=>num(x?.[key])).filter(v=>v!==null);
  if(!values.length)return null;
  const better=values.filter(v=>v>value).length;
  return {rank:better+1,total:values.length,value};
}
function rankText(st,key,label,allStats,rate=true){
  const r=metricRank(st,key,allStats);if(!r)return'';
  return label+'は現チーム記録'+r.total+'名中'+r.rank+'位（'+(rate?fmtRate(r.value):fmtInt(r.value))+'）';
}
function recentEvidence(name,layers){
  const meta=layers?.recentMeta||{};
  if(String(meta.status||'')!=='COMPLETE')return'直近6試合Evidenceは取得できていません。';
  const st=layers.recentMap.get(norm(name));
  if(!st)return'直近6試合に該当選手の集計行がありません。';
  const gameCount=Number(meta.gameCount)||6;
  const overlap=meta.sameAsCurrentSeasonWindow?' 今季通算と対象試合が重なるため、独立した上昇・下降材料として二重評価しません。':'';
  return (meta.windowStart||'期間不明')+'〜'+(meta.windowEnd||'期間不明')+'の直近'+gameCount+'試合：出場 '+fmtInt(st.games)+'、'+fmtInt(st.AB)+'打数'+fmtInt(st.H)+'安打、打率 '+fmtRate(st.AVG)+'、出塁率 '+fmtRate(st.OBP)+'、OPS '+fmtRate(st.OPS)+'。'+overlap;
}
function historicalEvidence(name,layers){
  const meta=layers?.historicalMeta||{};
  if(String(meta.status||'')!=='COMPLETE')return'過去実績Evidenceは取得できていません。';
  const st=layers.historicalMap.get(norm(name));
  if(!st||[st.AB,st.H,st.AVG,st.OPS].every(v=>num(v)===null))return'旧チームで確認できる打撃実績はありません。';
  return (meta.periodStart||'期間不明')+'〜'+(meta.periodEnd||'期間不明')+'：'+fmtInt(st.AB)+'打数'+fmtInt(st.H)+'安打、打率 '+fmtRate(st.AVG)+'、出塁率 '+fmtRate(st.OBP)+'、OPS '+fmtRate(st.OPS)+'。';
}
function usageEvidence(name,layers){
  const row=layers?.usageMap?.get(norm(name));
  const a=row?.appearance||{};
  if(String(a.status||'')==='UNAVAILABLE')return'実打順・先発起用は未確認です。';
  const orders=Object.entries(a.battingOrders||{}).sort((x,y)=>Number(x[0])-Number(y[0])).map(([slot,count])=>slot+'番×'+count).join('、');
  const standard=[...new Set([...Object.keys(a.officialStartingPositions||{}),...Object.keys(a.practiceFirstStartingPositions||{})])].join('・');
  return '先発 '+(Number(a.starts)||0)+'試合（公式戦 '+(Number(a.officialStarts)||0)+'／練習第1試合 '+(Number(a.practiceFirstStarts)||0)+'）、実打順 '+(orders||'記録なし')+'、標準先発守備資格 '+(standard||'なし')+'。';
}
function specificReason(slot,st,allStats){
  if(!st)return'今季通算の数値が不足しているため、実起用・直近・過去実績・守備成立を合わせて判断した配置です。';
  const parts=[];
  if(slot===1){
    parts.push(rankText(st,'OBP','出塁率',allStats),rankText(st,'SB','盗塁',allStats,false));
    return parts.filter(Boolean).join('、')+'。1番は出塁と走塁を中心に全14名で比較します。';
  }
  if(slot===2){
    parts.push(rankText(st,'AVG','打率',allStats),rankText(st,'OBP','出塁率',allStats),rankText(st,'OPS','OPS',allStats));
    return parts.filter(Boolean).join('、')+'。2番は上位で打席を多く回す前提で、出塁と打撃全体を全14名比較します。';
  }
  if(slot===3){
    parts.push(rankText(st,'OPS','OPS',allStats),rankText(st,'SLG','長打率',allStats),rankText(st,'RISP','得点圏打率',allStats));
    return parts.filter(Boolean).join('、')+'。3番は4番への接続と走者を返す打撃の両面を、今季・直近・過去実績で確認します。';
  }
  if(slot===4){
    parts.push(rankText(st,'SLG','長打率',allStats),rankText(st,'OPS','OPS',allStats),rankText(st,'RISP','得点圏打率',allStats));
    return parts.filter(Boolean).join('、')+'。4番は長打・OPS・得点圏と実際の起用を主なEvidenceにし、3賢人の一致度そのものを打撃Evidenceの代わりにはしません。';
  }
  if(slot===5){
    parts.push(rankText(st,'RBI','打点',allStats,false),rankText(st,'RISP','得点圏打率',allStats),rankText(st,'OPS','OPS',allStats));
    return parts.filter(Boolean).join('、')+'。5番は4番後の得点機会を想定し、打点・得点圏・OPSを全14名比較します。';
  }
  if(slot===6){
    parts.push(rankText(st,'OBP','出塁率',allStats),rankText(st,'OPS','OPS',allStats),rankText(st,'RISP','得点圏打率',allStats));
    return parts.filter(Boolean).join('、')+'。6番は中軸後の出塁・打撃継続と守備成立を合わせて確認します。';
  }
  if(slot===7){
    parts.push(rankText(st,'AVG','打率',allStats),rankText(st,'OBP','出塁率',allStats));
    return parts.filter(Boolean).join('、')+'。7番は打撃数値だけでなく、公式戦想定の9守備位置を先発実績で成立させる条件も含めます。';
  }
  if(slot===8){
    parts.push(rankText(st,'OBP','出塁率',allStats),rankText(st,'BB','四球',allStats,false));
    return parts.filter(Boolean).join('、')+'。8番は下位打線の出塁と、先発守備Evidenceを伴う全体配置の成立を合わせて確認します。';
  }
  parts.push(rankText(st,'OBP','出塁率',allStats),rankText(st,'BB','四球',allStats,false),rankText(st,'SB','盗塁',allStats,false));
  return parts.filter(Boolean).join('、')+'。9番は1番への接続を意識しつつ、出塁・走塁と守備成立を確認します。';
}
function observationSummary(layers){
  if(layers?.observationStatus!=='COMPLETE')return'観察Evidenceはこの審議では利用不可または未取得です。';
  const latest=layers.observationLatest?'、最新記録 '+layers.observationLatest:'';
  return '日付付き観察Evidence '+layers.observationCount+'件を審議に供給済み'+latest+'。観察は数値・実起用を上書きする命令ではなく補助Evidenceです。';
}
function clipText(value,limit=150){
  const s=String(value??'').trim();
  return s.length>limit?s.slice(0,limit-1)+'…':s;
}
function playerObservationEvidence(name,layers){
  if(layers?.observationStatus!=='COMPLETE')return'権限内の個別観察Evidenceは表示できません。';
  const rows=(layers.observations||[])
    .filter(o=>norm(o?.player)===norm(name)&&String(o?.statement||'').trim())
    .sort((a,b)=>String(b?.recordedAt||'').localeCompare(String(a?.recordedAt||'')))
    .slice(0,2);
  if(!rows.length)return'この選手を対象にした日付付き観察はありません。';
  return rows.map(o=>{
    const when=String(o?.recordedAt||'日時不明').trim()||'日時不明';
    const source=String(o?.sourceType||'情報源不明').trim()||'情報源不明';
    const scene=String(o?.scene||'').trim();
    return when+'／'+source+(scene?'／'+scene:'')+'：'+clipText(o.statement);
  }).join(' ｜ ');
}
function overview(r,entries,names,layers){
  const top=groupCount(entries),source=selectedSource(r,entries,names);
  const basis='下の理由は、全14名の今季通算・直近6試合・過去実績・実打順/守備起用を主Evidenceとして表示し、3賢人の一致度は別枠の審議情報として示します。';
  if(top===3)return'3賢人の二次判定が1〜9番まで完全一致しました。'+basis;
  if(top===2)return'3賢人の二次案は2対1に分かれました。'+(source?'表示案は'+source+'の二次案と一致します。':'')+' '+basis;
  return'3賢人の二次案は1対1対1で分かれ、正式な多数派はありません。'+(source?'表示中は'+source+'の二次案を参考案として採用しています。':'')+' '+basis;
}
function supportText(n){return n===3?'3/3一致':n===2?'2/3支持':n===1?'1/3・争点あり':'0/3・整合要確認';}
function supportClass(n){return n===3?'strong':n<=1?'split':'';}
function reasoningLine(support,slot,name){
  if(support===0)return`3賢人の二次打順案に${slot}番${name}の配置が見つかりません。最終案との整合確認が必要です。`;
  if(support===3)return`3賢人全員が二次判定で${slot}番に${name}を配置。ここは最も合意が強い打順です。`;
  if(support===2)return`3賢人中2人が二次判定で${slot}番に${name}を配置。多数側が同じ位置を支持しています。`;
  return`この${slot}番配置を支持したのは3賢人中1人です。多数一致ではなく、打線全体の比較で選ばれた参考案上の配置です。`;
}
function fieldingEvidenceLine(row){
  const position=String(row?.positionLabel||row?.position||'').trim();
  const e=row?.positionEvidence||{};
  const official=Number(e.officialStarts)||0,practiceFirst=Number(e.practiceFirstStarts)||0,total=Number(e.totalStarts)||0,recent=Number(e.recentStarts)||0,appearances=Number(e.fieldingAppearances)||0;
  if(!position)return'守備位置が最終結果に含まれていません。';
  if(total<=0&&appearances<=0)return`${position}：確認できる実起用Evidenceがありません。守備配置の再確認が必要です。`;
  const base=`${position}：先発 ${total}試合（公式戦 ${official}、練習試合第1試合 ${practiceFirst}）、直近先発 ${recent}試合、守備出場 ${appearances}試合。`;
  if(total===0&&appearances>0)return base+'先発実績はなく、守備出場のみが根拠のためEvidenceは薄めです。';
  if(official===0&&practiceFirst===0)return base+'公式戦・練習試合第1試合での先発根拠は確認できません。';
  return base;
}
function render(r,data){
  injectStyle();
  const hero=document.querySelector('.magiFinalDecisionHero');
  if(!hero)return false;
  const rows=finalRows(r);
  const names=finalNames(r);
  const entries=secondEntries(r).filter(e=>e.order.length===9);
  if(names.length!==9||entries.length!==3)return false;
  const evidenceStamp=[r?.case?.evidence?.resolverVersion||'',r?.case?.evidence?.recentSix?.windowEnd||'',...(r?.case?.evidence?.sources||[]).map(s=>String(s?.modifiedTime||''))].join('|');
  const signature=[names.map(norm).join('|'),...entries.map(e=>e.order.map(norm).join('|')),evidenceStamp].join('::');
  if(lastSignature===signature&&hero.querySelector('.magiLineupReasons'))return true;
  const old=hero.querySelector('.magiLineupReasons');if(old)old.remove();
  const section=document.createElement('section');section.className='magiLineupReasons';section.setAttribute('aria-label','1番から9番の選定理由');
  const layers=evidenceLayers(r,data);
  const statsMap=layers.currentMap;
  const allCurrentStats=layers.currentAll;
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
  html+=`<div class="magiLineupReasonsOverview">${esc(overview(r,entries,names,layers))}<br>${esc(observationSummary(layers))}</div>`;
  if(hasFallback(entries)){
    html+='<div class="magiLineupReasonWarning">二次判定に暫定維持データが含まれるため、1〜9番の理由は表示しません。実際の二次判定を取得してから再表示します。</div>';
    section.innerHTML=html;
    const method=hero.querySelector('.magiFinalDecisionMethod'),field=hero.querySelector('.magiFinalFieldingNote');
    if(method)hero.insertBefore(section,method);else if(field)hero.insertBefore(section,field);else hero.appendChild(section);
    lastSignature=signature;hero.dataset.magiLineupReasons='419';return true;
  }
  html+='<div class="magiLineupReasonList">';
  names.forEach((name,index)=>{
    const slot=index+1,support=exactSlotSupport(entries,slot,name),alts=slotAlternatives(entries,slot,name),st=statsMap.get(norm(name));
    html+=`<article class="magiLineupReasonCard"><div class="magiLineupReasonHead"><div class="magiLineupReasonName"><span class="magiLineupReasonSlot">${slot}番</span><span>${esc(name)}</span></div><span class="magiLineupReasonSupport ${supportClass(support)}">${supportText(support)}</span></div>`;
    html+=`<div class="magiLineupReasonLine"><b>審議一致：</b>${esc(reasoningLine(support,slot,name))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>今季通算：</b>${esc(statEvidence(slot,st))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>直近6試合：</b>${esc(recentEvidence(name,layers))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>過去実績：</b>${esc(historicalEvidence(name,layers))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>実起用：</b>${esc(usageEvidence(name,layers))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>観察Evidence：</b>${esc(playerObservationEvidence(name,layers))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>配置判断：</b>${esc(specificReason(slot,st,allCurrentStats))}</div>`;
    html+=`<div class="magiLineupReasonLine"><b>守備根拠：</b>${esc(fieldingEvidenceLine(rows[index]))}</div>`;
    if(alts.length)html+=`<div class="magiLineupReasonAlternatives"><b>同じ打順位置の別案：</b> ${esc(alts.join(' ／ '))}</div>`;
    html+='</article>';
  });
  html+='</div>';
  section.innerHTML=html;
  const method=hero.querySelector('.magiFinalDecisionMethod');
  const field=hero.querySelector('.magiFinalFieldingNote');
  if(method)hero.insertBefore(section,method);else if(field)hero.insertBefore(section,field);else hero.appendChild(section);
  lastSignature=signature;
  hero.dataset.magiLineupReasons='419';
  return true;
}
async function apply(){
  const r=result();
  if(!r||String(r?.final?.mode||'').toUpperCase()!=='FULL_LINEUP')return false;
  if(finalNames(r).length!==9)return false;
  const data=hasStructuredBattingEvidence(r)?null:await loadStats();
  return render(r,data);
}
function run(){if(scheduled)return;scheduled=true;requestAnimationFrame(async()=>{scheduled=false;await apply().catch(()=>{});});}
document.addEventListener('magi:deliberation-result',()=>run());
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
let tries=0;const timer=setInterval(async()=>{tries++;if(await apply().catch(()=>false)||tries>=240)clearInterval(timer)},200);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();

window.MAGI_LINEUP_REASONS_V415_API=Object.freeze({version:'lineup-reasons-v420',secondEntries,exactSlotSupport,slotAlternatives,selectedSource,sameOrder,metricRank,specificReason});
})();
