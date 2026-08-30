import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';

const EXPECTED_CURRENT_ROSTER = 14;
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
  return /クリーンナップ|中軸|主軸|打線|打順|先発|レギュラー|スタメン|候補|誰を中心|誰を起用/.test(String(body?.case?.question || ''));
}

function uniquePlayerCount(values) {
  const key = s => String(s || '').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
  return new Set((Array.isArray(values) ? values : []).map(key).filter(Boolean)).size;
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const persona = String(body?.persona || '').toLowerCase();
    const phase = body?.phase === 'SECOND' ? 'SECOND' : 'PRIMARY';
    if (!PERSONA_PROMPTS[persona]) return sendJson(res, 400, { error: 'Unknown persona' });
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    const payload = phase === 'PRIMARY'
      ? {
          phase,
          case: body.case,
          instruction: 'Give the independent judgment. For any lineup, batting-order, starter, regular, or candidate-selection question: FIRST read the ALL CURRENT TEAM CHECK evidence and put every checked current-team player name into checkedPlayers. Do not shortlist before this check is complete. SECOND, independently choose your own candidatePlayers using only your persona domain; do not copy or anticipate the other Wise Men. candidateBasis must briefly explain the persona-specific selection standard. In publicStatement, name the main candidatePlayers naturally before stating the judgment. Write primaryReason and publicStatement in natural spoken Japanese, as if you were saying it aloud in a baseball meeting to coaches and parents. Keep it concrete, easy to understand, and recognizably in this persona voice. Avoid bureaucratic AI/report wording. publicStatement should usually be 1–3 short sentences. Do not expose hidden chain-of-thought.'
        }
      : {
          phase,
          case: body.case,
          ownPrimaryJudgment: body.primarySelf || null,
          crossExamination: body.crossExamination || null,
          instruction: 'Rejudge independently. For candidate-selection cases, checkedPlayers must continue to reflect the full current-team check. candidatePlayers may change only when a concrete evidence-grounded challenge warrants it; do not change merely to join a majority. In publicStatement, answer the challenge like a real spoken exchange first, then say plainly whether your judgment or candidate shortlist changed and why. Use natural baseball language understandable to both experienced people and parents. Keep it concise and human, not report-like. Do not expose hidden chain-of-thought.'
        };

    const result = await callGemini({
      systemInstruction: PERSONA_PROMPTS[persona],
      userPayload: payload,
      responseSchema: schema
    });

    result.persona = persona.toUpperCase();
    result.phase = phase;
    if (phase === 'PRIMARY') {
      result.changedFromPrimary = false;
      result.changeReason = '';
    }

    if (isCandidateCase(body) && uniquePlayerCount(result.checkedPlayers) < EXPECTED_CURRENT_ROSTER) {
      const count = uniquePlayerCount(result.checkedPlayers);
      result.judgment = 'YELLOW';
      result.confidence = 'LOW';
      result.reviewRequested = true;
      result.reviewReason = `現チーム全員チェック未完了（${count}/${EXPECTED_CURRENT_ROSTER}名）。候補抽出前に全員確認が必要。`;
      result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), result.reviewReason])];
      result.primaryReason = result.reviewReason;
      result.publicStatement = `現チーム${EXPECTED_CURRENT_ROSTER}名を全員確認できていません。${count}名だけを見て候補を決めることはしません。`;
      result.candidatePlayers = [];
      result.candidateBasis = '全員確認未完了のため候補抽出を中止';
    }

    return sendJson(res, 200, result);
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Persona execution failed' });
  }
}
