import assert from 'node:assert/strict';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildConsensusLineup, isFullLineupQuestion, validateFullLineupOrder } from '../server/api/magi/_full-lineup.js';
import { buildFullLineupResult, isSelectionCase } from '../server/api/magi/orchestrate.js';
import { buildCurrentSelectionEvidence, selectionEvidenceKind } from '../server/api/magi/_selection-live-evidence.js';

const tests=[];function test(name,fn){tests.push({name,fn});}
const L1=['武澤 大翔','嶋田 栄志','大野 竜暉','大久保 陽翔','中嶋 玲月','長侶 穹','井坂 悠聖','坂田 暉馬','武田 晴琉翔'];
const L2=['嶋田 栄志','武澤 大翔','大野 竜暉','大久保 陽翔','中嶋 玲月','井坂 悠聖','長侶 穹','武田 晴琉翔','坂田 暉馬'];
const L3=['武澤 大翔','嶋田 栄志','大久保 陽翔','大野 竜暉','中嶋 玲月','長侶 穹','坂田 暉馬','井坂 悠聖','武田 晴琉翔'];

function persona(persona,order){return {persona,phase:'SECOND',checkedPlayers:CURRENT_ROSTER.slice(),candidatePlayers:order,candidateBasis:'テスト',facts:[],analysis:[],prediction:[],confidence:'MEDIUM',judgment:'BLUE',primaryReason:`${persona}の打順案`,publicStatement:'打順案',warnings:[],dataConflict:false,reviewRequested:false,reviewReason:'',changedFromPrimary:false,changeReason:''};}
const SECOND={melchior:persona('MELCHIOR',L1),balthasar:persona('BALTHASAR',L2),casper:persona('CASPER',L3)};
const SECOND_MAJORITY={melchior:persona('MELCHIOR',L1),balthasar:persona('BALTHASAR',L1),casper:persona('CASPER',L3)};
const SECOND_CONSENSUS={melchior:persona('MELCHIOR',L1),balthasar:persona('BALTHASAR',L1),casper:persona('CASPER',L1)};
const CROSS={agreement:['中軸候補の一部は共通する。'],disagreement:['1番と2番の並びで意見が分かれる。'],domainConflicts:[],warnings:[],informationGaps:[],challenges:{melchior:['バルタザールの1番案は現在データで裏付けられるか。'],balthasar:['メルキオールの並びは得点の流れとしてどう勝ちに行く。'],casper:['二人の案で役割集中は起きないか。']}};

const SYNTHETIC_POSITIONS=['投','捕','一','二','三','遊','左','中','右'];
const SYNTHETIC_FIELDING_CASE={evidence:{appearanceFielding:{
  status:'COMPLETE',
  players:L1.map((name,i)=>({
    name,
    appearance:{
      officialStartingPositions:{[SYNTHETIC_POSITIONS[i]]:1},
      practiceFirstStartingPositions:{},
      startingPositions:{[SYNTHETIC_POSITIONS[i]]:1},
      recentStartingPositions:{[SYNTHETIC_POSITIONS[i]]:1}
    },
    fielding:{positions:{[SYNTHETIC_POSITIONS[i]]:1}}
  }))
}}};
const SUBSTITUTE_ONLY_FIELDING_CASE={evidence:{appearanceFielding:{
  status:'COMPLETE',
  players:L1.map((name,i)=>({
    name,
    appearance:{
      officialStartingPositions:{},
      practiceFirstStartingPositions:{},
      startingPositions:{[SYNTHETIC_POSITIONS[i]]:1},
      recentStartingPositions:{},
      practiceSecondStartingPositions:{[SYNTHETIC_POSITIONS[i]]:1}
    },
    fielding:{positions:{[SYNTHETIC_POSITIONS[i]]:2}}
  }))
}}};

test('L01 full lineup wording is detected',()=>{
  assert.equal(isFullLineupQuestion('ベストオーダー組んで'),true);
  assert.equal(isFullLineupQuestion('次の試合の打順どうする？'),true);
  assert.equal(isFullLineupQuestion('3番は誰がいい？'),false);
  assert.equal(isSelectionCase({question:'ベストオーダー組んで'}),true);
});

test('L02 exactly nine unique current players are required',()=>{
  assert.equal(validateFullLineupOrder(L1).ok,true);
  assert.equal(validateFullLineupOrder([...L1.slice(0,8),L1[0]]).ok,false);
  assert.equal(validateFullLineupOrder([...L1.slice(0,8),'宮嵜 翔']).ok,false);
});

test('L03 three distinct second-round lineups remain 1-1-1 DEADLOCK',()=>{
  const result=buildConsensusLineup(SECOND);
  assert.ok(result);
  assert.equal(result.decisionStatus,'DEADLOCK');
  assert.equal(result.finalVote,'1-1-1');
  assert.equal(result.lineup.length,0);
  assert.equal(result.selectedFromPersona,'');
  assert.equal(result.proposalGroups.length,3);
  assert.ok(result.slotConflicts.length>0);
});

