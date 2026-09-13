import crypto from 'node:crypto';
import { cacheableDriveFile, getCachedDriveFile, putCachedDriveFile } from './_cache.js';
import {
  assertAllowedDriveDataFile,
  isDriveFolder,
  isDriveTraversalItem,
  withDriveAllowedTypes
} from './_file-policy.js';

// Initial/common MAGI-WEB Drive scope: 20_TEAM_DATA_チームデータ
export const MAGI_DRIVE_ROOT_ID = process.env.MAGI_TEAM_DATA_ROOT_ID || '1lIRTMRRMOE0lnIPAFmw9NrCDHSKf_8Hn';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ROOT_LABEL = '20_TEAM_DATA_チームデータ';
let cachedToken = null;
let cachedUntil = 0;
let cachedTree = null;
let cachedTreeAt = 0;
const TREE_CACHE_MS = 300_000;
const FRESH_TREE_MIN_INTERVAL_MS = 30_000;
const TREE_SCAN_CONCURRENCY = 6;
const FILE_CACHE_MS = 300_000;
const FLAT_SCAN_LIMIT = 10_000;
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
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
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

function filesListUrl({ q = '', pageToken = '' } = {}) {
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents)');
  return `https://www.googleapis.com/drive/v3/files?${q ? `q=${encodeURIComponent(q)}&` : ''}pageSize=1000&fields=${fields}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
}

async function listChildren(folderId) {
  let pageToken = '';
  const all = [];
  do {
    const q = withDriveAllowedTypes(`'${folderId}' in parents and trashed=false`);
    const response = await googleDriveFetch(filesListUrl({ q, pageToken }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('drive_list_failed');
      error.status = response.status;
      error.details = data;
      throw error;
    }
    all.push(...(Array.isArray(data.files) ? data.files.filter(isDriveTraversalItem) : []));
    pageToken = String(data.nextPageToken || '');
  } while (pageToken && all.length < 5000);
  return all;
}

async function listAllVisibleFiles(limit = FLAT_SCAN_LIMIT) {
  let pageToken = '';
  const all = [];
  do {
    const response = await googleDriveFetch(filesListUrl({ q: withDriveAllowedTypes('trashed=false'), pageToken }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('drive_flat_list_failed');
      error.status = response.status;
      error.details = data;
      throw error;
    }
    all.push(...(Array.isArray(data.files) ? data.files.filter(isDriveTraversalItem) : []));
    pageToken = String(data.nextPageToken || '');
  } while (pageToken && all.length < limit);
  return all.slice(0, limit);
}

function buildRootedTreeFromFlat(files, { maxItems, maxDepth }) {
  const candidates = (files || []).filter(x => x?.id && isDriveTraversalItem(x));
  const byId = new Map(candidates.map(x => [String(x.id), x]));
  const memo = new Map();
  const resolving = new Set();

  function resolve(id) {
    if (memo.has(id)) return memo.get(id);
    if (resolving.has(id)) return null;
    const file = byId.get(id);
    if (!file) return null;
    resolving.add(id);
    const parents = Array.isArray(file.parents) ? file.parents.map(String) : [];
    let resolved = null;
    for (const parentId of parents) {
      if (parentId === MAGI_DRIVE_ROOT_ID) {
        resolved = { path: `${ROOT_LABEL}/${file.name}`, depth: 1 };
        break;
      }
      const parent = resolve(parentId);
      if (parent) {
        resolved = { path: `${parent.path}/${file.name}`, depth: parent.depth + 1 };
        break;
      }
    }
    resolving.delete(id);
    memo.set(id, resolved);
    return resolved;
  }

  const out = [];
  for (const file of candidates) {
    if (String(file.id) === MAGI_DRIVE_ROOT_ID) continue;
    const rooted = resolve(String(file.id));
    if (!rooted || rooted.depth > maxDepth + 1) continue;
    out.push({ ...file, path: rooted.path });
    if (out.length >= maxItems) break;
  }
  out.sort((a, b) => String(a.path || '').localeCompare(String(b.path || ''), 'ja'));
  return out;
}

async function listTreeRecursive({ maxItems, maxDepth }) {
  const out = [];
  const queue = [{ id: MAGI_DRIVE_ROOT_ID, path: ROOT_LABEL, depth: 0 }];
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
        if (!isDriveTraversalItem(source)) continue;
        const item = { ...source, path: `${current.path}/${source.name}` };
        out.push(item);
        if (isDriveFolder(source)) {
          queue.push({ id: source.id, path: item.path, depth: current.depth + 1 });
        }
        if (out.length >= maxItems) break;
      }
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

export async function listMagiDriveTree({ maxItems = 2000, maxDepth = 12, fresh = false } = {}) {
  if (!driveServiceConfigured()) throw new Error('drive_service_not_configured');
  const age = Date.now() - cachedTreeAt;
  if (cachedTree) {
    if (!fresh && age < TREE_CACHE_MS) return cachedTree.filter(isDriveTraversalItem);
    if (fresh && age < FRESH_TREE_MIN_INTERVAL_MS) return cachedTree.filter(isDriveTraversalItem);
  }

  let out = [];
  try {
    const flat = await listAllVisibleFiles(Math.max(FLAT_SCAN_LIMIT, maxItems * 2));
    out = buildRootedTreeFromFlat(flat, { maxItems, maxDepth });
  } catch (error) {
    console.warn('[MAGI Drive flat tree fallback]', error?.message || error);
  }

  if (!out.length) {
    out = await listTreeRecursive({ maxItems, maxDepth });
  }

  cachedTree = out.filter(isDriveTraversalItem);
  cachedTreeAt = Date.now();
  return cachedTree;
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

function rememberFile(cacheKey, buffer, contentType) {
  fileContentCache.set(cacheKey, { at: Date.now(), buffer, contentType });
  if (fileContentCache.size > 24) {
    const oldest = [...fileContentCache.entries()].sort((a,b) => a[1].at - b[1].at).slice(0, fileContentCache.size - 24);
    for (const [key] of oldest) fileContentCache.delete(key);
  }
}

export async function fetchDriveFileContent(fileOrId, { signal } = {}) {
  const source = typeof fileOrId === 'string' ? { id: fileOrId } : (fileOrId || {});
  const meta = source.mimeType && source.name ? source : await getDriveFileMetadata(source.id);
  const id = String(meta.id || source.id || '');
  if (!id) throw new Error('missing_drive_file_id');
  assertAllowedDriveDataFile(meta);

  const version = String(meta.modifiedTime || source.modifiedTime || '');
  const mimeType = String(meta.mimeType || source.mimeType || '');
  const cacheKey = `${id}|${version}|${mimeType}`;
  const memoryCached = fileContentCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.at < FILE_CACHE_MS) {
    return { buffer: memoryCached.buffer, contentType: memoryCached.contentType, meta };
  }

  if (cacheableDriveFile(meta)) {
    try {
      const persistent = await getCachedDriveFile(meta);
      if (persistent?.buffer) {
        const contentType = persistent.contentType || 'application/octet-stream';
        rememberFile(cacheKey, persistent.buffer, contentType);
        return { buffer: persistent.buffer, contentType, meta };
      }
    } catch (_) {}
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`;
  const contentType = /\.csv$/i.test(String(meta.name || '')) ? 'text/csv; charset=utf-8' : 'application/vnd.ms-excel.sheet.macroenabled.12';
  const response = await googleDriveFetch(url, signal ? { signal } : {});
  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    const error = new Error('drive_file_fetch_failed');
    error.status = response.status;
    error.details = responseText.slice(0, 300);
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const resolvedContentType = response.headers.get('content-type') || contentType;
  rememberFile(cacheKey, buffer, resolvedContentType);

  if (cacheableDriveFile(meta)) {
    putCachedDriveFile(meta, buffer, resolvedContentType).catch(() => {});
  }

  return { buffer, contentType: resolvedContentType, meta };
}
