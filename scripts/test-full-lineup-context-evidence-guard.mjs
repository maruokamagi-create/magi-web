import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dateKey } from '../server/api/magi/_appearance-date-key.js';
import { EVIDENCE_SOURCES } from '../server/api/magi/_evidence-source-map.js';
import { classifyLineupGuardIssues, classifyLineupGuardIssueList } from '../server/api/magi/_lineup-guard-issue-codes.js';
import { reconcileLineupOrderExplanation, ORDER_EXPLANATION_CONFLICT } from '../server/api/magi/_lineup-order-explanation-reconcile.js';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

// Actual 2026-10-10 read-only Drive CSV stores dates as Excel serials.
assert.equal(dateKey('46236'),'2026-08-02');
assert.equal(dateKey('46243'),'2026-08-09');
assert.equal(dateKey(46277),'2026-09-11');
assert.equal(dateKey(46278),'2026-09-12');
assert.equal(dateKey('46298'),'2026-10-03');
assert.equal(dateKey('2026/10/03'),'2026-10-03');
assert.equal(dateKey('2026-10-03'),'2026-10-03');
assert.equal(dateKey('46236.5'),'','do not silently round a fractional/ambiguous date');
assert.equal(dateKey('12345'),'','non-current invalid serial must remain unverified');
assert.equal(dateKey('not a date'),'');
const originalDefinitions=EVIDENCE_SOURCES.CURRENT_SCORE_SHEETS.files;
assert.equal(originalDefinitions[6].date,'2026-09-12');
assert.equal(dateKey('46277'),'2026-09-11','do not silently rewrite the seventh CSV game to score-original date');
assert.notEqual(dateKey('46277'),originalDefinitions[6].date,'source disagreement must remain visible and block complete verification');
assert.equal(dateKey('46278'),originalDefinitions[7].date,'eighth game matches its exact score original');

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
assert.match(liveSelftest,/issueCodes:Array\.isArray\(row\?\.guardIssueCodes\)/,'Live acceptance must prefer uncapped safe guard classes');
assert.match(liveSelftest,/guardIssueCount:Number\.isInteger\(row\?\.guardIssueCount\)/);
const safeCodes=classifyLineupGuardIssueList([
  'BEST_ORDERで打撃数値・打順から得点効率・勝利優位を断定している',
  'BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している',
  'BEST_ORDERのcandidatePlayersと打順説明が矛盾している',
  'FULL_LINEUP_STANDARD_DEFENSE: unsupported',
  'unknown private text goes nowhere'
]);
assert.deepEqual(safeCodes,['UNSUPPORTED_SCORING_CLAIM','UNSUPPORTED_DEFENSE_EFFECT','ORDER_EXPLANATION_CONFLICT','FIELDING_COVERAGE','OTHER_GUARD']);
assert.ok(safeCodes.every(code=>!code.includes('private')));
const personaSource=fs.readFileSync(new URL('../server/api/magi/persona.js',import.meta.url),'utf8');
assert.match(personaSource,/guardIssueCodes = classifyLineupGuardIssueList\(issues\)/);

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

