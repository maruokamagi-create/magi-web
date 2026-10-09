// TEAM_REVIEW: the opponent adjusting to a batting order and the resulting
// scoring impact are not observations proved by individual AVG/OPS/AB data.
// These are affirmative patterns only; the caller handles explicit non-claims.
export function unsupportedOpponentScoringForecast(value){
  const sentence=String(value??'');
  return /(?:相手(?:投手陣)?)[^。！？!?]{0,24}(?:研究|対策|警戒)[^。！？!?]{0,32}(?:された|される|した|されれば|進めば)[^。！？!?]{0,85}(?:点数|得点|攻撃力|勝敗)[^。！？!?]{0,45}(?:止ま|低下|落ち|減|下が|抑えられ|制約|不利|リスク)/.test(sentence);
}

// An individually observed batting distribution is not a measured distribution
// of team scoring routes. Do not treat "upper-batters produce the runs" as a
// recorded fact unless the supplied evidence explicitly establishes it.
export function unsupportedScoringRouteConcentration(value){
  const sentence=String(value??'');
  return /(?:得点(?:を生み出す)?(?:の)?(?:ルート|経路|源)|チームの得点経路)[^。！？!?]{0,58}(?:特定|一部|上位)[^。！？!?]{0,32}(?:偏|集中|依存|限られ)/.test(sentence);
}

// A current-state review may report appearance distribution but may not
// convert it into a demonstrated long-range roster construction effect.
export function unsupportedUsageToLongTermSquadEffect(value){
  const sentence=String(value??'');
  return /(?:起用|出場)[^。！？!?]{0,18}(?:偏重|集中|偏り)[^。！？!?]{0,45}(?:長期|将来)[^。！？!?]{0,22}(?:チーム編成|成長|選手層|チーム作り)[^。！？!?]{0,36}(?:影響|リスク|問題|損な)/.test(sentence);
}
