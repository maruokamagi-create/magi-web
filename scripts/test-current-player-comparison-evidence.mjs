import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeModel } from '../server/api/magi/_semantic-authority.js';
import {
  currentTwoPlayerBattingComparison,
  currentBattingComparisonPacket,
  resolveCurrentBattingComparison
} from '../server/api/magi/_player-comparison-evidence.js';

const source={id:'fixture-current-id',name:'current-master.xlsm',path:'CURRENT/00_MASTER/current-master.xlsm',modifiedTime:'2026-10-08T01:00:00Z'};
const audit={
  sourceType:'XLSM_MASTER',season:'current',source,
  extracted:{
    periodStart:'2026-08-01',periodEnd:'2026-10-08',
    playersByName:{
      '大野 竜暉':{batting:{AB:'40',H:'15',AVG:'.375',OPS:'1.058',BB:'5',SB:'4',RBI:'7',UNKNOWN:'private'}},
      '坂田 暉馬':{batting:{AB:'39',H:'12',AVG:'.308',OPS:'.861',BB:'2',RBI:'4'}},
      '宮村 龍':{batting:{AB:'11',H:'5',AVG:'.455',OPS:'1.200'}}
    }
  }
};
const raw={
  mode:'COMPARISON',confidence:'HIGH',players:['大野 竜暉','坂田 暉馬'],
  understoodRequest:'2人の今季打撃成績を比較する',domains:['BATTING','TEAM'],
  selectionKind:'NONE',timeScope:'CURRENT_SEASON',needsData:true
};
const question='大野 竜暉と坂田 暉馬の今季打撃成績を比較して';
const semantic=normalizeModel(raw,question,[]);
assert.equal(semantic.mode,'COMPARISON');
assert.deepEqual(currentTwoPlayerBattingComparison(semantic),raw.players);

let calls=[];
const resolved=await resolveCurrentBattingComparison({semantic,auditProvider:async args=>{calls.push(args);return audit;}});
assert.equal(resolved.status,'COMPLETE');
assert.deepEqual(calls,[{season:'current'}],'only the current season may be fetched');
const evidence=resolved.evidence;
assert.equal(evidence.comparisonKind,'CURRENT_BATTING_TWO_PLAYERS');
assert.deepEqual(evidence.comparedPlayers.map(x=>x.name),raw.players);
assert.equal(evidence.comparedPlayers[0].batting.AVG,'.375');
assert.equal(evidence.comparedPlayers[1].batting.OPS,'.861');
assert.equal(evidence.comparedPlayers[0].batting.UNKNOWN,undefined,'unwhitelisted data must not leak');
assert.deepEqual(evidence.files,[source.name]);
assert.deepEqual(evidence.sources.map(x=>x.name),[source.name]);
assert.equal(evidence.sourceType,'XLSM_MASTER');
assert.equal(evidence.periodStart,'2026-08-01');
assert.equal(evidence.periodEnd,'2026-10-08');
assert.ok(evidence.text.includes('大野 竜暉：打数 40 / 安打 15 / 打率 .375'));
assert.ok(evidence.text.includes('坂田 暉馬：打数 39 / 安打 12 / 打率 .308'));
assert.ok(!evidence.text.includes('宮村 龍'));

const reversed=normalizeModel({...raw,players:['坂田 暉馬','大野 竜暉']},'坂田 暉馬と大野 竜暉の今季打撃成績を比較して',[]);
assert.deepEqual(currentBattingComparisonPacket(reversed,audit).evidence.comparedPlayers.map(x=>x.name),['坂田 暉馬','大野 竜暉']);

const unsupported=[
  {...semantic,mode:'SINGLE_VALUE'},
  {...semantic,confidence:'LOW'},
  {...semantic,players:['大野 竜暉']},
  {...semantic,players:['大野 竜暉','大野 竜暉']},
  {...semantic,players:['大野 竜暉','宮村 龍']},
  {...semantic,domains:['BATTING','PITCHING']},
  {...semantic,domains:['TEAM']},
  {...semantic,timeScope:'PREVIOUS_SEASON'},
  {...semantic,selectionKind:'FULL_LINEUP'}
];
for(const u of unsupported){
  assert.equal(currentTwoPlayerBattingComparison(u),null,JSON.stringify(u));
  assert.equal(await resolveCurrentBattingComparison({semantic:u,auditProvider:async()=>{throw new Error('unsupported route should not fetch');}}),null);
}
assert.equal(currentBattingComparisonPacket(semantic,{...audit,season:'old'}).status,'UNAVAILABLE');
assert.equal(currentBattingComparisonPacket(semantic,{...audit,sourceType:'MEMORY'}).status,'UNAVAILABLE');
assert.equal(currentBattingComparisonPacket(semantic,{...audit,source:{...source,name:'unknown.csv'}}).status,'UNAVAILABLE');
assert.equal(currentBattingComparisonPacket(semantic,{...audit,extracted:{playersByName:{'大野 竜暉':audit.extracted.playersByName['大野 竜暉']}}}).status,'UNAVAILABLE');
assert.equal(currentBattingComparisonPacket(semantic,{...audit,extracted:{playersByName:{...audit.extracted.playersByName,'坂田 暉馬':{batting:{AVG:'.308'}}}}}).status,'UNAVAILABLE');
assert.deepEqual(await resolveCurrentBattingComparison({semantic,auditProvider:async()=>{throw new Error('Drive unavailable');}}),{status:'UNAVAILABLE',reason:'CURRENT_MASTER_AUDIT_UNAVAILABLE'});

const core=fs.readFileSync(new URL('../server/api/magi/core.js',import.meta.url),'utf8');
assert.match(core,/if\(currentTwoPlayerBattingComparison\(semantic\)\)/,'core must require real semantic COMPARISON qualification');
assert.match(core,/resolveCurrentBattingComparison\(\{semantic\}\)/,'core must retrieve evidence');
assert.match(core,/source:'CURRENT_MASTER_BATTING_COMPARISON'/,'core must attach the matched comparison evidence');
assert.match(core,/comparison\?\.status!=='COMPLETE'/,'incomplete comparisons must fail closed');

console.log('CURRENT TWO-PLAYER BATTING COMPARISON EVIDENCE: 16/16 PASS');
