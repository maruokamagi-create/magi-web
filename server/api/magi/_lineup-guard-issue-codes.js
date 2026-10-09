// Public diagnostic codes for the Live FULL_LINEUP acceptance gate.
// Never return raw persona text, player metrics, or rejected evidence excerpts.
const PREFIX='回答文に、確認できた記録と合わない内容があるため再確認が必要です。';

function classify(issue){
    if(/^FULL_LINEUP_STANDARD_DEFENSE/.test(issue))return 'FIELDING_COVERAGE';
    if(/^FULL_LINEUP:/.test(issue))return 'LINEUP_STRUCTURE';
    if(/candidatePlayersと打順説明が矛盾/.test(issue))return 'ORDER_EXPLANATION_CONFLICT';
    if(/直近試合数をEvidenceと異なる/.test(issue))return 'RECENT_WINDOW_MISMATCH';
    if(/正式ロスター|ロスター完全一致/.test(issue))return 'ROSTER_MISMATCH';
    if(/supplied CASE\/EVIDENCE|数値.{0,30}(?:一致しない|存在しない)|投球回.{0,20}単位不明|四死球という合算値/.test(issue))return 'NUMERIC_EVIDENCE_MISMATCH';
    if(/比較基準のない統計値|合成指標だけから|Evidenceにない(?:長打率|出塁率)/.test(issue))return 'METRIC_INFERENCE_OR_ABSENT';
    if(/BEST_ORDER.*打順固定/.test(issue))return 'UNSUPPORTED_FIXED_SLOT';
    if(/BEST_ORDER.*(?:守備安定性|連携効果)/.test(issue))return 'UNSUPPORTED_DEFENSE_EFFECT';
    if(/BEST_ORDER.*(?:得点|勝利|勝ち|得点力)/.test(issue))return 'UNSUPPORTED_SCORING_CLAIM';
    if(/BEST_ORDER.*(?:得点機会|安定性)/.test(issue))return 'UNSUPPORTED_STABILITY_CLAIM';
    if(/Evidenceから保証できない結果|将来結果|将来予測/.test(issue))return 'UNSUPPORTED_OUTCOME_PREDICTION';
    if(/SELECTIONでEvidenceにない成長|SELECTIONでEvidenceにない依存|負担の大きさ|具体的悪影響/.test(issue))return 'UNSUPPORTED_DEVELOPMENT_OR_BURDEN';
    return 'OTHER_GUARD';
}
export function classifyLineupGuardIssueList(issues){
  if(!Array.isArray(issues))return [];
  return [...new Set(issues.map(issue=>classify(String(issue||''))))];
}
export function classifyLineupGuardIssues(reviewReason){
  const reason=String(reviewReason??'');
  if(!reason.startsWith(PREFIX))return [];
  return classifyLineupGuardIssueList(reason.slice(PREFIX.length).split('／').slice(0,3).filter(Boolean));
}
