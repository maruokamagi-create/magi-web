import { requireApprovedMember } from './_access.js';
import { cacheableDriveFile, driveCacheConfigured, getCachedDriveFile, putCachedDriveFile } from './_cache.js';
import { driveServiceConfigured, fetchDriveFileContent } from './_service.js';
import { listMagiKnowledgeTree, MAGI_KNOWLEDGE_SCOPE_VERSION } from './_knowledge-scope.js';

export const config = { maxDuration: 60 };
const BATCH_LIMIT = 3;
const FILE_TIMEOUT_MS = 8000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isAuthoritativeWarmTarget(file) {
  const path = normalizePath(file?.path);
  if (!path) return false;

  // 常時使う数値正本だけを事前準備する。詳細CSVや制作物は質問時に取得する。
  const statsMaster = /(?:2026-2027_CURRENT_現チーム|2025-2026_ARCHIVE_旧チーム)\/03_STATS_成績データ\/00_MASTER_正本\//.test(path);

  // 顧問・管理者専用資料は少数かつ判断材料として重要なので、権限保持者だけ事前準備する。
  const staffKnowledge = path === '50_STAFF_顧問・指導者' || path.startsWith('50_STAFF_顧問・指導者/');

  return statsMaster || staffKnowledge;
}

async function warmOne(file) {
  const base = { id: String(file.id || ''), name: String(file.name || ''), path: String(file.path || '') };
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

    const knowledge = await listMagiKnowledgeTree({ role: member.role });
    const targets = knowledge.filter(file => cacheableDriveFile(file) && isAuthoritativeWarmTarget(file));
    const batch = targets.slice(cursor, cursor + limit);
    const results = await Promise.all(batch.map(warmOne));
    const nextCursor = cursor + batch.length;
    const complete = nextCursor >= targets.length;

    return json(res, 200, {
      ok: true,
      scopeVersion: MAGI_KNOWLEDGE_SCOPE_VERSION,
      strategy: 'AUTHORITATIVE_ONLY',
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
