import { requireApprovedMember } from './_access.js';
import { filterDriveFilesForRole } from './_permissions.js';
import { cacheableDriveFile, driveCacheConfigured, getCachedDriveFile, putCachedDriveFile } from './_cache.js';
import { driveServiceConfigured, fetchDriveFileContent, listMagiDriveTree } from './_service.js';

const BATCH_LIMIT = 5;
const FILE_TIMEOUT_MS = 15000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function warmOne(file) {
  const base = { id: String(file.id || ''), name: String(file.name || '') };
  const cached = await getCachedDriveFile(file).catch(() => null);
  if (cached) return { ...base, ok: true, status: 'hit' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
  try {
    const fetched = await fetchDriveFileContent(file, { signal: controller.signal });
    const stored = await putCachedDriveFile(file, fetched.buffer, fetched.contentType);
    if (!stored.ok) return { ...base, ok: false, status: stored.reason || 'cache_store_failed' };
    return { ...base, ok: true, status: 'stored' };
  } catch (error) {
    return {
      ...base,
      ok: false,
      status: error?.name === 'AbortError' ? 'timeout' : (error?.message || 'failed')
    };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const member = await requireApprovedMember(req, res);
  if (!member) return;
  if (!driveServiceConfigured()) return json(res, 503, { ok: false, error: 'Drive service is not configured' });
  if (!driveCacheConfigured()) return json(res, 503, { ok: false, error: 'Drive cache is not configured' });

  try {
    const cursor = Math.max(0, Number.parseInt(String(req.query?.cursor || '0'), 10) || 0);
    const requestedLimit = Math.max(1, Number.parseInt(String(req.query?.limit || BATCH_LIMIT), 10) || BATCH_LIMIT);
    const limit = Math.min(BATCH_LIMIT, requestedLimit);

    const allFiles = await listMagiDriveTree();
    const visible = filterDriveFilesForRole(member.role, allFiles);
    const targets = visible.filter(cacheableDriveFile);
    const batch = targets.slice(cursor, cursor + limit);
    const results = await Promise.all(batch.map(warmOne));
    const nextCursor = cursor + batch.length;
    const complete = nextCursor >= targets.length;

    return json(res, 200, {
      ok: true,
      total: targets.length,
      cursor,
      processed: batch.length,
      nextCursor: complete ? null : nextCursor,
      complete,
      hits: results.filter(x => x.ok && x.status === 'hit').length,
      stored: results.filter(x => x.ok && x.status === 'stored').length,
      failed: results.filter(x => !x.ok).length,
      results,
      failures: results.filter(x => !x.ok).map(x => ({ id: x.id, name: x.name, reason: x.status }))
    });
  } catch (error) {
    console.error('[MAGI Drive warm]', error?.message || error, error?.details || '');
    return json(res, 502, { ok: false, error: 'Drive cache warm failed' });
  }
}
