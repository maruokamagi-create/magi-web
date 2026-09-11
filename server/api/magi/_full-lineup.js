import { CURRENT_ROSTER, canonicalCurrentPlayerNameStrict, playerKey } from './_roster.js';

function text(v){return String(v??'').trim();}

export function isFullLineupQuestion(input){
  const caseData=typeof input==='string'?{question:input}:(input||{});
  if(String(caseData?.selectionKind||'').toUpperCase()==='FULL_LINEUP') return true;
  if(String(caseData?.mode||'').toLowerCase()==='lineup') return true;
  const q=text(caseData?.question).normalize('NFKC');
  if(!q) return false;
  if(/(?:ベストオーダー|ベスト打順)/.test(q)) return true;
  if(/(?:打順|オーダー|打線).{0,16}(?:どうする|どう組|組んで|組む|組みたい|考えて|考える|決めて|決める|作って|作る)/.test(q)) return true;
  if(/(?:組んで|組む|作って|作る|考えて|考える).{0,12}(?:打順|オーダー|打線)/.test(q)) return true;
  if(/1番.{0,40}9番|一番.{0,40}九番/.test(q)) return true;
  return false;
}

export function validateFullLineupOrder(values){
  const supplied=Array.isArray(values)?values:[];
  const normalized=[];
  const invalid=[];
  const seen=new Set();
  const duplicates=[];
  for(const raw of supplied){
    const official=canonicalCurrentPlayerNameStrict(raw);
    if(!official){invalid.push(text(raw));continue;}
    const key=playerKey(official);
    if(seen.has(key)){duplicates.push(official);continue;}
    seen.add(key);normalized.push(official);
  }
  const issues=[];
  if(supplied.length!==9) issues.push(`打順は9人必要です（現在${supplied.length}人）`);
  if(invalid.length) issues.push(`現チーム外または未登録の選手があります: ${invalid.join('・')}`);
  if(duplicates.length) issues.push(`打順内に重複があります: ${[...new Set(duplicates)].join('・')}`);
  if(normalized.length!==9) issues.push(`現チームの異なる9選手で打順を構成できていません（現在${normalized.length}人）`);
  return {ok:issues.length===0,order:normalized,issues};
}

export function buildConsensusLineup(second){
  const entries=Array.isArray(second)?second.map((v,i)=>[String(i),v]):Object.entries(second||{});
  if(entries.length!==3) return null;
  const personaLineups={};
  const table=new Map();
  for(const [key,value] of entries){
    const check=validateFullLineupOrder(value?.candidatePlayers);
    if(!check.ok) return null;
    personaLineups[key]=check.order;
    check.order.forEach((name,index)=>{
      const k=playerKey(name);
      const row=table.get(k)||{name,support:0,rankTotal:0,ranks:[],firstPlaceCount:0};
      row.support+=1;
      row.rankTotal+=index+1;
      row.ranks.push(index+1);
      if(index===0) row.firstPlaceCount+=1;
      table.set(k,row);
    });
  }

  const ranked=[...table.values()].map(row=>({
    ...row,
    averageRank:Number((row.rankTotal/row.support).toFixed(2))
  })).sort((a,b)=>
    b.support-a.support ||
    a.averageRank-b.averageRank ||
    b.firstPlaceCount-a.firstPlaceCount ||
    a.name.localeCompare(b.name,'ja')
  );

  const proposalScores=entries.map(([key])=>{
    const order=personaLineups[key];
    let agreementScore=0;
    let totalDeviation=0;
    order.forEach((name,index)=>{
      const row=table.get(playerKey(name));
      const slot=index+1;
      const deviation=Math.abs(slot-(row?.averageRank||slot));
      agreementScore+=(row?.support||0)*100-deviation*10;
      totalDeviation+=deviation;
    });
    return {persona:key,order,agreementScore:Number(agreementScore.toFixed(2)),totalDeviation:Number(totalDeviation.toFixed(2))};
  }).sort((a,b)=>
    b.agreementScore-a.agreementScore ||
    a.totalDeviation-b.totalDeviation ||
    a.persona.localeCompare(b.persona,'ja')
  );

  // Important MAGI rule: the final order must come from an actual second-round Wise Man proposal.
  // Do not invent a fourth compromise lineup by averaging slots across the three proposals.
  const selectedProposal=proposalScores[0];
  const lineup=selectedProposal.order.map((name,index)=>{
    const row=table.get(playerKey(name));
    return {slot:index+1,name,support:row?.support||0,averageRank:row?Number((row.rankTotal/row.support).toFixed(2)):null,ranks:row?.ranks||[]};
  });

  const slotConflicts=[];
  for(let i=0;i<9;i++){
    const choices=entries.map(([key])=>({persona:key,name:personaLineups[key][i]}));
    if(new Set(choices.map(x=>x.name)).size>1) slotConflicts.push({slot:i+1,choices});
  }
  return {lineup,personaLineups,slotConflicts,playerSupport:ranked,selectedFromPersona:selectedProposal.persona,proposalScores};
}

export const FULL_LINEUP_ROSTER=Object.freeze(CURRENT_ROSTER.slice());
