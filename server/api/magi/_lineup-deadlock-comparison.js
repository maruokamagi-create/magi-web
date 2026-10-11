import { validateFullLineupOrder } from './_full-lineup.js';
import { assignEvidenceGroundedFielding } from './_lineup-fielding.js';

// Pure, deterministic, read-only evidence comparison. A 1-1-1 vote does not
// authorize us to elect the most similar lineup or blend three proposals.
// Each proposal is evaluated independently against the exact current packet.
export function buildLineupDeadlockComparison(second, appearanceFielding) {
  const keys=['melchior','balthasar','casper'];
  if(!second||typeof second!=='object')return null;
  const proposals={};
  for(const key of keys){
    const check=validateFullLineupOrder(second[key]?.candidatePlayers);
    if(!check.ok)return null;
    const fielding=assignEvidenceGroundedFielding(
      check.order.map((name,i)=>({slot:i+1,name})),appearanceFielding);
    proposals[key]={
      order:check.order,
      fieldingStatus:fielding.status,
      fieldingReason:fielding.status==='COMPLETE'?'':String(fielding.reason||fielding.status||'UNVERIFIED'),
      positions:fielding.status==='COMPLETE'
        ? fielding.lineup.map(({slot,name,position,positionLabel,positionEvidence})=>({
          slot,name,position,positionLabel,
          officialStarts:Number(positionEvidence?.officialStarts)||0,
          practiceFirstStarts:Number(positionEvidence?.practiceFirstStarts)||0
        }))
        : []
    };
  }
  const signatures=keys.map(key=>proposals[key].order.join('>'));
  if(new Set(signatures).size!==3)return null;
  const selected=keys.map(key=>proposals[key].order);
  const firstSet=new Set(selected[0]);
  const sameNine=selected.every(order=>order.length===firstSet.size&&order.every(n=>firstSet.has(n)));
  const slots=Array.from({length:9},(_,i)=>{
    const choices=Object.fromEntries(keys.map(key=>[key,proposals[key].order[i]]));
    const uniqueNames=new Set(Object.values(choices));
    return {slot:i+1,choices,agreementCount:uniqueNames.size===1?3:uniqueNames.size===2?2:1};
  });
  return {
    status:'COMPARISON_ONLY',
    decision:'DEADLOCK',
    finalVote:'1-1-1',
    allNinePlayersShared:sameNine,
    sharedSlots:slots.filter(s=>s.agreementCount===3).map(s=>s.slot),
    disputedSlots:slots.filter(s=>s.agreementCount!==3).map(s=>s.slot),
    slots,
    proposals,
    limitations:[
      '各案は比較対象であり、採用する最終オーダーではありません。',
      '打撃数値・実打順・先発守備資格だけでは、特定の打順が得点や勝敗で優れるとは断定できません。',
      '守備評価は公式戦または練習第1試合の先発実績に限定し、練習第2試合の実験起用や途中出場だけで資格を補いません。'
    ]
  };
}
