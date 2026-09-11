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
const CROSS={agreement:['中軸候補の一部は共通する。'],disagreement:['1番と2番の並びで意見が分かれる。'],domainConflicts:[],warnings:[],informationGaps:[],challenges:{melchior:['バルタザールの1番案は現在データで裏付けられるか。'],balthasar:['メルキオールの並びは得点の流れとしてどう勝ちに行く。'],casper:['二人の案で役割集中は起きないか。']}};

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

test('L03 consensus lineup preserves nine unique current players',()=>{
  const result=buildConsensusLineup(SECOND);
  assert.ok(result);
  assert.equal(result.lineup.length,9);
  assert.equal(new Set(result.lineup.map(x=>x.name)).size,9);
  assert.ok(result.lineup.every(x=>CURRENT_ROSTER.includes(x.name)));
  assert.ok(result.slotConflicts.length>0);
});

test('L04 final result exposes full lineup and three-sage cross discussion',()=>{
  const result=buildFullLineupResult(SECOND,CROSS);
  assert.equal(result.mode,'FULL_LINEUP');
  assert.equal(result.status,'LINEUP_RESULT');
  assert.equal(result.lineup.length,9);
  assert.equal(Object.keys(result.personaLineups).length,3);
  assert.ok(result.crossDiscussion.challenges.melchior.length>0);
  assert.ok(result.crossDiscussion.challenges.balthasar.length>0);
  assert.ok(result.crossDiscussion.challenges.casper.length>0);
  assert.ok(!result.recommendation.includes('宮嵜 翔'));
});

test('L05 incomplete second-round order fails closed',()=>{
  const broken={...SECOND,casper:{...SECOND.casper,candidatePlayers:L3.slice(0,8)}};
  const result=buildFullLineupResult(broken,CROSS);
  assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
  assert.equal(result.lineup.length,0);
});

test('L06 live evidence marks full lineup and keeps old team reference-only',async()=>{
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
