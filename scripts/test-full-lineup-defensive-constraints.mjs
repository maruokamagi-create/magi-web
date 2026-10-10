import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStandardDefenseEligibility, assignEvidenceGroundedFielding } from '../server/api/magi/_lineup-fielding.js';

// Position coverage reproduces the exact issue observed in the Oct 10 live
// BALTHASAR PRIMARY proposal. Eligibility is strictly an existing start in an
// official game or practice first game, not practice second-game experiments.
const historicalStarts={
  '大野 竜暉':['捕'],
  '嶋田 栄志':['中'],
  '井坂 悠聖':['三','左','遊'],
  '大久保 陽翔':['投','三','遊'],
  '中嶋 玲月':['一'],
  '橋向 結都':['投','遊'],
  '坂田 暉馬':['二'],
  '上村 蓮':['右'],
  '武田 晴琉翔':['左','右'],
  '武澤 大翔':['右']
};
// Artificial weights select a unique legal assignment in this regression;
// they are NOT asserted to be actual game-start counts.
const fixturePriority={
  '大久保 陽翔':'遊','橋向 結都':'投','井坂 悠聖':'三',
  '武田 晴琉翔':'左','武澤 大翔':'右'
};
const packet={status:'COMPLETE',players:Object.entries(historicalStarts).map(([name,positions])=>({
  name,
  appearance:{officialStartingPositions:Object.fromEntries(positions.map(position=>[position,fixturePriority[name]===position?6:1])),practiceFirstStartingPositions:{}},
  fielding:{positions:{}}
}))};
const eligibility=buildStandardDefenseEligibility(packet);
assert.deepEqual(eligibility.constrainedPositions['捕'],['大野 竜暉']);
assert.deepEqual(eligibility.constrainedPositions['一'],['中嶋 玲月']);
assert.deepEqual(eligibility.constrainedPositions['二'],['坂田 暉馬']);
assert.deepEqual(eligibility.constrainedPositions['中'],['嶋田 栄志']);
assert.deepEqual(eligibility.constrainedPositions['左'],['井坂 悠聖','武田 晴琉翔']);
assert.equal(eligibility.constrainedPositions['右'],undefined,'three eligible right fielders are not an at-most-two bottleneck');

const fromNames=names=>names.map((name,slot)=>({name,slot:slot+1}));
const rejected=[
  '大久保 陽翔','大野 竜暉','中嶋 玲月','嶋田 栄志',
  '坂田 暉馬','上村 蓮','橋向 結都','武澤 大翔','井坂 悠聖'
];
const incompatible=assignEvidenceGroundedFielding(fromNames(rejected),packet);
assert.notEqual(incompatible.status,'COMPLETE','a nine with no legal one-to-one defense must never be marked complete');
const accepted=[
  '大久保 陽翔','大野 竜暉','中嶋 玲月','嶋田 栄志',
  '坂田 暉馬','武田 晴琉翔','橋向 結都','武澤 大翔','井坂 悠聖'
];
const legal=assignEvidenceGroundedFielding(fromNames(accepted),packet);
assert.equal(legal.status,'COMPLETE','a distinct-position matching remains possible');
assert.equal(new Set(legal.lineup.map(r=>r.position)).size,9);
const p=fs.readFileSync(new URL('../server/api/magi/persona.js',import.meta.url),'utf8');
assert.match(p,/standardDefenseEligibility\.constrainedPositions/);
assert.match(p,/dual-position player used at LEFT cannot also fill THIRD or SHORT/);
assert.match(p,/BALTHASAR must verify the same nine/);
console.log('PASS: source-derived bottlenecks and one-to-one defensive coverage; no candidate is auto-changed');
