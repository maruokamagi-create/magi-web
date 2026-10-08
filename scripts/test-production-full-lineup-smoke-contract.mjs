import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';

// Exercise the SAME jq contract used in production smoke, not a JS replica.
// Test data here are synthetic and never serve as baseball Evidence.
const filter=fileURLToPath(new URL('./validate-production-full-lineup-final.jq',import.meta.url));
const dir=mkdtempSync(join(tmpdir(),'magi-lineup-contract-'));
const rosterPath=join(dir,'roster.json');
writeFileSync(rosterPath,JSON.stringify(CURRENT_ROSTER));
const names=CURRENT_ROSTER.slice(0,9);
const positions=['投','捕','一','二','三','遊','左','中','右'];
const base={
  mode:'FULL_LINEUP',
  crossDiscussion:{challenges:{melchior:['compare evidence'],balthasar:['compare tactics'],casper:['compare concerns']}},
  personaLineups:{melchior:[...names],balthasar:[...names],casper:[...names]}
};
const clone=value=>JSON.parse(JSON.stringify(value));
function accepted(value){
  const cmd=spawnSync('jq',['-e','--slurpfile','roster',rosterPath,'-f',filter],{
    input:JSON.stringify(value),encoding:'utf8'
  });
  if(cmd.error)throw cmd.error;
  if(cmd.status===null)throw new Error(cmd.stderr||'jq did not exit');
  return cmd.status===0;
}
const valid={
  ...clone(base),status:'LINEUP_RESULT',deliberationDecision:'CONSENSUS',finalVote:'3-0',
  fieldingStatus:'COMPLETE',
  lineup:names.map((name,index)=>({
    slot:index+1,name,position:positions[index],
    positionEvidence:{officialStarts:1,practiceFirstStarts:0,totalStarts:1,recentStarts:0,fieldingAppearances:1}
  }))
};
const deadlock={
  ...clone(base),status:'LINEUP_REVIEW_REQUIRED',reviewReason:'FULL_LINEUP_DEADLOCK_1_1_1',
  deliberationDecision:'DEADLOCK',finalVote:'1-1-1',
  lineup:[],battingOrder:[],fieldingStatus:'NOT_EVALUATED',fieldingReason:'LINEUP_DEADLOCK',
  proposalGroups:[{personas:['melchior']},{personas:['balthasar']},{personas:['casper']}],
  slotConflicts:[{slot:1}]
};
[deadlock.personaLineups.balthasar[0],deadlock.personaLineups.balthasar[1]]=
  [deadlock.personaLineups.balthasar[1],deadlock.personaLineups.balthasar[0]];
[deadlock.personaLineups.casper[2],deadlock.personaLineups.casper[3]]=
  [deadlock.personaLineups.casper[3],deadlock.personaLineups.casper[2]];

const cases=[
  ['consensus, 9 evidence-qualified fielders',valid,true],
  ['2-1 majority, actual 9 evidence-qualified fielders',{
    ...clone(valid),deliberationDecision:'MAJORITY',finalVote:'2-1',
    personaLineups:clone(deadlock.personaLineups)
  },true],
  ['genuine 1-1-1 deadlock with no lineup',deadlock,true],
  ['deadlock cannot invent a lineup',{...clone(deadlock),lineup:[valid.lineup[0]]},false],
  ['deadlock cannot imply fielding evaluated',{...clone(deadlock),fieldingStatus:'COMPLETE'},false],
  ['deadlock cannot fabricate same-vote consensus',{
    ...clone(deadlock),personaLineups:clone(valid.personaLineups)
  },false],
  ['deadlock must have three independently recorded groups',{
    ...clone(deadlock),proposalGroups:[{personas:['melchior','casper']},{personas:['balthasar']}] 
  },false],
  ['deadlock cannot carry old-team candidate',{
    ...clone(deadlock),personaLineups:{...clone(deadlock.personaLineups),melchior:[...names.slice(0,8),'宮嵜 翔']}
  },false],
  ['other review-required failures remain failures',{
    ...clone(deadlock),reviewReason:'ROSTER_INCOMPLETE'
  },false],
  ['result requires all nine standard positions',{
    ...clone(valid),lineup:clone(valid.lineup).map((row,index)=>index===8?{...row,position:'投'}:row)
  },false],
  ['result requires starting-position evidence',{
    ...clone(valid),lineup:clone(valid.lineup).map((row,index)=>index===0?{...row,positionEvidence:{officialStarts:0,practiceFirstStarts:0,totalStarts:0,recentStarts:0,fieldingAppearances:0}}:row)
  },false],
  ['a 2-1 vote cannot masquerade as a deadlock',{
    ...clone(deadlock),finalVote:'2-1'
  },false],
  ['a 1-1-1 vote cannot masquerade as consensus',{
    ...clone(valid),finalVote:'1-1-1'
  },false]
];
try{
  for(const [description,input,expected] of cases){
    assert.equal(accepted(input),expected,description);
    console.log('PASS',description);
  }
  console.log('PRODUCTION FULL-LINEUP SMOKE CONTRACT: 13/13 PASS');
}finally{
  rmSync(dir,{recursive:true,force:true});
}
