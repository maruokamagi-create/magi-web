import { sendJson } from '../auth/line/_line.js';
import { requireApprovedMember } from './_access.js';
import { driveServiceAccountEmail, driveServiceConfigured, listMagiDriveTree, MAGI_DRIVE_ROOT_ID } from './_service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }
  try {
    const member = await requireApprovedMember(req, res);
    if (!member) return;

    if (!driveServiceConfigured()) {
      return sendJson(res, 200, {
        ok: true,
        configured: false,
        rootId: MAGI_DRIVE_ROOT_ID,
        files: []
      });
    }

    const files = await listMagiDriveTree();
    return sendJson(res, 200, {
      ok: true,
      configured: true,
      rootId: MAGI_DRIVE_ROOT_ID,
      serviceAccount: driveServiceAccountEmail(),
      count: files.length,
      files
    });
  } catch (error) {
    console.error('[MAGI server Drive index]', error?.message || error, error?.details || '');
    return sendJson(res, 502, { ok: false, error: 'Google Driveを読み込めませんでした' });
  }
}
