import { readSession, sendJson } from './_line.js';
import { memberStoreConfigured, submitOwnProfile } from './_members.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }
  if (!memberStoreConfigured()) return sendJson(res, 503, { ok: false, error: 'Member store is not configured' });

  const session = readSession(req);
  if (!session?.sub) return sendJson(res, 401, { ok: false, error: 'Authentication required' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const member = await submitOwnProfile(session.sub, {
      formalName: body.formalName,
      requestedRole: body.requestedRole,
      lineDisplayName: session.name || ''
    });
    return sendJson(res, 200, { ok: true, member });
  } catch (error) {
    const code = String(error?.message || '');
    if (code === 'invalid_formal_name') return sendJson(res, 400, { ok: false, error: '氏名を正しく入力してください' });
    if (code === 'invalid_requested_role') return sendJson(res, 400, { ok: false, error: '立場を選択してください' });
    if (code === 'profile_not_editable') return sendJson(res, 409, { ok: false, error: 'この申請情報は変更できません' });
    if (code === 'member_not_found') return sendJson(res, 404, { ok: false, error: '利用者情報が見つかりません' });
    console.error('[LINE profile]', error?.message || error, error?.details || '');
    return sendJson(res, 500, { ok: false, error: '申請情報を保存できませんでした' });
  }
}
