import assert from 'node:assert/strict';
import { normalizeModel } from '../server/api/magi/_semantic-authority.js';
import { routedFromSemantic } from '../server/api/magi/core.js';
import { buildLiveAnswer } from '../server/api/magi/_live-answer.js';

function input(overrides={}){
  return {
    mode:'SINGLE_VALUE', confidence:'HIGH', understoodRequest:'チームの成績を調べる',
    routeReason:'明確なチーム全体の成績', players:[], domains:['TEAM','BATTING'],
    timeScope:'CURRENT_SEASON', specificSeason:'', metric:'OPS',opponent:'',
    breakdowns:[], selectionKind:'NONE', clarificationQuestion:'',needsData:true,
    ...overrides
  };
}
const teamLive={
  sourceType:'XLSM_MASTER',source:{name:'current-master.xlsm',path:'CURRENT/current-master.xlsm'},
  parser:'test-team-aggregate',seasonLabel:'2026-2027現チーム',
  extracted:{team:{games:12,wins:8,losses:3,draws:1,OPS:'.738',OBP:'.401',SLG:'.337'},playersByName:{}}
};
async function answer(question,semantic){
  let auditCalls=[];
  const result=await buildLiveAnswer({
    question,routed:routedFromSemantic(semantic),
    auditProvider:async args=>{auditCalls.push(args);return teamLive;}
  });
  return {result,auditCalls};
}

{
  const semantic=normalizeModel(input(),'今季のチームOPSだけ教えて',[]);
  assert.equal(semantic.mode,'SINGLE_VALUE','team aggregates must not request a player name');
  assert.equal(semantic.teamAggregate,true);
  assert.equal(routedFromSemantic(semantic).route,'TEAM_LOOKUP');
  const {result,auditCalls}=await answer('今季のチームOPSだけ教えて',semantic);
  assert.ok(result.answer.includes('.738'),result.answer);
  assert.equal(result.refusedToInvent,false);
  assert.equal(auditCalls.length,1);
  assert.deepEqual(auditCalls[0].players,[]);
}
{
  const semantic=normalizeModel(input({
    mode:'SUMMARY',domains:['TEAM'],metric:'',understoodRequest:'今季の勝敗を確認する'
  }),'今季のチームは何勝何敗？',[]);
  assert.equal(semantic.mode,'SUMMARY');
  assert.equal(routedFromSemantic(semantic).route,'TEAM_LOOKUP');
  const {result}=await answer('今季のチームは何勝何敗？',semantic);
  assert.ok(result.answer.includes('8勝')&&result.answer.includes('3敗'),result.answer);
}
{
  const semantic=normalizeModel(input({
    players:['大野 竜暉'],understoodRequest:'大野 竜暉の打率を調べる',metric:'AVG'
  }),'大野 竜暉の打率を教えて',[]);
  assert.equal(semantic.mode,'SINGLE_VALUE');
  assert.equal(semantic.teamAggregate,undefined);
  assert.equal(routedFromSemantic(semantic).route,'BATTING_LOOKUP');
}
{
  const semantic=normalizeModel(input({domains:['BATTING'],players:[]}),
    'OPSだけ教えて',[]);
  assert.equal(semantic.mode,'CLARIFY','a stat with no named player or TEAM target stays ambiguous');
}
{
  const semantic=normalizeModel(input({mode:'FULL_REPORT'}),'今季のチーム打撃成績一覧を出して',[]);
  assert.equal(semantic.mode,'CLARIFY','do not claim support for an unimplemented full team report');
}
{
  const semantic=normalizeModel(input({mode:'SINGLE_VALUE',domains:['BATTING','TEAM'],
    players:[],confidence:'LOW'}),'チームOPSを教えて',[]);
  assert.equal(semantic.mode,'CLARIFY','semantic confidence gate remains authoritative');
}

{
  // A temporal adjective such as 「今の」 is not a reference to the person
  // mentioned in an earlier turn when the new question names the team.
  const context=[{role:'user',text:'大野 竜暉の打率は？'}];
  const semantic=normalizeModel(input(),'今のチームOPSだけ教えて',context);
  assert.equal(semantic.teamAggregate,true);
  assert.equal(semantic.mode,'SINGLE_VALUE');
  assert.deepEqual(semantic.players,[]);
  assert.equal(routedFromSemantic(semantic).route,'TEAM_LOOKUP');
  const {result}=await answer('今のチームOPSだけ教えて',semantic);
  assert.ok(result.answer.includes('.738'));
}
{
  const context=[{role:'user',text:'嶋田 栄志の打撃成績は？'}];
  const semantic=normalizeModel(input({mode:'SUMMARY',domains:['TEAM'],metric:''}), '今のチームは何勝何敗？',context);
  assert.equal(semantic.teamAggregate,true);
  assert.equal(routedFromSemantic(semantic).route,'TEAM_LOOKUP');
}
{
  // Genuine anaphora must still resolve to the preceding named individual.
  const context=[{role:'user',text:'大野 竜暉について教えて'}];
  const semantic=normalizeModel(input({players:['大野 竜暉'],domains:['BATTING'],metric:'AVG'}),'その選手の今季打率は？',context);
  assert.equal(semantic.teamAggregate,undefined);
  assert.equal(semantic.mode,'SINGLE_VALUE');
  assert.deepEqual(semantic.players,['大野 竜暉']);
  assert.equal(routedFromSemantic(semantic).route,'BATTING_LOOKUP');
}
{
  // TEAM in a model response cannot override an unresolved anaphoric target.
  const context=[{role:'user',text:'大野 竜暉について教えて'}];
  const semantic=normalizeModel(input(),'その選手のチームOPSを教えて',context);
  assert.equal(semantic.mode,'CLARIFY');
}

console.log('SEMANTIC TEAM AGGREGATE ROUTING: 10/10 PASS');
