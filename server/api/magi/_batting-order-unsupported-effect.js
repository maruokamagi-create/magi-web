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
    || /(?:将来(?:的に)?).{0,24}チーム.{0,24}(?:支え|牽引|柱にな)/.test(s)
    // Past starts show deployment frequency; they are not direct skill
    // assessment or proof that keeping the slot will stabilize a team.
    || /(?:3番|打順|起用|実績|経験|役割).{0,65}(?:役割|打順).{0,10}(?:継続性|安定性|適応|経験値)/.test(s)
    || /(?:3番|打順|起用|実績|経験).{0,65}(?:適応|慣れ|経験(?:が|は)?豊富|強みを持つ|戦術的な軸)/.test(s)
    || /(?:チーム|打順).{0,20}(?:安定(?:性)?|バランス).{0,24}(?:優先|図る|つなが|維持|高め|強み|重視|考え)/.test(s)
    || /(?:得点機(?:会)?|得点ルート).{0,15}(?:拡大|増加|増大|創出|広げ|高め)/.test(s)
    || /(?:4番|次打者).{0,14}(?:つなぎ|つながり).{0,24}(?:有効|強み|効果|期待)/.test(s)
    // Previous slot starts document usage, not the reliability of a player in
    // that role or the success of connecting a later hitter to an outcome.
    || /(?:3番|打順|起用|実績|経験|回数).{0,100}(?:信頼性|信頼度|確実性|信頼できる).{0,16}(?:高い|ある|十分|優れる)/.test(s)
    || /(?:4番|次打者|後続打者).{0,65}(?:つなぐ|つなげる|つなぎ|つながり).{0,45}(?:期待|有効|優位|適任|効果|可能性)/.test(s)
    || /(?:3番|打順).{0,30}(?:起用(?:実績|経験)|経験).{0,35}(?:リスク|不安|問題)/.test(s)
    || /(?:役割|打順).{0,22}(?:継続性|適応|経験値|安定性).{0,22}(?:確認できる|維持|強み|高い|豊富)/.test(s);
}
