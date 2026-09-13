export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
export const MAGI_DRIVE_FILE_POLICY_VERSION = 'xlsm-csv-only-v1';

const ALLOWED_DATA_FILE = /\.(?:xlsm|csv)$/i;
const XLSM_MIME = 'application/vnd.ms-excel.sheet.macroenabled.12';
const CSV_MIME = 'text/csv';

export function isDriveFolder(file) {
  return String(file?.mimeType || '') === DRIVE_FOLDER_MIME;
}

export function isAllowedDriveDataFile(file) {
  return ALLOWED_DATA_FILE.test(String(file?.name || '').trim());
}

export function isDriveTraversalItem(file) {
  return isDriveFolder(file) || isAllowedDriveDataFile(file);
}

export function driveAllowedListClause() {
  return `(${[
    `mimeType='${DRIVE_FOLDER_MIME}'`,
    `mimeType='${XLSM_MIME}'`,
    `mimeType='${CSV_MIME}'`,
    "name contains '.xlsm'",
    "name contains '.XLSM'",
    "name contains '.csv'",
    "name contains '.CSV'"
  ].join(' or ')})`;
}

export function withDriveAllowedTypes(baseQuery = 'trashed=false') {
  const base = String(baseQuery || 'trashed=false').trim();
  return `(${base}) and ${driveAllowedListClause()}`;
}

export function assertAllowedDriveDataFile(file) {
  if (isAllowedDriveDataFile(file)) return file;
  const error = new Error('drive_file_type_not_allowed');
  error.code = 'DRIVE_FILE_TYPE_NOT_ALLOWED';
  error.status = 415;
  throw error;
}
