import { readSession, sendJson } from '../auth/line/_line.js';
import { getMemberBySub, memberStoreConfigured, presentMember } from '../auth/line/_members.js';

export async function requireApprovedMember(req, res) {
  if (!memberStoreConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Member store is not configured' });
    return null;
  }
  const session = readSession(req);
  if (!session?.sub) {
    sendJson(res, 401, { ok: false, error: 'Authentication required' });
    return null;
  }
  const raw = await getMemberBySub(session.sub);
  const member = presentMember(raw);
  if (!member || member.status !== 'active') {
    sendJson(res, 403, { ok: false, error: 'Approval required' });
    return null;
  }
  return member;
}
