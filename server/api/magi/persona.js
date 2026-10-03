import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { validatePersonaOutput } from './_persona-output-guard.js';
import { CURRENT_ROSTER, canonicalizePlayerData, playerKey } from './_roster.js';
import { isFullLineupQuestion, validateFullLineupOrder } from './_full-lineup.js';
import { isPitchingPlanQuestion, validatePitchingPlanOrder } from './_pitching-plan.js';

export const PERSONA_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    persona: { type: 'STRING' },
    phase: { type: 'STRING' },
    checkedPlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidatePlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidateBasis: { type: 'STRING' },
    facts: { type: 'ARRAY', items: { type: 'STRING' } },
    analysis: { type: 'ARRAY', items: { type: 'STRING' } },
    prediction: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    judgment: { type: 'STRING', enum: ['GREEN', 'BLUE', 'YELLOW', 'RED'] },
    primaryReason: { type: 'STRING' },
    publicStatement: { type: 'STRING' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    dataConflict: { type: 'BOOLEAN' },
    reviewRequested: { type: 'BOOLEAN' },
    reviewReason: { type: 'STRING' },
    changedFromPrimary: { type: 'BOOLEAN' },
    changeReason: { type: 'STRING' }
  },
  required: ['persona','phase','checkedPlayers','candidatePlayers','candidateBasis','facts','analysis','prediction','confidence','judgment','primaryReason','publicStatement','warnings','dataConflict','reviewRequested','reviewReason','changedFromPrimary','changeReason']
};

export function validPersonaCase(body) {
  const q = String(body?.case?.question || '').trim();
  return q.length >= 2 && q.length <= 12000;
}

export function isCandidateCase(body) {
  const caseData = body?.case || {};
  if (String(caseData?.mode || '').toLowerCase() === 'selection') return true;
  if (isFullLineupQuestion(caseData) || isPitchingPlanQuestion(caseData)) return true;
  const q = String(caseData?.question || '');
  const battingSlot = /(?:[1-9１-９一二三四五六七八九](?:番|ばん)(?:打者)?)/;
  const domain = /クリーンナップ|中軸|主軸|打線|打順|オーダー|紅白戦|スタメン|レギュラー|先発|起用|守備位置|ポジション|クローザー|抑え|捕手|投手|一塁|二塁|三塁|遊撃|左翼|中堅|右翼|レフト|センター|ライト/;
  const cue = /誰|だれ|どの|どれ|どちら|どう組|どうする|組んで|組む|組み合わせ|候補|選ぶ|選定|何番|一番いい|最適|ベスト|考えて|決めて/;
  return (domain.test(q) || battingSlot.test(q)) && cue.test(q);
}

export function personaRosterStatus(values) {
  const supplied = Array.isArray(values) ? values.map(v => String(v || '').trim()).filter(Boolean) : [];
  const got = new Map();
  for (const name of supplied) {
    const key = playerKey(name);
    if (key && !got.has(key)) got.set(key, name);
  }
  const officialKeys = new Set(CURRENT_ROSTER.map(playerKey));
  const missing = CURRENT_ROSTER.filter(p => !got.has(playerKey(p)));
  const unexpected = [...got.entries()].filter(([key]) => !officialKeys.has(key)).map(([,name]) => name);
  const duplicatesOrAliases = supplied.length - got.size;
  const exactCount = got.size === CURRENT_ROSTER.length;
  const complete = missing.length === 0 && unexpected.length === 0 && exactCount;
  return {
    complete,
    missing,
    unexpected,
    checked: CURRENT_ROSTER.length - missing.length,
    uniqueCount: got.size,
    suppliedCount: supplied.length,
    duplicatesOrAliases
  };
}

export function personaFullLineupIssues(rawResult, fullLineupCase) {
  if (!fullLineupCase) return [];
  const check = validateFullLineupOrder(rawResult?.candidatePlayers);
  return check.issues.map(x => `FULL_LINEUP: ${x}`);
}

export function personaPitchingPlanIssues(rawResult, pitchingPlanCase) {
  if (!pitchingPlanCase) return [];
  const check = validatePitchingPlanOrder(rawResult?.candidatePlayers);
  return check.issues.map(x => `PITCHING_PLAN: ${x}`);
}

export function normalizeConditionalJudgment(result, selectionMode) {
  if (selectionMode || String(result?.judgment || '').toUpperCase() !== 'YELLOW') return result;
  const stanceText = [result?.publicStatement, result?.primaryReason]
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .join(' ');

  const explicitHold =
    /判断(?:を|は)?(?:保留|留保)/.test(stanceText) ||
    /(?:判断材料|データ|記録|根拠|材料).{0,18}(?:不足|足りない|足りません|揃っていない|揃っていません)/.test(stanceText) ||
    /(?:結論|判断).{0,12}(?:出せない|出せません|下せない|下せません|できない|できません)/.test(stanceText) ||
    /(?:固定|決定|即断).{0,16}(?:早い|早すぎ|推奨できない|勧められない|見送る)/.test(stanceText) ||
    /判断(?:は|を)?変え(?:ない|ません|られない|られません)/.test(stanceText);
  if (explicitHold) return result;

  const supportsConditionalAction =
    /条件(?:付き|つき|を付け|をつけ).{0,24}(?:起用|採用|運用|賛成|任せ|使|試|進め)/.test(stanceText) ||
    /(?:条件付き|期限付き|暫定|当面).{0,24}(?:なら|で|として)?.{0,12}(?:起用|採用|運用|賛成|任せ|使|試|進め)/.test(stanceText) ||
    /(?:なら|であれば).{0,20}(?:賛成|起用でき|採用でき|任せられ|使える|試せる)/.test(stanceText) ||
    /無条件.{0,20}(?:ではなく|でなく).{0,20}(?:条件付き|見直し可能).{0,24}(?:起用|運用|採用|使)/.test(stanceText);
  if (supportsConditionalAction) {
    result.judgment = 'BLUE';
    result.warnings = [...new Set(Array.isArray(result.warnings) ? result.warnings : [])];
  }
  return result;
}

