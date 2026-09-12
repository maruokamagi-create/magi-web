import { googleDriveFetch, listMagiDriveTree } from './_service.js';
import { filterDriveFilesForRole } from './_permissions.js';

export const MAGI_STAFF_ROOT_ID = '1H2AXlCa8DCLMl7rtE3OWI4qcM8sRswsi';
export const MAGI_STAFF_ROOT_LABEL = '50_STAFF_顧問・指導者';
export const MAGI_KNOWLEDGE_SCOPE_VERSION = 'knowledge-scope-v1-team-plus-staff';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const CACHE_MS = 300_000;
let cachedStaffTree = null;
let cachedStaffTreeAt = 0;

function filesListUrl(folderId, pageToken = '') {
  const q = `'${folderId}' in parents and trashed=false`;
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents)');
  return `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1000&fields=${fields}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
}

async function listChildren(folderId) {
  let pageToken = '';
  const out = [];
  do {
    const response = await googleDriveFetch(filesListUrl(folderId, pageToken));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('drive_staff_list_failed');
      error.status = response.status;
      error.details = data;
      throw error;
    }
    out.push(...(Array.isArray(data.files) ? data.files : []));
    pageToken = String(data.nextPageToken || '');
  } while (pageToken && out.length < 2000);
  return out;
}

async function listStaffTree({ fresh = false, maxItems = 800, maxDepth = 10 } = {}) {
  const age = Date.now() - cachedStaffTreeAt;
  if (cachedStaffTree && !fresh && age < CACHE_MS) return cachedStaffTree;

  const out = [];
  const queue = [{ id: MAGI_STAFF_ROOT_ID, path: MAGI_STAFF_ROOT_LABEL, depth: 0 }];
  const seen = new Set();

  while (queue.length && out.length < maxItems) {
    const current = queue.shift();
    if (!current || seen.has(current.id) || current.depth > maxDepth) continue;
    seen.add(current.id);
    const children = await listChildren(current.id);
    for (const source of children) {
      const item = { ...source, path: `${current.path}/${source.name}` };
      out.push(item);
      if (source.mimeType === FOLDER_MIME) {
        queue.push({ id: source.id, path: item.path, depth: current.depth + 1 });
      }
      if (out.length >= maxItems) break;
    }
  }

  cachedStaffTree = out;
  cachedStaffTreeAt = Date.now();
  return out;
}

export async function listMagiKnowledgeTree({ role = 'member', fresh = false, maxItems = 2500, maxDepth = 14 } = {}) {
  const team = await listMagiDriveTree({ fresh, maxItems, maxDepth });
  let combined = Array.isArray(team) ? team.slice() : [];

  if (role === 'admin' || role === 'coach') {
    try {
      const staff = await listStaffTree({ fresh, maxItems: 800, maxDepth: 10 });
      combined.push(...staff);
    } catch (error) {
      console.warn('[MAGI staff knowledge scope]', error?.message || error);
    }
  }

  const seen = new Set();
  combined = combined.filter(file => {
    const id = String(file?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  combined = filterDriveFilesForRole(role, combined);
  combined.sort((a, b) => String(a.path || '').localeCompare(String(b.path || ''), 'ja'));
  return combined;
}
