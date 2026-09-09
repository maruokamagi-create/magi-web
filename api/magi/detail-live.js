import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { buildVerifiedDetailAnswer } from './_detail-live-answer.js';

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const member = await requireApprovedMember(req, res);
    if (!member) return;
    const body = await readBody(req);
    const question = String(body?.question || '').trim().slice(0, 4000);
    if (!question) return sendJson(res, 400, { ok:false, error:'question is required' });
    const result = await buildVerifiedDetailAnswer({ question });
    return sendJson(res, 200, result);
  } catch (error) {
    console.error('[MAGI verified detail answer]', error?.message || error);
    return sendJson(res, 502, { ok:false, error:error?.message || 'Verified detail answer failed' });
  }
}
