import assert from 'node:assert/strict';
import { buildLiveAnswer } from '../server/api/magi/_live-answer.js';
import { buildStrictPitchingAnswer } from '../server/api/magi/_strict-pitching-answer.js';

const currentLive={
  sourceType:'XLSM_MASTER',source:{name:'current-master.xlsm',path:'CURRENT/00_MASTER/current-master.xlsm',modifiedTime:'2026-09-11T00:00:00Z'},parser:'test-live',seasonLabel:'2026-2027現チーム',
  extracted:{
    team:{games:12,wins:8,losses:3,draws:1,OPS:'.738',OBP:'.401',SLG:'.337'},
    playersByName:{
      '大久保 陽翔':{batting:{AVG:'.333',OPS:'.812',H:'12',RBI:'8',HR:'1'},pitching:{ERA:'3.10',IP:'9.0',SO:'11',BB:'4'}},
      '大野 竜暉':{batting:{AVG:'.278',OPS:'.924',H:'10',RBI:'7'},pitching:{ERA:'1.69',IP:'54.0',SO:'50',BB:'12',HBP:'3',APP:'14',WHIP:'0.98'}}
    }
  }
};
const oldLive={
  sourceType:'XLSM_MASTER',source:{name:'old-master.xlsm',path:'OLD/00_MASTER/old-master.xlsm',modifiedTime:'2026-07-31T00:00:00Z'},parser:'test-live',seasonLabel:'2025-2026旧チーム',
  extracted:{
    team:{games:46,wins:20,losses:23,draws:3,OPS:'.672',OBP:'.350',SLG:'.322'},
    playersByName:{
      '大久保 陽翔':{batting:{AVG:'.302',OPS:'.969',H:'30',RBI:'20'},pitching:{ERA:'3.63',IP:'56.0',SO:'58',BB:'20'}},
      '大野 竜暉':{batting:{AVG:'.293',OPS:'.801',H:'25',RBI:'18'},pitching:{ERA:'1.69',IP:'54.0',SO:'50',BB:'12',HBP:'2',APP:'18',WHIP:'0.95'}}
    }
  }
};
let liveCalls=[];
async function fakeLiveAudit({season}){liveCalls.push(season);return season==='old'?oldLive:currentLive;}

const strictCurrent={source:{name:'current-master.xlsm',path:'CURRENT/current-master.xlsm'},parser:'strict-test',stats:{ERA:'1.69',IP:'54.0',SO:'50',BB:'12',HBP:'3',APP:'14',WHIP:'0.98'},chosen:{row:10},candidateCount:1};
const strictOld={source:{name:'old-master.xlsm',path:'OLD/old-master.xlsm'},parser:'strict-test',stats:{ERA:'2.20',IP:'40.0',SO:'41',BB:'15',HBP:'2',APP:'12',WHIP:'1.10'},chosen:{row:20},candidateCount:1};
let strictCalls=[];
async function fakeStrictAudit({season}){strictCalls.push(season);return season==='old'?strictOld:strictCurrent;}

function route(type,players=['大野 竜暉'],timeScope='CURRENT_SEASON'){
  return {route:type,players,timeScope,routerVersion:'test-router',understoodRequest:'test'};
}
function includesAll(answer,values){for(const v of values) assert.ok(answer.includes(v),`missing ${v} in ${answer}`);}
function includesNone(answer,values){for(const v of values) assert.ok(!answer.includes(v),`unexpected ${v} in ${answer}`);}

const tests=[];
function test(name,fn){tests.push({name,fn});}

