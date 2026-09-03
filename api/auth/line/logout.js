import { clearSessionCookie, sendJson } from './_line.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  res.setHeader('Set-Cookie', clearSessionCookie());

  if (req.method === 'GET') {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  return sendJson(res, 200, { ok: true });
}
