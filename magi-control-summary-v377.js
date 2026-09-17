(()=>{
'use strict';
if(globalThis.MAGI_CONTROL_SUMMARY_V377)return;

const PERSONAS=[
  {key:'melchior',label:'MELCHIOR',name:'MELCHIOR-1'},
  {key:'balthasar',label:'BALTHASAR',name:'BALTHASAR-2'},
  {key:'casper',label:'CASPER',name:'CASPER-3'}
];
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　]/g,'');
const unique=arr=>[...new Set((arr||[]).map(txt).filter(Boolean))];

function personaValue(container,persona,index){
  if(Array.isArray(container))return container[index]||null;
  if(container&&container[persona.key])return container[persona.key];
  const values=Object.values(container||{});
  return values.find(v=>String(v?.persona||'').toUpperCase().includes(persona.label))||values[index]||null;
}
function orderOf(value){return Array.isArray(value?.candidatePlayers)?value.candidatePlayers.map(txt).filter(Boolean):[]}
function finalOrder(result){return Array.isArray(result?.final?.lineup)?result.final.lineup.map(x=>txt(x?.name)).filter(Boolean):[]}
function signature(order){return (order||[]).map(norm).join('|')}
function evidence(result){return result?.case?.evidence||{}}
function question(result){return txt(result?.case?.question)}
function teamPolicy(result){return evidence(result)?.teamPolicy||{}}
function threshold(result){return Number(teamPolicy(result)?.sampleSize?.practicalBattingAtBatsSufficient)||15}
function asksHandedness(result){return /(?:対右|対左|右投手|左投手|右腕|左腕|左右別|左右の相性|相手投手.{0,8}(?:右|左))/.test(question(result).normalize('NFKC'))}
function recentProvided(result){
  const e=evidence(result);
  return e?.numericEvidenceContract?.recentSixNumbersProvided===true||String(e?.recentSix?.status||'').toUpperCase()==='COMPLETE';
}
function currentPlayerRows(result){
  const e=evidence(result);
  if(Array.isArray(e?.allCurrentTeamCheck?.players))return e.allCurrentTeamCheck.players;
  return [];
}
function abMap(result){
  const map=new Map();
  for(const p of currentPlayerRows(result)){
    const ab=Number(String(p?.batting?.AB??'').replace(/,/g,''));
    if(Number.isFinite(ab))map.set(norm(p?.name),ab);
  }
  return map;
}
function allSelectedAtLeast(result,order,min){
  const map=abMap(result);
  if(!order?.length||!map.size)return false;
  return order.every(name=>{const n=map.get(norm(name));return Number.isFinite(n)&&n>=min});
}
function currentNumericTokens(result){
  const fields=['AVG','OPS','OBP','SLG','RISP','RISP_AVG','AB','PA','H','RBI','BB','HBP','SB'];
  const out=[];
  for(const p of currentPlayerRows(result))for(const k of fields){
    const v=txt(p?.batting?.[k]);if(!v)continue;out.push(v);if(/^0\.\d+$/.test(v))out.push(v.slice(1));
  }
  return unique(out).filter(v=>v.length>=2);
}
function dropSentenceSegments(s,predicate){
  const hadEnd=/[。！？!?]$/.test(s);
  const parts=s.split('。').map(x=>x.trim()).filter(Boolean).filter(x=>!predicate(x));
  if(!parts.length)return'';
  return parts.join('。')+(hadEnd?'。':'');
}
function sanitizeSpeech(value,result){
  let s=txt(value);if(!s||!result)return s;
  const qAsksHand=asksHandedness(result);
  const handRe=/(?:対右|対左|右投手|左投手|右腕|左腕|左右別|左右の相性|相手投手.{0,12}(?:右|左)|(?:右|左).{0,8}相手投手)/;
  if(!qAsksHand&&handRe.test(s))s=dropSentenceSegments(s,seg=>handRe.test(seg));

  const min=threshold(result),order=finalOrder(result),allEnough=allSelectedAtLeast(result,order,min),map=abMap(result);
  const sampleRe=/(?:母数|サンプル|打席数|打数).{0,20}(?:少な|不足|足りな|蓄積|増え|増や|精査|慎重)/;
  if(sampleRe.test(s)){
    s=dropSentenceSegments(s,seg=>{
      if(!sampleRe.test(seg))return false;
      const named=currentPlayerRows(result).filter(p=>seg.includes(txt(p?.name)));
      if(named.length)return named.every(p=>(map.get(norm(p?.name))??-1)>=min);
      return allEnough;
    });
  }

  if(!recentProvided(result)&&/直近/.test(s)){
    const tokens=currentNumericTokens(result);
    if(tokens.some(v=>s.includes(v))&&!/(?:直近6試合|直近六試合).{0,20}(?:未提供|取得でき|確認でき|データがない|データなし)/.test(s)){
      s=s.replace(/直近(?:6試合|六試合)?で/g,'今季通算で').replace(/直近(?:6試合|六試合)?の/g,'今季通算の').replace(/直近で/g,'今季通算で');
    }
  }
  return txt(s)||'打線のつながり、今季通算成績、守備・起用の整合を基準に検証します。';
}
function stripLineupRecital(value){
  let s=txt(value).replace(/^(?:候補|再選定)\s*[:：]\s*/,'');
  const full=/(?:^|[。！？!?]\s*)1番[\s\S]{0,520}?2番[\s\S]{0,520}?3番[\s\S]{0,520}?4番[\s\S]{0,520}?5番[\s\S]{0,520}?6番[\s\S]{0,520}?7番[\s\S]{0,520}?8番[\s\S]{0,520}?9番[^。！？!?]*(?:[。！？!?]|$)/;
  s=s.replace(full,' ').replace(/^[/／,，、\s]+|[/／,，、\s]+$/g,'').trim();
  return s;
}
function neutralizeSummarySpeech(value,label){
  let s=txt(value).replace(/\s+/g,' ');
  if(!s)return'';
  const who=txt(label)||'当該賢人';
  s=s
    .replace(/俺は/g,`${who}は`)
    .replace(/僕は/g,`${who}は`)
    .replace(/私は/g,`${who}は`)
    .replace(/俺の/g,`${who}の`)
    .replace(/僕の/g,`${who}の`)
    .replace(/私の/g,`${who}の`);
  return s;
}
function cleanReason(value,result,label){
  const candidates=[value?.candidateBasis,value?.primaryReason,value?.publicStatement,value?.changeReason];
  for(const raw of candidates){
    let s=sanitizeSpeech(raw,result);if(!s)continue;
    const before=s;s=stripLineupRecital(s);
    if(!s||(/^1番/.test(s)&&/9番/.test(s)))continue;
    if(s===before&&/^(?:1番|候補|再選定)/.test(s)&&/9番/.test(s))continue;
    return neutralizeSummarySpeech(s,label);
  }
  return'';
}
function practicalConditions(result,order){
  const raw=Array.isArray(result?.final?.reDeliberationConditions)?result.final.reDeliberationConditions:[];
  const qAsksHand=asksHandedness(result),min=threshold(result),allEnough=allSelectedAtLeast(result,order,min);
  const handRe=/(?:対右|対左|右投手|左投手|右腕|左腕|左右別|左右の相性|相手投手.{0,12}(?:右|左))/;
  const sampleRe=/(?:母数|サンプル|打席数|打数).{0,24}(?:少な|不足|足りな|蓄積|増え|増や|精査|慎重)|10打数台/;
  const filtered=unique(raw).filter(s=>{
    if(!qAsksHand&&handRe.test(s))return false;
    if(allEnough&&sampleRe.test(s))return false;
    return true;
  }).map(s=>sanitizeSpeech(s,result)).filter(Boolean).slice(0,3);
  if(filtered.length)return filtered;
  const bits=['今季通算成績'];
  if(recentProvided(result))bits.push('直近6試合の傾向');
  bits.push('守備・起用条件');
  return [`${bits.join('・')}に明確な変化が出た場合`];
}
function groupEntries(entries){
  const map=new Map();
  for(const e of entries){
    const sig=signature(e.order);if(!sig)continue;
    if(!map.has(sig))map.set(sig,[]);
    map.get(sig).push(e);
  }
  return [...map.entries()].map(([sig,rows])=>({sig,rows,order:rows[0]?.order||[]})).sort((a,b)=>b.rows.length-a.rows.length);
}
function conflictText(baseOrder,others){
  const priority=[4,3,5,1,2,6,7,8,9];
  const out=[];
  for(const slot of priority){
    const base=baseOrder?.[slot-1];if(!base)continue;
    const diffs=others.map(o=>({label:o.label,name:o.order?.[slot-1]})).filter(x=>x.name&&norm(x.name)!==norm(base));
    if(!diffs.length)continue;
    out.push(`${slot}番（基準案：${base}／${diffs.map(x=>`${x.label}：${x.name}`).join('・')}）`);
    if(out.length>=2)break;
  }
  return out.join('、');
}
function primarySecondChanges(result,entries){
  const out=[];
  for(const e of entries){
    const first=orderOf(personaValue(result?.primary,e.persona,e.index));
    const second=e.order;
    if(first.length!==9||second.length!==9)continue;
    for(const slot of [4,3,5,1,2]){
      const a=first[slot-1],b=second[slot-1];
      if(a&&b&&norm(a)!==norm(b)){
        out.push(`${e.label}は相互検証後、${slot}番を${a}から${b}へ変更しました。`);
        break;
      }
    }
  }
  return unique(out).slice(0,2);
}
function buildFullLineup(result){
  const entries=PERSONAS.map((persona,index)=>({persona,index,label:persona.label,name:persona.name,value:personaValue(result?.second,persona,index)}))
    .map(e=>({...e,order:orderOf(e.value)})).filter(e=>e.order.length===9);
  if(entries.length!==3)return null;
  const groups=groupEntries(entries);if(!groups.length)return null;
  const selected=finalOrder(result);
  const selectedSig=signature(selected);
  const selectedGroup=groups.find(g=>g.sig===selectedSig)||groups[0];
  const top=groups[0];
  let decisionType='DEADLOCK',vote='1-1-1',label='3人の意見が分かれました',supportGroup=selectedGroup;
  if(top.rows.length===3){decisionType='CONSENSUS';vote='3-0';label='3対0 CONSENSUS';supportGroup=top}
  else if(top.rows.length===2){decisionType='MAJORITY';vote='2-1';label='2対1 MAJORITY';supportGroup=top}

  const supportingLabels=supportGroup.rows.map(x=>x.label);
  const minority=decisionType==='MAJORITY'?entries.find(e=>!supportGroup.rows.includes(e)):null;
  const others=entries.filter(e=>!supportGroup.rows.includes(e));
  let decisionLead='';
  if(decisionType==='CONSENSUS')decisionLead='3賢人が二次判定で同一の打順案を支持しました。';
  else if(decisionType==='MAJORITY')decisionLead=`${supportingLabels.join('と')}が同一の二次打順案を支持し、${minority?.label||'少数側'}は別案を維持しました。`;
  else decisionLead='3賢人の二次打順案は3つに分かれ、正式な多数派は成立しませんでした。表示中の打順は比較のための参考案（暫定）で、正式採用ではありません。';

  const decisiveReasons=decisionType==='DEADLOCK'?[]:unique(supportGroup.rows.map(e=>cleanReason(e.value,result,e.label))).filter(Boolean).slice(0,2);
  const mainDisagreement=conflictText(supportGroup.order,others);
  const minorityOpinion=minority?cleanReason(minority.value,result,minority.label):'';
  const majorChanges=primarySecondChanges(result,entries);
  const reDeliberationConditions=practicalConditions(result,supportGroup.order);

  return Object.freeze({
    mode:'FULL_LINEUP',decisionType,vote,label,
    supportingPersonas:supportingLabels,
    minorityPersona:minority?.label||'',
    decisionLead,
    decisiveReasons,
    mainDisagreement,
    minorityOpinion,
    majorChanges,
    reDeliberationConditions
  });
}
function build(result){
  if(!result||result?.final?.mode!=='FULL_LINEUP')return null;
  return buildFullLineup(result);
}

globalThis.MAGI_CONTROL_SUMMARY_V377=Object.freeze({
  version:'control-summary-v394',
  build,
  sanitizeSpeech,
  recentProvided,
  threshold
});
})();