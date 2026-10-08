// Semantic guard shared by the persona output validator and its prose sanitizer.
// These claims describe consequences or suitability not established by batting
// averages or how often a player has previously occupied a lineup slot.
// This is a general BATTING_ORDER language class, never a player-name rule.
export function unsupportedBattingOrderEffect(sentence){
  const s=String(sentence??'');
  return /(?:安定した選択肢|最も有効な戦術|役割に慣れて(?:いる|きた)|3番.{0,14}適性.{0,14}(?:豊富|高い))/.test(s)
    || /(?:3番|打順|起用|選手|実績).{0,80}チーム.{0,14}安定.{0,22}(?:つなが|繋が|維持|高め)/.test(s)
    || /(?:打順|起用).{0,28}(?:連続性|安定性).{0,28}(?:維持|高め|向上)/.test(s)
    || /(?:打線|チーム).{0,12}(?:攻撃力|得点力).{0,20}(?:高め|向上|改善|増加|上げ)/.test(s)
    || /(?:将来(?:的に)?).{0,24}チーム.{0,24}(?:支え|牽引|柱にな)/.test(s);
}
