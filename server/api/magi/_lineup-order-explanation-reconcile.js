import { validateFullLineupOrder } from './_full-lineup.js';

// Only incompatible narrative is discarded, never an invalid roster, numeric
// claim, unsupported outcome effect, or defense-eligibility rejection.
// CASPER's unsupported generic growth/dependency/burden prose is also removable
// when (and only when) a candidate-order contradiction is already present.
export const ORDER_EXPLANATION_CONFLICT='BEST_ORDERのcandidatePlayersと打順説明が矛盾している';
const DISCARDABLE_UNGROUNDED_LANGUAGE=new Set([
  'SELECTIONでEvidenceにない成長・育成・負担影響を追加している',
  'SELECTIONでEvidenceにない依存・役割集中を追加している',
  'Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている',
  // Soft text-only BEST_ORDER claims may be discarded together with an
  // independently detected numbered-order mismatch; no eligibility, roster
  // or numeric inconsistency is recoverable here.
  'BEST_ORDERで打撃数値・打順から得点効率・勝利優位を断定している',
  'BEST_ORDERでEvidenceにない得点力最大化・勝利接近を推定している',
  'BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している',
  'BEST_ORDERで打撃数値・打順から得点機会・安定性を推定している'
]);

export function reconcileLineupOrderExplanation(result,guardIssues){
  if(!result||result.reviewRequested===true||result.dataConflict===true)return null;
  if(!Array.isArray(guardIssues)||!guardIssues.includes(ORDER_EXPLANATION_CONFLICT))return null;
  if(guardIssues.some(issue=>issue!==ORDER_EXPLANATION_CONFLICT&&!DISCARDABLE_UNGROUNDED_LANGUAGE.has(issue)))return null;
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
    warnings:['候補順と食い違う説明や、Evidenceで裏付けられない評価は採用していません。']
  };
}
