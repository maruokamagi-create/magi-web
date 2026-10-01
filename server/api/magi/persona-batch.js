import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { deterministicFullLineupCross, deterministicSelectionCross, isSelectionCase } from './orchestrate.js';
import {
  PERSONA_RESPONSE_SCHEMA,
  buildPersonaRequest,
  finalizePersonaDraft,
  validPersonaCase
} from './persona.js';

const PERSONAS = ['melchior','balthasar','casper'];

const BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(PERSONAS.map(persona => [persona, PERSONA_RESPONSE_SCHEMA])),
  required: PERSONAS
};

function batchSystemInstruction(phase) {
  if (phase === 'FULL') {
    return [
      'MAGI FULL DELIBERATION BATCH PROTOCOL.',
      'Produce PRIMARY and SECOND work products for all three personas in one structured response.',
      'For PRIMARY, each persona must reason independently from the shared CASE and must not use another persona output.',
      'For SECOND, reconsider only from the supplied deterministic cross-examination challenge assigned to that persona and its own PRIMARY.',
      'Do not seek consensus or majority agreement. Preserve genuine disagreement.',
      'MELCHIOR uses only MELCHIOR role; BALTHASAR only BALTHASAR role; CASPER only CASPER role.',
      'Return exactly the requested schema.'
    ].join(' ');
  }
  if (phase === 'SECOND') {
    return [
      'MAGI SECOND BATCH PROTOCOL.',
      'Generate three separately reasoned SECOND judgments in one structured response.',
      'Each persona may use only its own PRIMARY judgment and its own cross-examination compartment.',
      'Never expose or use another persona PRIMARY, challenge, reasoning, or generated SECOND output.',
      'MELCHIOR uses only MELCHIOR system role; BALTHASAR uses only BALTHASAR system role; CASPER uses only CASPER system role.',
      'Reconsideration is allowed only from evidence plus that persona own challenge. Do not seek consensus or majority agreement.',
      'Return exactly the requested schema.'
    ].join(' ');
  }
  return [
    'MAGI PRIMARY BATCH PROTOCOL.',
    'Generate three separately reasoned PRIMARY judgments in one structured response.',
    'Each persona must evaluate the supplied CASE independently.',
    'MELCHIOR uses only MELCHIOR system role; BALTHASAR uses only BALTHASAR system role; CASPER uses only CASPER system role.',
    'Do not make one persona react to, quote, imitate, compromise with, or infer the output of another persona.',
    'There is no majority, consensus, cross-examination, or SECOND judgment in this call.',
    'Treat the three outputs as three isolated PRIMARY work products that merely share the same authoritative CASE evidence.',
    'Return exactly the requested schema.'
  ].join(' ');
}

function safeTransient(res, error) {
  const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
  const safeFailureClass = ['provider_rate_limit','model_unavailable','provider_retryable_http','provider_http','empty_text','invalid_structured_json','timeout','other'].includes(String(error?.failureClass || ''))
    ? String(error.failureClass) : (error?.timedOut === true ? 'timeout' : 'other');
  try {
    res.setHeader('X-MAGI-Gemini-Failure', safeFailureClass);
    if (safeFailureClass === 'provider_rate_limit') {
      const retryAfter = Number(error?.retryAfterSeconds);
      res.setHeader('Retry-After', String(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(60, Math.ceil(retryAfter)) : 15));
    }
  } catch {}
  if (transient) {
    try { res.setHeader('X-MAGI-Persona-Recovery', 'retry-persona-batch-request'); } catch {}
  }
  return sendJson(res, transient ? 503 : 500, {
    error: transient ? '3賢人の判断を一時的に取得できませんでした。' : '3賢人の判断を作成できませんでした。',
    code: 'PERSONA_BATCH_GENERATION_FAILED',
    retryExhausted: !transient,
    retryFreshRequest: transient,
    retryScope: transient ? 'PERSONA_BATCH_REQUEST' : '',
    diagnostic: { failureClass: safeFailureClass }
  });
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const phase = ['PRIMARY','SECOND','FULL'].includes(body?.phase) ? body.phase : 'PRIMARY';
    if (!validPersonaCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });
    if (phase === 'SECOND' && (!body?.primary || !body?.crossExamination)) {
      return sendJson(res, 400, { error: 'SECOND batch requires isolated PRIMARY and cross-examination compartments' });
    }
    if (phase === 'FULL') {
      // FULL is intentionally fail-closed until the one-call response schema can
      // carry both PRIMARY and SECOND while preserving the deterministic CROSS.
      // Build the authoritative CROSS capability here first so FULL never invents
      // a second, divergent cross-examination implementation.
      const crossBuilder = isSelectionCase(body.case)
        ? deterministicSelectionCross
        : null;
      if (!crossBuilder) {
        return sendJson(res, 400, {
          error: 'FULL batch is not supported for this case type yet',
          code: 'PERSONA_FULL_BATCH_UNSUPPORTED_CASE'
        });
      }
      return sendJson(res, 503, {
        error: 'FULL batch schema is not enabled yet',
        code: 'PERSONA_FULL_BATCH_NOT_READY',
        retryExhausted: true
      });
    }

    const personaRequests = Object.fromEntries(PERSONAS.map(persona => {
      const isolatedBody = phase === 'SECOND'
        ? { case: body.case, primarySelf: body.primary?.[persona] || null, crossExamination: body.crossExamination?.[persona] || null }
        : body;
      const { payload } = buildPersonaRequest(isolatedBody, persona, phase);
      return [persona, {
        personaRole: PERSONA_PROMPTS[persona],
        payload
      }];
    }));

    const raw = await callGemini({
      systemInstruction: batchSystemInstruction(phase),
      userPayload: {
        phase,
        isolationRule: phase === 'SECOND'
          ? 'Each persona receives only its own PRIMARY and its own cross-examination compartment. Never cross-read persona compartments.'
          : 'Each persona sees the same CASE evidence but must produce its own judgment without using another persona output.',
        personas: personaRequests
      },
      responseSchema: BATCH_SCHEMA
    });

    const out = {};
    for (const persona of PERSONAS) {
      if (!raw?.[persona] || typeof raw[persona] !== 'object') {
        return sendJson(res, 503, { error: phase + ' batch response is incomplete', code: 'PERSONA_BATCH_INCOMPLETE', retryExhausted: false });
      }
      const validationBody = phase === 'SECOND' ? { ...body, primarySelf: body.primary?.[persona] || null } : body;
      const { result, guardIssues } = finalizePersonaDraft(validationBody, persona, phase, raw[persona]);
      // Batch PRIMARY is fail-closed: unlike the serial endpoint, it must not
      // publish a degraded persona merely because the draft can be represented
      // as YELLOW. Any deterministic guard issue invalidates the whole batch.
      if (guardIssues.length) {
        return sendJson(res, 503, {
          error: phase + ' batch response failed persona validation',
          code: 'PERSONA_BATCH_VALIDATION_FAILED',
          persona: persona.toUpperCase(),
          retryExhausted: false
        });
      }
      if (result.reviewRequested === true) {
        return sendJson(res, 503, {
          error: phase + ' batch persona requires review',
          code: 'PERSONA_BATCH_REVIEW_REQUIRED',
          persona: persona.toUpperCase(),
          retryExhausted: false
        });
      }
      out[persona] = result;
    }
    return sendJson(res, 200, out);
  } catch (error) {
    console.error('[MAGI persona-batch]', error?.message || error);
    return safeTransient(res, error);
  }
}
