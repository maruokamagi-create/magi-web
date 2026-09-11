import assert from 'node:assert/strict';
import {
  isSelectionCase,
  deterministicFinal,
  buildSelectionResult,
  buildFinalResult
} from '../server/api/magi/orchestrate.js';

const tests=[];
function test(name,fn){tests.push({name,fn});}
function persona(persona,judgment,overrides={}){
  return {
    persona,
    phase:'SECOND',
    checkedPlayers:[],
    candidatePlayers:[],
    candidateBasis:'test',
    facts:[],analysis:[],prediction:[],
    confidence:'HIGH',judgment,
    primaryReason:`${persona} reason`,
    publicStatement:`${persona} statement`,
    warnings:[],dataConflict:false,reviewRequested:false,reviewReason:'',
    changedFromPrimary:false,changeReason:'',
    ...overrides
  };
}

// Selection intent detection must distinguish "choose someone" from "evaluate this proposal".
test('S01 3番だれがいい is selection',()=>assert.equal(isSelectionCase({question:'3番だれがいい？'}),true));
test('S02 starter who is selection',()=>assert.equal(isSelectionCase({question:'次の試合、誰を先発にする？'}),true));
test('S03 closer who is selection',()=>assert.equal(isSelectionCase({question:'クローザー誰がいい？'}),true));
test('S04 defensive position choice is selection',()=>assert.equal(isSelectionCase({question:'レフトは誰が最適？'}),true));
test('S05 explicit closer proposal is not candidate selection',()=>assert.equal(isSelectionCase({question:'大野をクローザー固定どう？'}),false));
test('S06 explicit mode selection always wins',()=>assert.equal(isSelectionCase({mode:'selection',question:'候補を考えて'}),true));

// Deterministic vote protocol.
test('F01 3 GREEN becomes consensus 3-0',()=>{
  const r=deterministicFinal([persona('MELCHIOR','GREEN'),persona('BALTHASAR','GREEN'),persona('CASPER','GREEN')]);
  assert.equal(r.status,'MAGI_CONSENSUS');assert.equal(r.vote,'3-0');
});
test('F02 BLUE BLUE RED becomes majority 2-1',()=>{
  const r=deterministicFinal([persona('MELCHIOR','BLUE'),persona('BALTHASAR','BLUE'),persona('CASPER','RED')]);
  assert.equal(r.status,'MAGI_MAJORITY');assert.equal(r.vote,'2-1');
});
test('F03 GREEN BLUE RED becomes deadlock',()=>{
  const r=deterministicFinal([persona('MELCHIOR','GREEN'),persona('BALTHASAR','BLUE'),persona('CASPER','RED')]);
  assert.equal(r.status,'MAGI_DEADLOCK');assert.equal(r.vote,'1-1-1');
});
test('F04 all YELLOW becomes insufficient evidence',()=>{
  const r=deterministicFinal([persona('MELCHIOR','YELLOW'),persona('BALTHASAR','YELLOW'),persona('CASPER','YELLOW')]);
  assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.vote,'YELLOW-YELLOW-YELLOW');
});
test('F05 reviewRequested overrides majority',()=>{
  const r=deterministicFinal([
    persona('MELCHIOR','GREEN'),
    persona('BALTHASAR','GREEN',{reviewRequested:true,reviewReason:'重大な前提不足'}),
    persona('CASPER','RED')
  ]);
  assert.equal(r.status,'MAGI_REVIEW_REQUIRED');assert.equal(r.reviewReason,'重大な前提不足');
});
test('F06 MELCHIOR data conflict requires review',()=>{
  const r=deterministicFinal([
    persona('MELCHIOR','BLUE',{dataConflict:true}),
    persona('BALTHASAR','BLUE'),
    persona('CASPER','BLUE')
  ]);
  assert.equal(r.status,'MAGI_REVIEW_REQUIRED');
});

// Final proposal rendering must preserve minority and lowest confidence.
test('R01 minority opinion and lowest confidence survive finalization',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{confidence:'HIGH',primaryReason:'数値面では条件付き'}),
    balthasar:persona('BALTHASAR','BLUE',{confidence:'MEDIUM',primaryReason:'勝ち筋はある'}),
    casper:persona('CASPER','RED',{confidence:'LOW',primaryReason:'役割集中が大きい'})
  };
  const r=buildFinalResult(second,{warnings:['負担確認'],informationGaps:['直近起用状況']});
  assert.equal(r.status,'MAGI_MAJORITY');
  assert.equal(r.vote,'2-1');
  assert.equal(r.confidence,'LOW');
  assert.match(r.minorityOpinion,/CASPER/);
  assert.match(r.minorityOpinion,/役割集中/);
  assert.ok(r.reDeliberationConditions.includes('直近起用状況'));
  assert.ok(r.reDeliberationConditions.includes('負担確認'));
});

test('R02 consensus recommendation follows majority judgment',()=>{
  const r=buildFinalResult({
    melchior:persona('MELCHIOR','GREEN'),
    balthasar:persona('BALTHASAR','GREEN'),
    casper:persona('CASPER','GREEN')
  },{});
  assert.equal(r.status,'MAGI_CONSENSUS');
  assert.match(r.recommendation,/賛成判断/);
});

// Selection aggregation: no hard-coded clean-up wording, preserve split/review states.
test('C01 shared top candidate produces selection result',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['大野 竜暉','橋向 結都']}),
    balthasar:persona('BALTHASAR','GREEN',{candidatePlayers:['大野 竜暉','大久保 陽翔']}),
    casper:persona('CASPER','BLUE',{confidence:'MEDIUM',candidatePlayers:['橋向 結都','大野 竜暉']})
  };
  const r=buildSelectionResult(second,{warnings:[],informationGaps:[]});
  assert.equal(r.status,'SELECTION_RESULT');
  assert.ok(r.centerCandidates.includes('大野 竜暉'));
  assert.match(r.recommendation,/中心候補/);
  assert.doesNotMatch(r.recommendation,/クリーンナップ/);
});

test('C02 totally split candidates stay selection split',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['大野 竜暉']}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['大久保 陽翔']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.equal(r.status,'SELECTION_SPLIT');
  assert.deepEqual(r.centerCandidates,[]);
  assert.match(r.recommendation,/各賢人の上位候補/);
  assert.doesNotMatch(r.recommendation,/クリーンナップ/);
});

test('C03 review request blocks candidate finalization',()=>{
  const second={
    melchior:persona('MELCHIOR','YELLOW',{candidatePlayers:['大野 竜暉'],reviewRequested:true,reviewReason:'成績表の値が矛盾'}),
    balthasar:persona('BALTHASAR','GREEN',{candidatePlayers:['大野 竜暉']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.equal(r.status,'SELECTION_REVIEW_REQUIRED');
  assert.deepEqual(r.centerCandidates,[]);
  assert.match(r.reviewReason,/矛盾/);
});

test('C04 non-current candidate name is filtered from selection arrays',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['宮嵜 翔','大野 竜暉']}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['大野 竜暉']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.ok(!r.recommendedCandidates.includes('宮嵜 翔'));
  assert.ok(!r.alternateCandidates.includes('宮嵜 翔'));
  assert.ok(r.recommendedCandidates.includes('大野 竜暉'));
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){
    console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;
  }
}
console.log(`DELIBERATION FINAL UNIT RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exit(1);
