import assert from 'node:assert/strict';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

const CASE={
  question:'大野 竜暉をクローザー固定すべき？',
  evidence:{
    currentTeam:{player:'大野 竜暉',pitching:{appearances:3,innings:'5.0',strikeouts:7,walks:2}},
    oldTeam:{player:'大野 竜暉',pitching:{era:'1.69',innings:'54.0',strikeouts:50}},
    operationalConcern:'捕手との兼任負担を考慮する必要がある'
  }
};
function result(overrides={}){
  return {facts:[],analysis:[],prediction:[],primaryReason:'',publicStatement:'',warnings:[],reviewReason:'',changeReason:'',...overrides};
}
const tests=[];function test(name,fn){tests.push({name,fn});}

test('G01 valid pitching labels pass',()=>{
  const r=result({facts:['現チームは登板3試合、投球回5.0、奪三振7、与四球2。','旧チームの防御率は1.69、54.0イニング、奪三振50。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G02 innings mislabeled as appearances is blocked',()=>{
  const r=result({publicStatement:'現チームでの登板はまだ5回です。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('登板数5')));
});

test('G03 walks cannot become four-dead-balls',()=>{
  const r=result({facts:['現チームは四死球2です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('四死球')));
});

test('G04 invented WHIP is blocked',()=>{
  const r=result({analysis:['WHIPは0.95です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('WHIP0.95')));
});

test('G05 wrong ERA is blocked',()=>{
  const r=result({facts:['旧チームの防御率は2.10です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('防御率2.10')));
});

test('G06 supplied old ERA is accepted',()=>{
  const r=result({facts:['旧チームの防御率は1.69です。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G07 unrelated current roster player is blocked in focused proposal',()=>{
  const r=result({publicStatement:'大久保 陽翔も候補に入れます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('大久保 陽翔')));
});

test('G08 unrelated roster names are allowed when not focused',()=>{
  const r=result({publicStatement:'大久保 陽翔も候補に入れます。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:false}),[]);
});

test('G09 invented save count is blocked',()=>{
  const r=result({analysis:['セーブ数は3です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('セーブ3')));
});

test('G10 stat quality adjective without baseline is blocked',()=>{
  const r=result({primaryReason:'与四球の少なさを評価して条件付きで起用する。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G11 unsupported historical closer performance is blocked',()=>{
  const r=result({prediction:['旧チーム同様に重要な場面で試合を締めくくるだろう。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('G12 explicit comparison baseline permits stat-quality language',()=>{
  const compared={...CASE,evidence:{...CASE.evidence,comparison:'チーム平均より与四球が少ない'}};
  const r=result({analysis:['与四球が少ない点は比較上の強みです。']});
  assert.deepEqual(validatePersonaOutput(compared,r,{focused:true}),[]);
});

test('G13 strikeout-walk ratio qualitative claim without baseline is blocked',()=>{
  const r=result({analysis:['奪三振7と与四球2の割合は悪くない。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G14 unsupported pressure-experience inference is blocked',()=>{
  const r=result({analysis:['旧チーム54.0回の実績はプレッシャーのかかる場面での経験値として軽視できない。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('G15 raw strikeout count cannot become generic strikeout ability without baseline',()=>{
  const r=result({publicStatement:'三振が取れる力は買いです。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G16 explicit missing closer evidence disclaimer is allowed',()=>{
  const r=result({warnings:['旧チームでのクローザーとしての起用実績を示す記録は含まれていません。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G17 explicit no-baseline quality disclaimer is allowed',()=>{
  const r=result({analysis:['比較基準がないため、与四球が少ないとは言えません。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G18 plain walk label is checked against supplied walks',()=>{
  const r=result({facts:['四球2です。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G19 wrong plain walk label is blocked',()=>{
  const r=result({facts:['四球5です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('与四球5')));
});

test('G20 bare inning count used as sample is blocked',()=>{
  const r=result({publicStatement:'現チームのサンプルはまだ5回と少ないです。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('投球回5')));
});

test('G21 explicit inning unit is accepted',()=>{
  const r=result({publicStatement:'現チームの投球回は5.0回です。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G22 burden intensity cannot be strengthened beyond evidence',()=>{
  const r=result({publicStatement:'捕手との兼任負担が大きすぎるので固定は避けます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('負担の大きさ')));
});

test('G23 supplied burden concern phrasing is allowed',()=>{
  const r=result({publicStatement:'捕手との兼任負担を考慮する必要があります。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G24 definite future harm in assertive text is blocked',()=>{
  const r=result({publicStatement:'捕手との兼任負担で半年後の成長に影響が出てしまいます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('具体的悪影響')));
});

test('G25 conditional future burden prediction is allowed',()=>{
  const r=result({prediction:['負担を考慮せず固定した場合、コンディションに影響を与える可能性があります。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G26 hard future certainty is blocked',()=>{
  const r=result({prediction:['この起用なら必ず勝利を維持できます。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('保証できない')));
});

test('G27 fatigue and burden accumulation is blocked without evidence',()=>{
  const r=result({warnings:['捕手と投手の兼任による疲労や負担の蓄積に注意が必要です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('負担の大きさ')));
});

test('G28 certainty in user-facing action language is blocked',()=>{
  const r=result({publicStatement:'条件付きで試しながら確実に勝ちを拾っていこう。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('保証できない')));
});

test('G29 unhedged causal growth prediction is blocked',()=>{
  const r=result({prediction:['慎重な段階的起用を続けることで、選手が成長しチームの戦力として定着する。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G30 hedged growth prediction is allowed',()=>{
  const r=result({prediction:['慎重な段階的起用を続けた場合、選手の成長につながる可能性があります。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`PERSONA OUTPUT GUARD RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);
