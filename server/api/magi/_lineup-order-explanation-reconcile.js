import { validateFullLineupOrder } from './_full-lineup.js';
import { CURRENT_ROSTER, playerKey } from './_roster.js';

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
  'BEST_ORDERで打撃数値・打順から得点機会・安定性を推定している',
  // Only non-guarantee prose forecasting can be discarded, and ONLY
  // when an independent numbered candidate/order conflict already exists;
  // numeric mismatch, defense eligibility and roster errors remain hard.
  // A hard outcome guarantee such as 「必ず勝てる」 is NEVER auto-recovered.
  '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている',
  '将来予測を不確実性の表現なしに確定結果として述べている'
]);

// Recover *present records*, not a fabricated explanation of winning value.
// This optional packet is used only after an isolated numbered-order prose
// conflict and only from a COMPLETE exact-current-team Evidence table.
const DISPLAY_METRICS=[['AB','打数'],['AVG','打率'],['OBP','出塁率'],['SLG','長打率'],['OPS','OPS']];
function metricLiteral(value,key){
  if(value===null||value===undefined)return null;
  const raw=String(value).trim();
  if(!/^(?:\d+|\d*\.\d+)$/.test(raw))return null;
  const n=Number(raw);
  if(!Number.isFinite(n)||n<0||(key==='AB'&&!Number.isInteger(n)))return null;
  if(['AVG','OBP','SLG'].includes(key)&&n>1)return null;
  return raw;
}
export function verifiedLineupStats(order,caseData){
  const block=caseData?.evidence?.allCurrentTeamCheck;
  if(block?.status!=='COMPLETE'||!Array.isArray(block.players)||block.players.length!==CURRENT_ROSTER.length)return null;
  const allowed=new Set(CURRENT_ROSTER.map(playerKey)),lookup=new Map();
  for(const entry of block.players){
    const key=playerKey(entry?.name);
    if(!allowed.has(key)||lookup.has(key))return null;
    lookup.set(key,entry);
  }
  if(lookup.size!==allowed.size)return null;
  const rows=order.map((name,index)=>{
    const entry=lookup.get(playerKey(name));
    const metrics=DISPLAY_METRICS.map(([key,label])=>{
      const value=metricLiteral(entry?.batting?.[key],key);
      return value===null?null:`${label}${value}`;
    }).filter(Boolean);
    return {slot:index+1,name,metrics};
  });
  return rows.some(row=>row.metrics.length)?rows:null;
}

export function reconcileLineupOrderExplanation(result,guardIssues,caseData=null){
  if(!result||result.reviewRequested===true||result.dataConflict===true)return null;
  if(!Array.isArray(guardIssues)||!guardIssues.includes(ORDER_EXPLANATION_CONFLICT))return null;
  if(guardIssues.some(issue=>issue!==ORDER_EXPLANATION_CONFLICT&&!DISCARDABLE_UNGROUNDED_LANGUAGE.has(issue)))return null;
  const check=validateFullLineupOrder(result.candidatePlayers);
  if(!check.ok)return null;
  const order=check.order.map((name,index)=>`${index+1}番${name}`).join('、');
  const persona=String(result.persona||'').toUpperCase();
  const first=persona.startsWith('BALTHASAR')?'俺':persona.startsWith('CASPER')?'僕':'私';
  const verified=verifiedLineupStats(check.order,caseData);
  const measured=verified?verified.filter(row=>row.metrics.length):[];
  const measuredFacts=measured.map(row=>`${row.slot}番${row.name}：今季通算${row.metrics.join('、')}`);
  const core=measured.filter(row=>row.slot>=3&&row.slot<=5);
  const shown=(core.length>=2?core:measured.slice(0,3))
    .map(row=>`${row.slot}番${row.name}（${row.metrics.join('、')}）`).join('、');
  const limitation='これらの打撃数値だけでは、特定の打順位置が勝敗や得点に与える優位性は証明できません。';
  return {
    ...result,
    candidatePlayers:check.order,
    // Abandon the inconsistent rationale rather than silently interpreting a
    // different batting order as the validated structured 1-9 sequence.
    candidateBasis:`今回比較する打順候補は${order}です。${measuredFacts.length?' 確認済みの現チーム通算記録：'+measuredFacts.join('。')+'。':' 比較可能な今季通算数値は未確認です。'} ${limitation}`,
    primaryReason:shown
      ? `打順を再確認しました。比較材料は${shown}です。${limitation} 対戦相手・打順別の結果や実起用の差を含む判断材料は別途照合が必要です。`
      : '正式14名の現チームから候補順を示しましたが、今季通算の比較数値は確認できず、打順位置の優位性は未判定です。',
    publicStatement:`${first}の候補順は${order}です。${shown?' 確認できる打撃記録は'+shown+'です。':''} ${limitation} 元の打順説明の矛盾は根拠に採用しません。`,
    facts:measuredFacts,
    analysis:[],
    prediction:[],
    confidence:result.confidence==='HIGH'?'MEDIUM':result.confidence,
    warnings:['候補順と食い違う説明や、Evidenceで裏付けられない評価は採用していません。',measuredFacts.length?'記録の比較だけでは打順位置の優劣を確定できません。':'今季通算の比較数値が未確認のため打順位置の優劣を判断できません。']
  };
}