export function personaCandidateSequence(value) {
  const rows = Array.isArray(value?.candidatePlayers) ? value.candidatePlayers : [];
  return rows.map(name => playerKey(name) || String(name || '').trim().normalize('NFKC')).filter(Boolean);
}

export function personaSameSequence(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function normalizeChangeTracking(result, phase, primarySelf) {
  if (phase !== 'SECOND') {
    result.changedFromPrimary = false;
    result.changeReason = '';
    return result;
  }
  const valid = new Set(['GREEN','BLUE','YELLOW','RED']);
  const previous = String(primarySelf?.judgment || '').toUpperCase();
  const current = String(result?.judgment || '').toUpperCase();
  const judgmentChanged = valid.has(previous) && valid.has(current) && previous !== current;

  const previousCandidates = personaCandidateSequence(primarySelf);
  const currentCandidates = personaCandidateSequence(result);
  const hasCandidateState = previousCandidates.length > 0 || currentCandidates.length > 0;
  const candidateChanged = hasCandidateState && !personaSameSequence(previousCandidates, currentCandidates);
  const changed = judgmentChanged || candidateChanged;

  result.changedFromPrimary = changed;
  if (!changed) {
    result.changeReason = '';
  } else if (!String(result?.changeReason || '').trim()) {
    if (judgmentChanged && candidateChanged) {
      result.changeReason = `一次判断 ${previous} から ${current} へ変更し、候補・配置も変更。`;
    } else if (candidateChanged) {
      result.changeReason = 'クロス審議を受け、一次案から候補・配置を変更。';
    } else {
      result.changeReason = `一次判断 ${previous} から ${current} へ変更。`;
    }
  }
  return result;
}

export function personaJstContext() {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(now);
  return {
    timeZone: 'Asia/Tokyo',
    currentDateTime: formatted,
    instruction: 'この日時を審議の基準時点とする。「半年後」「来年」「次の夏」「今季」などは必ずこの基準時点から暦上の期間を計算して表現する。現在が夏なら半年後を夏とは呼ばない。次の夏を指すなら約1年後など、実際の時期に合わせる。'
  };
}


export function recoverSoftPitchingPlanLanguage(result, issues, pitchingPlanCase, caseData) {
  if (!pitchingPlanCase || !Array.isArray(issues) || !issues.length) return false;
  const check = validatePitchingPlanOrder(result?.candidatePlayers);
  if (!check.ok) return false;

  const evidencePlayers = Array.isArray(caseData?.evidence?.allCurrentTeamCheck?.players)
    ? caseData.evidence.allCurrentTeamCheck.players
    : [];
  if (evidencePlayers.length) {
    const eligible = new Set(evidencePlayers
      .filter(row => row?.pitching && typeof row.pitching === 'object' && Object.values(row.pitching).some(v => String(v ?? '').trim() !== ''))
      .map(row => playerKey(row?.name))
      .filter(Boolean));
    if (!check.order.every(name => eligible.has(playerKey(name)))) return false;
  }

  const hard = issues.some(issue => /(?:PITCHING_PLAN|正式ロスター|ロスター完全一致|現チーム外|未登録|重複配置|4役必要|4投手で構成|候補抽出|数値.{0,30}(?:一致しない|存在しない)|選手名.{0,30}(?:存在しない|対象外)|投球記録がある選手数.{0,24}一致しない|しか選択肢がない|CASE外)/i.test(String(issue || '')));
  if (hard) return false;

  const [starter, second, late, closer] = check.order;
  const persona = String(result?.persona || '').toUpperCase();
  const firstPerson = persona.startsWith('BALTHASAR') ? '俺' : persona.startsWith('CASPER') ? '僕' : '私';

  result.candidatePlayers = check.order;
  result.judgment = 'BLUE';
  result.confidence = 'MEDIUM';
  result.reviewRequested = false;
  result.reviewReason = '';
  result.dataConflict = false;
  result.facts = [];
  result.analysis = [];
  result.prediction = [];
  result.candidateBasis = `確認できる現チームの投球記録を比較し、先発 ${starter}、第2投手 ${second}、終盤 ${late}、クローザー ${closer} の4役案としました。`;
  result.primaryReason = '確認できる投球記録の範囲だけで4役を分けた案です。未確認の役割適性や将来効果は根拠にしていません。';
  result.publicStatement = `${firstPerson}は、先発 ${starter}、第2投手 ${second}、終盤 ${late}、クローザー ${closer} の4役案を維持します。確認できる投球記録だけで判断し、未確認の役割適性や将来効果は使いません。`;
  result.warnings = ['説明のうち確認できない将来効果・役割適性は判断に使っていません。'];
  return true;
}

export function recoverSoftFullLineupLanguage(result, issues, fullLineupCase) {
  if (!fullLineupCase || !Array.isArray(issues) || !issues.length) return false;
  const check = validateFullLineupOrder(result?.candidatePlayers);
  if (!check.ok) return false;
  const hard = issues.some(issue => /(?:FULL_LINEUP|正式ロスター|ロスター完全一致|対象外|9人の打順構成|candidatePlayers|打順構成エラー|数値.{0,30}(?:一致しない|存在しない)|選手名.{0,30}(?:存在しない|対象外)|supplied CASE\/EVIDENCE.{0,50}(?:値と一致しない|選手.*存在しない))/i.test(String(issue || '')));
  if (hard) return false;
  result.candidatePlayers = check.order;
  result.judgment = 'BLUE';
  result.confidence = result.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM';
  result.reviewRequested = false;
  result.reviewReason = '';
  result.dataConflict = false;
  result.facts = [];
  result.analysis = [];
  result.prediction = [];
  result.candidateBasis = '確認できた今季通算成績と打数を基準に、現チーム14名から9人を比較してこの順番としました。';
  result.primaryReason = '確認できた記録だけを使い、現在の成績と打順のつながりを比較した案です。';
  result.publicStatement = `${check.order.map((name,index)=>`${index+1}番${name}`).join('、')} の順です。確認できた記録だけで比較しました。`;
  result.warnings = ['説明のうち確認できない内容は判断に使っていません。'];
  return true;
}

export function failClosedPersona(result, issues) {
  const reason = `回答文に、確認できた記録と合わない内容があるため再確認が必要です。${issues.slice(0,3).join('／')}`;
  result.judgment = 'YELLOW';
  result.confidence = 'LOW';
  result.reviewRequested = true;
  result.reviewReason = reason;
  result.primaryReason = reason;
  result.publicStatement = '記録との照合で不整合を検出しました。このまま選手評価や起用判断には使わず、元データを確認して再審議します。';
  result.facts = [];
  result.analysis = [];
  result.prediction = [];
  result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), reason])];
  return result;
}

