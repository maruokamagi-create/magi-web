import crypto from 'node:crypto';

// LINE Login production config active.
const PUBLIC_URL = (process.env.MAGI_PUBLIC_URL || 'https://magi-web.vercel.app').replace(/\/$/, '');
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '2011407457';
const STATE_COOKIE = '__Host-magi_line_state';
const NONCE_COOKIE = '__Host-magi_line_nonce';
const SESSION_COOKIE = '__Host-magi_line_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function lineChannelId() {
  return LINE_CHANNEL_ID;
}

export function lineConfigured() {
  return Boolean(LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

export function callbackUrl() {
  return `${PUBLIC_URL}/api/auth/line/callback`;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function parseCookies(req) {
  const out = {};
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function setOauthCookies(res, state, nonce) {
  res.setHeader('Set-Cookie', [
    cookie(STATE_COOKIE, state, 600),
    cookie(NONCE_COOKIE, nonce, 600)
  ]);
}

export function clearOauthCookies(res, extra = []) {
  res.setHeader('Set-Cookie', [
    cookie(STATE_COOKIE, '', 0),
    cookie(NONCE_COOKIE, '', 0),
    ...extra
  ]);
}

function sessionSigningKey() {
  if (process.env.MAGI_SESSION_SECRET) return process.env.MAGI_SESSION_SECRET;
  return crypto
    .createHash('sha256')
    .update(`magi-session-v1:${process.env.LINE_CHANNEL_SECRET || ''}`)
    .digest();
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSigningKey()).update(value).digest('base64url');
}

export function createSession(profile) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(profile.sub),
    name: String(profile.name || ''),
    picture: String(profile.picture || ''),
    iat: now,
    exp: now + SESSION_MAX_AGE
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function sessionCookie(token) {
  return cookie(SESSION_COOKIE, token, SESSION_MAX_AGE);
}

export function clearSessionCookie() {
  return cookie(SESSION_COOKIE, '', 0);
}

export function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function oauthCookieNames() {
  return { state: STATE_COOKIE, nonce: NONCE_COOKIE };
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
