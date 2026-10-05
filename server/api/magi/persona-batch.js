import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { deterministicFullLineupCross, deterministicSelectionCross, isSelectionCase } from './orchestrate.js';
import {
  PERSONA_RESPONSE_SCHEMA,
  buildPersonaRequest,
  finalizePersonaDraft,
  recoverSoftFullLineupLanguage,
  recoverSoftPitchingPlanLanguage,
  validPersonaCase
} from './persona.js';

const PERSONAS = ['melchior','balthasar','casper'];

const BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(PERSONAS.map(persona => [persona, PERSONA_RESPONSE_SCHEMA])),
  required: PERSONAS
};

const FULL_PERSONA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    checkedPlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidatePlayers: { type: 'ARRAY', items: { type: 'STRING' } },
    candidateBasis: { type: 'STRING' },
    facts: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    judgment: { type: 'STRING', enum: ['GREEN','BLUE','YELLOW','RED'] },
    primaryReason: { type: 'STRING' },
    publicStatement: { type: 'STRING' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    dataConflict: { type: 'BOOLEAN' },
    reviewRequested: { type: 'BOOLEAN' },
    reviewReason: { type: 'STRING' },
    changedFromPrimary: { type: 'BOOLEAN' },
    changeReason: { type: 'STRING' }
  },
  required: ['checkedPlayers','candidatePlayers','candidateBasis','facts','confidence','judgment','primaryReason','publicStatement','warnings','dataConflict','reviewRequested','reviewReason','changedFromPrimary','changeReason']
};
const FULL_PHASE_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(PERSONAS.map(persona => [persona, FULL_PERSONA_SCHEMA])),
  required: PERSONAS
};
const FULL_BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: { primary: FULL_PHASE_SCHEMA, second: FULL_PHASE_SCHEMA },
  required: ['primary','second']
};

function inflateFullDraft(raw, persona, phase) {
  return {
    persona: persona.toUpperCase(),
    phase,
    checkedPlayers: raw?.checkedPlayers || [],
    candidatePlayers: raw?.candidatePlayers || [],
    candidateBasis: raw?.candidateBasis || '',
    facts: raw?.facts || [],
    analysis: [],
    prediction: [],
    confidence: raw?.confidence || 'LOW',
    judgment: raw?.judgment || 'YELLOW',
    primaryReason: raw?.primaryReason || '',
    publicStatement: raw?.publicStatement || '',
    warnings: raw?.warnings || [],
    dataConflict: raw?.dataConflict === true,
    reviewRequested: raw?.reviewRequested === true,
    reviewReason: raw?.reviewReason || '',
    changedFromPrimary: raw?.changedFromPrimary === true,
    changeReason: raw?.changeReason || ''
  };
}

