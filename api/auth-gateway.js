const routes = {
  'admin-line-members': () => import('../server/api/admin/line-members.js'),
  'line-callback': () => import('../server/api/auth/line/callback.js'),
  'line-logout': () => import('../server/api/auth/line/logout.js'),
  'line-profile': () => import('../server/api/auth/line/profile.js'),
  'line-session': () => import('../server/api/auth/line/session.js'),
  'line-start': () => import('../server/api/auth/line/start.js')
};

export default async function handler(req, res) {
  const key = String(req.query?.__magi_route || '');
  const load = routes[key];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Unknown auth route' }));
  }
  try {
    const mod = await load();
    const fn = mod.default || mod.handler;
    if (typeof fn !== 'function') throw new Error(`Handler not found: ${key}`);
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI auth gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Auth gateway failed' }));
  }
}
