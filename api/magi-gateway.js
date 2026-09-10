const routes = {
  'magi-core': () => import('../server/api/magi/core.js'),
  'magi-fielding-report': () => import('../server/api/magi/fielding-report.js'),
  'magi-health': () => import('../server/api/magi/health.js'),
  'magi-orchestrate': () => import('../server/api/magi/orchestrate.js'),
  'magi-persona': () => import('../server/api/magi/persona.js')
};

export default async function handler(req, res) {
  const key = String(req.query?.__magi_route || '');
  const load = routes[key];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Unknown MAGI route' }));
  }
  try {
    const mod = await load();
    const fn = mod.default || mod.handler;
    if (typeof fn !== 'function') throw new Error(`Handler not found: ${key}`);
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'MAGI gateway failed' }));
  }
}
