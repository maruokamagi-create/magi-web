import assert from 'node:assert/strict';
import { parseProviderRetryDelaySeconds } from '../server/api/magi/_canonical-cache.js';

assert.equal(parseProviderRetryDelaySeconds('43s',{quotaWindow:'MINUTE'}),43);
assert.equal(parseProviderRetryDelaySeconds('28811s',{quotaWindow:'DAY'}),28811);
assert.equal(parseProviderRetryDelaySeconds('1.5m',{quotaWindow:'MINUTE'}),90);
assert.equal(parseProviderRetryDelaySeconds('500ms',{quotaWindow:'SECOND'}),1);
assert.equal(parseProviderRetryDelaySeconds('',{quotaWindow:'MINUTE'}),60);
assert.equal(parseProviderRetryDelaySeconds('',{quotaWindow:'DAY'}),3600);
assert.equal(parseProviderRetryDelaySeconds('999999s',{quotaWindow:'DAY'}),86400);
console.log('PROVIDER QUOTA COOLDOWN RESULT: 7/7 PASS');
