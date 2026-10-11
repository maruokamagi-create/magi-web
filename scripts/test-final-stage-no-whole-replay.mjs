import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../magi-production-stability-v412.js',import.meta.url),'utf8');
const actualError=Object.assign(new Error('最終判断の集約を一時的に完了できませんでした。'),{
  magiStage:'FINAL',code:'FINAL_AGGREGATION_FAILED',status:503
});
let calls=0,reads=0,writes=0,prefights=0,stages=[];
const baseRunner=async()=>{
  calls++;
  if(calls===1)throw actualError;
  return {primary:{},crossExamination:{},second:{},final:{status:'LINEUP_REVIEW_REQUIRED'}};
};
const context={
  document:{dispatchEvent(){}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},
  localStorage:{getItem(){reads++;return '{"result":{"final":{"status":"LINEUP_RESULT"}}}'},setItem(){writes++}},
  setInterval(){return 1},clearInterval(){},setTimeout(){return 1},
  Date,JSON,Math,Promise,Error,String,Object,Array,Boolean,Number,
};
context.window=context;
context.fetch=async()=>{prefights++;return {ok:true}};
context.addEventListener=()=>{};
context.MAGI_APP_RUNTIME={ready:true};
context.MAGI_FORMAL_UI_RUNNER_V2=baseRunner;
context.MAGI_PROGRESS_V358={version:'progress-v358-event-driven',update:(...a)=>stages.push(a)};
context.MAGI_DELIBERATION_SERIAL_V374=true;
vm.runInNewContext(source,context,{filename:'magi-production-stability-v412.js'});
assert.equal(typeof context.MAGI_FORMAL_UI_RUNNER_V2,'function');
const wrapped=context.MAGI_FORMAL_UI_RUNNER_V2;
const failure=await wrapped({question:'ベストオーダー',selectionKind:'FULL_LINEUP',evidence:{count:14}})
  .then(()=>null,e=>e);
assert.equal(failure,actualError,'FINAL error must remain the original structured error');
assert.equal(calls,1,'do not replay all Gemini/three-Wise-Men stages');
assert.equal(reads,0,'never substitute a saved decision for failed live FINAL');
assert.equal(writes,0,'failed live run must not persist a selected result');
assert.equal(stages.length,0,'do not reset an 88% FINAL failure to 20% recovery');
assert.equal(prefights,1,'existing nonprovider preflight still runs once');
assert.equal(wrapped.meta.wholeRunRetry,false);
assert.equal(wrapped.meta.sameInputReplay,false);

const result=await wrapped({question:'次の別の質問',selectionKind:'FULL_LINEUP',evidence:{count:14}});
assert.equal(calls,2,'a separate explicit user action may perform another run');
assert.equal(result.final.status,'LINEUP_REVIEW_REQUIRED');
const runner=readFileSync(new URL('../magi-formal-runner-v373.js',import.meta.url),'utf8');
const a=runner.indexOf('function bufferedOptions(original){'),b=runner.indexOf('function replay(original,result){',a);
assert.ok(a>=0&&b>a);
const seen=[];
const opts=vm.runInNewContext('(()=>{'+runner.slice(a,b)+';return bufferedOptions})()',{
  progress:(...args)=>seen.push(['progress',...args])
})({onStage:s=>seen.push(['status',s.stage])});
opts.onStage({stage:'SECOND'});
opts.onStage({stage:'FINAL'});
assert.equal(seen.filter(x=>x[0]==='status').length,1,'only FINAL must also update canonical status label');
assert.equal(seen.find(x=>x[0]==='progress'&&x[1]===88)?.[2],'最終判断を集約中');

const backend=readFileSync(new URL('../server/api/magi/orchestrate.js',import.meta.url),'utf8');
assert.match(backend,/failurePhase=String\(body\?\.phase\|\|''\)/);
assert.match(backend,/isFinal\s*\?\s*'FINAL_AGGREGATION_FAILED'/);
assert.match(backend,/最終判断の集約に失敗しました/);
assert.match(backend,/CROSS_EXAMINATION_FAILED/);
console.log('PASS: 88% FINAL failure never silently replays whole debate or stale best order; reports correct stage');
