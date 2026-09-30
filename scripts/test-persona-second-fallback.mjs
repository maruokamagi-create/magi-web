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
assert.equal(primary.retryExhausted, true);
assert.equal(primary.retryFreshRequest, undefined);

assert.equal(markSecondTransientRetryable({ phase: 'SECOND' }, null), null);

console.log('PERSONA SECOND FRESH-REQUEST RETRY: PASS');
