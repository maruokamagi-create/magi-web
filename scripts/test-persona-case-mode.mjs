import assert from 'node:assert/strict';
import {
  isCandidateCase,
  normalizeConditionalJudgment,
  normalizeChangeTracking
} from '../server/api/magi/persona.js';

const tests=[];
function test(name,fn){tests.push({name,fn});}

const modeCases=[
  ['M01 3番だれがいい is selection',{case:{question:'3番だれがいい？'}},true],
  ['M02 who starts is selection',{case:{question:'次の試合、誰を先発にする？'}},true],
  ['M03 closer who is selection',{case:{question:'クローザー誰がいい？'}},true],
  ['M04 left field who is selection',{case:{question:'レフトは誰が最適？'}},true],
  ['M05 named starter proposal stays focused',{case:{question:'大野を先発固定どう？'}},false],
  ['M06 named third-batter proposal stays focused',{case:{question:'大野を3番固定どう？'}},false],
  ['M07 named left-field proposal stays focused',{case:{question:'武田をレフト固定でどう？'}},false],
  ['M08 named closer proposal stays focused',{case:{question:'大野をクローザー固定すべき？'}},false],
  ['M09 explicit selection mode wins',{case:{mode:'selection',question:'候補を考えて'}},true],
  ['M10 generic player evaluation is focused',{case:{question:'大野をどう評価する？'}},false]
];
for(const [name,input,expected] of modeCases){
  test(name,()=>assert.equal(isCandidateCase(input),expected));
}

test('M11 quoted conditional opinion cannot flip explicit hold',()=>{
  const r={
    judgment:'YELLOW',warnings:[],
    publicStatement:'指摘は理解しましたが、私の判断は変えません。',
    primaryReason:'クローザー適性を示す記録やデータが不足しているため、現時点では判断を保留します。',
    analysis:['条件付き起用の意見は理解しますが、Evidenceでは確認できません。']
  };
  assert.equal(normalizeConditionalJudgment(r,false).judgment,'YELLOW');
});

test('M12 affirmative conditional stance promotes yellow to blue',()=>{
  const r={
    judgment:'YELLOW',warnings:[],
    publicStatement:'無条件の固定ではなく、条件付きで起用していきます。',
    primaryReason:'見直し可能な条件付き運用なら進められます。'
  };
  assert.equal(normalizeConditionalJudgment(r,false).judgment,'BLUE');
});

test('M13 selection mode never rewrites judgment from prose',()=>{
  const r={
    judgment:'YELLOW',warnings:[],
    publicStatement:'条件付きで起用していきます。',
    primaryReason:'条件付き運用を支持します。'
  };
  assert.equal(normalizeConditionalJudgment(r,true).judgment,'YELLOW');
});

test('M14 second-round enum change forces changedFromPrimary true',()=>{
  const r={judgment:'BLUE',changedFromPrimary:false,changeReason:''};
  normalizeChangeTracking(r,'SECOND',{judgment:'YELLOW'});
  assert.equal(r.changedFromPrimary,true);
  assert.match(r.changeReason,/YELLOW.*BLUE/);
});

test('M15 unchanged second-round enum clears false change reason',()=>{
  const r={judgment:'YELLOW',changedFromPrimary:true,changeReason:'変更したつもり'};
  normalizeChangeTracking(r,'SECOND',{judgment:'YELLOW'});
  assert.equal(r.changedFromPrimary,false);
  assert.equal(r.changeReason,'');
});

test('M16 primary phase always resets change tracking',()=>{
  const r={judgment:'BLUE',changedFromPrimary:true,changeReason:'変更'};
  normalizeChangeTracking(r,'PRIMARY',{judgment:'YELLOW'});
  assert.equal(r.changedFromPrimary,false);
  assert.equal(r.changeReason,'');
});

let passed=0;
for(const {name,fn} of tests){
  try{
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  }catch(error){
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode=1;
    break;
  }
}
console.log(`PERSONA CASE MODE RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);