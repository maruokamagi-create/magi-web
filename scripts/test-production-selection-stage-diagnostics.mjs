import assert from 'node:assert/strict';
import fs from 'node:fs';

const selection=fs.readFileSync(new URL('../.github/workflows/magi-production-selection-smoke.yml',import.meta.url),'utf8');
const stages=[
  'STAGE=PREPARE',
  'STAGE=PRIMARY_BATCH_REQUEST',
  'STAGE=PRIMARY_BATCH_LAYOUT',
  'STAGE="PRIMARY_${p}_FIELDS"',
  'STAGE="PRIMARY_${p}_ROSTER"',
  'STAGE="PRIMARY_${p}_CANDIDATES"',
  'STAGE=CROSS_REQUEST',
  'STAGE=CROSS_FIELDS',
  'STAGE=SECOND_BATCH_REQUEST',
  'STAGE=SECOND_BATCH_LAYOUT',
  'STAGE="SECOND_${p}_FIELDS"',
  'STAGE="SECOND_${p}_ROSTER"',
  'STAGE="SECOND_${p}_CANDIDATES"',
  'STAGE=FINAL_REQUEST',
  'STAGE=FINAL_FIELDS',
  'STAGE=PERSONA_INDEPENDENCE',
  'STAGE=PASS'
];
let previous=-1;
for(const marker of stages){
  const at=selection.indexOf(marker);
  assert.ok(at>previous, `Missing or out-of-order stage marker: ${marker}`);
  previous=at;
}
assert.match(selection,/trap 'echo "SELECTION_SMOKE_STAGE_FAILURE stage=\$\{STAGE:-UNKNOWN\} line=\$\{LINENO\}" >&2' ERR/);
assert.doesNotMatch(selection,/echo .*BASH_COMMAND|set -x/,'never log raw player evidence or shell bodies');
assert.match(selection,/same_roster "\/tmp\/\$\{p\}-primary\.json"/);
assert.match(selection,/candidates_current_only "\/tmp\/\$\{p\}-second\.json"/);
assert.match(selection,/\(\.reviewRequested==false\)/);
assert.match(selection,/\(\.dataConflict==false\)/);
console.log('SELECTION SMOKE STAGE DIAGNOSTIC CONTRACT: PASS');
