import driveIndex from '../server/api/drive/index.js';
import driveFile from '../server/api/drive/file.js';
import driveWarm from '../server/api/drive/warm.js';

const routes = {
  'drive-index': driveIndex,
  'drive-file': driveFile,
  'drive-warm': driveWarm
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
    return res.end(JSON.stringify({ ok: false, error: 'Unknown drive route' }));
  }
  try {
    return await fn(req, res);
  } catch (error) {
    console.error('[MAGI drive gateway]', key, error?.message || error);
    if (res.headersSent) return;
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Drive gateway failed' }));
  }
}
