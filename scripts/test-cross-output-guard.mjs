import assert from 'node:assert/strict';
import { failClosedCross, validateCrossOutput } from '../server/api/magi/_cross-output-guard.js';

const CASE={
  question:'大野 竜暉をクローザー固定すべき？',
  evidence:{
    currentTeam:{player:'大野 竜暉',pitching:{appearances:3,innings:'5.0',strikeouts:7,walks:2}},
    oldTeam:{player:'大野 竜暉',pitching:{era:'1.69',innings:'54.0',strikeouts:50}},
    operationalConcern:'捕手との兼任負担を考慮する必要がある'
  }
};
function cross(overrides={}){
  return {
    agreement:[],disagreement:[],domainConflicts:[],warnings:[],informationGaps:[],
    challenges:{melchior:[],balthasar:[],casper:[]},
    ...overrides
  };
}
const tests=[];function test(name,fn){tests.push({name,fn});}

test('X01 evidence-grounded cross text passes',()=>{
  const r=cross({
    agreement:['現チームの投球回5.0はまだ小さいサンプルである。'],
    informationGaps:['捕手兼任時の具体的な疲労度は確認できていない。'],
    challenges:{melchior:['旧チームの54.0回だけで固定まで言えるか。'],balthasar:[],casper:[]}
  });
  assert.deepEqual(validateCrossOutput(CASE,r,{focused:true}),[]);
});

test('X02 mislabeled innings as appearances is blocked',()=>{
  const r=cross({agreement:['現チームでは登板5回である。']});
  const issues=validateCrossOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('登板数5')));
});

test('X03 unrelated player is blocked in focused proposal',()=>{
  const r=cross({warnings:['大久保 陽翔の起用も考えるべきだ。']});
  const issues=validateCrossOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('大久保 陽翔')));
});

test('X04 unsupported prior closer role is blocked',()=>{
  const r=cross({agreement:['旧チーム同様にクローザーとして試合を締めた実績がある。']});
  const issues=validateCrossOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('X05 unsupported ratio quality claim is blocked',()=>{
  const r=cross({domainConflicts:['奪三振7と与四球2の割合は悪くないため、戦術的には固定できる。']});
  const issues=validateCrossOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('X06 candidate discussion can mention other players when not focused',()=>{
  const r=cross({disagreement:['大久保 陽翔と大野 竜暉のどちらを優先するかで意見が分かれる。']});
  assert.deepEqual(validateCrossOutput(CASE,r,{focused:false}),[]);
});

test('X07 fail closed cross keeps no unsafe debate content',()=>{
  const r=failClosedCross(['登板数5は不一致']);
  assert.equal(r.reviewRequired,true);
  assert.equal(r.agreement.length,0);
  assert.equal(r.challenges.melchior.length,0);
  assert.match(r.reviewReason,/不整合/);
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`CROSS OUTPUT GUARD RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);
