import { callGemini, readBody, requirePost, sendJson } from './_gemini.js';
import { ORCHESTRATOR } from './_prompts.js';

const crossSchema = {
  type: 'OBJECT',
  properties: {
    agreement: { type: 'ARRAY', items: { type: 'STRING' } },
    disagreement: { type: 'ARRAY', items: { type: 'STRING' } },
    domainConflicts: { type: 'ARRAY', items: { type: 'STRING' } },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    informationGaps: { type: 'ARRAY', items: { type: 'STRING' } },
    challenges: {
      type: 'OBJECT',
      properties: {
        melchior: { type: 'ARRAY', items: { type: 'STRING' } },
        balthasar: { type: 'ARRAY', items: { type: 'STRING' } },
        casper: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['melchior','balthasar','casper']
    }
  },
  required: ['agreement','disagreement','domainConflicts','warnings','informationGaps','challenges']
};

const finalSchema = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['MAGI_CONSENSUS','MAGI_MAJORITY','MAGI_DEADLOCK','INSUFFICIENT_EVIDENCE','MAGI_REVIEW_REQUIRED'] },
    vote: { type: 'STRING' },
    recommendation: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    majorReasons: { type: 'ARRAY', items: { type: 'STRING' } },
    minorityOpinion: { type: 'STRING' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    prediction: { type: 'ARRAY', items: { type: 'STRING' } },
    reviewReason: { type: 'STRING' },
    reDeliberationConditions: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['status','vote','recommendation','confidence','majorReasons','minorityOpinion','warnings','prediction','reviewReason','reDeliberationConditions']
};

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const body = await readBody(req);
    if (!body?.case?.question) return sendJson(res, 400, { error: 'CASE is required' });

    if (body.phase === 'CROSS_EXAMINATION') {
      if (!body.primary) return sendJson(res, 400, { error: 'Locked primary judgments are required' });
      const result = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: {
          phase: 'CROSS_EXAMINATION',
          case: body.case,
          lockedPrimaryJudgments: body.primary,
          instruction: 'Do not decide the case. Only expose agreement, disagreement, domain conflicts, warnings, information gaps, and evidence-grounded challenges.'
        },
        responseSchema: crossSchema
      });
      return sendJson(res, 200, result);
    }

    if (body.phase === 'FINAL') {
      if (!body.primary || !body.second) return sendJson(res, 400, { error: 'Primary and second judgments are required' });
      const result = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: {
          phase: 'FINAL',
          case: body.case,
          lockedPrimaryJudgments: body.primary,
          crossExamination: body.crossExamination || null,
          secondJudgments: body.second,
          instruction: 'Apply the MAGI voting and review protocol exactly. Never create a fourth opinion.'
        },
        responseSchema: finalSchema
      });
      return sendJson(res, 200, result);
    }

    return sendJson(res, 400, { error: 'Unknown orchestrator phase' });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'Orchestration failed' });
  }
}
