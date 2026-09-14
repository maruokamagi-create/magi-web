import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const runnerSrc=await readFile(new URL('../magi-formal-runner-v357.js',import.meta.url),'utf8');
const semanticSrc=await readFile(new URL('../main-live-answer-v329.js',import.meta.url),'utf8');
const bootstrapSrc=await readFile(new URL('../magi-app-bootstrap-v357.js',import.meta.url),'utf8');
const indexSrc=await readFile(new URL('../index.html',import.meta.url),'utf8');

const elements={
  q:{value:'元の質問'},
  caseMeta:{textContent:''}
};
const document={getElementById:id=>elements[id]||null};
const context={console,document};
context.window=context;
vm.createContext(context);

vm.runInContext(`
window.MAGI_ENGINE_UI_V187=true;
window.__formalCalls=0;
function searchDataEvidence(){ return {count:0,files:[],text:'legacy'}; }
runMagi=async function(){
  window.__formalCalls++;
  const e=searchDataEvidence(document.getElementById('q').value);
  document.getElementById('caseMeta').textContent='DATA HUB：'+e.count+'件参照 参照ファイル：'+(e.files||[]).join('、')+' ENGINE：Gemini v1.0';
  return e;
};
`,context);
vm.runInContext(runnerSrc,context,{filename:'magi-formal-runner-v357.js'});

const names=['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'];
const packet={
  count:14,
  files:['丸岡中軟式野球部_通算成績一覧2026-2027.xlsm','打撃詳細2026-2027.csv'],
  text:'【現チーム全14選手・打撃】',
  allCurrentTeamCheck:{players:names.map((name,i)=>({name,batting:{AVG:`.${String(200+i).padStart(3,'0')}`,AB:String(10+i)}}))}
};

const out=await context.MAGI_FORMAL_UI_RUNNER_V2({
  question:'現時点のベストオーダーを審議して',
  evidence:packet,
  selectionKind:'FULL_LINEUP',
  semantic:{mode:'DELIBERATION'}
});
assert.equal(out.count,14,'H01: formal runner must feed the server packet, not legacy zero-row client evidence');
assert.match(elements.caseMeta.textContent,/DATA HUB：14件参照/,'H02: rendered case meta must show 14 server-evidence players');
assert.match(elements.caseMeta.textContent,/2026-2027\.xlsm/,'H03: rendered case meta must show the authoritative source');
assert.equal(elements.q.value,'元の質問','H04: runner must restore the user input after deliberation');
assert.equal(context.searchDataEvidence('x').count,0,'H05: explicit packet must not leak into later questions');

const callsBefore=context.__formalCalls;
await assert.rejects(
  ()=>context.MAGI_FORMAL_UI_RUNNER_V2({question:'現時点のベストオーダーを審議して',evidence:{count:0,files:[],allCurrentTeamCheck:{players:[]}},selectionKind:'FULL_LINEUP'}),
  /14名|Evidence/,
  'H06: full-lineup deliberation must stop before the engine when authoritative evidence is incomplete'
);
assert.equal(context.__formalCalls,callsBefore,'H07: invalid full-lineup evidence must never reach the three-wise-men engine UI');

assert.ok(semanticSrc.includes('MAGI_FORMAL_UI_RUNNER_V2'),'H08: semantic entry must call the explicit-evidence runner');
assert.equal(semanticSrc.includes('window.searchDataEvidence='),false,'H09: semantic entry must not monkeypatch evidence lookup');
assert.equal(semanticSrc.includes('window.routeQuestion='),false,'H10: semantic entry must not monkeypatch the legacy router');
assert.ok(bootstrapSrc.includes('/magi-formal-runner-v357.js'),'H11: bootstrap must load the explicit-evidence runner');
assert.ok(bootstrapSrc.indexOf('/magi-formal-runner-v357.js')<bootstrapSrc.indexOf('/main-live-answer-v329.js'),'H12: explicit-evidence runner must load before semantic entry');
assert.equal(bootstrapSrc.includes('captureFormalRunner'),false,'H13: bootstrap must not capture the mutable global runMagi as the semantic runner');
assert.ok(indexSrc.includes('/magi-app-bootstrap-v357.js?v=357'),'H14: stabilization branch must use v357 bootstrap');
assert.equal(indexSrc.includes('/magi-app-bootstrap-v356.js'),false,'H15: obsolete bootstrap must not be loaded');

console.log('FORMAL EVIDENCE HANDOFF RESULT: 15/15 PASS');
