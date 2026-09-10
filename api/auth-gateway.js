import adminLineMembers from '../server/api/admin/line-members.js';
import lineCallback from '../server/api/auth/line/callback.js';
import lineLogout from '../server/api/auth/line/logout.js';
import lineProfile from '../server/api/auth/line/profile.js';
import lineSession from '../server/api/auth/line/session.js';
import lineStart from '../server/api/auth/line/start.js';

const routes = {
  'admin-line-members': adminLineMembers,
  'line-callback': lineCallback,
  'line-logout': lineLogout,
  'line-profile': lineProfile,
  'line-session': lineSession,
  'line-start': lineStart
};

function routeKey(req) {
  const value = req.query?.__magi_route;
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

export default async function handler(req, res) {
  const key = routeKey(req);
  const fn = routes[key];
  if (typeof fn !== 'function') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Unknown auth route' }));
  }
  try {
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI auth gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Auth gateway failed' }));
  }
}
