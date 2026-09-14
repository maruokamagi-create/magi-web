import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const src=await readFile(new URL('../magi-formal-runner-v358.js',import.meta.url),'utf8');
const elements={q:{value:'元の質問'},caseMeta:{textContent:''}};
const progressEvents=[];
const document={
  getElementById:id=>elements[id]||null,
  dispatchEvent:()=>true
};
const context={console,document,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};
context.window=context;
context.MAGI_PROGRESS_V358={
  update:(pct,label,step)=>progressEvents.push({pct,label,step}),
  error:label=>progressEvents.push({pct:-1,label,step:'ERROR'})
};
context.MAGI_ENGINE_UI_V187=true;
context.searchDataEvidence=()=>({count:14,files:['legacy-client.xlsm'],allCurrentTeamCheck:{players:[]},text:'LEGACY WITHOUT NUMBERS'});

const goodRow=name=>({candidatePlayers:['大野 竜暉','坂田 暉馬','嶋田 栄志','大久保 陽翔','中嶋 玲月','橋向 結都','武澤 大翔','上村 蓮','武田 晴琉翔'],candidateBasis:`${name} 打率 .278 / OPS .924`,facts:['打率 .278','OPS .924'],analysis:[],primaryReason:'打率 .278 と OPS .924 を確認',publicStatement:'打率 .278、OPS .924を根拠に打順を組む',warnings:[]});
function goodResult(input){
  const set={melchior:goodRow('M'),balthasar:goodRow('B'),casper:goodRow('C')};
  return {case:{...input,evidence:JSON.parse(JSON.stringify(input.evidence))},primary:set,crossExamination:{},second:set,final:{status:'LINEUP_RESULT'}};
}
context.MAGI_ENGINE_V1=Object.freeze({version:'test-base',personas:['melchior','balthasar','casper'],deliberate:async(input,options={})=>{
  options.onStage?.({stage:'PRIMARY'});options.onStage?.({stage:'CROSS'});options.onStage?.({stage:'SECOND'});options.onStage?.({stage:'FINAL'});
  const result=goodResult(input);
  options.onPrimaryLocked?.(result.primary);options.onCrossComplete?.(result.crossExamination);options.onSecondComplete?.(result.second);options.onFinalComplete?.(result.final);
  return result;
}});
context.runMagi=async()=>{
  const legacy=context.searchDataEvidence(elements.q.value);
  elements.caseMeta.textContent=`DATA HUB：${legacy.count}件参照 参照ファイル：${legacy.files.join('、')} ENGINE：Gemini v1.0`;
  return context.MAGI_ENGINE_V1.deliberate({question:elements.q.value,mode:'selection',evidence:legacy},{});
};
vm.createContext(context);
vm.runInContext(src,context,{filename:'magi-formal-runner-v358.js'});

const names=['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'];
const packet={
  count:14,
  files:['丸岡中軟式野球部_通算成績一覧2026-2027.xlsm','打撃詳細2026-2027.csv'],
  text:'【現チーム全14選手・打撃】\n'+names.map((name,i)=>`${name}：打率 .${String(200+i).padStart(3,'0')} / 打数 ${10+i} / OPS .${String(700+i).padStart(3,'0')}`).join('\n'),
  allCurrentTeamCheck:{players:names.map((name,i)=>({name,batting:{AVG:`.${String(200+i).padStart(3,'0')}`,AB:String(10+i),OPS:`.${String(700+i).padStart(3,'0')}`}}))},
  recentSix:{status:'COMPLETE',players:[]},
  historicalReference:{status:'COMPLETE',players:[]}
};

const result=await context.MAGI_FORMAL_UI_RUNNER_V3({question:'現時点のベストオーダーを審議して',evidence:packet,selectionKind:'FULL_LINEUP'});
assert.equal(result.case.evidence.numericEvidenceContract.currentPlayersWithCoreBatting,14,'V358-01 engine must receive numeric 14-player Evidence contract');
assert.equal(result.case.evidence.currentBattingAnchors.length,14,'V358-02 compact numeric anchors must be injected at engine boundary');
assert.match(elements.caseMeta.textContent,/2026-2027\.xlsm/,'V358-03 UI Evidence metadata must come from server packet');
assert.ok(progressEvents.some(x=>x.pct===28),'V358-04 primary stage must update progress');
assert.ok(progressEvents.some(x=>x.pct===54),'V358-05 cross stage must update progress');
assert.ok(progressEvents.some(x=>x.pct===72),'V358-06 second stage must update progress');
assert.ok(progressEvents.some(x=>x.pct===88),'V358-07 final stage must update progress');
assert.equal(elements.q.value,'元の質問','V358-08 original question field must be restored');

let calls=0;
context.MAGI_ENGINE_V1=Object.freeze({version:'bad-base',personas:['melchior','balthasar','casper'],deliberate:async(input)=>{
  calls++;
  const bad={...goodRow('bad'),facts:[],primaryReason:'2026-2027今季通算の数値データは提供されていない',publicStatement:'数値データが確認できないため役割だけで組む'};
  const set={melchior:bad,balthasar:bad,casper:bad};
  return {case:{...input,evidence:JSON.parse(JSON.stringify(input.evidence))},primary:set,crossExamination:{},second:set,final:{status:'LINEUP_RESULT'}};
}});
await assert.rejects(
  ()=>context.MAGI_FORMAL_UI_RUNNER_V3({question:'現時点のベストオーダーを審議して',evidence:packet,selectionKind:'FULL_LINEUP'}),
  /NUMERIC_EVIDENCE_RESULT_INVALID|数値Evidence/,
  'V358-09 false missing-data deliberation must fail closed'
);
assert.equal(calls,2,'V358-10 invalid numeric-use result must receive exactly one safe re-deliberation');

console.log('FORMAL EVIDENCE V358 RESULT: 10/10 PASS');