// Production SECOND CASPER can mix prose/order conflict with inferred scoring
// and fielding effects; none of the effects may survive reconciliation.
const speculativeCasper={
  ...incompatible,persona:'CASPER',phase:'SECOND',
  primaryReason:'記録上の打撃数値を基準に得点力を最大化する。',
  warnings:['先発守備資格を満たせば守備連携を強化できる。'],
  analysis:['確実に勝利できる。']
};
const mixedIssues=validatePersonaOutput(lineupCase,speculativeCasper,{focused:false});
assert.ok(mixedIssues.includes(ORDER_EXPLANATION_CONFLICT),'raw order inconsistency must be detected');
assert.ok(mixedIssues.includes('BEST_ORDERでEvidenceにない得点力最大化・勝利接近を推定している'));
assert.ok(mixedIssues.includes('BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している'));
assert.equal(reconcileLineupOrderExplanation(speculativeCasper,mixedIssues),null,'unlisted causal or outcome issues cannot be silently discarded');
const recoverableCasper={...speculativeCasper,analysis:[]};
const recoverableIssues=validatePersonaOutput(lineupCase,recoverableCasper,{focused:false});
assert.ok(recoverableIssues.every(issue=>[
  ORDER_EXPLANATION_CONFLICT,
  'BEST_ORDERでEvidenceにない得点力最大化・勝利接近を推定している',
  'BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している'
].includes(issue)),'only enumerated prose-only issues may qualify');
const cleanCasper=reconcileLineupOrderExplanation(recoverableCasper,recoverableIssues);
assert.ok(cleanCasper,'SECOND CASPER text can be reconciled without making up a new batting order');
assert.deepEqual(cleanCasper.candidatePlayers,chosen,'must not reorder 1-9 or substitute a player');
assert.deepEqual(cleanCasper.analysis,[]);
assert.ok(!/最大化|連携を強化/.test(JSON.stringify(cleanCasper)),'unproven effects cannot remain');
assert.deepEqual(validatePersonaOutput(lineupCase,cleanCasper,{focused:false}),[]);
assert.equal(reconcileLineupOrderExplanation(recoverableCasper,recoverableIssues.concat('FULL_LINEUP_STANDARD_DEFENSE: unsupported starter')),null);

// Production SECOND MELCHIOR (Live 37889151231) returned FOUR guard issues,
 // but the enum-only diagnostic collapsed distinct scoring/stability issues.
 // An isolated prose+order contradiction can be fixed by discarding ALL
 // unsupported prose while keeping the authoritative candidate order.
const mixedMelchior={
  ...incompatible, persona:'MELCHIOR',phase:'SECOND',
  analysis:['通算打率から得点効率が高まると判断する。','打順の配置と成績から得点機会が増加し、安定性があると判断する。'],
  warnings:['先発守備資格を満たすため、守備連携を強化できる。']
};
const melchiorIssues=validatePersonaOutput(lineupCase,mixedMelchior,{focused:false});
assert.ok(melchiorIssues.includes(ORDER_EXPLANATION_CONFLICT),'mixed case must contain actual order contradiction');
assert.ok(melchiorIssues.includes('BEST_ORDERで打撃数値・打順から得点効率・勝利優位を断定している'));
assert.ok(melchiorIssues.includes('BEST_ORDERで打撃数値・打順から得点機会・安定性を推定している'));
assert.ok(melchiorIssues.includes('BEST_ORDERで守備資格・打順から守備安定性や連携効果を推定している'));
assert.deepEqual(classifyLineupGuardIssueList(melchiorIssues),[
  'UNSUPPORTED_SCORING_CLAIM','UNSUPPORTED_STABILITY_CLAIM',
  'UNSUPPORTED_DEFENSE_EFFECT','ORDER_EXPLANATION_CONFLICT'
], 'diagnostic must not collapse scoring-chance stability into generic scoring');
const melchiorFixed=reconcileLineupOrderExplanation(mixedMelchior,melchiorIssues);
assert.ok(melchiorFixed,'scoring/stability/fielding narrative must be discarded when order mismatch is independent');
assert.deepEqual(melchiorFixed.candidatePlayers,chosen,'reconciliation must NEVER move the candidate sequence');
assert.deepEqual(melchiorFixed.facts,[]);
assert.deepEqual(melchiorFixed.analysis,[]);
assert.deepEqual(melchiorFixed.prediction,[]);
assert.deepEqual(validatePersonaOutput(lineupCase,melchiorFixed,{focused:false}),[],'all original evidence checks still apply');
assert.equal(reconcileLineupOrderExplanation(mixedMelchior,[...melchiorIssues,'FULL_LINEUP_STANDARD_DEFENSE: no eligible starter']),null);
assert.equal(reconcileLineupOrderExplanation(mixedMelchior,[...melchiorIssues,'数値1 は supplied CASE/EVIDENCE の値と一致しない']),null);
assert.equal(reconcileLineupOrderExplanation(mixedMelchior,melchiorIssues.filter(x=>x!==ORDER_EXPLANATION_CONFLICT)),null,'cannot discard unsupported claims absent an actual order mismatch');


