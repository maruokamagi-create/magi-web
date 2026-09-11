import assert from 'node:assert/strict';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence, shouldBuildCurrentSelectionEvidence, selectionEvidenceKind } from '../server/api/magi/_selection-live-evidence.js';

const currentPlayers=Object.fromEntries(CURRENT_ROSTER.map((name,i)=>[name,{
  batting:{AVG:`.${String(200+i).padStart(3,'0')}`,OPS:`.${String(600+i*10).padStart(3,'0')}`,AB:String(8+i)},
  pitching:i<4?{APP:String(i+1),ERA:`${(1.2+i/10).toFixed(2)}`,IP:`${4+i}.0`,SO:String(5+i)}:null
}]));
const oldPlayers=Object.fromEntries(CURRENT_ROSTER.map((name,i)=>[name,{
  batting:{AVG:`.${String(180+i).padStart(3,'0')}`,OPS:`.${String(550+i*10).padStart(3,'0')}`,AB:String(18+i)},
  pitching:i<5?{APP:String(i+2),ERA:`${(1.5+i/10).toFixed(2)}`,IP:`${8+i}.0`,SO:String(8+i)}:null
}]));

const calls=[];
const fakeAudit=async({season})=>{
  calls.push(season);
  if(season==='old') return {
    season:'old',seasonLabel:'2025-2026旧チーム',source:{id:'old-master',name:'old-master.xlsm',path:'20_TEAM_DATA_チームデータ/...old',modifiedTime:'2026-07-31T00:00:00Z'},
    extracted:{periodStart:'2025-08-01',periodEnd:'2026-07-31',playersByName:oldPlayers}
  };
  return {
    season:'current',seasonLabel:'2026-2027現チーム',source:{id:'current-master',name:'current-master.xlsm',path:'20_TEAM_DATA_チームデータ/...current',modifiedTime:'2026-09-11T00:00:00Z'},
    extracted:{periodStart:'2026-08-02',periodEnd:'2026-09-10',playersByName:currentPlayers}
  };
};

assert.equal(selectionEvidenceKind('1番は誰がいい？',{players:[],domains:['LINEUP']}),'BATTING_ORDER');
assert.equal(selectionEvidenceKind('2番どう組む？',{players:[],domains:['LINEUP']}),'BATTING_ORDER');
assert.equal(selectionEvidenceKind('5番は誰がいい？',{players:[],domains:['LINEUP']}),'BATTING_ORDER');
assert.equal(selectionEvidenceKind('ベストオーダーを組んで',{players:[],domains:['LINEUP']}),'FULL_LINEUP');
assert.equal(selectionEvidenceKind('7回制の投手運用を先発→第2投手→終盤→クローザーで組んで',{players:[],domains:['PITCHING','TACTICS']}),'PITCHING_PLAN');
assert.equal(selectionEvidenceKind('投手リレーどう組む？',{players:[],domains:['PITCHING','TACTICS']}),'PITCHING_PLAN');
assert.equal(selectionEvidenceKind('継投どうする？',{players:[],domains:['PITCHING','TACTICS']}),'PITCHING_PLAN');
assert.equal(selectionEvidenceKind('先発投手は誰がいい？',{players:[],domains:['PITCHING']}),'PITCHING_ROLE');
assert.equal(selectionEvidenceKind('クローザーは誰がいい？',{players:[],domains:['PITCHING']}),'PITCHING_ROLE');
assert.equal(shouldBuildCurrentSelectionEvidence('3番は誰がいい？',{players:[],domains:['LINEUP']}),true);
assert.equal(shouldBuildCurrentSelectionEvidence('投手リレーどう組む？',{players:[],domains:['PITCHING','TACTICS']}),true);
assert.equal(shouldBuildCurrentSelectionEvidence('大野 竜暉を3番にする？',{players:['大野 竜暉'],domains:['LINEUP']}),false);
assert.equal(shouldBuildCurrentSelectionEvidence('大野 竜暉のOPSは？',{players:['大野 竜暉'],domains:['BATTING']}),false);