function batchSystemInstruction(phase) {
  if (phase === 'FULL') {
    return [
      'MAGI FULL DELIBERATION BATCH PROTOCOL.',
      'Return PRIMARY and SECOND work products for all three personas in one structured response, but preserve strict logical phase ordering.',
      'STEP 1 PRIMARY: each persona reasons independently from the shared CASE. During PRIMARY, another persona output is unavailable and must not be inferred, copied, harmonized, or anticipated.',
      'STEP 2 CROSS: do not invent free-form cross examination. SECOND may use only the deterministic comparison instruction assigned to that persona.',
      'STEP 3 SECOND: each persona may reconsider only its own PRIMARY plus its own deterministic comparison instruction and shared CASE evidence. It must not read another persona reasoning, facts, analysis, warnings, confidence, or SECOND output.',
      'A persona may see another persona candidate name only when its deterministic comparison instruction explicitly names it; this never grants access to that persona reasoning.',
      'Do not seek consensus or majority agreement. Preserve genuine disagreement. Do not create differences merely to appear independent.',
      'MELCHIOR uses only MELCHIOR role; BALTHASAR only BALTHASAR role; CASPER only CASPER role.',
      'Return exactly the requested schema. Never expose hidden reasoning.'
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

function recoverSoftForecastLanguage(result, issues) {
  const list = Array.isArray(issues) ? issues.map(v => String(v || '')) : [];
  if (!list.length || !list.every(v => /(?:将来|不確実性|保証できない結果)/.test(v))) return false;
  result.prediction = [];
  result.analysis = [];
  result.warnings = [...new Set([...(Array.isArray(result.warnings) ? result.warnings : []), '将来結果を断定する表現は判断根拠から除外しました。'])];
  return true;
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const requestedPhase = String(body?.phase || 'PRIMARY').toUpperCase();
    if (requestedPhase === 'FULL') return sendJson(res, 410, { error:'FULL batch experiment is retired', code:'PERSONA_FULL_BATCH_RETIRED', retryExhausted:true });
    const phase = ['PRIMARY','SECOND'].includes(requestedPhase) ? requestedPhase : 'PRIMARY';
    if (!validPersonaCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });
    if (phase === 'SECOND' && (!body?.primary || !body?.crossExamination)) {
      return sendJson(res, 400, { error: 'SECOND batch requires isolated PRIMARY and cross-examination compartments' });
    }
    if (phase === 'FULL') {
      // FULL is intentionally fail-closed until the one-call response schema can
      // carry both PRIMARY and SECOND while preserving the deterministic CROSS.
      // Build the authoritative CROSS capability here first so FULL never invents
      // a second, divergent cross-examination implementation.
      const fullLineupCase = /(?:ベストオーダー|打順|オーダー|ラインナップ)/.test(String(body.case?.question || '')) && /(?:1番|１番|守備位置|ポジション|1.?9番|１.?９番)/.test(String(body.case?.question || ''));
      const crossBuilder = fullLineupCase
        ? deterministicFullLineupCross
        : (isSelectionCase(body.case) ? deterministicSelectionCross : null);
      if (!crossBuilder) {
        return sendJson(res, 400, {
          error: 'FULL batch is not supported for this case type yet',
          code: 'PERSONA_FULL_BATCH_UNSUPPORTED_CASE'
        });
      }
      // FULL shares the same CASE/roster/evidence across all three personas.
      // Do not repeat that large payload three times: send one authoritative
      // shared context plus only the persona-specific role/instruction.
      const builtPrimary = Object.fromEntries(PERSONAS.map(persona => {
        const { payload } = buildPersonaRequest(body, persona, 'PRIMARY');
        return [persona, payload];
      }));
      const sharedPrimary = builtPrimary.melchior;
      const primaryRequests = Object.fromEntries(PERSONAS.map(persona => [
        persona,
        {
          personaRole: PERSONA_PROMPTS[persona],
          instruction: builtPrimary[persona].instruction
        }
      ]));
      // A single model response cannot literally execute server code between its
      // PRIMARY and SECOND fields. Therefore FULL remains experimental and its
      // SECOND fields are not publishable until the server can reconstruct the
      // canonical CROSS from returned PRIMARY and verify that each SECOND is
      // consistent with that exact challenge.
      const rawFull = await callGemini({
        systemInstruction: batchSystemInstruction('FULL'),
        userPayload: {
          phase: 'FULL',
          sharedContext: {
            temporalContext: sharedPrimary.temporalContext,
            authoritativeCurrentRoster: sharedPrimary.authoritativeCurrentRoster,
            historicalWeightingRule: sharedPrimary.historicalWeightingRule,
            case: sharedPrimary.case
          },
          primaryPersonas: primaryRequests,
          crossPolicy: fullLineupCase ? 'CANONICAL_FULL_LINEUP_CROSS' : 'CANONICAL_SELECTION_CROSS',
          secondRule: 'SECOND is provisional. The server will reject it unless it matches the canonical CROSS reconstructed from PRIMARY.'
        },
        responseSchema: FULL_BATCH_SCHEMA
      });
      if (!rawFull?.primary || !rawFull?.second) {
        return sendJson(res, 503, { error:'FULL batch response is incomplete', code:'PERSONA_FULL_BATCH_INCOMPLETE', retryExhausted:true });
      }
      const primary = {};
      for (const persona of PERSONAS) {
        const finalized = finalizePersonaDraft(body, persona, 'PRIMARY', inflateFullDraft(rawFull.primary?.[persona], persona, 'PRIMARY'));
        if (!rawFull.primary?.[persona] || finalized.guardIssues.length || finalized.result.reviewRequested === true) {
          return sendJson(res, 503, { error:'FULL PRIMARY failed validation', code:'PERSONA_FULL_PRIMARY_VALIDATION_FAILED', persona:persona.toUpperCase(), retryExhausted:true });
        }
        primary[persona] = finalized.result;
      }
      const cross = crossBuilder(primary);
      if (!cross) {
        return sendJson(res, 503, { error:'FULL canonical CROSS could not be constructed', code:'PERSONA_FULL_CROSS_FAILED', retryExhausted:true });
      }
      const second = {};
      for (const persona of PERSONAS) {
        const challengeToSelf = Array.isArray(cross?.challenges?.[persona]) ? cross.challenges[persona] : [];
        if (!challengeToSelf.length) {
          return sendJson(res, 503, { error:'FULL canonical CROSS has no persona challenge', code:'PERSONA_FULL_CROSS_INCOMPLETE', persona:persona.toUpperCase(), retryExhausted:true });
        }
        const secondBody = {
          ...body,
          primarySelf: primary[persona],
          crossExamination: {
            ...cross,
            challengeToSelf,
            challengeTarget: persona.toUpperCase(),
            independenceRule:'他の2人格と同じ結論に合わせる必要はない。違いを作るためだけに変えてもいけない。一次案とEvidenceを自分の専門領域で再検証し、少なくとも1つの別案を比較したうえで、その案を採るか退けるかを自分で決めること。'
          }
        };
        const finalized = finalizePersonaDraft(secondBody, persona, 'SECOND', inflateFullDraft(rawFull.second?.[persona], persona, 'SECOND'));
        if (!rawFull.second?.[persona] || finalized.guardIssues.length || finalized.result.reviewRequested === true) {
          return sendJson(res, 503, { error:'FULL SECOND failed validation against canonical CROSS context', code:'PERSONA_FULL_SECOND_VALIDATION_FAILED', persona:persona.toUpperCase(), retryExhausted:true });
        }
        second[persona] = finalized.result;
      }
      // Structural validation now uses the exact server-reconstructed CROSS.
      // This still proves protocol-level, not separate-process, independence.
      return sendJson(res, 200, {
        experimental:true,
        publishable:false,
        isolationLevel:'PROTOCOL_LEVEL_SINGLE_PROVIDER_CALL',
        primary,
        cross,
        second
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
      let personaRaw = raw[persona];
      let finalized = finalizePersonaDraft(validationBody, persona, phase, personaRaw);
      let { result, guardIssues } = finalized;

      // One model generation per batch phase. Extra correction generations can exceed the serverless request window.\n      // Soft prose issues may still be sanitized deterministically below; hard evidence guards remain fail-closed.\n\n      // Still fail closed after correction attempts. Deterministic evidence
      // validation remains authoritative; this does not weaken any guard.
      if (guardIssues.length
        && !recoverSoftForecastLanguage(result, guardIssues)
        && !recoverSoftFullLineupLanguage(result, guardIssues, finalized.fullLineupCase)
        && !recoverSoftPitchingPlanLanguage(result, guardIssues, finalized.pitchingPlanCase, body.case)) {
        return sendJson(res, 503, {
          error: phase + ' batch response failed persona validation',
          code: 'PERSONA_BATCH_VALIDATION_FAILED',
          persona: persona.toUpperCase(),
          retryExhausted: true,
          retryFreshRequest: false,
          retryScope: '',
          diagnostic: {
            guardIssueCount: guardIssues.length,
            guardIssueCodes: guardIssues.map((issue) => String(issue?.code || issue?.type || issue || 'UNKNOWN')).slice(0, 8)
          }
        });
      }
      if (result.reviewRequested === true) {
        return sendJson(res, 503, {
          error: phase + ' batch persona requires review',
          code: 'PERSONA_BATCH_REVIEW_REQUIRED',
          persona: persona.toUpperCase(),
          retryExhausted: true,
          retryFreshRequest: false,
          retryScope: ''
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
