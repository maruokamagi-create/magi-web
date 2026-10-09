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
    || /(?:役割|打順).{0,22}(?:継続性|適応|経験値|安定性).{0,22}(?:確認できる|維持|強み|高い|豊富)/.test(s)
    // The user may ask us to consider the next batter. That is a tactical
    // constraint, not proof the chosen hitter will actually bridge successfully.
    || /(?:4番|次打者|後続打者).{0,70}(?:つなぐ|つなげる|つなぎ|つながる|接続).{0,65}(?:機能|最適化|成功|確実|有利|優位)/.test(s)
    || /(?:打率|OPS|得点圏打率|打撃成績|高い数値).{0,100}戦術(?:上|的に|的な).{0,26}(?:有利|優位|最適|優れる|確実)/.test(s)
    || /(?:打率|OPS|打撃成績).{0,95}(?:攻撃の軸|攻撃オプション|攻撃力|打線力).{0,45}(?:機能|強力|有効|向上|高め|可能性|なり得る)/.test(s)
    // Starts show recorded participation. They do not establish adaptation,
    // a measurable improvement in team growth, or physical burden from fixing
    // the batting slot unless such an observation is explicitly evidenced.
    || /(?:3番|打順|起用).{0,105}チーム全体の経験(?:の)?蓄積/.test(s)
    || /(?:経験(?:の)?蓄積|積み上げ(?:た|てきた)経験|経験の積み重ね).{0,100}(?:チーム(?:全体)?の(?:力|戦力|成長|バランス)|今後.{0,24}力|成果)/.test(s)
    || /(?:固定(?:化|する|継続)|打順固定|起用固定).{0,75}(?:選手の?負担|負担).{0,45}(?:影響|増加|大きく|重く|損な|蓄積|おそれ)/.test(s)
    || /(?:3番|起用|出場詳細).{0,95}(?:適合|適性).{0,22}(?:確認できる|確認されている|示している)/.test(s)
    || /(?:3番|打順|起用).{0,110}(?:重要な役割|戦術上有利).{0,20}(?:担う|担っている|だ|である)/.test(s);
}
