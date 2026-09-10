import { lineConfigured, readSession, sendJson } from './_line.js';
import { ensureLineMember, memberStoreConfigured } from './_members.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  if (!lineConfigured()) return sendJson(res, 200, { ok: true, configured: false, authenticated: false });

  const session = readSession(req);
  if (!session) {
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      authenticated: false,
      memberStoreConfigured: memberStoreConfigured(),
      user: null,
      member: null
    });
  }

  const user = {
    name: session.name || '',
    picture: session.picture || ''
  };

  if (!memberStoreConfigured()) {
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      authenticated: true,
      memberStoreConfigured: false,
      user,
      member: null
    });
  }

  try {
    const member = await ensureLineMember(session);
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      authenticated: true,
      memberStoreConfigured: true,
      user,
      member: member ? {
        id: member.id,
        displayName: member.formal_name || member.line_display_name || user.name,
        formalName: member.formal_name || '',
        lineDisplayName: member.line_display_name || user.name,
        pictureUrl: member.picture_url || user.picture,
        needsProfile: member.status === 'pending' && !member.profile_complete,
        status: member.status,
        role: member.role,
        createdAt: member.created_at,
        lastLoginAt: member.last_login_at
      } : null
    });
  } catch (error) {
    console.error('[LINE member session]', error?.message || error, error?.details || '');
    return sendJson(res, 503, {
      ok: false,
      configured: true,
      authenticated: true,
      memberStoreConfigured: true,
      error: 'Member registry is unavailable'
    });
  }
}