const packet=await buildCurrentSelectionEvidence({question:'3番は誰がいい？',routed:{players:[],domains:['LINEUP']},auditProvider:fakeAudit});
assert.equal(packet.count,14);
assert.equal(packet.primarySeason,'current');
assert.equal(packet.selectionKind,'BATTING_ORDER');
assert.equal(packet.allCurrentTeamCheck.status,'COMPLETE');
assert.deepEqual(packet.allCurrentTeamCheck.players.map(x=>x.name),CURRENT_ROSTER);
assert.equal(packet.historicalReference.status,'COMPLETE');
assert.equal(packet.historicalReference.candidateEligible,false);
assert.deepEqual(packet.historicalReference.players.map(x=>x.name),CURRENT_ROSTER);
assert.ok(packet.text.includes('【主評価】2026-2027 現チーム'));
assert.ok(packet.text.includes('【現チーム全14選手・打撃】'));
assert.ok(packet.text.includes('【母数ルール】'));
assert.ok(packet.text.includes('率系の打撃指標'));
assert.ok(packet.text.includes('打数'));
assert.ok(packet.sampleSizeRule.includes('打数'));
assert.ok(packet.text.includes('【参考】2025-2026旧チーム'));
assert.ok(packet.text.includes('旧チームの引退選手を現チーム候補に入れない'));
assert.ok(packet.text.includes('大野 竜暉'));
assert.equal(packet.sources[0].name,'current-master.xlsm');
assert.equal(packet.sources[0].priority,'PRIMARY');
assert.equal(packet.sources[1].name,'old-master.xlsm');
assert.equal(packet.sources[1].priority,'REFERENCE');
assert.deepEqual(calls.sort(),['current','old']);

const pitchingPacket=await buildCurrentSelectionEvidence({question:'先発投手は誰がいい？',routed:{players:[],domains:['PITCHING']},auditProvider:fakeAudit});
assert.equal(pitchingPacket.selectionKind,'PITCHING_ROLE');
assert.ok(pitchingPacket.text.includes('【現チーム全14選手・投手】'));
assert.ok(pitchingPacket.text.includes('防御率'));
assert.ok(pitchingPacket.text.includes('旧チーム'));
assert.ok(pitchingPacket.sampleSizeRule.includes('投球回'));
assert.ok(pitchingPacket.sampleSizeRule.includes('登板数'));

const pitchingPlanPacket=await buildCurrentSelectionEvidence({question:'7回制の投手運用を先発→第2投手→終盤→クローザーで組んで',routed:{players:[],domains:['PITCHING','TACTICS']},auditProvider:fakeAudit});
assert.equal(pitchingPlanPacket.selectionKind,'PITCHING_PLAN');
assert.ok(pitchingPlanPacket.text.includes('【現チーム全14選手・投手】'));
assert.ok(pitchingPlanPacket.text.includes('先発 → 第2投手 → 終盤 → クローザー'));
assert.ok(pitchingPlanPacket.text.includes('異なる4投手'));
assert.ok(pitchingPlanPacket.text.includes('高圧場面適性はEvidenceに明示されていない限り捏造しない'));
assert.ok(pitchingPlanPacket.summary.includes('7回制4役投手運用'));
assert.ok(pitchingPlanPacket.sampleSizeRule.includes('投球回'));

const genericPitchingPlanPacket=await buildCurrentSelectionEvidence({question:'投手リレーどう組む？',routed:{players:[],domains:['PITCHING','TACTICS']},auditProvider:fakeAudit});
assert.equal(genericPitchingPlanPacket.selectionKind,'PITCHING_PLAN');
assert.equal(genericPitchingPlanPacket.count,14);
assert.equal(genericPitchingPlanPacket.primarySeason,'current');
assert.equal(genericPitchingPlanPacket.historicalReference.candidateEligible,false);

const incomplete={...currentPlayers};delete incomplete[CURRENT_ROSTER[0]];
await assert.rejects(()=>buildCurrentSelectionEvidence({
  question:'4番は誰がいい？',
  routed:{players:[],domains:['LINEUP']},
  auditProvider:async({season})=>season==='old'?{extracted:{playersByName:oldPlayers}}:{extracted:{playersByName:incomplete}}
}),/14名の正本確認が未完了/);

const withoutOld=await buildCurrentSelectionEvidence({
  question:'ベストオーダーを組んで',
  routed:{players:[],domains:['LINEUP']},
  auditProvider:async({season})=>{
    if(season==='old') throw new Error('old unavailable');
    return {seasonLabel:'2026-2027現チーム',source:{name:'current-master.xlsm'},extracted:{playersByName:currentPlayers}};
  }
});
assert.equal(withoutOld.selectionKind,'FULL_LINEUP');
assert.equal(withoutOld.historicalReference.status,'UNAVAILABLE');
assert.equal(withoutOld.count,14);
assert.ok(withoutOld.text.includes('今回は現チーム正本だけで判断する'));
assert.ok(withoutOld.text.includes('3賢人は独立して全打順を作り'));
assert.ok(withoutOld.text.includes('具体的な打順番号と選手名'));
assert.ok(withoutOld.dataRule.includes('率系指標は母数とセット'));

console.log('SELECTION LIVE EVIDENCE RESULT: PASS');
