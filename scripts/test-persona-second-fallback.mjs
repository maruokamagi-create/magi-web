import assert from 'node:assert/strict';
import { buildSecondFallback } from '../server/api/magi/persona-resilient.js';

const primary = {
  persona: 'MELCHIOR',
  phase: 'PRIMARY',
  checkedPlayers: ['大野 竜暉','坂田 暉馬'],
  candidatePlayers: ['大野 竜暉','坂田 暉馬'],
  candidateBasis: '確認できた記録から選定。',
  facts: ['事実'],
  analysis: ['分析'],
  prediction: [],
  confidence: 'MEDIUM',
  judgment: 'BLUE',
  primaryReason: '一次判断の理由。',
  publicStatement: '一次判断を維持します。',
  warnings: [],
  dataConflict: false,
  reviewRequested: false,
  reviewReason: '',
  changedFromPrimary: false,
  changeReason: ''
};

const fallback = buildSecondFallback({ phase: 'SECOND', primarySelf: primary });
assert.ok(fallback, 'SECOND fallback must be built from a valid primary judgment');
assert.equal(fallback.phase, 'SECOND');
assert.equal(fallback.changedFromPrimary, false);
assert.equal(fallback.changeReason, '');
assert.equal(fallback.confidence, 'LOW');
assert.equal(fallback.secondFallbackUsed, true);
assert.deepEqual(fallback.candidatePlayers, primary.candidatePlayers);
assert.match(fallback.publicStatement, /一次判断を暫定維持/);
assert.match(fallback.warnings.join(' '), /一時的な通信障害/);
assert.equal(buildSecondFallback({ phase: 'PRIMARY', primarySelf: primary }), null);
assert.equal(buildSecondFallback({ phase: 'SECOND', primarySelf: null }), null);

console.log('PERSONA SECOND TRANSIENT FALLBACK: PASS');
