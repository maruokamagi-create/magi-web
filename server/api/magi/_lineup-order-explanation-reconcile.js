import { validateFullLineupOrder } from './_full-lineup.js';

// Only the *written order* may be replaced, never an invalid roster, numeric
// claim, unsupported effect, or defense-eligibility rejection.
export const ORDER_EXPLANATION_CONFLICT='BEST_ORDERのcandidatePlayersと打順説明が矛盾している';

export function reconcileLineupOrderExplanation(result,guardIssues){
  if(!result||result.reviewRequested===true||result.dataConflict===true)return null;
  if(!Array.isArray(guardIssues)||guardIssues.length!==1||guardIssues[0]!==ORDER_EXPLANATION_CONFLICT)return null;
  const check=validateFullLineupOrder(result.candidatePlayers);
  if(!check.ok)return null;
  const order=check.order.map((name,index)=>`${index+1}番${name}`).join('、');
  const persona=String(result.persona||'').toUpperCase();
  const first=persona.startsWith('BALTHASAR')?'俺':persona.startsWith('CASPER')?'僕':'私';
  return {
    ...result,
    candidatePlayers:check.order,
    // Abandon the inconsistent rationale rather than silently interpreting a
    // different batting order as the validated structured 1-9 sequence.
    candidateBasis:`今回比較する打順候補は${order}です。`,
    primaryReason:'正式14名の現チームについて、候補順は上記の9名です。守備配置は実際の先発起用記録で別途照合します。',
    publicStatement:`${first}の候補順は${order}です。元の説明と一致しない箇所は根拠に採用しません。`,
    facts:[],
    analysis:[],
    prediction:[],
    warnings:['元の打順説明に候補順との食い違いがあり、矛盾する説明を採用していません。']
  };
}
