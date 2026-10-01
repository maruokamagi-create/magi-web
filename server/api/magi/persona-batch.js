import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
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

function batchSystemInstruction() {
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
  return sendJson(res, transient ? 503 : 500, {
    error: transient ? '3賢人の一次判断を一時的に取得できませんでした。' : '3賢人の一次判断を作成できませんでした。',
    code: 'PERSONA_BATCH_GENERATION_FAILED',
    retryExhausted: transient,
    diagnostic: { failureClass: safeFailureClass }
  });
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    if (body?.phase && body.phase !== 'PRIMARY') return sendJson(res, 400, { error: 'PRIMARY batch only' });
    if (!validPersonaCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    const personaRequests = Object.fromEntries(PERSONAS.map(persona => {
      const { payload } = buildPersonaRequest(body, persona, 'PRIMARY');
      return [persona, {
        personaRole: PERSONA_PROMPTS[persona],
        primaryPayload: payload
      }];
    }));

    const raw = await callGemini({
      systemInstruction: batchSystemInstruction(),
      userPayload: {
        phase: 'PRIMARY',
        isolationRule: 'Each persona sees the same CASE evidence but must produce its own judgment without using another persona output.',
        personas: personaRequests
      },
      responseSchema: BATCH_SCHEMA
    });

    const out = {};
    for (const persona of PERSONAS) {
      if (!raw?.[persona] || typeof raw[persona] !== 'object') {
        return sendJson(res, 503, { error: 'PRIMARY batch response is incomplete', code: 'PERSONA_BATCH_INCOMPLETE', retryExhausted: false });
      }
      const { result, guardIssues } = finalizePersonaDraft(body, persona, 'PRIMARY', raw[persona]);
      if (guardIssues.length) {
        return sendJson(res, 503, {
          error: 'PRIMARY batch response failed persona validation',
          code: 'PERSONA_BATCH_VALIDATION_FAILED',
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
