import assert from 'node:assert/strict';
import { buildLiveAnswer } from '../server/api/magi/_live-answer.js';

const routed={route:'TEAM_LOOKUP',timeScope:'CURRENT_SEASON',players:[],domains:['TEAM'],understoodRequest:'指定期間のチーム成績'};
let auditCalls=0;
const noAudit=async()=>{auditCalls++;throw Error('season totals must not be used for a date filter')};
for(const q of [
 '丸岡中の2026年10月01日から2026年10月10日までのチーム試合成績を教えて',
 '丸岡中の2026-10-01から2026-10-10までのチーム試合成績を教えて'
]){
 const out=await buildLiveAnswer({question:q,routed,auditProvider:noAudit});
 assert.equal(out.route,'TEAM_LOOKUP');
 assert.equal(out.refusedToInvent,true);
 assert.equal(out.limitation,'TEAM_DATE_RANGE_NOT_YET_CONNECTED');
 assert.match(out.answer,/シーズン全体の勝敗で代用せず/);
}
assert.equal(auditCalls,0,'no season audit on a specified date range');
const normal=await buildLiveAnswer({
 question:'今季のチーム戦績を教えて',
 routed,
 auditProvider:async()=>({source:{name:'test-current-master.xlsm'},extracted:{team:{games:8,wins:3,losses:4,draws:1}}})
});
assert.equal(normal.refusedToInvent,false);
assert.match(normal.answer,/3勝4敗/);
console.log('TEAM DATE RANGE FAIL-CLOSED: 3/3 PASS (no Gemini, no Drive)');
