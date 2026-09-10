import magiCore from '../server/api/magi/core.js';
import fieldingReport from '../server/api/magi/fielding-report.js';
import magiHealth from '../server/api/magi/health.js';
import magiOrchestrate from '../server/api/magi/orchestrate.js';
import magiPersona from '../server/api/magi/persona.js';

const routes = {
  'magi-core': magiCore,
  'magi-fielding-report': fieldingReport,
  'magi-health': magiHealth,
  'magi-orchestrate': magiOrchestrate,
  'magi-persona': magiPersona
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
    return res.end(JSON.stringify({ ok: false, error: 'Unknown MAGI route' }));
  }
  try {
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'MAGI gateway failed' }));
  }
}
