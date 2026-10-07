import fs from 'node:fs';
import assert from 'node:assert/strict';

const live=fs.readFileSync(new URL('../api/magi-live-deliberation-selftest.js', import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../.github/workflows/magi-production-live-deliberation-selftest.yml', import.meta.url),'utf8');

assert.match(live,/VERCEL_GIT_COMMIT_SHA/);
assert.match(live,/VERCEL_ENV/);
assert.equal((live.match(/deployment:deploymentIdentity\(\)/g)||[]).length,4);

for (const file of ['lineup','closer','natural-third','team-review']) {
  const pattern=new RegExp('deployment\\.sha==\\$expected_sha and \\.deployment\\.env=="production"[^\\n]*\\/tmp\\/'+file+'-prepare\\.json');
  assert.match(workflow,pattern);
}

const readiness=workflow.match(/production-revision-ready:[\s\S]*?\n  exact-live-best-order:/)?.[0]||'';
assert.match(readiness,/Verify production revision/);
assert.match(readiness,/stage=prepare/);
assert.match(readiness,/\.deployment\.sha==\$expected_sha/);
assert.match(readiness,/\.deployment\.env=="production"/);
assert.doesNotMatch(readiness,/stage=primary|run_stage primary/);

assert.match(workflow,/exact-live-best-order:[\s\S]{0,120}needs: production-revision-ready/);
assert.equal((workflow.match(/needs: \[production-revision-ready,/g)||[]).length,3);
assert.equal((workflow.match(/needs\.production-revision-ready\.result == 'success'/g)||[]).length,3);
assert.equal((workflow.match(/run_stage prepare$/gm)||[]).length,4);
assert.equal((workflow.match(/run_stage prepare 5/g)||[]).length,0);

console.log('LIVE PRODUCTION SHA GATE RESULT: PASS');
