const STAFF_FOLDER = '50_STAFF_顧問・指導者';

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
}

export function isStaffDrivePath(path) {
  const p = normalizePath(path);
  if (!p) return false;
  return p === STAFF_FOLDER || p.startsWith(`${STAFF_FOLDER}/`) || p.includes(`/${STAFF_FOLDER}/`) || p.endsWith(`/${STAFF_FOLDER}`);
}

export function canAccessDrivePath(role, path) {
  const r = String(role || 'member');
  if (r === 'admin' || r === 'coach') return true;
  return !isStaffDrivePath(path);
}

export function filterDriveFilesForRole(role, files = []) {
  return (Array.isArray(files) ? files : []).filter((file) => canAccessDrivePath(role, file?.path));
}
