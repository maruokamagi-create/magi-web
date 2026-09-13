import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertAllowedDriveDataFile,
  driveAllowedListClause,
  isAllowedDriveDataFile,
  isDriveFolder,
  isDriveTraversalItem,
  MAGI_DRIVE_FILE_POLICY_VERSION,
  withDriveAllowedTypes
} from '../server/api/drive/_file-policy.js';

const allowed = [
  { name: 'team.xlsm', mimeType: 'application/vnd.ms-excel.sheet.macroenabled.12' },
  { name: 'TEAM.XLSM', mimeType: 'application/octet-stream' },
  { name: 'batting.csv', mimeType: 'text/csv' },
  { name: 'BATTING.CSV', mimeType: 'application/vnd.ms-excel' }
];
for (const file of allowed) assert.equal(isAllowedDriveDataFile(file), true, `must allow ${file.name}`);

const rejected = [
  'team.xlsx', 'team.xls', 'team.pdf', 'team.json', 'team.txt', 'team.docx',
  'team.png', 'team.jpg', 'team.csv.bak', 'team.xlsm.pdf', 'no-extension'
];
for (const name of rejected) assert.equal(isAllowedDriveDataFile({ name }), false, `must reject ${name}`);

const folder = { name: '03_STATS_成績データ', mimeType: 'application/vnd.google-apps.folder' };
assert.equal(isDriveFolder(folder), true);
assert.equal(isAllowedDriveDataFile(folder), false);
assert.equal(isDriveTraversalItem(folder), true, 'folders are metadata-only traversal items');
assert.equal(isDriveTraversalItem({ name: 'photo.jpg', mimeType: 'image/jpeg' }), false);

const clause = driveAllowedListClause();
assert.match(clause, /google-apps\.folder/);
assert.match(clause, /xlsm/i);
assert.match(clause, /csv/i);
assert.doesNotMatch(clause, /pdf|json|png|jpeg|document/);
const query = withDriveAllowedTypes("'folder-id' in parents and trashed=false");
assert.match(query, /folder-id/);
assert.match(query, /xlsm/i);
assert.match(query, /csv/i);

assert.throws(
  () => assertAllowedDriveDataFile({ name: 'report.pdf', mimeType: 'application/pdf' }),
  error => error?.code === 'DRIVE_FILE_TYPE_NOT_ALLOWED' && error?.status === 415
);

const service = fs.readFileSync(new URL('../server/api/drive/_service.js', import.meta.url), 'utf8');
const cache = fs.readFileSync(new URL('../server/api/drive/_cache.js', import.meta.url), 'utf8');
const scope = fs.readFileSync(new URL('../server/api/drive/_knowledge-scope.js', import.meta.url), 'utf8');
const fileApi = fs.readFileSync(new URL('../server/api/drive/file.js', import.meta.url), 'utf8');
const warm = fs.readFileSync(new URL('../server/api/drive/warm.js', import.meta.url), 'utf8');
const clientWarm = fs.readFileSync(new URL('../drive-server-cache-v307.js', import.meta.url), 'utf8');
assert.match(service, /assertAllowedDriveDataFile\(meta\)/);
assert.match(service, /withDriveAllowedTypes/);
assert.doesNotMatch(service, /google-apps\.document|export\?mimeType/);
assert.match(cache, /isAllowedDriveDataFile/);
assert.match(scope, /knowledge-scope-v2-xlsm-csv-only/);
assert.match(fileApi, /Drive file type not allowed/);
assert.match(warm, /isAllowedDriveDataFile/);
assert.match(warm, /strategy: 'XLSM_CSV_ONLY'/);
assert.doesNotMatch(warm, /00_MASTER_正本|AUTHORITATIVE_ONLY/);
assert.match(clientWarm, /\(\?:xlsm\|csv\)/);
assert.match(clientWarm, /XLSM・CSV準備完了/);

console.log(`PASS ${MAGI_DRIVE_FILE_POLICY_VERSION}: only .xlsm and .csv content is ingestible and all allowed files are prewarmed`);
