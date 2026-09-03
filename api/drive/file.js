import { requireApprovedMember } from './_access.js';
import { canAccessDrivePath } from './_permissions.js';
import { driveServiceConfigured, getDriveFileMetadata, googleDriveFetch, listMagiDriveTree } from './_service.js';

const SAFE_ID = /^[A-Za-z0-9_-]{10,200}$/;

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

    const tree = await listMagiDriveTree();
    const indexed = tree.find((file) => file?.id === id);
    if (!indexed || !canAccessDrivePath(member.role, indexed.path)) {
      res.statusCode = 403;
      return res.end('Drive file access denied');
    }

    const meta = await getDriveFileMetadata(id);
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

    const response = await googleDriveFetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[MAGI server Drive file]', response.status, text.slice(0, 300));
      res.statusCode = 502;
      return res.end('Drive file fetch failed');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const upstreamType = response.headers.get('content-type');
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', upstreamType || contentType);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  } catch (error) {
    console.error('[MAGI server Drive file]', error?.message || error, error?.details || '');
    if (!res.headersSent) res.statusCode = 502;
    res.end('Google Drive file unavailable');
  }
}