export function personaCorrectionDirective(issues) {
  const list = Array.isArray(issues) ? issues : [];
  const directives = [];
  if (list.some(x => /クローザー|終盤|高圧場面|役割経験/.test(String(x)))) {
    directives.push('Do not mention or imply any prior closer usage, save situation, end-game role, pressure handling, high-leverage experience, or unfamiliarity with pressure unless CASE.evidence explicitly contains it. If it is absent, omit the story entirely; a disclaimer alone is enough.');
  }
  if (list.some(x => /負担の大きさ|具体的悪影響/.test(String(x)))) {
    directives.push('The only supported burden statement is exactly the supplied level: 「捕手との兼任負担を考慮する必要がある」. In facts, analysis, primaryReason, publicStatement and warnings, do NOT say the burden is large, severe, accumulated, increasing, already harming the player, causing fatigue, affecting growth, affecting performance, or affecting team balance. Prefer repeating the supplied wording exactly. If you want to discuss a possible future consequence, put it only in prediction and use explicit probability wording; otherwise omit it.');
  }
  if (list.some(x => /将来|不確実性|保証できない/.test(String(x)))) {
    directives.push('Every future causal statement about growth, conditioning, performance, wins, team strength, role stability, attack strength, scoring or burden MUST contain explicit uncertainty wording such as 「可能性がある」「おそれがある」「考えられる」. A conditional clause alone is not enough. A present-tense recommendation such as 「この打順を標準案にする」 is a decision, not a forecast; keep it separate from any prediction. candidateBasis is also an assertive field: do not put unverified future growth or future team-strength claims there. If the forecast is not necessary, delete it.');
  }
  if (list.some(x => /長打力|出塁能力/.test(String(x)))) {
    directives.push('Do not decompose OPS into slugging power or on-base ability unless SLG/extra-base-hit evidence or OBP evidence is explicitly supplied. State the OPS value itself instead.');
  }
  if (list.some(x => /FULL_LINEUP/.test(String(x)))) {
    directives.push('This is a full batting-order task. candidatePlayers MUST contain exactly nine distinct current-team players in batting order from No.1 through No.9. Do not return a shortlist, extra bench players, duplicate players, or historical players. If opponent-specific information is absent, produce a standard current lineup rather than refusing to choose.');
  }
  if (list.some(x => /PITCHING_PLAN/.test(String(x)))) {
    directives.push('This is a four-role pitching-plan task. candidatePlayers MUST contain exactly four distinct current-team players in this exact role order: STARTER, SECOND PITCHER, LATE, CLOSER. Do not add extra pitchers, duplicate a pitcher, or include retired players.');
  }
  return directives.join(' ');
}

export function isOpponentSpecificLineupQuestion(caseData) {
  const q = String(caseData?.question || '').normalize('NFKC');
  return /(?:対戦相手|相手投手|相手先発|右投手|左投手|右腕|左腕|対右|対左|左右の相性|相手別|対戦データ|対戦成績)/.test(q);
}

export function normalizeStandardFullLineupDecision(result, caseData) {
  if (!isFullLineupQuestion(caseData) || isOpponentSpecificLineupQuestion(caseData)) return result;
  const check = validateFullLineupOrder(result?.candidatePlayers);
  if (!check.ok || result?.dataConflict === true) return result;

  const reason = [result?.reviewReason, result?.primaryReason, ...(Array.isArray(result?.warnings) ? result.warnings : [])]
    .map(v => String(v || ''))
    .join(' ');
  const hardBlock = /(?:不整合|矛盾|正式ロスター|読み込まれていない|取得できない|取得不能|欠落|選手参照|数値.{0,16}一致しない|Evidence.{0,16}存在しない|打順構成.{0,16}(?:不完全|エラー))/.test(reason);
  const ordinaryUncertainty = /(?:相手|左右|対戦|母数|打席|打数|サンプル|試合数|直近|少な|不足|未確認)/.test(reason);

  if (result?.reviewRequested === true && ordinaryUncertainty && !hardBlock) {
    result.reviewRequested = false;
    result.reviewReason = '';
  }
  if (String(result?.judgment || '').toUpperCase() === 'YELLOW' && result?.reviewRequested !== true && !hardBlock) {
    result.judgment = 'BLUE';
    result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), '標準ベストオーダーとして暫定採用。相手投手や追加試合の情報が入れば見直す。'])];
  }
  result.candidatePlayers = check.order;
  return result;
}

