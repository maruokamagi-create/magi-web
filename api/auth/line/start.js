import { callbackUrl, lineChannelId, lineConfigured, randomToken, redirect, sendJson, setOauthCookies } from './_line.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  if (!lineConfigured()) return sendJson(res, 503, { ok: false, configured: false, error: 'LINE Login is not configured yet' });

  const state = randomToken();
  const nonce = randomToken();
  setOauthCookies(res, state, nonce);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: lineChannelId(),
    redirect_uri: callbackUrl(),
    state,
    scope: 'openid profile',
    nonce
  });

  return redirect(res, `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
}
