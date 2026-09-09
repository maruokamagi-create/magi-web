import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { runDetailCsvConsistencyAudit } from './_detail-csv-audit.js';

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  const member = await requireApprovedMember(req, res);
  if (!member) return;
  try {
    const body = await readBody(req);
    const result = await runDetailCsvConsistencyAudit({ season: body?.season || 'current' });
    return sendJson(res, 200, { ok:true, ...result });
  } catch (error) {
    console.error('[MAGI detail CSV consistency]', error?.message || error);
    return sendJson(res, 502, { ok:false, error:error?.message || 'Detail CSV consistency audit failed' });
  }
}
