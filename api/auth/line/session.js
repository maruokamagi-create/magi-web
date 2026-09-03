import { lineConfigured, readSession, sendJson } from './_line.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  if (!lineConfigured()) return sendJson(res, 200, { ok: true, configured: false, authenticated: false });

  const session = readSession(req);
  return sendJson(res, 200, {
    ok: true,
    configured: true,
    authenticated: Boolean(session),
    user: session ? { sub: session.sub, name: session.name || '', picture: session.picture || '' } : null
  });
}
