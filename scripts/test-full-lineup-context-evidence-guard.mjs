import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyLineupGuardIssues } from '../server/api/magi/_lineup-guard-issue-codes.js';

const core=fs.readFileSync(new URL('../server/api/magi/core.js',import.meta.url),'utf8');
const selection=fs.readFileSync(new URL('../server/api/magi/_selection-live-evidence.js',import.meta.url),'utf8');
const fullLineup=fs.readFileSync(new URL('../server/api/magi/_full-lineup.js',import.meta.url),'utf8');

assert.match(fullLineup,/ベストオーダー\|ベスト打順/,'generic best-order wording must remain a full-lineup request');
assert.match(selection,/if\(hasNamedPlayer\(routed\)\) return '';/,'selection evidence still contains the named-player narrow-route guard');
assert.match(
  core,
  /const selectionRouted=String\(routed\?\.selectionKind\|\|''\)\.toUpperCase\(\)==='FULL_LINEUP'\?\{\.\.\.routed,players:\[\]\}:routed;/,
  'FULL_LINEUP must clear contextual player names only for the evidence-builder handoff'
);
assert.match(
  core,
  /buildCurrentSelectionEvidence\(\{question,routed:selectionRouted,staffAccessContext\}\)/,
  'live full-lineup evidence must use the sanitized routing view while preserving the guarded staff evidence context'
);
assert.match(
  core,
  /selectionKind:semantic\?\.selectionKind\|\|'NONE'/,
  'the public semantic selection kind must remain unchanged'
);

const prefix='回答文に、確認できた記録と合わない内容があるため再確認が必要です。';
const diagnostics=[
  ['BEST_ORDERのcandidatePlayersと打順説明が矛盾している','ORDER_EXPLANATION_CONFLICT'],
  ['BEST_ORDERで打撃数値・打順から得点効率・勝利優位を断定している','UNSUPPORTED_SCORING_CLAIM'],
  ['BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している','UNSUPPORTED_DEFENSE_EFFECT'],
  ['BEST_ORDERでEvidenceにない打順固定を断定している','UNSUPPORTED_FIXED_SLOT'],
  ['FULL_LINEUP_STANDARD_DEFENSE: 守備位置を成立できません','FIELDING_COVERAGE'],
  ['FULL_LINEUP: ロスター以外の選手','LINEUP_STRUCTURE'],
  ['登板数7 は supplied CASE/EVIDENCE の登板数 値と一致しない','NUMERIC_EVIDENCE_MISMATCH'],
  ['BEST_ORDERで直近試合数をEvidenceと異なる値で述べている','RECENT_WINDOW_MISMATCH']
];
for(const [raw,expected] of diagnostics){
  const diagnostic=classifyLineupGuardIssues(prefix+raw);
  assert.deepEqual(diagnostic,[expected]);
  assert.ok(!JSON.stringify(diagnostic).includes(raw));
}
assert.deepEqual(classifyLineupGuardIssues(''),[]);
assert.deepEqual(classifyLineupGuardIssues('失敗内容は本人しか知らない'),[]);
assert.deepEqual(
  classifyLineupGuardIssues(prefix+'BEST_ORDERでEvidenceにない打順固定を断定している／BEST_ORDERでEvidenceにない打順固定を断定している'),
  ['UNSUPPORTED_FIXED_SLOT'],
  'duplicate guard issues must be deduplicated'
);
const liveSelftest=fs.readFileSync(new URL('../api/magi-live-deliberation-selftest.js',import.meta.url),'utf8');
assert.match(liveSelftest,/issueCodes:classifyLineupGuardIssues\(reason\)/,'live acceptance must expose safe guard categories');

console.log('FULL LINEUP CONTEXT EVIDENCE GUARD: PASS');
