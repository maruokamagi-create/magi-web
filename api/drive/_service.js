import crypto from 'node:crypto';

export const MAGI_DRIVE_ROOT_ID = process.env.MAGI_DRIVE_ROOT_ID || '1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
let cachedToken = null;
let cachedUntil = 0;

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
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  return response;
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

export async function listMagiDriveTree({ maxItems = 2000, maxDepth = 12 } = {}) {
  if (!driveServiceConfigured()) throw new Error('drive_service_not_configured');
  const out = [];
  const queue = [{ id: MAGI_DRIVE_ROOT_ID, path: 'ROOT', depth: 0 }];
  const seen = new Set();
  while (queue.length && out.length < maxItems) {
    const current = queue.shift();
    if (!current || seen.has(current.id) || current.depth > maxDepth) continue;
    seen.add(current.id);
    const children = await listChildren(current.id);
    for (const source of children) {
      const item = { ...source, path: `${current.path}/${source.name}` };
      out.push(item);
      if (source.mimeType === 'application/vnd.google-apps.folder') {
        queue.push({ id: source.id, path: item.path, depth: current.depth + 1 });
      }
      if (out.length >= maxItems) break;
    }
  }
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
