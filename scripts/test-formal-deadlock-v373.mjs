import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../magi-formal-runner-v373.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('../magi-app-bootstrap-v363.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.match(bootstrap,/const REV='427'/,'new bootstrap should load fresh UI assets');
assert.match(bootstrap,/magi-formal-runner-v373\.js\?v=\$\{REV\}/);
assert.match(html,/magi-app-bootstrap-v363\.js\?v=427/,'iPhone should receive the refreshed bootstrap');

const players=Array.from({length:14},(_,i)=>'選手'+String(i+1).padStart(2,'0'));
const first=players.slice(0,9);
const balthasar=first.slice();[balthasar[0],balthasar[1]]=[balthasar[1],balthasar[0]];
const casper=first.slice();[casper[2],casper[3]]=[casper[3],casper[2]];
const votes={melchior:first,balthasar,casper};
const clone=v=>JSON.parse(JSON.stringify(v));
const groups=Object.entries(votes).map(([persona,order])=>({personas:[persona],support:1,order:order.slice()}));
const challenges={melchior:['compare 2nd slot'],balthasar:['compare 3rd slot'],casper:['compare 4th slot']};
const goodDeadlock={
  mode:'FULL_LINEUP',
  status:'LINEUP_REVIEW_REQUIRED',
  reviewReason:'FULL_LINEUP_DEADLOCK_1_1_1',
  deliberationDecision:'DEADLOCK',
  finalVote:'1-1-1',
  lineup:[],battingOrder:[],
  fieldingStatus:'NOT_EVALUATED',fieldingReason:'LINEUP_DEADLOCK',
  personaLineups:clone(votes),
  proposalGroups:groups,
  slotConflicts:[{slot:2}],
  crossDiscussion:{challenges},
  recommendation:'3案が一致しないため、決定は保留する'
};
const goodConsensus={
  mode:'FULL_LINEUP',status:'LINEUP_RESULT',
  deliberationDecision:'CONSENSUS',finalVote:'3-0',
  lineup:first.map((name,i)=>({slot:i+1,name})),
  fieldingStatus:'COMPLETE'
};
const packet={
  count:14,files:['チーム成績_2026-2027.xlsm'],
  selectionKind:'FULL_LINEUP',
  allCurrentTeamCheck:{
    players:players.map((name,i)=>({name,batting:{AVG:'.'+String(240+i),AB:String(18+i),OPS:'.'+String(640+i)}}))
  },
  historicalReference:{status:'INCOMPLETE',players:[]},
  recentSix:{status:'INCOMPLETE',players:[]}
};

let nextFinal=clone(goodDeadlock);
const events=[],progress=[],errors=[];
const elements={q:{value:'元の入力欄'}};
const document={
  getElementById:id=>elements[id]||null,
  dispatchEvent:e=>{events.push(e);return true}
};
const ctx={
  console,document,
  CustomEvent:class { constructor(type,opts={}){this.type=type;this.detail=opts.detail;} },
  MAGI_ENGINE_UI_V187:true,
  MAGI_PROGRESS_V358:{update:(pct,label,step)=>progress.push({pct,label,step}),error:label=>errors.push(label)}
};
ctx.window=ctx;
ctx.MAGI_ENGINE_V1=Object.freeze({
  version:'vm-engine',personas:['melchior','balthasar','casper'],
  deliberate:async(input,options={})=>{
    for(const stage of ['PRIMARY','CROSS','SECOND','FINAL'])options.onStage?.({stage});
    return {
      case:clone(input),
      primary:{},crossExamination:{},second:{},
      final:clone(nextFinal)
    };
  }
});
ctx.runMagi=async()=>ctx.MAGI_ENGINE_V1.deliberate({question:elements.q.value,mode:'selection'});
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'magi-formal-runner-v373.js'});
const runner=ctx.MAGI_FORMAL_UI_RUNNER_V3;
assert.equal(typeof runner,'function');

const ask=()=>runner({question:'守備込みで今季のベストオーダーを審議して',evidence:packet,selectionKind:'FULL_LINEUP'});
let count=0;
function ok(condition,label){assert.ok(condition,label);count++;console.log('PASS '+label);}
let finalResult=await ask();
ok(finalResult.final.status==='LINEUP_REVIEW_REQUIRED'
  && finalResult.final.lineup.length===0
  && ctx.MAGI_LAST_DELIBERATION_RESULT?.final?.finalVote==='1-1-1',
  'genuine 1-1-1 deadlock is delivered without invented lineup');
ok(events.some(e=>e.type==='magi:deliberation-result'&&e.detail?.final?.reviewReason==='FULL_LINEUP_DEADLOCK_1_1_1'),
  'deadlock reaches the real UI result event');
ok(progress.some(e=>e.pct===99&&e.label.includes('確定保留'))
  && elements.q.value==='元の入力欄','deadlock shows hold status and restores input');
ok(ctx.MAGI_ENGINE_V1.version==='vm-engine'&&errors.length===0,
  'successful deadlock restores engine without false error');

nextFinal=clone(goodConsensus);
finalResult=await ask();
ok(finalResult.final.lineup.length===9
  && ctx.MAGI_LAST_DELIBERATION_RESULT?.final?.status==='LINEUP_RESULT',
  'verified nine-player consensus remains acceptable');

async function refuses(label,input){
  nextFinal=clone(input);
  await assert.rejects(ask,/最終ベストオーダーが9人で確定していません|最終ベストオーダーに重複または欠落があります/);
  ok(ctx.MAGI_LAST_DELIBERATION_RESULT===null&&ctx.MAGI_LAST_FORMAL_ERROR?.message,
     label+' fails closed and exposes a real UI error');
}
await refuses('fake deadlock vote',{...goodDeadlock,finalVote:'2-1'});
await refuses('review without a genuine deadlock',{...goodDeadlock,reviewReason:'FIELDING_MISSING'});
await refuses('deadlock claiming completed fielding',{...goodDeadlock,fieldingStatus:'COMPLETE'});
await refuses('deadlock inventing a lineup',{...goodDeadlock,lineup:[{slot:1,name:first[0]}]});
await refuses('deadlock with two identical proposals',{...goodDeadlock,personaLineups:{...votes,casper:balthasar.slice()}});
await refuses('deadlock using a player outside the current roster',{...goodDeadlock,personaLineups:{...votes,casper:[...casper.slice(0,8),'引退選手X']}});
await refuses('deadlock missing cross-examination',{...goodDeadlock,crossDiscussion:{challenges:{melchior:[],balthasar:[],casper:[]}}});
await refuses('deadlock with falsified proposal groups',{...goodDeadlock,proposalGroups:groups.map(g=>({...g,order:first.slice()}))});
await refuses('incomplete ordinary result',{...goodConsensus,lineup:[]});
await refuses('duplicate selected player',{...goodConsensus,lineup:[...goodConsensus.lineup.slice(0,8),{slot:9,name:first[0]}]});
console.log('FORMAL UI DEADLOCK V373 CONTRACT: '+count+'/'+count+' PASS');
