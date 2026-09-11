import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { validatePersonaOutput } from './_persona-output-guard.js';
import { CURRENT_ROSTER, canonicalizePlayerData, playerKey } from './_roster.js';
import { isFullLineupQuestion, validateFullLineupOrder } from './_full-lineup.js';
import { isPitchingPlanQuestion, validatePitchingPlanOrder } from './_pitching-plan.js';

const schema = {
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

function validCase(body) {
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

function rosterStatus(values) {
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

function fullLineupIssues(rawResult, fullLineupCase) {
  if (!fullLineupCase) return [];
  const check = validateFullLineupOrder(rawResult?.candidatePlayers);
  return check.issues.map(x => `FULL_LINEUP: ${x}`);
}

function pitchingPlanIssues(rawResult, pitchingPlanCase) {
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

export function normalizeChangeTracking(result, phase, primarySelf) {
  if (phase !== 'SECOND') {
    result.changedFromPrimary = false;
    result.changeReason = '';
    return result;
  }
  const valid = new Set(['GREEN','BLUE','YELLOW','RED']);
  const previous = String(primarySelf?.judgment || '').toUpperCase();
  const current = String(result?.judgment || '').toUpperCase();
  if (!valid.has(previous) || !valid.has(current)) return result;

  const changed = previous !== current;
  result.changedFromPrimary = changed;
  if (!changed) {
    result.changeReason = '';
  } else if (!String(result?.changeReason || '').trim()) {
    result.changeReason = `一次判断 ${previous} から ${current} へ変更。`;
  }
  return result;
}

function jstContext() {
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

function failClosedPersona(result, issues) {
  const reason = `回答文の数値・選手参照をEvidenceと照合した結果、不整合を検出したため再確認が必要です。${issues.slice(0,3).join('／')}`;
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

function correctionDirective(issues) {
  const list = Array.isArray(issues) ? issues : [];
  const directives = [];
  if (list.some(x => /クローザー|終盤|高圧場面|役割経験/.test(String(x)))) {
    directives.push('Do not mention or imply any prior closer usage, save situation, end-game role, pressure handling, high-leverage experience, or unfamiliarity with pressure unless CASE.evidence explicitly contains it. If it is absent, omit the story entirely; a disclaimer alone is enough.');
  }
  if (list.some(x => /負担の大きさ|具体的悪影響/.test(String(x)))) {
    directives.push('The only supported burden statement is exactly the supplied level: 「捕手との兼任負担を考慮する必要がある」. In facts, analysis, primaryReason, publicStatement and warnings, do NOT say the burden is large, severe, accumulated, increasing, already harming the player, causing fatigue, affecting growth, affecting performance, or affecting team balance. Prefer repeating the supplied wording exactly. If you want to discuss a possible future consequence, put it only in prediction and use explicit probability wording; otherwise omit it.');
  }
  if (list.some(x => /将来|不確実性|保証できない/.test(String(x)))) {
    directives.push('Every future causal statement about growth, conditioning, performance, wins, team strength, role stability, attack strength, scoring or burden MUST contain explicit uncertainty wording such as 「可能性がある」「おそれがある」「考えられる」. A conditional clause alone is not enough. candidateBasis is also an assertive field: do not put unverified future growth or future team-strength claims there. If the forecast is not necessary, delete it.');
  }
  if (list.some(x => /長打力|出塁能力/.test(String(x)))) {
    directives.push('Do not decompose OPS into slugging power or on-base ability unless SLG/extra-base-hit evidence or OBP evidence is explicitly supplied. State the OPS value itself instead.');
  }
  if (list.some(x => /FULL_LINEUP/.test(String(x)))) {
    directives.push('This is a full batting-order task. candidatePlayers MUST contain exactly nine distinct current-team players in batting order from No.1 through No.9. Do not return a shortlist, extra bench players, duplicate players, or historical players.');
  }
  if (list.some(x => /PITCHING_PLAN/.test(String(x)))) {
    directives.push('This is a four-role pitching-plan task. candidatePlayers MUST contain exactly four distinct current-team players in this exact role order: STARTER, SECOND PITCHER, LATE, CLOSER. Do not add extra pitchers, duplicate a pitcher, or include retired players.');
  }
  return directives.join(' ');
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
    if (!PERSONA_PROMPTS[persona]) return sendJson(res, 400, { error: 'Unknown persona' });
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    const temporalContext = jstContext();
    const historyRule = '2026-2027の現チームEvidenceを主評価とする。2025-2026など過年度の記録は、CASE.evidenceに明示的に含まれる場合だけ参考にする。過年度Evidenceがある場合は、母数・実戦経験・役割継続をその記録が実際に示す範囲で現在評価へ接続する。CASE.evidenceにない過年度の選手役割、打順、起用歴、成績、経験を知識や推測で追加しない。旧チームで非レギュラーだった選手の小さい母数だけを現在評価の不利材料にしない。';
    const focusedHistoryRule = 'FOCUSED PROPOSAL HISTORY RULE: Historical facts may be used only when they are explicitly present in CASE.evidence. Generic roster history or role-continuity knowledge must not be imported. Historical innings, ERA, strikeouts, walks, or appearances support only the pitching facts those fields actually state. They do NOT prove prior closer usage, save situations, high-leverage success, pressure handling, end-game experience, or any other role unless CASE.evidence explicitly states that role. Do not turn a raw rate/count into a qualitative claim such as good, bad, high, low, many, few, strong, weak, effective, or reliable without an explicit comparison baseline in CASE.evidence.';
    const effectiveHistoryRule = candidateCase ? historyRule : focusedHistoryRule;
    const focusedProposalRule = candidateCase ? '' : 'This is a focused proposal/evaluation, not a candidate-selection task. Answer only about the player, role, or proposal actually named in the CASE. Do not introduce another roster player. Do not manufacture an alternative candidate unless the user explicitly asked for one. Keep checkedPlayers, candidatePlayers and candidateBasis empty. Use only facts explicitly supplied in CASE/evidence. A strikeout count alone does NOT prove runs were prevented, a save situation was handled, pressure was handled, or closer suitability was established. If CASE/evidence does not contain a claimed role or comparison baseline, omit that claim rather than rephrasing it. If Evidence says only 「兼任負担を考慮する必要がある」, use that exact level in facts/analysis/reasons/statements; do not upgrade it to a large burden, fatigue, accumulated workload, growth harm, performance harm or team-balance harm. Any future effect on growth, conditioning, performance, wins, team strength, role stability or burden must use explicit uncertainty wording such as 「可能性がある」「おそれがある」「考えられる」; a conditional phrase by itself is not enough. ';
    const selectionEvidenceRule = 'SELECTION EVIDENCE RULE: Candidate attributes must come from CASE.evidence only. Persona identity does not authorize invented attributes. If development, mental, leadership, practice-attitude, future-growth or role-suitability evidence is absent, CASPER must not infer growth potential, future team strengthening, human traits, leadership, mental strength, development trajectory or role suitability from AVG/OPS or positions alone; it must say those development factors are unverified and rank only from supported evidence. If tactical expected-runs, clutch, pressure, opponent, lineup-combination or game-state evidence is absent, BALTHASAR must not state those as facts or certainty; any tactical forecast must be explicitly probabilistic. MELCHIOR may compare supplied peer metrics but must not decompose OPS into OBP or SLG qualities unless those components are supplied. candidateBasis, primaryReason and publicStatement are assertive fields and must not contain unsupported future outcomes.';
    const fullLineupPrimaryRule = 'This is a FULL LINEUP task. After checking all 14 current players, candidatePlayers must contain exactly nine distinct current-team players in your proposed batting order, where candidatePlayers[0] is 1番 and candidatePlayers[8] is 9番. This is not a top-nine ranking: treat adjacent hitters and lineup flow as part of your own persona domain. Do not include bench players after the ninth slot. Do not include retired old-team players. Historical evidence may inform current-player continuity only as historicalWeightingRule allows.';
    const fullLineupSecondRule = 'This remains a FULL LINEUP task after cross-examination. Reconsider the actual 1番〜9番 sequence, not just the names. candidatePlayers must still contain exactly nine distinct current-team players in batting-order sequence. Reply to the other Wise Men’s concrete challenges about slots and combinations, then keep or revise your order independently. Do not converge merely to create consensus.';
    const pitchingPlanPrimaryRule = 'This is a PITCHING PLAN task for a 7-inning game. After checking all 14 current players, candidatePlayers must contain exactly four distinct current-team players in this exact role order: candidatePlayers[0]=先発, candidatePlayers[1]=第2投手, candidatePlayers[2]=終盤, candidatePlayers[3]=クローザー. This is a role assignment, not a generic pitcher ranking. Use only supplied pitching evidence and its sample size. Do not invent exact inning limits, consecutive-use tolerance, saves, closer history, high-leverage success, pressure handling, or fatigue status unless CASE.evidence explicitly supplies them. Historical innings and rates may show past pitching volume only; they do not prove a past role.';
    const pitchingPlanSecondRule = 'This remains a 7-inning four-role PITCHING PLAN task after cross-examination. Reconsider the exact role sequence 先発→第2投手→終盤→クローザー. candidatePlayers must still contain exactly four distinct current-team players in that role order. Answer the concrete role-player challenges, then keep or revise your plan independently. Do not converge merely to create consensus, and never invent unsupported closer history, pressure ability, fatigue, or exact inning ceilings.';

    const primaryInstruction = candidateCase
      ? fullLineupCase
        ? `${fullLineupPrimaryRule} Do not phrase the user-facing answer as 賛成・反対・可決・否決. FIRST inspect exactly the authoritativeCurrentRoster 14 players using ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. ${selectionEvidenceRule} candidateBasis must explain the evidence-grounded idea behind your 1〜9 order. In publicStatement, state your batting order clearly enough that the user can see the sequence and the key reason for it. Resolve relative time expressions from temporalContext. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
        : pitchingPlanCase
          ? `${pitchingPlanPrimaryRule} Do not phrase the user-facing answer as 賛成・反対・可決・否決. FIRST inspect exactly the authoritativeCurrentRoster 14 players using ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. ${selectionEvidenceRule} candidateBasis must explain why each of the four role assignments is defensible from the supplied records and sample sizes. In publicStatement, clearly state 先発、第2投手、終盤、クローザー with exact official names. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
          : `This is a SELECTION question, not a yes/no proposal. Do not phrase the user-facing answer as 賛成・反対・可決・否決. The judgment enum is only an internal protocol field and must not be treated as the answer. FIRST inspect exactly the authoritativeCurrentRoster 14 players using the ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. Do not add any fifteenth player or omit anyone. SECOND, independently choose candidatePlayers using only your persona domain and only supplied evidence. Rank candidatePlayers in your preferred order. candidateBasis must explain your own evidence-grounded selection standard. Apply historicalWeightingRule only to historical facts actually supplied. ${selectionEvidenceRule} In publicStatement, directly answer who you select and why, using the exact official player names from authoritativeCurrentRoster. Resolve relative time expressions from temporalContext. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.`
      : focusedProposalRule + 'Give the independent judgment on the exact proposal. Separate supplied fact from analysis and prediction. Historical evidence is governed strictly by historicalWeightingRule. Do not infer prior role, leverage situation, success condition, or qualitative statistical strength from raw counts alone. If the evidence is incomplete, say exactly what remains uncertain while still answering the current choice boundary. Write primaryReason and publicStatement in natural spoken Japanese, usually 1–3 short sentences. Do not expose hidden chain-of-thought.';
    const secondInstruction = candidateCase
      ? fullLineupCase
        ? `${fullLineupSecondRule} Keep checkedPlayers exactly equal to the authoritative 14-player roster. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. ${selectionEvidenceRule} If crossExamination introduces an unsupported premise, identify it as unverified instead of adopting it. In publicStatement, state what changed or stayed in your 1〜9 order and why. Do not expose hidden chain-of-thought.`
        : pitchingPlanCase
          ? `${pitchingPlanSecondRule} Keep checkedPlayers exactly equal to the authoritative 14-player roster. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. If crossExamination introduces an unsupported premise, identify it as unverified instead of adopting it. In publicStatement, state what changed or stayed in the four roles and why, using exact official player names. Do not expose hidden chain-of-thought.`
          : `This remains a SELECTION question, not a yes/no vote. Do not say you are 賛成 or 反対 to the question. Keep checkedPlayers exactly equal to the authoritative 14-player roster. Reconsider your own candidatePlayers only from concrete evidence and cross-examination; do not change merely to join a majority. Rank candidatePlayers in your current preferred order. Continue historicalWeightingRule, selectionEvidenceRule and temporalContext. ${selectionEvidenceRule} If crossExamination introduces a development, tactical or historical premise absent from CASE.evidence, treat it as unverified rather than adopting it. In publicStatement, state plainly which candidates you retain, add, or remove and why, using exact official player names from authoritativeCurrentRoster. The actual answer is the candidate shortlist, not the judgment enum. Keep it concise and natural. Do not expose hidden chain-of-thought.`
      : focusedProposalRule + 'Rejudge the exact focused proposal independently. Answer the evidence-grounded challenge, but do not adopt an unsupported claim merely because it appeared in crossExamination or another persona output. CASE/evidence remains authoritative. Historical evidence is governed strictly by historicalWeightingRule. If a challenge mentions a role, rate, strength, weakness, pressure situation, or past usage not explicitly in CASE/evidence, identify it as unverified and do not repeat it as fact. State plainly whether your judgment changed and why. Keep it concise and natural. Do not expose hidden chain-of-thought.';

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
          crossExamination: body.crossExamination || null,
          instruction: secondInstruction
        };

    let rawResult = await callGemini({
      systemInstruction: PERSONA_PROMPTS[persona],
      userPayload: payload,
      responseSchema: schema
    });
    let result = normalizeChangeTracking(
      normalizeConditionalJudgment(canonicalizePlayerData(rawResult), candidateCase),
      phase,
      body.primarySelf
    );
    let guardIssues = [
      ...validatePersonaOutput(body.case, result, { focused: !candidateCase }),
      ...fullLineupIssues(rawResult, fullLineupCase),
      ...pitchingPlanIssues(rawResult, pitchingPlanCase)
    ];

    for (let attempt = 0; guardIssues.length && attempt < 3; attempt++) {
      const issueDirective = correctionDirective(guardIssues);
      const correctionPayload = {
        ...payload,
        invalidDraft: result,
        correctionIssues: guardIssues,
        correctionAttempt: attempt + 1,
        instruction: `${payload.instruction} CORRECTION PASS ${attempt + 1}: The previous structured draft failed deterministic evidence-language validation. Correct every item in correctionIssues. Remove unsupported claims completely rather than disguising or rephrasing them. Do not import generic historical role knowledge. Do not relabel a supplied metric. Do not add another player. ${issueDirective} Return the complete schema again using only CASE/evidence-supported facts.`
      };
      rawResult = await callGemini({
        systemInstruction: PERSONA_PROMPTS[persona],
        userPayload: correctionPayload,
        responseSchema: schema
      });
      result = normalizeChangeTracking(
        normalizeConditionalJudgment(canonicalizePlayerData(rawResult), candidateCase),
        phase,
        body.primarySelf
      );
      guardIssues = [
        ...validatePersonaOutput(body.case, result, { focused: !candidateCase }),
        ...fullLineupIssues(rawResult, fullLineupCase),
        ...pitchingPlanIssues(rawResult, pitchingPlanCase)
      ];
    }

    result.persona = persona.toUpperCase();
    result.phase = phase;

    if (guardIssues.length) failClosedPersona(result, guardIssues);

    if (!candidateCase) {
      result.checkedPlayers = [];
      result.candidatePlayers = [];
      result.candidateBasis = '';
    }

    if (candidateCase) {
      const rs = rosterStatus(result.checkedPlayers);
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
          }
        } else if (pitchingPlanCase) {
          const planCheck = validatePitchingPlanOrder(result.candidatePlayers);
          if (!planCheck.ok) {
            result.judgment = 'YELLOW';
            result.confidence = 'LOW';
            result.reviewRequested = true;
            result.reviewReason = `7回制4役の投手運用を確定できません。${planCheck.issues.join('。')}`;
            result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), result.reviewReason])];
            result.primaryReason = result.reviewReason;
            result.publicStatement = '現チーム14名は確認できましたが、先発・第2投手・終盤・クローザーの4役が正しく構成できていないため、この案は確定しません。';
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
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Persona execution failed' });
  }
}