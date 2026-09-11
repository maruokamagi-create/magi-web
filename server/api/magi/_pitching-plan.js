import { CURRENT_ROSTER, canonicalCurrentPlayerNameStrict, playerKey } from './_roster.js';

function text(v){return String(v??'').trim();}

export const PITCHING_PLAN_ROLES=Object.freeze([
  {key:'STARTER',label:'先発'},
  {key:'SECOND',label:'第2投手'},
  {key:'LATE',label:'終盤'},
  {key:'CLOSER',label:'クローザー'}
]);

function pitchingPlanSignals(input){
  const caseData=typeof input==='string'?{question:input}:(input||{});
  const explicitMode=String(caseData?.selectionKind||'').toUpperCase()==='PITCHING_PLAN'||String(caseData?.mode||'').toLowerCase()==='pitching_plan';
  const q=text(caseData?.question).normalize('NFKC');
  const hasPlan=/(?:投手運用|継投|投手リレー|投手プラン|投手起用)/.test(q);
  const buildCue=/(?:どうする|どう組|組んで|組む|考えて|考える|決めて|決める|作って|作る)/.test(q);
  const roleCount=[/先発/,/(?:第?2投手|二番手|2番手|第二投手)/,/(?:終盤|つなぎ|ブリッジ)/,/(?:クローザー|抑え|守護神)/].filter(re=>re.test(q)).length;
  const sevenInning=/(?:7回制|七回制|7イニング|七イニング)/.test(q);
  return {explicitMode,q,hasPlan,buildCue,roleCount,sevenInning};
}

export function isExplicitPitchingPlanQuestion(input){
  const s=pitchingPlanSignals(input);
  if(s.explicitMode)return true;
  if(!s.q)return false;
  return s.roleCount>=2&&(s.sevenInning||s.hasPlan);
}

export function isPitchingPlanQuestion(input){
  const s=pitchingPlanSignals(input);
  if(s.explicitMode)return true;
  if(!s.q)return false;
  if(s.roleCount>=2&&(s.sevenInning||s.hasPlan||s.buildCue))return true;
  return s.hasPlan&&s.buildCue;
}

export function validatePitchingPlanOrder(values){
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
  if(supplied.length!==PITCHING_PLAN_ROLES.length) issues.push(`投手運用は${PITCHING_PLAN_ROLES.length}役必要です（現在${supplied.length}人）`);
  if(invalid.length) issues.push(`現チーム外または未登録の選手があります: ${invalid.join('・')}`);
  if(duplicates.length) issues.push(`基本4役案では同一投手を重複配置できません: ${[...new Set(duplicates)].join('・')}`);
  if(normalized.length!==PITCHING_PLAN_ROLES.length) issues.push(`先発・第2投手・終盤・クローザーを異なる4投手で構成できていません（現在${normalized.length}人）`);
  return {ok:issues.length===0,order:normalized,issues};
}

export function buildConsensusPitchingPlan(second){
  const entries=Array.isArray(second)?second.map((v,i)=>[String(i),v]):Object.entries(second||{});
  if(entries.length!==3) return null;
  const personaPlans={};
  const table=new Map();
  for(const [key,value] of entries){
    const check=validatePitchingPlanOrder(value?.candidatePlayers);
    if(!check.ok) return null;
    personaPlans[key]=check.order;
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

  const playerSupport=[...table.values()].map(row=>({
    ...row,
    averageRank:Number((row.rankTotal/row.support).toFixed(2))
  })).sort((a,b)=>
    b.support-a.support ||
    a.averageRank-b.averageRank ||
    b.firstPlaceCount-a.firstPlaceCount ||
    a.name.localeCompare(b.name,'ja')
  );

  const proposalScores=entries.map(([key])=>{
    const order=personaPlans[key];
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

  // MAGIの最終案は三賢人の二次案のいずれかを採用し、平均化した第四案は作らない。
  const selectedProposal=proposalScores[0];
  const plan=selectedProposal.order.map((name,index)=>({
    role:PITCHING_PLAN_ROLES[index].key,
    roleLabel:PITCHING_PLAN_ROLES[index].label,
    name,
    support:table.get(playerKey(name))?.support||0,
    averageRank:table.get(playerKey(name))?Number((table.get(playerKey(name)).rankTotal/table.get(playerKey(name)).support).toFixed(2)):null,
    ranks:table.get(playerKey(name))?.ranks||[]
  }));

  const roleConflicts=[];
  for(let i=0;i<PITCHING_PLAN_ROLES.length;i++){
    const choices=entries.map(([key])=>({persona:key,name:personaPlans[key][i]}));
    if(new Set(choices.map(x=>x.name)).size>1){
      roleConflicts.push({role:PITCHING_PLAN_ROLES[i].key,roleLabel:PITCHING_PLAN_ROLES[i].label,choices});
    }
  }
  return {plan,personaPlans,roleConflicts,playerSupport,selectedFromPersona:selectedProposal.persona,proposalScores};
}

export const PITCHING_PLAN_ROSTER=Object.freeze(CURRENT_ROSTER.slice());
