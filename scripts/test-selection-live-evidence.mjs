import assert from 'node:assert/strict';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence, shouldBuildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

const playersByName=Object.fromEntries(CURRENT_ROSTER.map((name,i)=>[name,{batting:{AVG:`.${String(200+i).padStart(3,'0')}`,OPS:`.${String(600+i*10).padStart(3,'0')}`},pitching:null}]));
const fakeAudit=async()=>({
  season:'current',seasonLabel:'2026-2027現チーム',source:{id:'master',name:'current-master.xlsm',path:'20_TEAM_DATA_チームデータ/...',modifiedTime:'2026-09-11T00:00:00Z'},
  extracted:{periodStart:'2026-08-02',periodEnd:'2026-09-10',playersByName}
});

assert.equal(shouldBuildCurrentSelectionEvidence('3番は誰がいい？',{players:[],domains:['LINEUP']}),true);
assert.equal(shouldBuildCurrentSelectionEvidence('大野 竜暉を3番にする？',{players:['大野 竜暉'],domains:['LINEUP']}),false);
assert.equal(shouldBuildCurrentSelectionEvidence('大野 竜暉のOPSは？',{players:['大野 竜暉'],domains:['BATTING']}),false);

const packet=await buildCurrentSelectionEvidence({question:'3番は誰がいい？',routed:{players:[],domains:['LINEUP']},auditProvider:fakeAudit});
assert.equal(packet.count,14);
assert.equal(packet.allCurrentTeamCheck.status,'COMPLETE');
assert.deepEqual(packet.allCurrentTeamCheck.players.map(x=>x.name),CURRENT_ROSTER);
assert.ok(packet.text.includes('【全14選手・打撃】'));
assert.ok(packet.text.includes('大野 竜暉'));
assert.ok(packet.text.includes('ここにない数値・役割・性格・将来結果は作らない'));
assert.equal(packet.sources[0].name,'current-master.xlsm');

const missingAudit=async()=>({seasonLabel:'current',source:{name:'x.xlsm'},extracted:{playersByName:{...playersByName}}});
delete (await missingAudit()).extracted.playersByName[CURRENT_ROSTER[0]];
const incomplete={...playersByName};delete incomplete[CURRENT_ROSTER[0]];
await assert.rejects(()=>buildCurrentSelectionEvidence({question:'4番は誰がいい？',routed:{players:[],domains:['LINEUP']},auditProvider:async()=>({extracted:{playersByName:incomplete}})}),/14名の正本確認が未完了/);

console.log('SELECTION LIVE EVIDENCE RESULT: PASS');
