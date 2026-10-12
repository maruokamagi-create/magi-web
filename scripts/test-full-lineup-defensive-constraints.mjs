import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStandardDefenseEligibility, assignEvidenceGroundedFielding, buildEvidenceGroundedDefenseReconsideration } from '../server/api/magi/_lineup-fielding.js';
import { buildPersonaRequest } from '../server/api/magi/persona.js';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';

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
const packet={status:'COMPLETE',players:CURRENT_ROSTER.map(name=>({
  name,
  appearance:{officialStartingPositions:Object.fromEntries((historicalStarts[name]||[]).map(position=>[position,fixturePriority[name]===position?6:1])),practiceFirstStartingPositions:{}},
  fielding:{positions:{}}
}))};
const eligibility=buildStandardDefenseEligibility(packet);
assert.deepEqual(eligibility.constrainedPositions['捕'],['大野 竜暉']);
assert.deepEqual(eligibility.constrainedPositions['一'],['中嶋 玲月']);
assert.deepEqual(eligibility.constrainedPositions['二'],['坂田 暉馬']);
assert.deepEqual(eligibility.constrainedPositions['中'],['嶋田 栄志']);
assert.deepEqual(eligibility.constrainedPositions['左'],['井坂 悠聖','武田 晴琉翔']);
assert.equal(eligibility.constrainedPositions['右'],undefined,'three eligible right fielders are not an at-most-two bottleneck');
assert.equal(eligibility.globallyFeasible,true);
for(const name of ['大野 竜暉','中嶋 玲月','坂田 暉馬','嶋田 栄志','武田 晴琉翔']){
  assert.ok(eligibility.mandatoryPlayers.includes(name),name+' must appear in every legal standard nine');
}
assert.ok(!eligibility.mandatoryPlayers.includes('上村 蓮'),'eligible RF substitute is not universally required');

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

// The production CASPER-style invalid nine is never auto-replaced by MAGI.
// It receives exact, sourced alternatives only in the persona's next own turn.
const repair=buildEvidenceGroundedDefenseReconsideration(rejected,packet);
assert.equal(repair.status,'DEFENSE_RECONSIDERATION_REQUIRED');
assert.equal(repair.rejectedReason,'NO_COMPLETE_STANDARD_STARTING_MATCHING');
assert.deepEqual(repair.missingMandatory,['武田 晴琉翔']);
assert.ok(repair.onePlayerSwapExamples.some(x=>x.remove==='上村 蓮'&&x.add==='武田 晴琉翔'));
assert.deepEqual(rejected,['大久保 陽翔','大野 竜暉','中嶋 玲月','嶋田 栄志','坂田 暉馬','上村 蓮','橋向 結都','武澤 大翔','井坂 悠聖']);
assert.equal(buildEvidenceGroundedDefenseReconsideration(accepted,packet),null,'legal proposal stays untouched');
assert.equal(buildEvidenceGroundedDefenseReconsideration(rejected,{...packet,status:'PARTIAL'}),null,'partial evidence forbids suggestions');
assert.equal(buildEvidenceGroundedDefenseReconsideration(rejected,{...packet,players:packet.players.slice(1)}),null,'missing roster forbids suggestions');
assert.equal(buildEvidenceGroundedDefenseReconsideration([...rejected.slice(0,8),rejected[0]],packet),null,'duplicate nine is rejected');

const caseData={question:'今のベストオーダーを審議して',mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP',appearanceFielding:packet}};
const primary=buildPersonaRequest({case:caseData},'casper','PRIMARY').payload;
assert.ok(primary.standardDefenseEligibility.mandatoryPlayers.includes('武田 晴琉翔'));
const second=buildPersonaRequest({case:caseData,primarySelf:{candidatePlayers:rejected},crossExamination:{challenges:{casper:['守備の九位置が成立するか？']}}},'casper','SECOND').payload;
assert.ok(second.defenseReconsideration.onePlayerSwapExamples.some(x=>x.add==='武田 晴琉翔'));
assert.deepEqual(second.ownPrimaryJudgment.candidatePlayers,rejected);
assert.equal(buildPersonaRequest({case:caseData,primarySelf:{candidatePlayers:accepted}},'casper','SECOND').payload.defenseReconsideration,undefined);
assert.match(second.instruction,/defenseReconsideration/);
assert.match(primary.instruction,/mandatoryPlayers/);
const batchSource=fs.readFileSync(new URL('../server/api/magi/persona-batch.js',import.meta.url),'utf8');
assert.match(batchSource,/payload\.defenseReconsideration/,'single and batch SECOND both preserve persona-private hint');
const p=fs.readFileSync(new URL('../server/api/magi/persona.js',import.meta.url),'utf8');
assert.match(p,/standardDefenseEligibility\.constrainedPositions/);
assert.match(p,/dual-position player used at LEFT cannot also fill THIRD or SHORT/);
assert.match(p,/BALTHASAR must verify the same nine/);
console.log('PASS: 14-player mandatory inclusion and independent own-persona defense retry hints, no auto-changed lineup');
