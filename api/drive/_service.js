import crypto from 'node:crypto';

// Initial/common MAGI-WEB Drive scope: 20_TEAM_DATA_チームデータ
export const MAGI_DRIVE_ROOT_ID = process.env.MAGI_TEAM_DATA_ROOT_ID || '1lIRTMRRMOE0lnIPAFmw9NrCDHSKf_8Hn';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
let cachedToken = null;
let cachedUntil = 0;
let cachedTree = null;
let cachedTreeAt = 0;
const TREE_CACHE_MS = 300_000;
const FRESH_TREE_MIN_INTERVAL_MS = 30_000;
const TREE_SCAN_CONCURRENCY = 6;
const FILE_CACHE_MS = 60_000;
const fileContentCache = new Map();

function readConfig() {
  let json = null;
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  if (raw) {
    try { json = JSON.parse(raw); } catch (_) {}
  }
  const clientEmail = String(json?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(json?.private_key || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  return { clientEmail, privateKey };
}

export function driveServiceConfigured() {
  const { clientEmail, privateKey } = readConfig();
  return Boolean(clientEmail && privateKey && MAGI_DRIVE_ROOT_ID);
}

export function driveServiceAccountEmail() {
  return readConfig().clientEmail;
}

function base64url(input) {
  return Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64url');
}

async function accessToken() {
  if (cachedToken && Date.now() < cachedUntil - 60_000) return cachedToken;
  const { clientEmail, privateKey } = readConfig();
  if (!clientEmail || !privateKey) throw new Error('drive_service_not_configured');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'RS256', typ: 'JWT' });
  const claims = base64url({
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  });
  const unsigned = `${header}.${claims}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth-type:jwt-bearer',
    assertion
  });
  body.set('grant_type','urn:ietf:params:oauth:grant-type:jwt-bearer');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error('drive_service_token_failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  cachedToken = data.access_token;
  cachedUntil = Date.now() + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function googleDriveFetch(url, options = {}) {
  const token = await accessToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
}

async function listChildren(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents)');
  let pageToken = '';
  const all = [];
  do {
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1000&fields=${fields}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await googleDriveFetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('drive_list_failed');
      error.status = response.status;
      error.details = data;
      throw error;
    }
    all.push(...(Array.isArray(data.files) ? data.files : []));
    pageToken = String(data.nextPageToken || '');
  } while (pageToken && all.length < 5000);
  return all;
}

export async function listMagiDriveTree({ maxItems = 2000, maxDepth = 12, fresh = false } = {}) {
  if (!driveServiceConfigured()) throw new Error('drive_service_not_configured');
  const age = Date.now() - cachedTreeAt;
  if (cachedTree) {
    if (!fresh && age < TREE_CACHE_MS) return cachedTree;
    if (fresh && age < FRESH_TREE_MIN_INTERVAL_MS) return cachedTree;
  }

  const out = [];
  const queue = [{ id: MAGI_DRIVE_ROOT_ID, path: '20_TEAM_DATA_チームデータ', depth: 0 }];
  const seen = new Set();

  while (queue.length && out.length < maxItems) {
    const batch = [];
    while (queue.length && batch.length < TREE_SCAN_CONCURRENCY) {
      const current = queue.shift();
      if (!current || seen.has(current.id) || current.depth > maxDepth) continue;
      seen.add(current.id);
      batch.push(current);
    }
    if (!batch.length) continue;

    const results = await Promise.all(batch.map(async current => ({
      current,
      children: await listChildren(current.id)
    })));

    for (const { current, children } of results) {
      for (const source of children) {
        const item = { ...source, path: `${current.path}/${source.name}` };
        out.push(item);
        if (source.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: source.id, path: item.path, depth: current.depth + 1 });
        }
        if (out.length >= maxItems) break;
      }
      if (out.length >= maxItems) break;
    }
  }

  cachedTree = out;
  cachedTreeAt = Date.now();
  return out;
}

export async function getDriveFileMetadata(id) {
  const fields = encodeURIComponent('id,name,mimeType,modifiedTime,size,parents');
  const response = await googleDriveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('drive_metadata_failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export async function fetchDriveFileContent(fileOrId, { signal } = {}) {
  const source = typeof fileOrId === 'string' ? { id: fileOrId } : (fileOrId || {});
  const meta = source.mimeType ? source : await getDriveFileMetadata(source.id);
  const id = String(meta.id || source.id || '');
  if (!id) throw new Error('missing_drive_file_id');

  const version = String(meta.modifiedTime || source.modifiedTime || '');
  const cacheKey = `${id}|${version}|${String(meta.mimeType || source.mimeType || '')}`;
  const cached = fileContentCache.get(cacheKey);
  if (cached && Date.now() - cached.at < FILE_CACHE_MS) {
    return { buffer: cached.buffer, contentType: cached.contentType, meta };
  }

  let url = '';
  let contentType = 'application/octet-stream';
  if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(contentType)}`;
  } else if (meta.mimeType === 'application/vnd.google-apps.document') {
    contentType = 'text/plain; charset=utf-8';
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent('text/plain')}`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`;
  }

  const response = await googleDriveFetch(url, signal ? { signal } : {});
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error('drive_file_fetch_failed');
    error.status = response.status;
    error.details = text.slice(0, 300);
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const resolvedContentType = response.headers.get('content-type') || contentType;
  fileContentCache.set(cacheKey, { at: Date.now(), buffer, contentType: resolvedContentType });
  if (fileContentCache.size > 24) {
    const oldest = [...fileContentCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,fileContentCache.size-24);
    for (const [key] of oldest) fileContentCache.delete(key);
  }
  return { buffer, contentType: resolvedContentType, meta };
}
