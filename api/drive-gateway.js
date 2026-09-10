const routes = {
  'drive-index': () => import('../server/api/drive/index.js'),
  'drive-file': () => import('../server/api/drive/file.js'),
  'drive-warm': () => import('../server/api/drive/warm.js')
};

export default async function handler(req, res) {
  const key = String(req.query?.__magi_route || '');
  const load = routes[key];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Unknown drive route' }));
  }
  try {
    const mod = await load();
    const fn = mod.default || mod.handler;
    if (typeof fn !== 'function') throw new Error(`Handler not found: ${key}`);
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI drive gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Drive gateway failed' }));
  }
}
