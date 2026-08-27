import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';

const schema = {
  type: 'OBJECT',
  properties: {
    persona: { type: 'STRING' },
    phase: { type: 'STRING' },
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
  required: ['persona','phase','facts','analysis','prediction','confidence','judgment','primaryReason','publicStatement','warnings','dataConflict','reviewRequested','reviewReason','changedFromPrimary','changeReason']
};

function validCase(body) {
  const q = String(body?.case?.question || '').trim();
  return q.length >= 2 && q.length <= 12000;
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
          instruction: 'Give the independent judgment. Write primaryReason and publicStatement in natural spoken Japanese, as if you were saying it aloud in a baseball meeting to coaches and parents. Keep it concrete, easy to understand, and recognizably in this persona voice. Avoid bureaucratic AI/report wording. publicStatement should usually be 1–3 short sentences. Do not expose hidden chain-of-thought.'
        }
      : {
          phase,
          case: body.case,
          ownPrimaryJudgment: body.primarySelf || null,
          crossExamination: body.crossExamination || null,
          instruction: 'Rejudge independently. In publicStatement, answer the challenge like a real spoken exchange first, then say plainly whether your judgment changed and why. Use natural baseball language understandable to both experienced people and parents. Keep it concise and human, not report-like. Change only if a concrete new reason from the cross examination warrants it; never change merely to join a majority. Do not expose hidden chain-of-thought.'
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
    return sendJson(res, 200, result);
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI persona]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Persona execution failed' });
  }
}
