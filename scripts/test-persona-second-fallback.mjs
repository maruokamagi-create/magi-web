import assert from 'node:assert/strict';
import { markSecondTransientRetryable } from '../server/api/magi/persona-resilient.js';

const transient = {
  error: '3賢人の回答を一時的に取得できませんでした。',
  code: 'PERSONA_GENERATION_FAILED',
  retryExhausted: true
};

const second = markSecondTransientRetryable({ phase: 'SECOND' }, transient);
assert.equal(second.code, 'PERSONA_GENERATION_FAILED');
assert.equal(second.retryExhausted, false);
assert.equal(second.retryFreshRequest, true);
assert.equal(second.retryScope, 'SECOND_REQUEST');
assert.equal('candidatePlayers' in second, false);
assert.equal('secondFallbackUsed' in second, false);

const primary = markSecondTransientRetryable({ phase: 'PRIMARY' }, transient);
assert.equal(primary.retryExhausted, false);
assert.equal(primary.retryFreshRequest, true);
assert.equal(primary.retryScope, 'PRIMARY_REQUEST');
assert.equal('candidatePlayers' in primary, false);
assert.equal('secondFallbackUsed' in primary, false);

assert.equal(markSecondTransientRetryable({ phase: 'SECOND' }, null), null);

console.log('PERSONA PRIMARY/SECOND FRESH-REQUEST RETRY: PASS');
