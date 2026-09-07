import { checkGeminiConfiguration, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { routeQuestion } from './_question-router-v2.js';

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);

    // Standalone semantic-router lab path. This is not wired into MAGI-WEB's main execution button yet.
    if (String(body?.mode || '').toUpperCase() === 'ROUTE_QUESTION') {
      const question = String(body?.question || '').trim();
      if (!question) return sendJson(res, 400, { ok: false, error: 'question is required' });
      const routed = await routeQuestion(question, body?.context || []);
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
