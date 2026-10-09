// TEAM_REVIEW evaluates current documented facts, not consequences invented
// from individual batting/appearance differences. This classifier is shared
// by the fail-closed validation gate and the prose-only batch sanitizer.
// No roster, coach-intent, numeric or scoring claim is inferred here.
const DENIAL=/(?:断定(?:しない|しません|できない|できません)|確認できない|未確認|根拠がない|裏付け(?:られない|がない)|とは言えない|とは言えません|保証(?:できない|しない)|実証されていない|不明|判断(?:できない|できません))/;

export function unsupportedTeamReviewOutcomeKind(value){
  const sentence=String(value||'').trim();
  if(!sentence||DENIAL.test(sentence))return null;
  // Individual batting rates do not prove opponent scouting outcomes,
  // winning paths, scoring-route concentration or a game-level attack risk.
  const opponentScoring=/(?:相手(?:投手|投手陣)?|対戦相手)[^。！？!?\n]{0,54}(?:研究|対策|警戒|攻略)[^。！？!?\n]{0,60}(?:点数|得点|点が|攻撃力|打線)[^。！？!?\n]{0,50}(?:止ま|減|下が|低下|制限|厳し|落ち|リスク)/;
  const scoringRouteBias=/(?:得点を生み出す|得点|攻撃)[^。！？!?\n]{0,25}(?:ルート|経路|選択肢)[^。！？!?\n]{0,42}(?:特定|一部|上位)[^。！？!?\n]{0,35}(?:打線|選手|打者)[^。！？!?\n]{0,25}(?:偏|依存|集中)/;
  const ungroundedAttackLeadership=/(?:一部|特定|上位|[0-9０-９]+人)[^。！？!?\n]{0,25}(?:選手|打者|打線)?[^。！？!?\n]{0,18}(?:チームの)?攻撃を牽引/;
  const tacticalWinningRhetoric=/(?:ここをどう|この状況をどう)[^。！？!?\n]{0,40}勝負だ/;
  // A conditional opponent adjustment is still a prediction, not evidence that
  // the current lineup lacks attack options; hedging as 'おそれ' is not proof.
  const opponentAttackNarrowing=/(?:相手(?:投手|投手陣)?|対戦相手)[^。！？!?\n]{0,54}(?:研究|対策|警戒|攻略)[^。！？!?\n]{0,60}(?:攻撃(?:の)?(?:幅|選択肢|手段)|勝ち筋|打線)[^。！？!?\n]{0,40}(?:狭|限|制約|低下|減|下が)/;
  if(opponentScoring.test(sentence)||scoringRouteBias.test(sentence)||ungroundedAttackLeadership.test(sentence)||tacticalWinningRhetoric.test(sentence)||opponentAttackNarrowing.test(sentence))return 'SCORING';

  // Recorded starts/pitches can establish workloads in counts, not an
  // unrecorded physical impact or accumulated bodily load.
  const assertedPhysicalLoad=/(?:投球|登板|出場|兼任)[^。！？!?\n]{0,38}(?:身体的な?)?負荷[^。！？!?\n]{0,28}(?:かか|生じ|発生|記録され|蓄積)|(?:身体的な?)?負荷[^。！？!?\n]{0,22}(?:かかっている|蓄積している)/;
  if(assertedPhysicalLoad.test(sentence))return 'BURDEN';

  // Future team development and qualitative 'experience value' are not
  // quantified by appearances, even when the latter have different counts.
  const growthDirective=/(?:長い目(?:で|から)|長期的)[^。！？!?\n]{0,55}(?:強いチーム|課題|育成|成長|チーム編成)|(?:出る選手だけでなく|チーム全体)[^。！？!?\n]{0,55}(?:力をつけ|経験を積)[^。！？!?\n]{0,25}(?:大切|重要|したい|必要)/;
  const futureUsageEffect=/(?:起用(?:偏重|集中|の偏り)|出場機会の偏り|過度な起用)[^。！？!?\n]{0,65}(?:長期的|将来|チーム編成)[^。！？!?\n]{0,50}(?:影響|リスク|悪化|懸念|問題)/;
  const unmeasuredExperience=/(?:経験値|経験量)[^。！？!?\n]{0,14}(?:差|偏り|低い|高い|生じ)|(?:経験値|経験量)に差/;
  // Documented starts do not establish that a hypothetical fixed selection
  // policy would decrease future collective ability.
  const fixedUsageTeamDecline=/(?:目先の勝利|選手起用|起用(?:の)?固定化)[^。！？!?\n]{0,85}(?:組織|チーム)[^。！？!?\n]{0,30}(?:総合力|チーム力|選手層)[^。！？!?\n]{0,26}(?:低下|弱|損)/;
  if(growthDirective.test(sentence)||futureUsageEffect.test(sentence)||unmeasuredExperience.test(sentence)||fixedUsageTeamDecline.test(sentence))return 'DEVELOPMENT';
  return null;
}
