import { readSession, sendJson } from '../auth/line/_line.js';
import { getMemberById, getMemberBySub, listMembers, memberStoreConfigured, presentMember, updateMember } from '../auth/line/_members.js';

async function requireAdmin(req, res) {
  if (!memberStoreConfigured()) {
    sendJson(res, 503, { ok: false, error: 'Member store is not configured' });
    return null;
  }
  const session = readSession(req);
  if (!session?.sub) {
    sendJson(res, 401, { ok: false, error: 'Authentication required' });
    return null;
  }
  const member = await getMemberBySub(session.sub);
  if (!member || member.status !== 'active' || member.role !== 'admin') {
    sendJson(res, 403, { ok: false, error: 'Admin access required' });
    return null;
  }
  return member;
}

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
      const members = await listMembers();
      return sendJson(res, 200, {
        ok: true,
        selfId: admin.id,
        members: members.map((member) => ({ ...member, isSelf: member.id === admin.id }))
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = String(body.id || '');
      if (!id) return sendJson(res, 400, { ok: false, error: 'Member id is required' });

      const target = await getMemberById(id);
      if (!target) return sendJson(res, 404, { ok: false, error: 'Member not found' });
      const shownTarget = presentMember(target);

      const nextStatus = body.status ? String(body.status) : target.status;
      const nextRole = body.role ? String(body.role) : target.role;
      if (target.id === admin.id && (nextStatus !== 'active' || nextRole !== 'admin')) {
        return sendJson(res, 400, { ok: false, error: 'You cannot remove your own administrator access' });
      }
      if (target.status === 'pending' && nextStatus === 'active' && !shownTarget?.profile_complete) {
        return sendJson(res, 400, { ok: false, error: '氏名の申請が完了していません' });
      }

      const updated = await updateMember(id, { status: nextStatus, role: nextRole });
      return sendJson(res, 200, { ok: true, member: updated });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[LINE member admin]', error?.message || error, error?.details || '');
    return sendJson(res, 500, { ok: false, error: 'Member administration failed' });
  }
}
