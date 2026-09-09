// Routes explicit old-team detailed stat questions to the verified XLSM<->CSV answer engine.
// This guard is intentionally narrow: it only activates when the old season is explicit
// and the requested metric belongs to the reconciled detail domains.

const OLD_SEASON_RE = /前チーム|旧チーム|2025\s*[-–—〜~]\s*2026/;
const PITCHING_RE = /投手|防御率|投球|投球回|奪三振|与四球|与死球|WHIP|先発|救援|クローザー|エース/;
const DETAIL_METRIC_RE = /盗塁成功率|盗塁率|盗塁刺|盗塁|四死球|四球|死球|犠打|犠飛|守備率|守備機会|補殺|刺殺|失策|エラー|捕逸|許盗塁|盗塁企図|盗塁阻止|牽制刺|捕妨害|捕手回数/;

export function shouldUseVerifiedOldDetailAnswer(questionValue) {
  const q = String(questionValue || '').trim();
  if (!q || !OLD_SEASON_RE.test(q)) return false;
  if (PITCHING_RE.test(q)) return false;
  return DETAIL_METRIC_RE.test(q);
}