export function buildPersonaRequest(body, persona, phase) {
  const candidateCase = isCandidateCase(body);
  const fullLineupCase = candidateCase && isFullLineupQuestion(body.case);
  const pitchingPlanCase = candidateCase && isPitchingPlanQuestion(body.case);
  const pitchingRoleCase = candidateCase && !pitchingPlanCase && String(body?.case?.selectionKind||body?.case?.evidence?.selectionKind||'').toUpperCase()==='PITCHING_ROLE';
  const requestedPitchingPlanInnings = Number(body?.case?.evidence?.gameInnings);
  const pitchingPlanGameInnings = requestedPitchingPlanInnings === 9 ? 9 : 7;
  const temporalContext = personaJstContext();
  const historyRule = '2026-2027の現チームEvidenceを主評価とする。ただし2025-2026など過年度の記録がCASE.evidenceに明示されている場合、それは単なる軽い参考ではなく、現在選手の実績・経験・再現性を測る重要な基準線として扱う。過去の大きな母数や継続した出場実績は、その記録が実際に示す範囲で明示的に評価へ入れる。その上で2026-2027通算と直近6試合の状態を重ね、過去だけで現在を上書きせず、少ない現在母数だけで過去の積み上げも消さない。CASE.evidenceにない過年度の選手役割、打順、起用歴、成績、経験は知識や推測で追加しない。旧チームで非レギュラーだった選手の小さい母数だけを現在評価の不利材料にしない。';
  const focusedHistoryRule = 'FOCUSED PROPOSAL HISTORY RULE: Historical facts may be used only when they are explicitly present in CASE.evidence. Generic roster history or role-continuity knowledge must not be imported. Historical innings, ERA, strikeouts, walks, or appearances support only the pitching facts those fields actually state. They do NOT prove prior closer usage, save situations, high-leverage success, pressure handling, end-game experience, or any other role unless CASE.evidence explicitly states that role. Do not turn a raw rate/count into a qualitative claim such as good, bad, high, low, many, few, strong, weak, effective, or reliable without an explicit comparison baseline in CASE.evidence.';
  const effectiveHistoryRule = candidateCase ? historyRule : focusedHistoryRule;
  const focusedProposalRule = candidateCase ? '' : 'This is a focused proposal/evaluation, not a candidate-selection task. Answer only about the player, role, or proposal actually named in the CASE. Do not introduce another roster player. Do not manufacture an alternative candidate unless the user explicitly asked for one. Keep checkedPlayers, candidatePlayers and candidateBasis empty. Use only facts explicitly supplied in CASE/evidence. A strikeout count alone does NOT prove runs were prevented, a save situation was handled, pressure was handled, or closer suitability was established. If CASE/evidence does not contain a claimed role or comparison baseline, omit that claim rather than rephrasing it. If Evidence says only 「兼任負担を考慮する必要がある」, use that exact level in facts/analysis/reasons/statements; do not upgrade it to a large burden, fatigue, accumulated workload, growth harm, performance harm or team-balance harm. Any future effect on growth, conditioning, performance, wins, team strength, role stability or burden must use explicit uncertainty wording such as 「可能性がある」「おそれがある」「考えられる」; a conditional phrase by itself is not enough. ';
  const selectionEvidenceRule = 'SELECTION EVIDENCE RULE: Candidate attributes must come from CASE.evidence only. Persona identity does not authorize invented attributes. If development, mental, leadership, practice-attitude, future-growth or role-suitability evidence is absent, CASPER must not infer growth potential, future team strengthening, human traits, leadership, mental strength, development trajectory or role suitability from AVG/OPS or positions alone; it must say those development factors are unverified and rank only from supported evidence. If tactical expected-runs, clutch, pressure, opponent, lineup-combination or game-state evidence is absent, BALTHASAR must not state those as facts or certainty; any tactical forecast must be explicitly probabilistic. ALL personas may compare supplied peer metrics, but none may decompose OPS into long-hit power, slugging quality, on-base ability, OBP or SLG qualities unless the corresponding SLG/extra-base-hit/OBP evidence is explicitly supplied. State the supplied OPS value itself instead. candidateBasis, primaryReason and publicStatement are assertive fields and must not contain unsupported future outcomes. For ALL personas and ALL selection phases, do not make any future-effect claim unless it is necessary to answer the question. Prefer present-tense evidence comparisons and current-role reasoning. If a future effect is necessary, every sentence that contains it must include explicit uncertainty wording such as 「可能性がある」「考えられる」「おそれがある」. This applies equally to facts, analysis, prediction, candidateBasis, primaryReason, publicStatement and warnings.';
  const currentBattingSlotRule = 'CURRENT BATTING SLOT RULE: This is a present-time comparison, not a forecast. In candidateBasis, facts, analysis, prediction, primaryReason, publicStatement and warnings, do not state or imply that selecting a candidate will create runs, scoring chances, wins, lineup success, momentum, growth or future team strength. Compare only supplied current/historical/recent evidence and current slot fit. Do not use generic baseball convention such as 「定石」「3番は長打力」 as evidence unless CASE.evidence explicitly supplies that team policy. Do not infer OBP, SLG, long-hit power, on-base ability, clutch ability or scoring ability from AVG or OPS alone. State only the exact supplied metrics and the direct comparison among real candidates. If a future effect is not explicitly requested, omit it entirely rather than adding uncertainty wording.';
  const fullLineupPrimaryRule = 'This is a FULL LINEUP task. After checking all 14 current players, candidatePlayers must contain exactly nine distinct current-team players in your proposed batting order, where candidatePlayers[0] is 1番 and candidatePlayers[8] is 9番. This is not a top-nine ranking: treat adjacent hitters and lineup flow as part of your own persona domain. RESULT PRIORITY: the purpose of the best-order recommendation is to maximize the chance of producing results in an actual game from the evidence available now. Start from verified game results and actual usage, not a raw-stat leaderboard. When CASE.evidence contains 実起用・守備Evidence from 出場詳細CSV/守備詳細CSV, you MUST use the recorded starting batting orders, starting positions, substitutions and actual fielding positions when deciding both the nine players and whether a proposed defensive assignment is realistic. STANDARD DEFENSE ELIGIBILITY: for a generic/current best-order, your chosen nine must be capable of covering 投・捕・一・二・三・遊・左・中・右 using only positions where the player has an actual start in an official game or in 練習第1試合. 練習第2試合 starts and mid-game/substitute fielding may be discussed as supplemental versatility, but they do not establish a standard starting defensive position. If your first nine cannot satisfy this, revise the nine rather than relying on a substitute-only position. When dated coach/instructor observations or strategy evidence are supplied, consider them explicitly but do not treat them as commands: prefer newer dated guidance over older guidance when they conflict, and do not carry an old intention forward as current policy unless later evidence confirms continuity. Later actual game usage may weaken an older intention. If current numeric/game evidence and coach intent conflict, preserve the conflict and explain it rather than silently discarding either side. Do not invent a fixed percentage weighting. Do not include bench players after the ninth slot. Do not include retired old-team players. For a generic/current best-order question, the task is to choose the best STANDARD lineup from the evidence available now. Missing opponent-specific handedness, matchup splits, or an exact future opponent is a later adjustment condition, not a reason to refuse a standard lineup. A small current sample lowers confidence but does not by itself justify YELLOW or reviewRequested when a legal nine-player lineup can be grounded in current records, historical baseline and recent form. Use three layers explicitly: (1) 2025-2026 historical performance for experience/reproducibility where available, (2) 2026-2027 aggregate for current level, and (3) recent six games for short-term form. For key batting slots, especially 1〜5番, candidateBasis/facts/primaryReason must connect available numbers from those layers to the slot choice. If a player lacks historical data, say so and use current/recent evidence; never invent it. Do not describe the standard-lineup recommendation itself as a guaranteed future outcome. DELIBERATION QUALITY: the PRIMARY publicStatement must not be only a nine-name announcement followed by a generic phrase such as 「成績を見て決めた」「数値を裏付けにした」「守備も考えた」. After stating the order, identify at least one meaningful batting-order decision (preferably 1〜5番 or the most debatable slot), name the players being compared, and cite at least one exact supplied statistic or explicitly supplied role/fielding fact that explains why you chose that order. Keep it concise, but make the first user-facing view show an actual argument, not merely a conclusion.';
  const fullLineupSecondRule = 'This remains a FULL LINEUP task after cross-examination. Reconsider the actual 1番〜9番 sequence, not just the names. candidatePlayers must still contain exactly nine distinct current-team players in batting-order sequence. Re-check STANDARD DEFENSE ELIGIBILITY before finalizing your SECOND proposal: the nine must collectively cover 投・捕・一・二・三・遊・左・中・右 using official-game or 練習第1試合 starting-position evidence only. A 練習第2試合 test start or mid-game fielding appearance is supplemental and cannot by itself make the standard defense legal. Reply to the other Wise Men’s concrete challenges about slots and combinations, then keep or revise your order independently. Do not converge merely to create consensus. For a generic/current best-order question, you must still leave the round with a STANDARD 1〜9 recommendation if the nine-player structure and core current evidence are available. Opponent-specific data and small samples may lower confidence or create a future adjustment condition, but they are not by themselves a blocking reason. Re-check the three evidence layers—historical performance, current-season aggregate, recent six-game form—and state how they support or weaken the key slots. DELIBERATION QUALITY: SECOND publicStatement must explicitly answer at least one concrete point raised in crossExamination. Name the disputed batting slot/player pair, say whether that point changed your order, and give the evidence-based reason. A bare 「維持します」「変えません」「他の意見も確認しました」 is invalid. The user must be able to see what was argued and why you kept or changed the lineup.';
  const pitchingRoleRule = 'This is a SINGLE PITCHING ROLE selection task. Stay strictly on the role named in the user question (for example, クローザー means closer only). candidatePlayers must contain ONLY players whose names appear in CASE.evidence pitchingEligible. A player with no pitching-detail record is ineligible for ordinary pitcher-role selection. Do not turn closer selection into a starter, long-relief, or whole pitching-plan discussion. Innings volume or ability to pitch long innings does not by itself establish closer suitability. If CASE.evidence does not contain saves, closer history, leverage performance, pressure handling, consecutive-use tolerance, or recovery evidence, state that those role-specific factors are unverified instead of inventing them. Compare supplied ERA, IP, SO/K9, WHIP and other actual pitching-detail fields only to the extent supplied. When the requested role is closer, explicitly inspect W/L/SV supplied from the master XLSM; SV is direct evidence of having finished games in a save situation and must not be omitted from the comparison. Do not automatically choose the saves leader: weigh SV together with the supplied pitching-detail performance and sample size. If CASE.evidence contains a dated COACH OBSERVATION about a pitching candidate, compare it with that candidate numeric pitching record before ranking. Mention both when they point in different directions and explain the effect on confidence or ranking. Coach opinion is evidence, not an automatic command; numeric results must also remain visible. Do not describe a candidate as stable, reliable, proven, strong, suitable, or experienced without an explicit comparison baseline or role evidence. ';
  const pitchingPlanPrimaryRule = `This is a PITCHING PLAN task for a ${pitchingPlanGameInnings}-inning game. After checking all 14 current players, candidatePlayers must contain exactly four distinct current-team players in this exact role order: candidatePlayers[0]=先発, candidatePlayers[1]=第2投手, candidatePlayers[2]=終盤, candidatePlayers[3]=クローザー. This is a role assignment, not a generic pitcher ranking. Use only supplied pitching evidence and its sample size. Raw totals and rates such as appearances, innings, ERA, strikeouts and walks do not by themselves prove stability, reliability, reproducibility, effectiveness, superiority, role suitability, pressure handling or readiness. Do not label a pitcher stable, reliable, proven, effective, strong, weak, suitable, or experienced unless CASE.evidence supplies an explicit comparison baseline or role evidence supporting that exact qualitative claim. Prefer stating the supplied numbers directly. Do not invent exact inning limits, consecutive-use tolerance, saves, closer history, high-leverage success, pressure handling, or fatigue status unless CASE.evidence explicitly supplies them. Historical innings and rates may show past pitching volume only; they do not prove a past role.`;
  const pitchingPlanSecondRule = `This remains a ${pitchingPlanGameInnings}-inning four-role PITCHING PLAN task after cross-examination. Reconsider the exact role sequence 先発→第2投手→終盤→クローザー. candidatePlayers must still contain exactly four distinct current-team players in that role order. Answer the concrete role-player challenges, then keep or revise your plan independently. Do not converge merely to create consensus, and never invent unsupported closer history, pressure ability, fatigue, or exact inning ceilings.`;

  const primaryInstruction = candidateCase
    ? fullLineupCase
      ? `${fullLineupPrimaryRule} Do not phrase the user-facing answer as 賛成・反対・可決・否決. FIRST inspect exactly the authoritativeCurrentRoster 14 players using ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. ${selectionEvidenceRule} candidateBasis must explain the evidence-grounded idea behind your 1〜9 order, and for the main hitters must visibly compare historical baseline → current aggregate → recent-six form when those layers exist. Put exact supplied numbers in facts rather than vague claims. In publicStatement, state your batting order clearly enough that the user can see the sequence and the key reason for it. The key reason must name a specific slot/player comparison and include at least one exact supplied number or explicit current-role/fielding fact; generic phrases alone are not sufficient. Unless a true data conflict or missing current-team core dataset prevents a legal lineup, set reviewRequested=false. For a valid but provisional standard lineup, use BLUE rather than YELLOW. Missing opponent handedness or a small sample belongs in warnings, not reviewRequested. Resolve relative time expressions from temporalContext. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
      : pitchingPlanCase
        ? `${pitchingPlanPrimaryRule} Do not phrase the user-facing answer as 賛成・反対・可決・否決. FIRST inspect exactly the authoritativeCurrentRoster 14 players using ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. ${selectionEvidenceRule} candidateBasis must explain why each of the four role assignments is defensible from the supplied records and sample sizes. In publicStatement, clearly state 先発、第2投手、終盤、クローザー with exact official names. Then identify at least one role assignment that is most debatable, name the alternative player you compared, and cite at least one exact supplied pitching statistic or explicit coach observation that explains your choice. A four-name role list followed by a generic phrase is not sufficient. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
        : pitchingRoleCase
          ? `${pitchingRoleRule} FIRST inspect exactly the authoritativeCurrentRoster 14 players and put exactly those 14 names into checkedPlayers. Then rank only pitchingEligible players for the exact requested pitching role. ${selectionEvidenceRule} In publicStatement and primaryReason, explain the choice in terms of the requested role and explicitly name any important role-specific evidence that is still missing. Compare your first candidate with at least one real alternative from pitchingEligible and cite at least one exact supplied pitching statistic, SV value, or explicit coach observation. A candidate name plus a generic role statement is not sufficient. Keep it concise Japanese for a baseball meeting.`
          : `This is a SELECTION question, not a yes/no proposal. Do not phrase the user-facing answer as 賛成・反対・可決・否決. The judgment enum is only an internal protocol field and must not be treated as the answer. FIRST inspect exactly the authoritativeCurrentRoster 14 players using the ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. Do not add any fifteenth player or omit anyone. SECOND, independently choose candidatePlayers using only your persona domain and only supplied evidence. Rank candidatePlayers in your preferred order. candidateBasis must explain your own evidence-grounded selection standard. Apply historicalWeightingRule only to historical facts actually supplied. ${selectionEvidenceRule} ${currentBattingSlotRule} For every SELECTION response, especially CASPER, any statement about future growth, development, future team strength, future performance, scoring, wins, role stability, conditioning or burden MUST use explicit uncertainty wording such as 「可能性がある」「考えられる」「おそれがある」 unless CASE.evidence explicitly proves that future outcome. Do not write a future effect as a certain result in analysis, prediction, candidateBasis, primaryReason, publicStatement, or warnings. If the future claim is unnecessary, omit it. For a current batting-slot question such as who should bat third, use present evidence and current role fit only. Do not claim that the choice will produce runs, wins, scoring opportunities, lineup success, growth, development or future team strength. Those future effects are outside this current-slot decision unless the user explicitly asks for a forecast. In publicStatement, directly answer who you select and why, using the exact official player names from authoritativeCurrentRoster. For a single batting-slot question, compare your first candidate with at least one real alternative and cite at least one exact supplied batting statistic or explicit current-role fact; do not give only the selected name plus a generic phrase. Resolve relative time expressions from temporalContext. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
    : focusedProposalRule + 'Give the independent judgment on the exact proposal. Separate supplied fact from analysis and prediction. Historical evidence is governed strictly by historicalWeightingRule. Do not infer prior role, leverage situation, success condition, or qualitative statistical strength from raw counts alone. If the evidence is incomplete, say exactly what remains uncertain while still answering the current choice boundary. Write primaryReason and publicStatement in natural spoken Japanese, usually 1–3 short sentences. Do not expose hidden chain-of-thought.';
  const secondInstruction = candidateCase
    ? fullLineupCase
      ? `${fullLineupSecondRule} Keep checkedPlayers exactly equal to the authoritative 14-player roster. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. ${selectionEvidenceRule} If crossExamination introduces an unsupported premise, identify it as unverified instead of adopting it. In candidateBasis/facts/primaryReason, compare historical baseline → current aggregate → recent-six form for the key slots when those layers exist. Unless a true data conflict or missing current-team core dataset prevents a legal lineup, set reviewRequested=false. A valid but provisional standard lineup is BLUE rather than YELLOW; missing opponent-specific data or small samples are warnings/adjustment conditions. In publicStatement, state what changed or stayed in your 1〜9 order and why. Do not expose hidden chain-of-thought.`
      : pitchingPlanCase
        ? `${pitchingPlanSecondRule} Keep checkedPlayers exactly equal to the authoritative 14-player roster. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. If crossExamination introduces an unsupported premise, identify it as unverified instead of adopting it. In publicStatement, state what changed or stayed in the four roles and why, using exact official player names. Explicitly answer at least one concrete role-player challenge from crossExamination and say whether that challenge changed your role assignment. A bare maintenance statement is invalid. Do not expose hidden chain-of-thought.`
        : pitchingRoleCase
          ? `${pitchingRoleRule} This is SECOND judgment after cross-examination. Keep checkedPlayers exactly equal to the authoritative 14-player roster. Re-rank only pitchingEligible players for the exact requested pitching role. Do not adopt any cross-examination claim about closer suitability, pressure, saves, fatigue, or long-inning value unless CASE.evidence supports it. ${selectionEvidenceRule} State what changed or stayed and why. Explicitly answer at least one concrete candidate comparison from crossExamination, name the player/role involved, and explain why you retained or changed the first candidate. A bare maintenance statement is invalid.`
          : `This remains a SELECTION question, not a yes/no vote. Do not say you are 賛成 or 反対 to the question. Keep checkedPlayers exactly equal to the authoritative 14-player roster. Reconsider your own candidatePlayers only from concrete evidence and cross-examination; do not change merely to join a majority. Rank candidatePlayers in your current preferred order. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. For every SELECTION response, any statement about future growth, development, future team strength, future performance, scoring, wins, role stability, conditioning or burden MUST use explicit uncertainty wording such as 「可能性がある」「考えられる」「おそれがある」 unless CASE.evidence explicitly proves that future outcome; otherwise omit the future claim. For a current batting-slot question, use present evidence and current role fit only; do not claim that a candidate will produce runs, wins, scoring opportunities or lineup success. Do not use phrases such as 「勝つための」 as a factual effect of the selection. ${selectionEvidenceRule} If crossExamination introduces a development, tactical or historical premise absent from CASE.evidence, treat it as unverified rather than adopting it. In publicStatement, state plainly which candidates you retain, add, or remove and why, using exact official player names from authoritativeCurrentRoster. For a single batting-slot selection, explicitly answer at least one concrete crossExamination comparison and say whether it changed your first candidate; a bare maintenance statement is invalid. The actual answer is the candidate shortlist, not the judgment enum. Keep it concise and natural. Do not expose hidden chain-of-thought.`
    : focusedProposalRule + 'Rejudge the exact focused proposal independently. Answer the evidence-grounded challenge, but do not adopt an unsupported claim merely because it appeared in crossExamination or another persona output. CASE/evidence remains authoritative. Historical evidence is governed strictly by historicalWeightingRule. If a challenge mentions a role, rate, strength, weakness, pressure situation, or past usage not explicitly in CASE/evidence, identify it as unverified and do not repeat it as fact. State plainly whether your judgment changed and why. Keep it concise and natural. Do not expose hidden chain-of-thought.';

  // SECOND only needs the persona-specific challenges plus compact cross summary.
  // Sending the complete cross-examination object to every persona duplicates
  // all three challenge sets and materially enlarges the Gemini request.
  const compactCrossExamination = phase === 'SECOND' && body.crossExamination
    ? {
        agreement: Array.isArray(body.crossExamination.agreement) ? body.crossExamination.agreement : [],
        disagreement: Array.isArray(body.crossExamination.disagreement) ? body.crossExamination.disagreement : [],
        domainConflicts: Array.isArray(body.crossExamination.domainConflicts) ? body.crossExamination.domainConflicts : [],
        warnings: Array.isArray(body.crossExamination.warnings) ? body.crossExamination.warnings : [],
        informationGaps: Array.isArray(body.crossExamination.informationGaps) ? body.crossExamination.informationGaps : [],
        challenges: Array.isArray(body.crossExamination?.challenges?.[persona])
          ? body.crossExamination.challenges[persona]
          : []
      }
    : null;

  const payload = phase === 'PRIMARY'
    ? {
        phase,
        temporalContext,
        authoritativeCurrentRoster: candidateCase ? CURRENT_ROSTER : [],
        historicalWeightingRule: effectiveHistoryRule,
        case: body.case,
        instruction: primaryInstruction
      }
    : {
        phase,
        temporalContext,
        authoritativeCurrentRoster: candidateCase ? CURRENT_ROSTER : [],
        historicalWeightingRule: effectiveHistoryRule,
        case: body.case,
        ownPrimaryJudgment: body.primarySelf || null,
        crossExamination: compactCrossExamination,
        instruction: secondInstruction
      };
  return { payload, candidateCase, fullLineupCase, pitchingPlanCase, pitchingRoleCase, pitchingPlanGameInnings };
}

export function finalizePersonaDraft(body, persona, phase, rawResult) {
  const candidateCase = isCandidateCase(body);
  const fullLineupCase = candidateCase && isFullLineupQuestion(body.case);
  const pitchingPlanCase = candidateCase && isPitchingPlanQuestion(body.case);
  let result = normalizeStandardFullLineupDecision(normalizeChangeTracking(
    normalizeConditionalJudgment(canonicalizePlayerData(rawResult), candidateCase),
    phase,
    body.primarySelf
  ), body.case);
  let guardIssues = [
    ...validatePersonaOutput(body.case, result, { focused: !candidateCase }),
    ...personaFullLineupIssues(rawResult, fullLineupCase),
    ...personaPitchingPlanIssues(rawResult, pitchingPlanCase)
  ];
  result.persona = persona.toUpperCase();
  result.phase = phase;
  return { result, guardIssues, candidateCase, fullLineupCase, pitchingPlanCase };
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const persona = String(body?.persona || '').toLowerCase();
    const phase = body?.phase === 'SECOND' ? 'SECOND' : 'PRIMARY';
    const candidateCase = isCandidateCase(body);
    const fullLineupCase = candidateCase && isFullLineupQuestion(body.case);
    const pitchingPlanCase = candidateCase && isPitchingPlanQuestion(body.case);
    const pitchingRoleCase = candidateCase && !pitchingPlanCase && String(body?.case?.selectionKind||body?.case?.evidence?.selectionKind||'').toUpperCase()==='PITCHING_ROLE';
    const requestedPitchingPlanInnings = Number(body?.case?.evidence?.gameInnings);
    const pitchingPlanGameInnings = requestedPitchingPlanInnings === 9 ? 9 : 7;
    if (!PERSONA_PROMPTS[persona]) return sendJson(res, 400, { error: 'Unknown persona' });
    if (!validPersonaCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    const { payload } = buildPersonaRequest(body, persona, phase);

    let rawResult = await callGemini({
      systemInstruction: PERSONA_PROMPTS[persona],
      userPayload: payload,
      responseSchema: PERSONA_RESPONSE_SCHEMA
    });
    let { result, guardIssues } = finalizePersonaDraft(body, persona, phase, rawResult);

    const correctionLimit = fullLineupCase ? 1 : 3;
    for (let attempt = 0; guardIssues.length && attempt < correctionLimit; attempt++) {
      const issueDirective = personaCorrectionDirective(guardIssues);
      const correctionPayload = {
        ...payload,
        invalidDraft: result,
        correctionIssues: guardIssues,
        correctionAttempt: attempt + 1,
        instruction: `${payload.instruction} CORRECTION PASS ${attempt + 1}: The previous structured draft failed deterministic evidence-language validation. Correct every item in correctionIssues. Remove unsupported claims completely rather than disguising or rephrasing them. Do not import generic historical role knowledge. Do not relabel a supplied metric. Do not add another player. ${issueDirective} Return the complete schema again using only CASE/evidence-supported facts.`
      };
      try {
        rawResult = await callGemini({
          systemInstruction: PERSONA_PROMPTS[persona],
          userPayload: correctionPayload,
          responseSchema: PERSONA_RESPONSE_SCHEMA
        });
      } catch (correctionError) {
        console.warn(`[MAGI persona correction] ${persona} ${phase}: ${correctionError?.message || correctionError}`);
        break;
      }
      result = normalizeStandardFullLineupDecision(normalizeChangeTracking(
        normalizeConditionalJudgment(canonicalizePlayerData(rawResult), candidateCase),
        phase,
        body.primarySelf
      ), body.case);
      guardIssues = [
        ...validatePersonaOutput(body.case, result, { focused: !candidateCase }),
        ...personaFullLineupIssues(rawResult, fullLineupCase),
        ...personaPitchingPlanIssues(rawResult, pitchingPlanCase)
      ];
    }

    result.persona = persona.toUpperCase();
    result.phase = phase;

    if (guardIssues.length
      && !recoverSoftFullLineupLanguage(result, guardIssues, fullLineupCase)
      && !recoverSoftPitchingPlanLanguage(result, guardIssues, pitchingPlanCase, body.case)) {
      failClosedPersona(result, guardIssues);
    }

    if (!candidateCase) {
      result.checkedPlayers = [];
      result.candidatePlayers = [];
      result.candidateBasis = '';
    }

    if (candidateCase) {
      const rs = personaRosterStatus(result.checkedPlayers);
      if (!rs.complete) {
        const problems = [];
        if (rs.missing.length) problems.push(`未確認：${rs.missing.join('・')}`);
        if (rs.unexpected.length) problems.push(`対象外：${rs.unexpected.join('・')}`);
        if (!rs.missing.length && !rs.unexpected.length && rs.uniqueCount !== CURRENT_ROSTER.length) problems.push(`確認人数：${rs.uniqueCount}名`);
        result.judgment = 'YELLOW';
        result.confidence = 'LOW';
        result.reviewRequested = true;
        result.reviewReason = `正式ロスター完全一致チェック失敗。${problems.join('。') || '14名との完全一致を確認できない'}。`;
        result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), result.reviewReason])];
        result.primaryReason = result.reviewReason;
        result.publicStatement = `現チームは正式に14名です。14名と完全一致していないため、この状態では候補を決めません。`;
        result.candidatePlayers = [];
        result.candidateBasis = '正式14名との完全一致未確認のため候補抽出を中止';
      } else {
        result.checkedPlayers = CURRENT_ROSTER.slice();
        if (fullLineupCase) {
          const lineupCheck = validateFullLineupOrder(result.candidatePlayers);
          if (!lineupCheck.ok) {
            result.judgment = 'YELLOW';
            result.confidence = 'LOW';
            result.reviewRequested = true;
            result.reviewReason = `1〜9番の打順構成を確定できません。${lineupCheck.issues.join('。')}`;
            result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), result.reviewReason])];
            result.primaryReason = result.reviewReason;
            result.publicStatement = '現チーム14名は確認できましたが、9人の打順が正しく構成できていないため、この案は確定しません。';
            result.candidatePlayers = [];
            result.candidateBasis = '9人の打順構成エラーのため再審議';
          } else {
            result.candidatePlayers = lineupCheck.order;
            normalizeStandardFullLineupDecision(result, body.case);
          }
        } else if (pitchingPlanCase) {
          const planCheck = validatePitchingPlanOrder(result.candidatePlayers);
          if (!planCheck.ok) {
            result.judgment = 'YELLOW';
            result.confidence = 'LOW';
            result.reviewRequested = true;
            result.reviewReason = `${pitchingPlanGameInnings}回制4役の投手運用を確定できません。${planCheck.issues.join('。')}`;
            result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), result.reviewReason])];
            result.primaryReason = result.reviewReason;
            result.publicStatement = `現チーム14名は確認できましたが、${pitchingPlanGameInnings}回制の先発・第2投手・終盤・クローザーの4役が正しく構成できていないため、この案は確定しません。`;
            result.candidatePlayers = [];
            result.candidateBasis = '4役投手運用の構成エラーのため再審議';
          } else {
            result.candidatePlayers = planCheck.order;
          }
        }
      }
    }

    normalizeChangeTracking(result, phase, body.primarySelf);
    return sendJson(res, 200, canonicalizePlayerData(result));
  } catch (error) {
    const tooLarge = error?.message === 'Request body too large';
    const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
    const status = tooLarge ? 413 : (transient ? 503 : 500);
    console.error('[MAGI persona]', error?.message || error);
    const safeFailureClass = ['provider_rate_limit','model_unavailable','provider_retryable_http','provider_http','empty_text','invalid_structured_json','timeout','other'].includes(String(error?.failureClass || ''))
      ? String(error.failureClass)
      : (error?.timedOut === true ? 'timeout' : 'other');
    try {
      res.setHeader('X-MAGI-Gemini-Failure', safeFailureClass);
      if (Array.isArray(error?.failureTrail) && error.failureTrail.length) {
        const safeTrail = error.failureTrail
          .slice(0, 3)
          .map(row => `${row.slot}=${row.failureClass}`)
          .join(',');
        res.setHeader('X-MAGI-Gemini-Trail', safeTrail);
      }
      if (safeFailureClass === 'provider_rate_limit') {
        const retryAfter = Number(error?.retryAfterSeconds);
        res.setHeader('Retry-After', String(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, Math.ceil(retryAfter)) : 15));
      }
    } catch {}
    return sendJson(res, status, {
      error: tooLarge ? '送信データが大きすぎます。' : (transient ? '3賢人の回答を一時的に取得できませんでした。' : '3賢人の回答を作成できませんでした。'),
      code: tooLarge ? 'REQUEST_TOO_LARGE' : 'PERSONA_GENERATION_FAILED',
      retryExhausted: transient,
      ...(transient ? {
        diagnostic: {
          failureClass: safeFailureClass,
          trail: Array.isArray(error?.failureTrail)
            ? error.failureTrail.slice(0, 3).map(row => ({
                slot: ['primary','fallback','last_resort'].includes(String(row?.slot)) ? String(row.slot) : 'unknown',
                failureClass: ['provider_rate_limit','model_unavailable','provider_retryable_http','provider_http','empty_text','invalid_structured_json','timeout','other'].includes(String(row?.failureClass)) ? String(row.failureClass) : 'other'
              }))
            : []
        }
      } : {})
    });
  }
}
