const STAFF_PREFIX = 'ROOT/50_STAFF_顧問・指導者';

export function canAccessDrivePath(role, path) {
  const r = String(role || 'member');
  const p = String(path || '');
  if (r === 'admin' || r === 'coach') return true;
  if (p === STAFF_PREFIX || p.startsWith(`${STAFF_PREFIX}/`)) return false;
  return true;
}

export function filterDriveFilesForRole(role, files = []) {
  return (Array.isArray(files) ? files : []).filter((file) => canAccessDrivePath(role, file?.path));
}
