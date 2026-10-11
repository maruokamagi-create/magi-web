import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildConsensusLineup } from '../server/api/magi/_full-lineup.js';
import { buildLineupDeadlockComparison } from '../server/api/magi/_lineup-deadlock-comparison.js';

const sameNine=['大久保 陽翔','大野 竜暉','中嶋 玲月','嶋田 栄志','坂田 暉馬','井坂 悠聖','橋向 結都','武澤 大翔','武田 晴琉翔'];
const orders={
  melchior:sameNine,
  balthasar:['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','橋向 結都','武澤 大翔','井坂 悠聖','武田 晴琉翔'],
  casper:['大久保 陽翔','嶋田 栄志','中嶋 玲月','大野 竜暉','坂田 暉馬','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔']
};
const positions={
  '大久保 陽翔':'遊','大野 竜暉':'捕','中嶋 玲月':'一',
  '嶋田 栄志':'中','坂田 暉馬':'二','井坂 悠聖':'三',
  '橋向 結都':'投','武澤 大翔':'右','武田 晴琉翔':'左'
};
const packet={status:'COMPLETE',players:sameNine.map(name=>({
  name,
  appearance:{officialStartingPositions:{[positions[name]]:2},practiceFirstStartingPositions:{}},
  fielding:{positions:{[positions[name]]:2}}
}))};
const second=Object.fromEntries(Object.entries(orders).map(([key,order])=>[key,{
  persona:key.toUpperCase(),candidatePlayers:order,primaryReason:'確認済み記録を比較しました。',
  warnings:[],reviewRequested:false,dataConflict:false,confidence:'MEDIUM'
}]));
const consensus=buildConsensusLineup(second);
const result={
  status:consensus.decisionStatus==='DEADLOCK'?'LINEUP_REVIEW_REQUIRED':'LINEUP_RESULT',
  finalVote:consensus.finalVote,
  deliberationDecision:consensus.decisionStatus,
  lineup:consensus.lineup,
  fieldingStatus:'NOT_EVALUATED',
  deadlockComparison:buildLineupDeadlockComparison(second,packet)
};
const orchestrate=fs.readFileSync(new URL('../server/api/magi/orchestrate.js',import.meta.url),'utf8');
assert.match(orchestrate,/if\(consensus\.decisionStatus==='DEADLOCK'\)/);
assert.match(orchestrate,/deadlockComparison:buildLineupDeadlockComparison\(normalizedSecond,caseData\?\.evidence\?\.appearanceFielding\)/);
assert.match(orchestrate,/lineup:\[\],\s*battingOrder:\[\]/,'deadlock final MUST retain an empty lineup');
assert.equal(result.status,'LINEUP_REVIEW_REQUIRED');
assert.equal(result.finalVote,'1-1-1');
assert.equal(result.deliberationDecision,'DEADLOCK');
assert.deepEqual(result.lineup,[],'a deadlock never fabricates a selected final batting order');
assert.equal(result.fieldingStatus,'NOT_EVALUATED','only the unselected FINAL lineup is not evaluated');

const comparison=result.deadlockComparison;
assert.equal(comparison.status,'COMPARISON_ONLY');
assert.equal(comparison.allNinePlayersShared,true);
assert.deepEqual(comparison.sharedSlots,[3,9]);
assert.ok(comparison.disputedSlots.includes(1));
assert.equal(comparison.slots.length,9);
assert.equal(comparison.proposals.balthasar.order[0],'大野 竜暉');
for(const key of Object.keys(orders)){
  const p=comparison.proposals[key];
  assert.equal(p.order.length,9);
  assert.equal(p.fieldingStatus,'COMPLETE');
  assert.equal(new Set(p.positions.map(x=>x.position)).size,9);
  assert.equal(p.positions.length,9);
}
assert.equal(buildLineupDeadlockComparison({...second,casper:{...second.casper,candidatePlayers:second.melchior.candidatePlayers}},packet),null,'identical orders are not 1-1-1');
assert.equal(buildLineupDeadlockComparison({...second,casper:{...second.casper,candidatePlayers:['未登録',...second.casper.candidatePlayers.slice(1)]}},packet),null,'unknown players are never accepted');
const incomplete={...packet,players:packet.players.filter(x=>x.name!=='武田 晴琉翔')};
const unresolved=buildLineupDeadlockComparison(second,incomplete);
assert.equal(unresolved.proposals.melchior.fieldingStatus,'UNRESOLVED');
assert.deepEqual(unresolved.proposals.melchior.positions,[],'no defensive positions are invented');
const noSource=buildLineupDeadlockComparison(second,null);
assert.equal(noSource.proposals.balthasar.fieldingStatus,'UNAVAILABLE');
assert.deepEqual(noSource.proposals.balthasar.positions,[]);

const browserScript=fs.readFileSync(new URL('../lineup-reasons-v415.js',import.meta.url),'utf8');
const ui={};
const document={readyState:'loading',addEventListener(){},documentElement:{}};
vm.runInNewContext(browserScript,{
  window:ui,document,
  MutationObserver:class{observe(){}},
  setInterval(){return 0},
  console
});
const api=ui.MAGI_LINEUP_REASONS_V415_API;
assert.ok(api&&typeof api.deadlockFullProposalsHtml==='function');
const entries=Object.entries(orders).map(([key,order])=>({key,label:key.toUpperCase(),order}));
const html=api.deadlockFullProposalsHtml({final:{deadlockComparison:comparison}},entries);
assert.match(html,/3案を比較（採用オーダーではありません）/);
assert.match(html,/3案とも選手9人は共通/);
assert.equal((html.match(/magiDeadlockProposal"/g)||[]).length,3);
assert.equal((html.match(/class="slot"/g)||[]).length,27);
assert.match(html,/守備9位置の実績照合：成立/);
assert.ok(!html.includes('最終オーダーを採用'));
const htmlWithoutPacket=api.deadlockFullProposalsHtml({final:{}},entries);
assert.equal(htmlWithoutPacket,'','unverified result must not invent source-backed proposal comparison');
console.log('PASS: deadlock comparison preserves three proposals, individual fielding proof, and no adopted lineup');
