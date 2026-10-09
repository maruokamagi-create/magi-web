import { CURRENT_ROSTER } from './_roster.js';
import { validateFullLineupOrder } from './_full-lineup.js';

// SECOND may inspect its own PRIMARY proposal and its own assigned CROSS
// challenge only. Never feed it another persona's private reasoning or
// unverified player numbers.
const METRICS=['AB','AVG','OBP','SLG','OPS','RISP'];
function compactBatting(value){
  const b=value?.batting&&typeof value.batting==='object'?value.batting:value;
  if(!b||typeof b!=='object')return {};
  const out={};
  for(const key of METRICS){
    const raw=b[key];
    if(raw===null||raw===undefined||String(raw).trim()==='')continue;
    const str=String(raw).trim();
    if(!/^(?:\d+|\d*\.\d+)$/.test(str))continue;
    const n=Number(str);
    if(!Number.isFinite(n)||n<0)continue;
    if(key==='AB'&&!Number.isInteger(n))continue;
    out[key]=str;
  }
  return out;
}

// Batting order is actual game usage, not a promise of lineup efficacy.
// The source already separates official/practice-first (standard) from
// practice-second (challenge) opportunities. Never pool their rates.
function exactCurrentRoster(players){
  if(!Array.isArray(players)||players.length!==CURRENT_ROSTER.length)return false;
  const known=new Set(CURRENT_ROSTER);
  return players.every(p=>known.has(p?.name))&&new Set(players.map(p=>p?.name)).size===known.size;
}
function count(value){
  const raw=String(value??'').trim();
  if(!/^\d+$/.test(raw))return null;
  const n=Number(raw);
  return Number.isSafeInteger(n)&&n>=0?raw:null;
}
function battingSlotRecord(entry){
  const batting=entry?.batting;
  const PA=count(batting?.PA),AB=count(batting?.AB),H=count(batting?.H);
  if(PA===null||AB===null||H===null||
     Number(AB)>Number(PA)||Number(H)>Number(AB))return {status:'UNVERIFIED'};
  if(Number(PA)===0)return {status:'NO_RECORDED_PA',PA:'0'};
  const metrics=compactBatting(batting);
  return {status:'RECORDED',PA,AB,H,...Object.fromEntries(
    ['AVG','OBP','SLG','OPS'].filter(k=>Object.hasOwn(metrics,k)).map(k=>[k,metrics[k]])
  )};
}
function actualSlotEvidence(caseData,name,slots){
  const data=caseData?.evidence?.battingOrderSplits;
  if(data?.status!=='COMPLETE'||!exactCurrentRoster(data.players))return null;
  const player=data.players.find(p=>p.name===name);
  const rows=Array.isArray(player?.slots)?player.slots:[];
  if(new Set(rows.map(s=>s?.slot)).size!==rows.length)return null;
  return slots.map(slot=>{
    const entry=rows.find(s=>s?.slot===slot);
    return {slot,
      standard:entry?battingSlotRecord(entry.standard):{status:'NO_RECORDED_PA'},
      // Kept as a separate count; challenge-game performance is not
      // evidence of standard-game selection or a pooled batting rate.
      challengePA:entry?count(entry.challenge?.batting?.PA):'0'
    };
  });
}
function recentVerifiedStarts(caseData,name,slots){
  const data=caseData?.evidence?.appearanceFielding;
  if(data?.status!=='COMPLETE'||data?.appearanceStatus!=='COMPLETE')return null;
  if(!exactCurrentRoster(data.players))return null;
  const appearance=data.players.find(p=>p.name===name)?.appearance;
  if(appearance?.status!=='COMPLETE')return null;
  const starts=Array.isArray(appearance.latestStarts)?appearance.latestStarts:[];
  return starts.filter(s=>
    slots.includes(s?.order)&&
    /^\d{4}-\d{2}-\d{2}$/.test(String(s?.date||''))&&
    (s.competitionType==='OFFICIAL'||(s.competitionType==='PRACTICE'&&s.practiceRole==='REGULAR_GAME_1'))
  ).slice(-3).map(s=>({date:s.date,slot:s.order,gameType:s.competitionType}));
}
function datedCoachBattingObservations(caseData,name){
  const e=caseData?.evidence;
  if(e?.normalizedObservationStatus!=='COMPLETE'||!Array.isArray(e.normalizedObservations))return [];
  const relevant=e.normalizedObservations.filter(o=>
    o?.sourceType==='指導者'&&o?.player===name&&
    /^20\d{2}[-/]\d{1,2}[-/]\d{1,2}(?:\s|T|$)/.test(String(o.recordedAt||''))&&
    typeof o.statement==='string'&&o.statement.length>0&&o.statement.length<=280&&
    /打順|打撃|打席|打率|出塁|打球|バッティング|スイング/.test(o.statement)&&
    !/^(?:除外|使用禁止|非公開)$/.test(String(o.handling||''))
  );
  return relevant.sort((a,b)=>String(b.recordedAt).localeCompare(String(a.recordedAt)))
    .slice(0,1).map(o=>({recordedAt:o.recordedAt,sourceType:'指導者',statement:o.statement,policyVerified:false}));
}

export function buildContestedAdjacentSlotEvidence(caseData,ownPrimary,cross){
  const checked=validateFullLineupOrder(ownPrimary?.candidatePlayers);
  if(!checked.ok)return [];
  const current=caseData?.evidence?.allCurrentTeamCheck;
  const players=Array.isArray(current?.players)?current.players:[];
  if(current?.status!=='COMPLETE'||players.length!==CURRENT_ROSTER.length)return [];
  const names=new Set(players.map(p=>String(p?.name||'').trim()));
  if(names.size!==CURRENT_ROSTER.length||CURRENT_ROSTER.some(name=>!names.has(name)))return [];
  const report=[
    ...(Array.isArray(cross?.disagreement)?cross.disagreement:[]),
    ...(Array.isArray(cross?.challenges)?cross.challenges:[]),
    ...(Array.isArray(cross?.challengeToSelf)?cross.challengeToSelf:[])
  ].join(' ').normalize('NFKC');
  const disputedSlots=new Set([...report.matchAll(/([1-9])番/g)].map(m=>Number(m[1])));
  const currentMap=new Map(players.map(p=>[p.name,p]));
  const recent=caseData?.evidence?.recentSix;
  const recentMap=recent?.status==='COMPLETE'&&Array.isArray(recent.players)
    ?new Map(recent.players.map(p=>[p.name,p])):new Map();
  const comparisons=[];
  for(let slot=1;slot<9;slot++){
    if(!disputedSlots.has(slot)||!disputedSlots.has(slot+1))continue;
    const namesAtSlots=checked.order.slice(slot-1,slot+1);
    const pair=namesAtSlots.map(name=>({
      slot:slot+namesAtSlots.indexOf(name),
      name,
      current:compactBatting(currentMap.get(name)),
      ...(recent?.status==='COMPLETE'?{recentSix:compactBatting(recentMap.get(name))}:{}),
      // Independent recorded batting orders, eligible starts and dated coach
      // comments are descriptive corroboration, never a manufactured effect.
      actualBattingSlots:actualSlotEvidence(caseData,name,[slot,slot+1]),
      recentEligibleStarts:recentVerifiedStarts(caseData,name,[slot,slot+1]),
      datedCoachBattingObservations:datedCoachBattingObservations(caseData,name)
    }));
    if(pair.some(p=>Object.keys(p.current).length===0))continue;
    comparisons.push({slots:[slot,slot+1],players:pair});
    if(comparisons.length===2)break;
  }
  return comparisons;
}
