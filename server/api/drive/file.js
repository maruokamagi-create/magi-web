import { requireApprovedMember } from './_access.js';
import { canAccessDrivePath } from './_permissions.js';
import { getCachedDriveFile, getCachedDriveFileById, putCachedDriveFile } from './_cache.js';
import { driveServiceConfigured, fetchDriveFileContent } from './_service.js';
import { listMagiKnowledgeTree } from './_knowledge-scope.js';

const SAFE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const UPSTREAM_TIMEOUT_MS = 15000;

function sendBuffer(res, buffer, contentType, cacheSource) {
  res.statusCode = 200;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', contentType || 'application/octet-stream');
  res.setHeader('Content-Length', String(buffer.length));
  res.setHeader('X-MAGI-Drive-Cache', cacheSource);
  res.end(buffer);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end('Method not allowed');
  }
  try {
    const member = await requireApprovedMember(req, res);
    if (!member) return;
    if (!driveServiceConfigured()) {
      res.statusCode = 503;
      return res.end('Drive service is not configured');
    }

    const id = String(req.query?.id || '');
    if (!SAFE_ID.test(id)) {
      res.statusCode = 400;
      return res.end('Invalid file id');
    }

    const directCached = await getCachedDriveFileById(id).catch(() => null);
    if (directCached?.buffer) {
      if (!canAccessDrivePath(member.role, directCached.path)) {
        res.statusCode = 403;
        return res.end('Drive file access denied');
      }
      return sendBuffer(res, directCached.buffer, directCached.contentType, 'HIT-PERSISTENT');
    }

    const tree = await listMagiKnowledgeTree({ role: member.role });
    const indexed = tree.find((file) => file?.id === id);
    if (!indexed || !canAccessDrivePath(member.role, indexed.path)) {
      res.statusCode = 403;
      return res.end('Drive file access denied');
    }

    const cached = await getCachedDriveFile(indexed).catch(() => null);
    if (cached?.buffer) return sendBuffer(res, cached.buffer, cached.contentType, 'HIT');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let fetched;
    try {
      fetched = await fetchDriveFileContent(indexed, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    putCachedDriveFile(indexed, fetched.buffer, fetched.contentType).catch(error => {
      console.warn('[MAGI server Drive cache]', indexed.name, error?.message || error);
    });
    return sendBuffer(res, fetched.buffer, fetched.contentType, 'MISS');
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('[MAGI server Drive file]', timedOut ? 'timeout' : (error?.message || error), error?.details || '');
    if (!res.headersSent) res.statusCode = timedOut ? 504 : 502;
    res.end(timedOut ? 'Drive file fetch timed out' : 'Google Drive file unavailable');
  }
}
