import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { CURRENT_ROSTER, canonicalizePlayerData, playerKey } from './_roster.js';

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

function isCandidateCase(body) {
  return /クリーンナップ|中軸|主軸|打線|打順|オーダー|紅白戦|先発|レギュラー|スタメン|候補|誰を中心|誰を起用/.test(String(body?.case?.question || ''));
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

function normalizeConditionalJudgment(result, selectionMode) {
  if (selectionMode || String(result?.judgment || '').toUpperCase() !== 'YELLOW') return result;
  const text = [
    result?.publicStatement,
    result?.primaryReason,
    result?.candidateBasis,
    result?.changeReason,
    ...(Array.isArray(result?.analysis) ? result.analysis : [])
  ].map(v => String(v || '')).join(' ');
  const supportsConditionalAction =
    /条件(?:を|付き|つき|付け|つけ).{0,24}(?:暫定|期限|起用|採用|運用|賛成)/.test(text) ||
    /(?:暫定|期限付き|当面).{0,20}(?:起用|採用|運用|任せ|送り出|賛成)/.test(text) ||
    /(?:なら|であれば).{0,16}(?:賛成|起用でき|採用でき|任せられ)/.test(text);
  if (supportsConditionalAction) {
    result.judgment = 'BLUE';
    result.warnings = [...new Set(Array.isArray(result.warnings) ? result.warnings : [])];
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

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const persona = String(body?.persona || '').toLowerCase();
    const phase = body?.phase === 'SECOND' ? 'SECOND' : 'PRIMARY';
    const selectionMode = String(body?.case?.mode || '').toLowerCase() === 'selection';
    if (!PERSONA_PROMPTS[persona]) return sendJson(res, 400, { error: 'Unknown persona' });
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    const temporalContext = jstContext();
    const historyRule = '2026-2027を主評価とするが、2025-2026を軽い参考として切り捨てない。大久保 陽翔・大野 竜暉は旧チームで十分な出場母数と継続的な実戦経験があるため、旧成績を再現性・経験値・役割継続の重要Evidenceとして現在評価へ接続する。特に大久保 陽翔は旧チームから継続して4番を担い、新チームでも基本的に4番を担うチームの柱という役割継続を必ず考慮する。ただし既得権として固定せず、現在の明確なEvidenceがあれば変更を検討する。旧チームで非レギュラーだった選手の小さい母数は現在評価の不利材料にしない。';
    const primaryInstruction = selectionMode
      ? 'This is a SELECTION question, not a yes/no proposal. Do not phrase the user-facing answer as 賛成・反対・可決・否決. The judgment enum is only an internal protocol field and must not be treated as the answer. FIRST inspect exactly the authoritativeCurrentRoster 14 players using the ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. Do not add any fifteenth player or omit anyone. SECOND, independently choose candidatePlayers using only your persona domain. Rank candidatePlayers in your preferred order. candidateBasis must explain your own selection standard. Apply historicalWeightingRule, including substantial old-team experience and role continuity for 大久保 陽翔 and 大野 竜暉. In publicStatement, directly answer who you select and why, using the exact official player names from authoritativeCurrentRoster. Resolve relative time expressions from temporalContext. Keep it natural, concise Japanese for a baseball meeting. Do not expose hidden chain-of-thought.'
      : 'Give the independent judgment. For any lineup, batting-order, starter, regular, or candidate-selection question: FIRST inspect exactly the authoritativeCurrentRoster 14 players using the ALL CURRENT TEAM CHECK evidence and put exactly those 14 names into checkedPlayers. Do not add any fifteenth player or other reference name, and do not omit anyone. Do not shortlist before this check is complete. SECOND, independently choose your own candidatePlayers using only your persona domain; do not copy or anticipate the other Wise Men. candidateBasis must briefly explain the persona-specific selection standard. Apply historicalWeightingRule: current-team evidence is primary, but substantial old-team evidence and role continuity for 大久保 陽翔 and 大野 竜暉 are meaningful evidence, not a negligible footnote. In publicStatement, name the main candidatePlayers naturally before stating the judgment and use exact official player names from authoritativeCurrentRoster. Resolve all relative time expressions from temporalContext. Write primaryReason and publicStatement in natural spoken Japanese, as if you were saying it aloud in a baseball meeting to coaches and parents. Keep it concrete, easy to understand, and recognizably in this persona voice. Avoid bureaucratic AI/report wording. publicStatement should usually be 1–3 short sentences. Do not expose hidden chain-of-thought.';
    const secondInstruction = selectionMode
      ? 'This remains a SELECTION question, not a yes/no vote. Do not say you are 賛成 or 反対 to the question. Keep checkedPlayers exactly equal to the authoritative 14-player roster. Reconsider your own candidatePlayers only from concrete evidence and cross-examination; do not change merely to join a majority. Rank candidatePlayers in your current preferred order. Continue historicalWeightingRule and temporalContext. In publicStatement, state plainly which candidates you retain, add, or remove and why, using exact official player names from authoritativeCurrentRoster. The actual answer is the candidate shortlist, not the judgment enum. Keep it concise and natural. Do not expose hidden chain-of-thought.'
      : 'Rejudge independently. For candidate-selection cases, checkedPlayers must continue to contain exactly the authoritative 14-player current-team roster: no omissions and no extra names. candidatePlayers may change only when a concrete evidence-grounded challenge warrants it; do not change merely to join a majority. Continue to apply historicalWeightingRule and resolve all relative dates from temporalContext. In publicStatement, answer the challenge like a real spoken exchange first, then say plainly whether your judgment or candidate shortlist changed and why, using exact official player names from authoritativeCurrentRoster. Use natural baseball language understandable to both experienced people and parents. Keep it concise and human, not report-like. Do not expose hidden chain-of-thought.';

    const payload = phase === 'PRIMARY'
      ? {
          phase,
          temporalContext,
          authoritativeCurrentRoster: CURRENT_ROSTER,
          historicalWeightingRule: historyRule,
          case: body.case,
          instruction: primaryInstruction
        }
      : {
          phase,
          temporalContext,
          authoritativeCurrentRoster: CURRENT_ROSTER,
          historicalWeightingRule: historyRule,
          case: body.case,
          ownPrimaryJudgment: body.primarySelf || null,
          crossExamination: body.crossExamination || null,
          instruction: secondInstruction
        };

    const rawResult = await callGemini({
      systemInstruction: PERSONA_PROMPTS[persona],
      userPayload: payload,
      responseSchema: schema
    });
    const result = normalizeConditionalJudgment(canonicalizePlayerData(rawResult), selectionMode);

    result.persona = persona.toUpperCase();
    result.phase = phase;
    if (phase === 'PRIMARY') {
      result.changedFromPrimary = false;
      result.changeReason = '';
    }

    if (isCandidateCase(body)) {
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
      }
    }

    return sendJson(res, 200, canonicalizePlayerData(result));
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Persona execution failed' });
  }
}
