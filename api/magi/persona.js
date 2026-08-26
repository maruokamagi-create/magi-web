import { callGemini, readBody, requirePost, sendJson } from './_gemini.js';
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
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    dataConflict: { type: 'BOOLEAN' },
    reviewRequested: { type: 'BOOLEAN' },
    reviewReason: { type: 'STRING' },
    changedFromPrimary: { type: 'BOOLEAN' },
    changeReason: { type: 'STRING' }
  },
  required: ['persona','phase','facts','analysis','prediction','confidence','judgment','primaryReason','warnings','dataConflict','reviewRequested','reviewReason','changedFromPrimary','changeReason']
};

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const body = await readBody(req);
    const persona = String(body?.persona || '').toLowerCase();
    const phase = body?.phase === 'SECOND' ? 'SECOND' : 'PRIMARY';
    if (!PERSONA_PROMPTS[persona]) return sendJson(res, 400, { error: 'Unknown persona' });
    if (!body?.case?.question) return sendJson(res, 400, { error: 'CASE is required' });

    const payload = phase === 'PRIMARY'
      ? { phase, case: body.case }
      : {
          phase,
          case: body.case,
          ownPrimaryJudgment: body.primarySelf || null,
          crossExamination: body.crossExamination || null,
          instruction: 'Rejudge independently. Change only if a concrete new reason from the cross examination warrants it; never change merely to join a majority.'
        };

    const result = await callGemini({
      systemInstruction: PERSONA_PROMPTS[persona],
      userPayload: payload,
      responseSchema: schema
    });

    // Server enforces identity/phase rather than trusting generated labels.
    result.persona = persona.toUpperCase();
    result.phase = phase;
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Persona execution failed' });
  }
}
