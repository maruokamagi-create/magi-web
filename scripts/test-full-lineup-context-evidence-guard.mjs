import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyLineupGuardIssues } from '../server/api/magi/_lineup-guard-issue-codes.js';
import { reconcileLineupOrderExplanation, ORDER_EXPLANATION_CONFLICT } from '../server/api/magi/_lineup-order-explanation-reconcile.js';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

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

// Regression: the nine structured candidate slots are authoritative; a
// contradictory explanation may be discarded only if it is the sole failure.
const chosen=['大野 竜暉','大久保 陽翔','坂田 暉馬','嶋田 栄志','中嶋 玲月','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔'];
const incompatible={
  persona:'BALTHASAR',phase:'PRIMARY',judgment:'BLUE',confidence:'MEDIUM',
  candidatePlayers:chosen,
  candidateBasis:'1番大野 竜暉、2番大久保 陽翔、3番嶋田 栄志、4番井坂 悠聖とする。',
  publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番嶋田 栄志。',
  primaryReason:'成績を比較している。',
  facts:['打順を誤って記載した説明は採用しない。'],
  analysis:[],prediction:[],warnings:[],dataConflict:false,reviewRequested:false
};
const lineupCase={mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP'}};
const initialIssues=validatePersonaOutput(lineupCase,incompatible,{focused:false});
assert.deepEqual(initialIssues,[ORDER_EXPLANATION_CONFLICT],'mismatched declared lineup must remain a hard failure');
const reconciled=reconcileLineupOrderExplanation(incompatible,initialIssues);
assert.ok(reconciled,'isolated narration mismatch should admit a structural reconciliation');
assert.deepEqual(reconciled.candidatePlayers,chosen,'the reconciliation must not reorder the nine proposed players');
assert.match(reconciled.publicStatement,/3番坂田 暉馬/);
assert.doesNotMatch(reconciled.publicStatement,/3番嶋田 栄志/);
assert.deepEqual(reconciled.facts,[],'the conflicting generated rationale must not survive');
assert.deepEqual(validatePersonaOutput(lineupCase,reconciled,{focused:false}),[],'corrected narrative must pass the original guard');
const casperMixed={...incompatible,persona:'CASPER',warnings:['チーム全体の成長につなげる。']};
const casperIssues=validatePersonaOutput(lineupCase,casperMixed,{focused:false});
assert.ok(casperIssues.includes(ORDER_EXPLANATION_CONFLICT));
assert.ok(casperIssues.includes('SELECTIONでEvidenceにない成長・育成・負担影響を追加している'));
const casperReconciled=reconcileLineupOrderExplanation(casperMixed,casperIssues);
assert.ok(casperReconciled,'an isolated conflict plus removable generic development prose must be reconcilable');
assert.deepEqual(casperReconciled.candidatePlayers,chosen,'CASPER candidate order remains unchanged');
assert.deepEqual(validatePersonaOutput(lineupCase,casperReconciled,{focused:false}),[],'CASPER prose must be validated again');
assert.deepEqual(casperReconciled.facts,[]);
assert.deepEqual(casperReconciled.analysis,[]);
assert.deepEqual(casperReconciled.prediction,[]);
assert.equal(reconcileLineupOrderExplanation(casperMixed,['SELECTIONでEvidenceにない成長・育成・負担影響を追加している']),null,'do not reinterpret unsupported prose without an order contradiction');
assert.equal(reconcileLineupOrderExplanation(casperMixed,[ORDER_EXPLANATION_CONFLICT,'FULL_LINEUP_STANDARD_DEFENSE: unavailable']),null,'fielding eligibility cannot be recovered by prose edits');

assert.equal(reconcileLineupOrderExplanation(incompatible,[ORDER_EXPLANATION_CONFLICT,'NUMERIC_MISMATCH']),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,dataConflict:true},[ORDER_EXPLANATION_CONFLICT]),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,reviewRequested:true},[ORDER_EXPLANATION_CONFLICT]),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,candidatePlayers:chosen.slice(0,8)},[ORDER_EXPLANATION_CONFLICT]),null);
const personaSource=fs.readFileSync(new URL('../server/api/magi/persona.js',import.meta.url),'utf8');
assert.match(personaSource,/const reconciled=reconcileLineupOrderExplanation\(/);
assert.match(personaSource,/const rechecked=\[/);

console.log('FULL LINEUP CONTEXT EVIDENCE GUARD: PASS');
