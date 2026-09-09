import { readBody, requirePost, requireSameOrigin, rateLimit, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { buildFastLiveRoute } from './_fast-live-route.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  const member = await requireApprovedMember(req, res);
  if (!member) return;

  try {
    const body = await readBody(req);
    const question = String(body?.question || '').trim();
    if (!question) return sendJson(res, 400, { ok:false, handled:false, error:'question is required' });

    const routed = buildFastLiveRoute(question, []);
    if (!routed) return sendJson(res, 200, { ok:true, handled:false });

    const started = Date.now();
    const result = routed.route === 'PITCHING_LOOKUP'
      ? await buildStrictPitchingAnswer({ question, routed })
      : await buildLiveAnswer({ question, routed });

    return sendJson(res, 200, {
      ...result,
      handled:true,
      fastPath:true,
      fastRouterVersion:routed.routerVersion,
      serverMs:Date.now() - started
    });
  } catch (error) {
    console.error('[MAGI fast live]', error?.message || error);
    return sendJson(res, 502, { ok:false, handled:false, error:error?.message || 'Fast live failed' });
  }
}
