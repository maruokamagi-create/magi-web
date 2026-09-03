import { callbackUrl, clearOauthCookies, createSession, lineConfigured, oauthCookieNames, parseCookies, redirect, sendJson, sessionCookie } from './_line.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  if (!lineConfigured()) return sendJson(res, 503, { ok: false, configured: false, error: 'LINE Login is not configured yet' });

  const code = String(req.query?.code || '');
  const state = String(req.query?.state || '');
  const error = String(req.query?.error || '');
  const cookies = parseCookies(req);
  const names = oauthCookieNames();
  const expectedState = cookies[names.state] || '';
  const nonce = cookies[names.nonce] || '';

  if (error) {
    clearOauthCookies(res);
    return redirect(res, '/?line_login=cancelled');
  }
  if (!code || !state || !expectedState || state !== expectedState || !nonce) {
    clearOauthCookies(res);
    return redirect(res, '/?line_login=invalid_state');
  }

  try {
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(),
        client_id: process.env.LINE_CHANNEL_ID,
        client_secret: process.env.LINE_CHANNEL_SECRET
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens?.id_token) throw new Error('Token exchange failed');

    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: tokens.id_token,
        client_id: process.env.LINE_CHANNEL_ID,
        nonce
      })
    });
    const profile = await verifyResponse.json();
    if (!verifyResponse.ok || !profile?.sub) throw new Error('ID token verification failed');

    const session = createSession(profile);
    clearOauthCookies(res, [sessionCookie(session)]);
    return redirect(res, '/?line_login=success');
  } catch (err) {
    console.error('[LINE Login callback]', err?.message || err);
    clearOauthCookies(res);
    return redirect(res, '/?line_login=failed');
  }
}
