import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const guardSrc=await readFile(new URL('../magi-ui-runner-guard-v359.js',import.meta.url),'utf8');
const truthSrc=await readFile(new URL('../magi-ui-truth-v359.js',import.meta.url),'utf8');
const bootstrapSrc=await readFile(new URL('../magi-app-bootstrap-v359.js',import.meta.url),'utf8');
const indexSrc=await readFile(new URL('../index.html',import.meta.url),'utf8');

const elements={
  status:{textContent:''},
  response:{textContent:'',classList:{hidden:false,remove(name){if(name==='show')this.hidden=true;}}},
  caseMeta:{innerHTML:'審議案件番号：MAGI-TEST<br>審議方式：選択審議<br>DATA HUB：0件参照<br>参照ファイル：<br>ENGINE：Gemini v1.0',get textContent(){return this.innerHTML.replace(/<br>/g,' ').replace(/<[^>]+>/g,'');},insertAdjacentHTML(_where,html){this.innerHTML+=html;}}
};
const document={
  getElementById:id=>elements[id]||null,
  querySelector:sel=>sel==='.engineError'?null:null
};
const context={console,document};
context.window=context;
context.MAGI_PROGRESS_V358={error:()=>{}};
context.runMagi=async()=>{};
vm.createContext(context);
vm.runInContext(guardSrc,context,{filename:'magi-ui-runner-guard-v359.js'});
context.MAGI_FORMAL_UI_RUNNER_V3=async()=>undefined;
vm.runInContext(truthSrc,context,{filename:'magi-ui-truth-v359.js'});
const guarded=context.MAGI_UI_TRUTH_V359_API.installFormalRunnerGuard();

const names=['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'];
const evidence={
  count:14,
  files:['丸岡中軟式野球部_通算成績一覧2026-2027.xlsm','打撃詳細2026-2027.csv'],
  numericEvidenceContract:{currentBattingNumbersProvided:true,currentPlayersWithCoreBatting:14},
  allCurrentTeamCheck:{players:names.map(name=>({name,batting:{AVG:'.250',AB:'20',OPS:'.700'}}))}
};
await guarded({selectionKind:'FULL_LINEUP',evidence});
assert.match(elements.caseMeta.textContent,/DATA HUB：14件参照/,'V359-01 stale DATA HUB 0 must be replaced with server Evidence count');
assert.match(elements.caseMeta.textContent,/2026-2027\.xlsm/,'V359-02 authoritative source file must be visible');

// A completed response that falsely says supplied numbers are missing must never stay public.
elements.response.classList.hidden=false;
elements.response.textContent='2026-2027今季通算の数値データは提供されていない';
await assert.rejects(()=>guarded({selectionKind:'FULL_LINEUP',evidence}),/FALSE_MISSING_DATA_RESULT_BLOCKED/,'V359-03 false missing-data result must fail closed');
assert.equal(elements.response.classList.hidden,true,'V359-04 false result must be hidden');

// Legacy UI failures are swallowed by engine-ui; the guard must surface them to the formal runner.
context.runMagi=async()=>{elements.status.textContent='MAGI正式審議エラー — 完了済みの審議ログを保持しました。';};
// New VM because guard installs only once.
const c2={console,document:{getElementById:id=>elements[id]||null,querySelector:()=>null}};c2.window=c2;c2.runMagi=context.runMagi;vm.createContext(c2);vm.runInContext(guardSrc,c2);
await assert.rejects(()=>c2.runMagi(),/正式3賢人UI|MAGI正式審議エラー/,'V359-05 swallowed UI error must propagate');

assert.ok(indexSrc.includes('/magi-app-bootstrap-v359.js?v=359'),'V359-06 index must use v359 bootstrap');
assert.equal(indexSrc.includes('/engine-progress-v188.js'),false,'V359-07 legacy progress engine must not load');
assert.equal(indexSrc.includes('/magi-app-bootstrap-v358.js'),false,'V359-08 obsolete bootstrap must not load');
assert.ok(bootstrapSrc.includes('/engine-progress-v358.js'),'V359-09 only event-driven progress engine is loaded by bootstrap');
assert.ok(bootstrapSrc.includes('/magi-ui-runner-guard-v359.js'),'V359-10 UI error propagation guard must load before formal runner');
assert.ok(bootstrapSrc.indexOf('/magi-ui-runner-guard-v359.js')<bootstrapSrc.indexOf('/magi-formal-runner-v358.js'),'V359-11 guard must wrap runMagi before v358 captures it');
assert.ok(bootstrapSrc.includes('MAGI_FORMAL_UI_RUNNER_V2=guarded'),'V359-12 semantic entry must use UI-truth guarded runner');

console.log('UI TRUTH V359 RESULT: 12/12 PASS');
