import zlib from 'node:zlib';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://stqekbjijufefrykksji.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'magi_drive_file_cache';
const MAX_CACHE_BYTES = 12 * 1024 * 1024;

export function driveCacheConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

function headers(extra = {}) {
  const base = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  if (!SERVICE_KEY.startsWith('sb_secret_')) base.Authorization = `Bearer ${SERVICE_KEY}`;
  return { ...base, ...extra };
}

async function rest(query = '', options = {}) {
  if (!driveCacheConfigured()) throw new Error('drive_cache_not_configured');
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}${query ? `?${query}` : ''}`;
  const response = await fetch(url, { ...options, headers: headers(options.headers || {}) });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    const error = new Error(`drive_cache_${response.status}`);
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

export function cacheableDriveFile(file) {
  if (!file || file.mimeType === 'application/vnd.google-apps.folder') return false;
  const name = String(file.name || '');
  const mime = String(file.mimeType || '');
  return [
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.document',
    'text/csv',
    'application/json',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12'
  ].includes(mime) || /\.(csv|json|txt|xls|xlsx|xlsm)$/i.test(name);
}

function decodeCachedRow(row) {
  if (!row) return null;
  try {
    const packed = Buffer.from(String(row.payload_base64 || ''), 'base64');
    const buffer = row.encoding === 'gzip-base64' ? zlib.gunzipSync(packed) : packed;
    return {
      buffer,
      contentType: String(row.content_type || 'application/octet-stream'),
      cachedAt: row.cached_at || null,
      sizeBytes: Number(row.size_bytes || buffer.length),
      fileId: String(row.file_id || ''),
      name: String(row.name || ''),
      mimeType: String(row.mime_type || ''),
      path: String(row.path || ''),
      modifiedTime: String(row.modified_time || '')
    };
  } catch (_) {
    return null;
  }
}

export async function getCachedDriveFileById(id) {
  if (!driveCacheConfigured() || !id) return null;
  const params = new URLSearchParams();
  params.set('file_id', `eq.${String(id)}`);
  params.set('select', 'file_id,modified_time,name,mime_type,path,content_type,encoding,payload_base64,size_bytes,cached_at');
  params.set('limit', '1');
  const rows = await rest(params.toString());
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return decodeCachedRow(row);
}

export async function getCachedDriveFile(file) {
  if (!driveCacheConfigured() || !file?.id) return null;
  const cached = await getCachedDriveFileById(file.id);
  if (!cached || cached.modifiedTime !== String(file.modifiedTime || '')) return null;
  return cached;
}

export async function putCachedDriveFile(file, buffer, contentType = 'application/octet-stream') {
  if (!driveCacheConfigured() || !file?.id || !Buffer.isBuffer(buffer)) return { ok: false, reason: 'unavailable' };
  if (buffer.length > MAX_CACHE_BYTES) return { ok: false, reason: 'too_large', sizeBytes: buffer.length };
  const packed = zlib.gzipSync(buffer, { level: 6 });
  const payload = {
    file_id: String(file.id),
    modified_time: String(file.modifiedTime || ''),
    name: String(file.name || '').slice(0, 500),
    mime_type: String(file.mimeType || '').slice(0, 200),
    path: String(file.path || '').slice(0, 2000),
    content_type: String(contentType || 'application/octet-stream').slice(0, 200),
    encoding: 'gzip-base64',
    payload_base64: packed.toString('base64'),
    size_bytes: buffer.length,
    cached_at: new Date().toISOString()
  };
  const params = new URLSearchParams();
  params.set('on_conflict', 'file_id');
  await rest(params.toString(), {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
  return { ok: true, sizeBytes: buffer.length };
}

export async function countFreshCachedFiles(files = []) {
  if (!driveCacheConfigured()) return 0;
  let count = 0;
  for (const file of files) {
    try { if (await getCachedDriveFile(file)) count++; } catch (_) {}
  }
  return count;
}
