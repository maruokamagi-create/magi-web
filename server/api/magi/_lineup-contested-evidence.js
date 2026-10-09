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
      ...(recent?.status==='COMPLETE'?{recentSix:compactBatting(recentMap.get(name))}:{})
    }));
    if(pair.some(p=>Object.keys(p.current).length===0))continue;
    comparisons.push({slots:[slot,slot+1],players:pair});
    if(comparisons.length===2)break;
  }
  return comparisons;
}
