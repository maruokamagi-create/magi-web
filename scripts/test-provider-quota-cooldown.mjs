import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseProviderRetryDelaySeconds } from '../server/api/magi/_canonical-cache.js';

assert.equal(parseProviderRetryDelaySeconds('43s',{quotaWindow:'MINUTE'}),43);
assert.equal(parseProviderRetryDelaySeconds('28811s',{quotaWindow:'DAY'}),28811);
assert.equal(parseProviderRetryDelaySeconds('1.5m',{quotaWindow:'MINUTE'}),90);
assert.equal(parseProviderRetryDelaySeconds('500ms',{quotaWindow:'SECOND'}),1);
assert.equal(parseProviderRetryDelaySeconds('',{quotaWindow:'MINUTE'}),60);
assert.equal(parseProviderRetryDelaySeconds('',{quotaWindow:'DAY'}),3600);
assert.equal(parseProviderRetryDelaySeconds('999999s',{quotaWindow:'DAY'}),86400);

const liveWorkflow=fs.readFileSync(new URL('../.github/workflows/magi-production-live-deliberation-selftest.yml',import.meta.url),'utf8');
const stages=liveWorkflow.split('          run_stage(){').slice(1);
assert.equal(stages.length,4,'all four staged Live jobs must carry provider backoff safety');
const rateLimitPredicate=String.raw`if jq -e '((.error//"")|contains("provider_rate_limit"))' "$out"`;
for(const [i,stage] of stages.entries()){
  const before=stage.slice(0,stage.indexOf('          run_stage prepare'));
  assert.ok(before.includes(rateLimitPredicate),'Live job '+i+' must stop on any provider rate limit, not only daily quota');
  assert.ok(before.indexOf(rateLimitPredicate)>before.indexOf('if [ "$code" = "200" ]'),'successful stage response must be checked first');
  assert.ok(before.indexOf('return 1',before.indexOf(rateLimitPredicate))<before.indexOf('sleep $((attempt*12))'),'provider limit must stop before outer retries');
  assert.ok(!before.includes('contains("[quota=DAY")'),'do not retry minute-budget provider saturation');
}
console.log('PROVIDER QUOTA AND LIVE FAIL-FAST RESULT: 11/11 PASS');
