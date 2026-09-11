import assert from 'node:assert/strict';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

function players(extraMetric={}){
  return CURRENT_ROSTER.map((name,index)=>({
    name,
    batting:{AVG:(0.220+index*0.008).toFixed(3),OPS:(0.600+index*0.020).toFixed(3),...extraMetric[index]}
  }));
}
function caseData(list){
  return {mode:'selection',question:'3番は誰がいい？',evidence:{allCurrentTeamCheck:{status:'COMPLETE',players:list}}};
}
function result(text){return {facts:[],analysis:[text],prediction:[],primaryReason:'',publicStatement:'',warnings:[],reviewReason:'',changeReason:''};}

const full=players();
assert.deepEqual(validatePersonaOutput(caseData(full),result('大野 竜暉はOPSが高いので候補にする。'),{focused:false}),[]);

const incomplete=full.slice(0,13);
assert.ok(validatePersonaOutput(caseData(incomplete),result('大野 竜暉はOPSが高いので候補にする。'),{focused:false}).some(x=>x.includes('比較基準')));

assert.ok(validatePersonaOutput(caseData(full),result('大野 竜暉は長打力が高い。'),{focused:false}).some(x=>x.includes('長打力')));

const withSlg=players(Object.fromEntries(CURRENT_ROSTER.map((_,i)=>[i,{SLG:(0.300+i*0.010).toFixed(3)}])));
assert.deepEqual(validatePersonaOutput(caseData(withSlg),result('大野 竜暉は長打力が高い。'),{focused:false}),[]);

assert.ok(validatePersonaOutput(caseData(full),result('長侶 穹は出塁能力が高い。'),{focused:false}).some(x=>x.includes('出塁能力')));

const withObp=players(Object.fromEntries(CURRENT_ROSTER.map((_,i)=>[i,{OBP:(0.310+i*0.009).toFixed(3)}])));
assert.deepEqual(validatePersonaOutput(caseData(withObp),result('長侶 穹は出塁能力が高い。'),{focused:false}),[]);

console.log('SELECTION PEER BASELINE GUARD RESULT: 6/6 PASS');