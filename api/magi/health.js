import { checkGeminiConfiguration, rateLimit, requirePost, requireSameOrigin, sendJson } from './_gemini.js';

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
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
    console.error('[MAGI health]', error?.message || error);
    return sendJson(res, 500, { ok: false, error: 'Health check failed' });
  }
}
