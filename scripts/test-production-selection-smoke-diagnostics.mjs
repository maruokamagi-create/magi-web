import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow=fs.readFileSync(new URL('../.github/workflows/magi-production-selection-smoke.yml',import.meta.url),'utf8');
const title='      - name: Run one full candidate-selection deliberation';
assert.ok(workflow.includes(title),'production selection step must be present');
const rest=workflow.slice(workflow.indexOf(title));
const marker='        run: |\n';
const at=rest.indexOf(marker);
assert.ok(at>=0,'selection bash body must be present');
const lines=rest.slice(at+marker.length).split('\n');
const code=lines.map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const syntax=spawnSync('bash',['-n'],{input:code,encoding:'utf8'});
assert.equal(syntax.status,0,'production selection Bash syntax: '+syntax.stderr);
assert.match(code,/set -Eeuo pipefail/);
assert.match(code,/trap 'code=\$\?; echo "MAGI_SELECTION_SMOKE_FAILURE gate=\$gate exit=\$code" >&2' ERR/);
for(const gate of [
  'primary_batch_request','primary_batch_shape','primary_${p}_schema','primary_${p}_roster','primary_${p}_candidates',
  'cross_request','cross_schema','second_batch_request','second_batch_shape','second_${p}_schema','second_${p}_roster','second_${p}_candidates',
  'final_request','final_schema','persona_distinctness'
]){
  assert.ok(code.includes('gate='+gate)||code.includes('gate="'+gate+'"'),'missing diagnostic gate '+gate);
}
// The error trap must report only a safe stage identifier and exit code, not
// dump case data, player names, rejected prose or private Evidence.
const trap='trap \'code=$?; echo "MAGI_SELECTION_SMOKE_FAILURE gate=$gate exit=$code" >&2\' ERR';
const specimen=spawnSync('bash',['-c','set -Eeuo pipefail\ngate=primary_melchior_roster\n'+trap+'\nfalse'],{encoding:'utf8'});
assert.equal(specimen.status,1);
assert.match(specimen.stderr,/MAGI_SELECTION_SMOKE_FAILURE gate=primary_melchior_roster exit=1/);
assert.ok(!/大野|嶋田|Evidence|candidatePlayers/.test(specimen.stderr),'diagnostic must never include player content');
console.log('PRODUCTION SELECTION FAILURE GATE DIAGNOSTIC CONTRACT: PASS');
