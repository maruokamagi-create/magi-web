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
  .magiRecordedDispute{margin:11px 0 13px;padding:12px;border:1px solid #c4d6e3;border-radius:11px;background:#f7fafc}
  .magiRecordedDisputeTitle{font-size:13px;font-weight:950;color:#0b2742;margin-bottom:7px}
  .magiRecordedDisputeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .magiRecordedDisputePlayer{padding:10px;border:1px solid #d6e3ec;background:#fff;border-radius:9px;min-width:0}
  .magiRecordedDisputePlayerName{font-weight:900;font-size:12px;margin-bottom:5px}
  .magiRecordedDisputeLine{font-size:11px;line-height:1.65;overflow-wrap:anywhere;margin-top:4px;color:#254158}
  .magiRecordedDisputeNote{font-size:11px;line-height:1.65;color:#465e71;margin-top:8px}
  .magiRecordedDisputeOnly{border-top:2px solid #bad7ea;margin-top:12px;padding-top:10px}
  @media(max-width:480px){.magiRecordedDisputeGrid{grid-template-columns:1fr}.magiRecordedDisputePlayer{padding:9px}.magiRecordedDisputeLine{font-size:11px}}
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
function adjacentSwapReviews(entries,names,statsMap){
  const reviews=[];
  for(let i=0;i<names.length-1;i++){
    const left=names[i],right=names[i+1];
    const majority=entries.filter(e=>norm(e.order?.[i])===norm(left)&&norm(e.order?.[i+1])===norm(right));
    const dissent=entries.filter(e=>norm(e.order?.[i])===norm(right)&&norm(e.order?.[i+1])===norm(left));
    if(majority.length!==2||dissent.length!==1)continue;
    const leftStats=statsMap?.get(norm(left)),rightStats=statsMap?.get(norm(right));
    const statLine=st=>st
      ? fmtInt(st.AB)+'打数、打率 '+fmtRate(st.AVG)+'、出塁率 '+fmtRate(st.OBP)+'、長打率 '+fmtRate(st.SLG)+'、OPS '+fmtRate(st.OPS)
      : '今季通算の数値Evidence未取得';
    const opsLeft=num(leftStats?.OPS),opsRight=num(rightStats?.OPS);
    const slgLeft=num(leftStats?.SLG),slgRight=num(rightStats?.SLG);
    let comparison='OPSと長打率の両方を確認できないため、数値による二案の優劣は保留します。';
    if(opsLeft!==null&&opsRight!==null&&slgLeft!==null&&slgRight!==null){
      if(opsLeft<opsRight&&slgLeft<slgRight)comparison='今季通算のOPS・長打率は'+right+'が高い記録です。';
      else if(opsLeft>opsRight&&slgLeft>slgRight)comparison='今季通算のOPS・長打率は'+left+'が高い記録です。';
      else comparison='今季通算のOPS・長打率は同じ選手が両方で上回る関係ではありません。';
    }
    reviews.push({
      firstSlot:i+1,
      secondSlot:i+2,
      text:'二次審議の多数派（2名）は'+(i+1)+'番'+left+'・'+(i+2)+'番'+right+'、少数派（'+dissent[0].label+'）は順序を逆にしています。'
        +'今季通算 '+left+'：'+statLine(leftStats)+'。'+right+'：'+statLine(rightStats)+'。'
        +comparison+'これらの数値も2対1の票数も、この打順位置の優位性を証明しません。'
        +'この2人の打順を交換しても9人の守備配置自体は変わらず、実打順・直近記録・得点圏実績などを含む位置別の説明が引き続き必要です。'
    });
  }
  return reviews;
}
// User-visible evidence is assembled exclusively from the authoritative
// CASE packet, never from a persona's unverified prose. Validate the official
// 14-player identity before treating a source's missing slot as a zero sample.
function verifiedCurrentPlayerKeys(e){
  const list=e?.allCurrentTeamCheck?.players;
  if(e?.allCurrentTeamCheck?.status!=='COMPLETE'||!Array.isArray(list)||list.length!==14)return null;
  const keys=list.map(x=>norm(x?.name)).filter(Boolean);
  return new Set(keys).size===14?new Set(keys):null;
}
function verifiedSourcePlayers(e,key){
  const roster=verifiedCurrentPlayerKeys(e),source=e?.[key],list=source?.players;
  if(!roster||source?.status!=='COMPLETE'||!Array.isArray(list)||list.length!==14)return null;
  const keys=list.map(x=>norm(x?.name));
  if(new Set(keys).size!==14||keys.some(x=>!roster.has(x)))return null;
  if(key==='appearanceFielding'&&source?.appearanceStatus!=='COMPLETE')return null;
  return new Map(list.map(x=>[norm(x.name),x]));
}
function strictCount(v){
  const s=String(v??'').trim();
  if(!/^\d+$/.test(s))return null;
  const n=Number(s);
  return Number.isSafeInteger(n)?n:null;
}
function safeRate(v,kind){
  const s=String(v??'').trim();
  if(!/^(?:\d+|\d*\.\d+)$/.test(s))return null;
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||(['AVG','OBP','SLG'].includes(kind)&&n>1)||n>5)return null;
  return s;
}
function recordedSlotSample(e,name,slot){
  const source=verifiedSourcePlayers(e,'battingOrderSplits');
  if(!source||!source.has(norm(name)))return {status:'UNAVAILABLE',text:'打順別の標準試合成績は未確認'};
  const slots=source.get(norm(name))?.slots;
  if(!Array.isArray(slots)||new Set(slots.map(x=>x?.slot)).size!==slots.length||
    slots.some(x=>!Number.isInteger(x?.slot)||x.slot<1||x.slot>9))
    return {status:'UNAVAILABLE',text:'打順別の記録形式を確認できません'};
  const row=slots.find(x=>x.slot===slot);
  if(!row)return {status:'NO_PA',text:'標準試合でこの打順の打席記録なし（打撃能力の評価ではありません）'};
  const b=row.standard?.batting||{};
  const PA=strictCount(b.PA),AB=strictCount(b.AB),H=strictCount(b.H);
  if(PA===null||AB===null||H===null||AB>PA||H>AB)
    return {status:'UNAVAILABLE',text:'標準試合の打席・打数・安打を照合できません'};
  const ch=strictCount(row.challenge?.batting?.PA);
  const challenge=ch===null?'':('／練習第2試合 '+ch+'打席（別枠）');
  if(PA===0)return {status:'NO_PA',text:'標準試合0打席・0打数'+challenge+'。結果の優劣は判定できません'};
  const rates=['AVG','OBP','SLG','OPS'].map(k=>{
    const raw=safeRate(b[k],k);
    return raw===null?'':{AVG:'打率',OBP:'出塁率',SLG:'長打率',OPS:'OPS'}[k]+' '+raw;
  }).filter(Boolean);
  return {status:'RECORDED',PA,AB,H,text:'標準試合 '+PA+'打席・'+AB+'打数・'+H+'安打'
    +(rates.length?'、'+rates.join('・'):'')+challenge};
}
function datedSlotStarts(e,name,slots){
  const source=verifiedSourcePlayers(e,'appearanceFielding');
  const a=source?.get(norm(name))?.appearance;
  if(!source||a?.status!=='COMPLETE'||!Array.isArray(a.latestStarts))return '標準先発の日付は未確認';
  const recent=a.latestStarts.filter(x=>slots.includes(x?.order)&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))&&
     (x.competitionType==='OFFICIAL'||(x.competitionType==='PRACTICE'&&x.practiceRole==='REGULAR_GAME_1')))
    .slice(-3);
  if(!recent.length)return '直近の先発履歴一覧に該当記録なし（全期間の不在を意味しません）';
  return recent.map(x=>x.date+' '+x.order+'番／'+(x.competitionType==='OFFICIAL'?'公式戦':'練習第1試合')).join('、');
}
function datedSlotCoachObservation(e,name){
  if(e?.normalizedObservationStatus!=='COMPLETE'||!Array.isArray(e.normalizedObservations))return '指導者観察は未取得または権限外';
  const rows=e.normalizedObservations.filter(x=>norm(x?.player)===norm(name)&&x?.sourceType==='指導者'&&
     /^20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]|$)/.test(String(x?.recordedAt||''))&&
     typeof x?.statement==='string'&&x.statement.length<=280&&
     /打順|打撃|打席|打率|出塁|打球|バッティング|スイング/.test(x.statement));
  if(!rows.length)return '該当する日付付き指導者の打撃観察なし';
  rows.sort((a,b)=>String(b.recordedAt).localeCompare(String(a.recordedAt)));
  return rows[0].recordedAt+'（記録当時の観察・現在の固定方針ではありません）'+clipText(rows[0].statement,115);
}
// A full 1-1-1 split can still be 2-vs-1 at the disputed local 3/4 pair.
// This *local* count is NEVER a final nine-player majority or selected lineup.
function localAdjacentSwaps(entries){
  const found=[];
  if(!Array.isArray(entries)||entries.length!==3||entries.some(x=>x.order?.length!==9))return found;
  for(let i=0;i<8;i++){
    const votes=entries.map(x=>({label:x.label,a:x.order[i],b:x.order[i+1]}));
    const first=votes[0];if(!first?.a||!first?.b||norm(first.a)===norm(first.b))continue;
    const same=votes.filter(v=>norm(v.a)===norm(first.a)&&norm(v.b)===norm(first.b));
    const flipped=votes.filter(v=>norm(v.a)===norm(first.b)&&norm(v.b)===norm(first.a));
    if(same.length+flipped.length!==3||Math.min(same.length,flipped.length)!==1)continue;
    const prevailing=same.length===2?same:flipped;
    const dissenter=same.length===1?same:flipped;
    found.push({firstSlot:i+1,secondSlot:i+2,left:prevailing[0].a,right:prevailing[0].b,
      supporting:prevailing.map(v=>v.label),dissent:dissenter[0].label});
  }
  return found.sort((a,b)=>{
    const priority=x=>(x.firstSlot>=3&&x.firstSlot<=5?0:1);
    return priority(a)-priority(b)||a.firstSlot-b.firstSlot;
  }).slice(0,3);
}
function recordedDisputeCards(entries,e){
  const roster=verifiedCurrentPlayerKeys(e);
  if(!roster)return [];
  return localAdjacentSwaps(entries).filter(pair=>roster.has(norm(pair.left))&&roster.has(norm(pair.right))).map(pair=>{
    const slots=[pair.firstSlot,pair.secondSlot];
    const people=[pair.left,pair.right].map(name=>({
      name,records:slots.map(slot=>({slot,...recordedSlotSample(e,name,slot)})),
      starts:datedSlotStarts(e,name,slots),
      coach:datedSlotCoachObservation(e,name)
    }));
    return {...pair,people};
  });
}
function recordedDisputeHtml(entries,e){
  const pairs=recordedDisputeCards(entries,e);
  if(!pairs.length)return '';
  return pairs.map(pair=>{
    const headline=pair.firstSlot+'・'+pair.secondSlot+'番：'+pair.supporting.join('・')+'の配置は'+
      pair.firstSlot+'番'+pair.left+'／'+pair.secondSlot+'番'+pair.right+
      '。'+pair.dissent+'は逆順（この部分の票数であり、全9人の多数決ではありません）。';
    return '<section class="magiRecordedDispute" aria-label="'+pair.firstSlot+'・'+pair.secondSlot+'番の実打順比較">'+
      '<div class="magiRecordedDisputeTitle">'+esc(pair.firstSlot+'・'+pair.secondSlot+'番　実打順と実起用の比較')+'</div>'+
      '<div class="magiRecordedDisputeNote">'+esc(headline)+'</div>'+
      '<div class="magiRecordedDisputeGrid">'+pair.people.map(player=>
        '<div class="magiRecordedDisputePlayer"><div class="magiRecordedDisputePlayerName">'+esc(player.name)+'</div>'+
        player.records.map(x=>'<div class="magiRecordedDisputeLine"><b>'+x.slot+'番の実績：</b>'+esc(x.text)+'</div>').join('')+
        '<div class="magiRecordedDisputeLine"><b>日付付き標準先発：</b>'+esc(player.starts)+'</div>'+
        '<div class="magiRecordedDisputeLine"><b>指導者観察：</b>'+esc(player.coach)+'</div></div>'
      ).join('')+'</div>'+
      '<div class="magiRecordedDisputeNote">公式戦＋練習第1試合と練習第2試合は別集計。打席数が少ない場合や未経験の打順では位置別の優劣は確定できず、この比較は得点・勝率への因果効果を示しません。</div></section>';
  }).join('');
}
// Deadlock must not fabricate a chosen lineup or use the normal 1–9 cards.
function deadlockDisputeHtml(r){
  if(r?.final?.mode!=='FULL_LINEUP'||r?.final?.status!=='LINEUP_REVIEW_REQUIRED'||
     r?.final?.finalVote!=='1-1-1'||Array.isArray(r?.final?.lineup)&&r.final.lineup.length!==0)return '';
  const entries=secondEntries(r).filter(x=>x.order.length===9);
  if(entries.length!==3)return '';
  return '<div class="magiRecordedDisputeOnly" role="region" aria-label="未決定の打順対立の記録比較">'+
   '<div class="magiLineupReasonsTitle">打順の対立・実記録の比較</div>'+
   '<div class="magiRecordedDisputeNote">3賢人の全9人案は1対1対1で、最終オーダーは確定していません。以下は争点の記録比較であり、採用打順ではありません。</div>'+
   (recordedDisputeHtml(entries,r?.case?.evidence||{})||'<div class="magiRecordedDisputeNote">位置を交換した対立は確認できないか、記録の完全性を確認できません。打順の優劣は判定しません。</div>')+'</div>';
}
function renderDeadlock(r){
  const html=deadlockDisputeHtml(r);
  if(!html)return false;
  injectStyle();
  const host=document.querySelector('.magiFinalDecisionHero')||
    document.querySelector('.final')||document.querySelector('#response');
  if(!host)return false;
  const signature=JSON.stringify([r?.final?.finalVote,r?.second?.melchior?.candidatePlayers,
    r?.second?.balthasar?.candidatePlayers,r?.second?.casper?.candidatePlayers,
    r?.case?.evidence?.battingOrderSplits?.source?.modifiedTime,
    r?.case?.evidence?.appearanceFielding?.sources?.map(x=>x.modifiedTime)]);
  const previous=host.querySelector('.magiRecordedDisputeOnly');
  if(previous&&previous.dataset.signature===signature)return true;
  if(previous)previous.remove();
  const el=document.createElement('section');
  el.innerHTML=html;
  const panel=el.firstElementChild;
  if(!panel)return false;
  panel.dataset.signature=signature;
  host.appendChild(panel);
  return true;
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
    lastSignature=signature;hero.dataset.magiLineupReasons='422';return true;
  }
  for(const review of adjacentSwapReviews(entries,names,statsMap)){
    html+=`<div class="magiLineupReasonWarning"><b>${review.firstSlot}・${review.secondSlot}番の根拠を比較：</b> ${esc(review.text)}</div>`;
  }
  html+=recordedDisputeHtml(entries,r?.case?.evidence||{});
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
  if(finalNames(r).length!==9)return renderDeadlock(r);
  const data=hasStructuredBattingEvidence(r)?null:await loadStats();
  return render(r,data);
}
function run(){if(scheduled)return;scheduled=true;requestAnimationFrame(async()=>{scheduled=false;await apply().catch(()=>{});});}
document.addEventListener('magi:deliberation-result',()=>run());
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
let tries=0;const timer=setInterval(async()=>{tries++;if(await apply().catch(()=>false)||tries>=240)clearInterval(timer)},200);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();

window.MAGI_LINEUP_REASONS_V415_API=Object.freeze({version:'lineup-reasons-v422',secondEntries,exactSlotSupport,slotAlternatives,selectedSource,sameOrder,metricRank,specificReason,adjacentSwapReviews,localAdjacentSwaps,recordedSlotSample,recordedDisputeCards,recordedDisputeHtml,deadlockDisputeHtml});
})();
