import assert from 'node:assert/strict';
import { isCandidateCase } from '../server/api/magi/persona.js';

const cases=[
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

let passed=0;
for(const [name,input,expected] of cases){
  try{
    assert.equal(isCandidateCase(input),expected);
    passed++;
    console.log(`PASS ${name}`);
  }catch(error){
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode=1;
    break;
  }
}
console.log(`PERSONA CASE MODE RESULT: ${passed}/${cases.length} PASS`);
if(passed!==cases.length)process.exit(1);
