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

// A legitimate 1-1-1 full-lineup split is a semantic outcome, not a broken FINAL.
// The live contract must accept only the exact fail-closed deadlock shape.
assert.match(live,/FULL_LINEUP_DEADLOCK_1_1_1/);
assert.match(live,/deliberationDecision==='DEADLOCK'/);
assert.match(live,/final\?\.finalVote==='1-1-1'/);
assert.match(workflow,/\.reviewReason=="FULL_LINEUP_DEADLOCK_1_1_1"/);
assert.match(workflow,/\.deliberationDecision=="DEADLOCK"/);
assert.match(workflow,/\.finalVote=="1-1-1"/);
assert.match(workflow,/\.fieldingStatus=="NOT_EVALUATED"/);
assert.match(workflow,/得点機会\.\{0,24\}/);
assert.match(workflow,/守備\.\{0,24\}安定/);

// Live132 semantic acceptance must reject phrases that previously passed a green
// job despite exceeding the supplied evidence.
assert.match(workflow,/勝ちに直結/);
assert.match(workflow,/勝ちパターン/);
assert.match(workflow,/戦術\.\{0,24\}合致/);
assert.match(workflow,/固定されて/);
assert.match(workflow,/チームの形\.\{0,18\}馴染/);
assert.match(workflow,/勢い\.\{0,18\}/);

// Deterministic TEAM_REVIEW validation failure is not transient provider noise.
// Do not consume repeated provider calls for the same rejected prose.
const teamReview=workflow.match(/exact-live-team-review:[\s\S]*$/)?.[0]||'';
assert.match(teamReview,/PERSONA_BATCH_VALIDATION_FAILED/);
assert.match(teamReview,/do not retry the same team-review stage/);

console.log('LIVE PRODUCTION SHA GATE RESULT: PASS');