test('L04 2-1 majority produces one actual second-round lineup and preserves minority',()=>{
  const result=buildFullLineupResult(SECOND_MAJORITY,CROSS,SYNTHETIC_FIELDING_CASE);
  assert.equal(result.mode,'FULL_LINEUP');
  assert.equal(result.status,'LINEUP_RESULT');
  assert.equal(result.fieldingStatus,'COMPLETE');
  assert.equal(result.deliberationDecision,'MAJORITY');
  assert.equal(result.finalVote,'2-1');
  assert.equal(result.minorityPersonas.length,1);
  assert.equal(result.lineup.length,9);
  assert.equal(new Set(result.lineup.map(x=>x.position)).size,9);
  assert.equal(Object.keys(result.personaLineups).length,3);
  assert.ok(result.crossDiscussion.challenges.melchior.length>0);
  assert.ok(result.crossDiscussion.challenges.balthasar.length>0);
  assert.ok(result.crossDiscussion.challenges.casper.length>0);
  assert.ok(!result.recommendation.includes('宮嵜 翔'));
});

test('L05 1-1-1 full-lineup final fails closed before fielding',()=>{
  const result=buildFullLineupResult(SECOND,CROSS,SYNTHETIC_FIELDING_CASE);
  assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
  assert.equal(result.deliberationDecision,'DEADLOCK');
  assert.equal(result.finalVote,'1-1-1');
  assert.equal(result.fieldingStatus,'NOT_EVALUATED');
  assert.equal(result.lineup.length,0);
  assert.equal(result.reviewReason,'FULL_LINEUP_DEADLOCK_1_1_1');
});

test('L06 3-0 consensus is explicit and produces the agreed order',()=>{
  const result=buildFullLineupResult(SECOND_CONSENSUS,CROSS,SYNTHETIC_FIELDING_CASE);
  assert.equal(result.status,'LINEUP_RESULT');
  assert.equal(result.deliberationDecision,'CONSENSUS');
  assert.equal(result.finalVote,'3-0');
  assert.deepEqual(result.lineup.map(x=>x.name),L1);
});

test('L07 substitute-only or practice-game-two defense does not establish a standard starting position',()=>{
  const result=buildFullLineupResult(SECOND_MAJORITY,CROSS,SUBSTITUTE_ONLY_FIELDING_CASE);
  assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
  assert.equal(result.fieldingStatus,'UNRESOLVED');
  assert.equal(result.lineup.length,0);
  assert.match(result.fieldingReason,/STANDARD_START/);
});

test('L08 missing fielding evidence fails closed instead of inventing positions',()=>{
  const result=buildFullLineupResult(SECOND_MAJORITY,CROSS);
  assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
  assert.equal(result.fieldingStatus,'UNAVAILABLE');
  assert.equal(result.lineup.length,0);
  assert.equal(result.battingOrder.length,9);
});

test('L09 incomplete second-round order fails closed',()=>{
  const broken={...SECOND_MAJORITY,casper:{...SECOND_MAJORITY.casper,candidatePlayers:L3.slice(0,8)}};
  const result=buildFullLineupResult(broken,CROSS);
  assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
  assert.equal(result.lineup.length,0);
});

test('L10 live evidence marks full lineup and keeps old team reference-only',async()=>{
  const currentPlayers=Object.fromEntries(CURRENT_ROSTER.map((name,i)=>[name,{batting:{AVG:`.${String(200+i).padStart(3,'0')}`,OPS:`.${String(600+i*10).padStart(3,'0')}`},pitching:null}]));
  const oldPlayers={...currentPlayers,'宮嵜 翔':{batting:{AVG:'.999',OPS:'1.999'}}};
  const provider=async({season})=>season==='current'
    ? {seasonLabel:'2026-2027現チーム',source:{name:'current.xlsm'},extracted:{periodStart:'2026-08-01',periodEnd:'2026-09-10',playersByName:currentPlayers}}
    : {seasonLabel:'2025-2026旧チーム',source:{name:'old.xlsm'},extracted:{periodStart:'2025-08-01',periodEnd:'2026-07-31',playersByName:oldPlayers}};
  assert.equal(selectionEvidenceKind('ベストオーダー組んで',{players:[],domains:['LINEUP']}),'FULL_LINEUP');
  const packet=await buildCurrentSelectionEvidence({question:'ベストオーダー組んで',routed:{players:[],domains:['LINEUP']},auditProvider:provider});
  assert.equal(packet.selectionKind,'FULL_LINEUP');
  assert.equal(packet.primarySeason,'current');
  assert.equal(packet.historicalReference.candidateEligible,false);
  assert.equal(packet.allCurrentTeamCheck.players.length,14);
  assert.ok(packet.text.includes('3賢人は独立して全打順を作り'));
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`FULL LINEUP SELECTION RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);
