import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evidenceSource } from '../server/api/magi/_evidence-source-map.js';

// Regression fixture grounded in the fifteen original PDFs and the restored
// 2026-2027 appearance CSV. No Drive file is edited by this test.
const set=evidenceSource('CURRENT_SCORE_SHEETS');
const files=set?.files||[];
assert.equal(files.length,15,'must register all fifteen games');
assert.equal(new Set(files.map(x=>x.id)).size,15,'original file IDs must be unique');
assert.equal(set.independentVote,false,'original score sheets are verification only');

const expected=[
  ['2026-08-02','PRACTICE','勝山クラブ',1],
  ['2026-08-02','PRACTICE','勝山クラブ',2],
  ['2026-08-09','PRACTICE','丸岡南中',1],
  ['2026-08-09','PRACTICE','丸岡南中',2],
  ['2026-08-11','PRACTICE','坂井中',1],
  ['2026-08-11','PRACTICE','坂井中',2],
  ['2026-09-12','PRACTICE','藤島中',1],
  ['2026-09-12','PRACTICE','藤島中',2],
  ['2026-09-20','OFFICIAL','丸岡南中',null],
  ['2026-09-21','OFFICIAL','三国中',null],
  ['2026-09-26','OFFICIAL','三国中',null],
  ['2026-10-03','PRACTICE','金津・芦原',1],
  ['2026-10-03','PRACTICE','金津・芦原',2],
  ['2026-10-10','PRACTICE','春江中',1],
  ['2026-10-10','PRACTICE','春江中',2]
];
assert.deepEqual(files.map(x=>[x.date,x.category,x.appearanceOpponent||x.opponent,x.gameNo??null]),expected);
for(const x of files){
  assert.match(x.id,/^[A-Za-z0-9_-]{15,}$/);
  assert.equal(x.independentVote,undefined,'no duplicate vote per PDF');
  assert.ok(x.label,'PDF basename requires a game label');
  assert.ok(x.opponent,'PDF basename requires an original opponent');
}
assert.equal(files[11].id,'13F9NgSW2qTkx4ZqM7S2FIc1u6p6ZM8iH');
assert.equal(files[12].id,'1NCrXY4uRpTcYqlpkKVsG76dS6_kS9-dP');
assert.equal(files[13].id,'1LG09b-jUWCIb1TAgGwy82c53zCHinqiZ');
assert.equal(files[14].id,'1aGeGQl0jpam-4YPp_qzzTgQj_k5UDTf_');
assert.equal(files[7].date,'2026-09-12','藤島中第2試合の日付は12日');

const builder=fs.readFileSync(new URL('../server/api/magi/_appearance-fielding-evidence.js',import.meta.url),'utf8');
assert.match(builder,/SCORE_FILE_DEFS\.length!==15/,'fail-closed original count guard');
assert.match(builder,/score_sheet_name_mismatch/,'must reject wrong original basename');
assert.match(builder,/SOURCE_MISMATCH_OPPONENT/,'must reject opponent mismatch');
assert.match(builder,/UNVERIFIED_SCORE_SHEET/,'must reject missing original');
assert.match(builder,/登録済み15試合/,'recovery explanation should reflect current coverage');
assert.doesNotMatch(builder,/登録済み13試合/);
const live=fs.readFileSync(new URL('../api/magi-live-deliberation-selftest.js',import.meta.url),'utf8');
assert.match(live,/scoreCheck\.originalCount\)===15/,'live gate must require 15 originals');
assert.match(live,/scoreCheck\.appearanceGameCount\)===15/,'live gate must require 15 appearance games');
assert.match(live,/scoreCheck\.verifiedCount\)\+Number\(scoreCheck\.sourceMismatchCount\)===15/,'live gate must account for 15 games');
assert.doesNotMatch(live,/scoreCheck\.originalCount\)===13/,'stale thirteen-game live gate must be removed');
console.log('PASS: fifteen score originals, exact mappings, strict guard retained');
