import fs from 'node:fs';
import assert from 'node:assert/strict';

const api=fs.readFileSync(new URL('../api/magi-live-deliberation-selftest.js', import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../.github/workflows/magi-production-live-deliberation-selftest.yml', import.meta.url),'utf8');

assert.match(api,/VERCEL_GIT_COMMIT_SHA/);
assert.match(api,/VERCEL_GIT_COMMIT_REF/);
assert.match(api,/VERCEL_TARGET_ENV\|\|process\.env\.VERCEL_ENV/);

const prepareResponses=(api.match(/stage:'PREPARE'[\s\S]{0,300}?deployment:deploymentRevision\(\)/g)||[]);
assert.equal(prepareResponses.length,4,'all four staged PREPARE responses must expose deployment revision');

const shaChecks=(workflow.match(/\.deployment\.gitSha==\$sha/g)||[]);
const refChecks=(workflow.match(/\.deployment\.gitRef=="main"/g)||[]);
const targetChecks=(workflow.match(/\.deployment\.target=="production"/g)||[]);
assert.equal(shaChecks.length,4,'all four live classes must require deployed SHA == GITHUB_SHA');
assert.equal(refChecks.length,4,'all four live classes must require main ref');
assert.equal(targetChecks.length,4,'all four live classes must require production target');
assert.match(workflow,/jq -e --arg sha "\$GITHUB_SHA"/);

console.log('PRODUCTION LIVE DEPLOYMENT SHA GATE: PASS');