// Actual 2026-10-09 Sequential full-lineup failed at MELCHIOR PRIMARY with
// ORDER_EXPLANATION_CONFLICT plus UNSUPPORTED_OUTCOME_PREDICTION only.
// Both are assertions in discarded prose, not a license to overwrite the nine
// structured candidates or to invent verified scores.
const predictedWinner={
  ...incompatible,
  phase:'PRIMARY',
  prediction:['この打順なら必ず勝てる。'],
  publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番嶋田 栄志にすると必ず勝てる。'
};
const predictionIssues=validatePersonaOutput(lineupCase,predictedWinner,{focused:false});
assert.ok(predictionIssues.includes(ORDER_EXPLANATION_CONFLICT),JSON.stringify(predictionIssues));
assert.ok(predictionIssues.includes('Evidenceから保証できない結果を断定している'),JSON.stringify(predictionIssues));
assert.ok(predictionIssues.every(x=>[
  ORDER_EXPLANATION_CONFLICT,
  'Evidenceから保証できない結果を断定している',
  '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている',
  '将来予測を不確実性の表現なしに確定結果として述べている'
].includes(x)),JSON.stringify(predictionIssues));
assert.equal(reconcileLineupOrderExplanation(predictedWinner,predictionIssues),null,
  'a hard guarantee such as 必ず勝てる must remain fail-closed even with an order contradiction');
const softFutureIssues=[
  ORDER_EXPLANATION_CONFLICT,
  '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている'
];
const softForecast={...incompatible,analysis:['この打順を継続すれば得点力が伸びる。']};
const softened=reconcileLineupOrderExplanation(softForecast,softFutureIssues);
assert.ok(softened,'non-guarantee future prose plus independently established order mismatch may be discarded');
assert.deepEqual(softened.candidatePlayers,chosen);
assert.deepEqual(softened.analysis,[]);
assert.doesNotMatch(JSON.stringify(softened),/得点力が伸びる/);
assert.deepEqual(validatePersonaOutput(lineupCase,softened,{focused:false}),[]);
assert.equal(reconcileLineupOrderExplanation(predictedWinner,
 predictionIssues.filter(x=>x!==ORDER_EXPLANATION_CONFLICT)),null,
 'outcome guarantees without a separate order mismatch must NOT be auto-rewritten');
assert.equal(reconcileLineupOrderExplanation(predictedWinner,
 predictionIssues.concat('FULL_LINEUP_STANDARD_DEFENSE: missing starter')),null);
assert.equal(reconcileLineupOrderExplanation(predictedWinner,
 predictionIssues.concat('数値.5 は supplied CASE/EVIDENCE の値と一致しない')),null);
assert.equal(reconcileLineupOrderExplanation({...predictedWinner,dataConflict:true},predictionIssues),null);

assert.equal(reconcileLineupOrderExplanation(incompatible,[ORDER_EXPLANATION_CONFLICT,'NUMERIC_MISMATCH']),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,dataConflict:true},[ORDER_EXPLANATION_CONFLICT]),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,reviewRequested:true},[ORDER_EXPLANATION_CONFLICT]),null);
assert.equal(reconcileLineupOrderExplanation({...incompatible,candidatePlayers:chosen.slice(0,8)},[ORDER_EXPLANATION_CONFLICT]),null);
assert.match(personaSource,/const reconciled=reconcileLineupOrderExplanation\(/);
assert.match(personaSource,/const rechecked=\[/);

console.log('FULL LINEUP CONTEXT EVIDENCE GUARD: PASS');
