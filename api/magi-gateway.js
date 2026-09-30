const routes = {
  'magi-core': () => import('../server/api/magi/core.js'),
  'magi-fielding-report': () => import('../server/api/magi/fielding-report.js'),
  'magi-health': () => import('../server/api/magi/health.js'),
  'magi-orchestrate': () => import('../server/api/magi/orchestrate.js'),
  'magi-persona': () => import('../server/api/magi/persona.js'),
  'magi-dialogue': () => import('../server/api/magi/dialogue-resilient.js')
};

function routeKey(req) {
  const value = req.query?.__magi_route;
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function numericHeader(req, name) {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function rejectStaleCoreClient(req, res, key) {
  if (key !== 'magi-core') return false;
  const clientVersion = numericHeader(req, 'x-magi-client-version');
  const runtimeVersion = numericHeader(req, 'x-magi-runtime-version');
  if (clientVersion >= MIN_CORE_CLIENT_VERSION && runtimeVersion >= MIN_RUNTIME_VERSION) return false;
  res.statusCode = 426;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: false,
    error: 'MAGIが更新されました。ページを再読み込みしてください。古い画面では審議結果を出しません。',
    code: 'MAGI_CLIENT_UPDATE_REQUIRED',
    clientVersion,
    runtimeVersion,
    requiredClientVersion: MIN_CORE_CLIENT_VERSION,
    requiredRuntimeVersion: MIN_RUNTIME_VERSION
  }));
  return true;
}

export default async function handler(req, res) {
  const key = routeKey(req);
  const load = routes[key];
  if (typeof load !== 'function') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Unknown MAGI route' }));
  }
  if (rejectStaleCoreClient(req, res, key)) return;
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
    return res.end(JSON.stringify({ ok: false, error: 'MAGI gateway failed', diagnostic: String(error?.stack || error?.message || error).split('\n').slice(0,8) }));
  }
}
