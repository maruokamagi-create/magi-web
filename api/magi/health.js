import { checkGeminiConfiguration, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';

function detectOutputFormat(questionValue) {
  const q = String(questionValue || '');
  return /(?:PDF|ＰＤＦ)/i.test(q) ? 'PDF' : 'DEFAULT';
}

function stripOutputFormatModifier(questionValue) {
  return String(questionValue || '')
    .replace(/(?:PDF|ＰＤＦ)(?:にして|化して|で出して|で見せて|で保存して|で作って|でお願い|で)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function routeWithOutputFormat(question, context) {
  const outputFormat = detectOutputFormat(question);
  let routed = await routeQuestion(question, context);
  routed = await recoverContextBoundDeliberation(question, context, routed);
  routed.outputFormat = outputFormat;

  // Output format is a presentation modifier, not a reason to lose an otherwise clear intent.
  // If the first pass stops only after a PDF modifier was added, classify the same request again
  // without that modifier. An actually ambiguous base request remains CLARIFY (e.g. "陽翔の成績").
  if (outputFormat === 'PDF' && routed.route === 'CLARIFY') {
    const baseQuestion = stripOutputFormatModifier(question);
    if (baseQuestion && baseQuestion !== question) {
      let base = await routeQuestion(baseQuestion, context);
      base = await recoverContextBoundDeliberation(baseQuestion, context, base);
      if (base.safeToExecute && base.route !== 'CLARIFY' && base.route !== 'UNSUPPORTED') {
        routed = {
          ...base,
          outputFormat,
          outputFormatRecovered: true,
          outputFormatBaseQuestion: baseQuestion
        };
      } else {
        routed.outputFormatBaseQuestion = baseQuestion;
        routed.outputFormatRecovered = false;
      }
    }
  }

  return routed;
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);

    // Standalone semantic-router lab path. This is not wired into MAGI-WEB's main execution button yet.
    if (String(body?.mode || '').toUpperCase() === 'ROUTE_QUESTION') {
      const question = String(body?.question || '').trim();
      if (!question) return sendJson(res, 400, { ok: false, error: 'question is required' });
      const routed = await routeWithOutputFormat(question, body?.context || []);
      return sendJson(res, 200, { ok: true, ...routed });
    }

    const gemini = await checkGeminiConfiguration();
    return sendJson(res, gemini.ok ? 200 : 503, {
      ok: gemini.ok,
      service: 'MAGI Gemini Engine',
      protocol: '1.0',
      model: gemini.model,
      modelDisplayName: gemini.displayName || null,
      configured: gemini.ok,
      reason: gemini.ok ? null : gemini.reason
    });
  } catch (error) {
    console.error('[MAGI health/router]', error?.message || error);
    return sendJson(res, 500, { ok: false, error: 'Health/router request failed' });
  }
}