test('L01 batting single metric returns only AVG',async()=>{
  const r=await buildLiveAnswer({question:'大野竜暉の打率だけ教えて',routed:route('BATTING_LOOKUP'),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['.278']);includesNone(r.answer,['.924','安打10','打点7']);assert.equal(r.refusedToInvent,false);
});

test('L02 batting multi metric returns AVG and OPS',async()=>{
  const r=await buildLiveAnswer({question:'大野竜暉の打率とOPS教えて',routed:route('BATTING_LOOKUP'),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['.278','.924']);includesNone(r.answer,['安打10','打点7']);
});

test('L03 batting hits and RBI exact',async()=>{
  const r=await buildLiveAnswer({question:'大久保陽翔の安打と打点だけ',routed:route('BATTING_LOOKUP',['大久保 陽翔']),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['12','8']);includesNone(r.answer,['.333','.812']);
});

test('L04 missing batting metric refuses invention',async()=>{
  const modified=structuredClone(currentLive);delete modified.extracted.playersByName['大野 竜暉'].batting.OPS;
  const r=await buildLiveAnswer({question:'大野竜暉のOPS教えて',routed:route('BATTING_LOOKUP'),auditProvider:async()=>modified});
  assert.equal(r.refusedToInvent,true);assert.ok(/確認できません|数値は作りません/.test(r.answer));
});

test('L05 team wins/losses does not add draw',async()=>{
  const r=await buildLiveAnswer({question:'今季何勝何敗？',routed:route('TEAM_LOOKUP',[]),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['8勝','3敗']);includesNone(r.answer,['1分']);
});

test('L06 team full record includes draw when asked',async()=>{
  const r=await buildLiveAnswer({question:'今季の勝敗と引き分け全部教えて',routed:route('TEAM_LOOKUP',[]),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['8勝','3敗','1分']);
});

test('L07 team OPS exact',async()=>{
  const r=await buildLiveAnswer({question:'今季のチームOPSだけ教えて',routed:route('TEAM_LOOKUP',[]),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['.738']);includesNone(r.answer,['.401','.337','8勝']);
});

test('L08 old season uses old source',async()=>{
  liveCalls=[];
  const r=await buildLiveAnswer({question:'旧チームの陽翔のOPS教えて',routed:route('BATTING_LOOKUP',['大久保 陽翔'],'PREVIOUS_SEASON'),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['.969']);includesNone(r.answer,['.812']);assert.deepEqual(liveCalls,['old']);
});

test('L09 career batting refuses instead of silently using current',async()=>{
  liveCalls=[];
  const r=await buildLiveAnswer({question:'大野竜暉の通算OPS教えて',routed:route('BATTING_LOOKUP',['大野 竜暉'],'CAREER'),auditProvider:fakeLiveAudit});
  assert.equal(r.refusedToInvent,true);assert.equal(r.limitation,'CAREER_AGGREGATION_NOT_CONNECTED');assert.deepEqual(liveCalls,[]);
});

test('L10 overview exact four metrics',async()=>{
  const r=await buildLiveAnswer({question:'大野竜暉の打率・OPS・防御率・奪三振をまとめて',routed:route('PLAYER_OVERVIEW'),auditProvider:fakeLiveAudit});
  includesAll(r.answer,['.278','.924','1.69','50']);includesNone(r.answer,['54.0','与四球12']);
});

test('L11 player not unique refuses',async()=>{
  const r=await buildLiveAnswer({question:'2人のOPS教えて',routed:route('BATTING_LOOKUP',['大野 竜暉','大久保 陽翔']),auditProvider:fakeLiveAudit});
  assert.equal(r.refusedToInvent,true);assert.equal(r.limitation,'PLAYER_NOT_UNIQUE');
});

test('P01 pitching single ERA excludes extra metrics',async()=>{
  const r=await buildStrictPitchingAnswer({question:'大野竜暉の防御率だけ教えて',routed:route('PITCHING_LOOKUP'),auditProvider:fakeStrictAudit});
  includesAll(r.answer,['1.69']);includesNone(r.answer,['奪三振50','与四球12','投球回54.0']);
});

test('P02 pitching multi ERA and strikeouts',async()=>{
  const r=await buildStrictPitchingAnswer({question:'大野竜暉の防御率と奪三振教えて',routed:route('PITCHING_LOOKUP'),auditProvider:fakeStrictAudit});
  includesAll(r.answer,['1.69','50']);includesNone(r.answer,['投球回54.0','与四球12']);
});

test('P03 pitching strikeouts and walks exact',async()=>{
  const r=await buildStrictPitchingAnswer({question:'大野竜暉の奪三振と与四球だけ教えて',routed:route('PITCHING_LOOKUP'),auditProvider:fakeStrictAudit});
  includesAll(r.answer,['50','12']);includesNone(r.answer,['防御率1.69','投球回54.0']);
});

test('P04 pitching HBP supported',async()=>{
  const r=await buildStrictPitchingAnswer({question:'大野竜暉の与死球教えて',routed:route('PITCHING_LOOKUP'),auditProvider:fakeStrictAudit});
  includesAll(r.answer,['3']);includesNone(r.answer,['防御率1.69','奪三振50']);
});

test('P05 missing pitching metric refuses invention',async()=>{
  const noWhip={...strictCurrent,stats:{...strictCurrent.stats}};delete noWhip.stats.WHIP;
  const r=await buildStrictPitchingAnswer({question:'大野竜暉のWHIP教えて',routed:route('PITCHING_LOOKUP'),auditProvider:async()=>noWhip});
  assert.equal(r.refusedToInvent,true);assert.ok(/確認できません|数値は作りません/.test(r.answer));
});

test('P06 old pitching uses old season',async()=>{
  strictCalls=[];
  const r=await buildStrictPitchingAnswer({question:'旧チームの大野竜暉の防御率教えて',routed:route('PITCHING_LOOKUP',['大野 竜暉'],'PREVIOUS_SEASON'),auditProvider:fakeStrictAudit});
  includesAll(r.answer,['2.20']);includesNone(r.answer,['1.69']);assert.deepEqual(strictCalls,['old']);
});

test('P07 career pitching refuses instead of current fallback',async()=>{
  strictCalls=[];
  const r=await buildStrictPitchingAnswer({question:'大野竜暉の通算防御率教えて',routed:route('PITCHING_LOOKUP',['大野 竜暉'],'CAREER'),auditProvider:fakeStrictAudit});
  assert.equal(r.refusedToInvent,true);assert.equal(r.limitation,'CAREER_PITCHING_AGGREGATION_NOT_CONNECTED');assert.deepEqual(strictCalls,[]);
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`LIVE ANSWER UNIT RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exit(1);
