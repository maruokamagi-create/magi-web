import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const integrity=readFileSync(new URL('../deliberation-integrity-v348.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../engine-ui-v187.js',import.meta.url),'utf8');
const guard=readFileSync(new URL('../magi-ui-runner-guard-v359.js',import.meta.url),'utf8');
const runner=readFileSync(new URL('../magi-formal-runner-v373.js',import.meta.url),'utf8');

const start=integrity.indexOf('async function postJSON(');
const end=integrity.indexOf('function normalizeCase(',start);
assert.ok(start>0&&end>start,'HTTP failure parser must be present');
let requests=0;
const reply={
  ok:false,status:503,
  headers:{get:key=>key==='x-magi-gemini-failure'?'provider_rate_limit':null},
  json:async()=>({
    error:'3賢人の回答を一時的に取得できませんでした。',
    code:'PERSONA_GENERATION_FAILED',
    retryExhausted:true,
    diagnostic:{failureClass:'provider_rate_limit'}
  })
};
const sandbox={
  fetch:async()=>{requests++;return reply;},
  emit(){},sleep:async()=>{},JSON,Math,
};
const postJSON=vm.runInNewContext('(()=>{'+integrity.slice(start,end)+';return postJSON})()',sandbox);
const failure=await postJSON('/api/magi/persona',{phase:'SECOND'},{}).then(
 ()=>{throw new Error('should reject unavailable persona');},
 err=>err
);
assert.equal(requests,1,'retryExhausted must not trigger extra paid/limited calls');
assert.equal(failure.code,'PERSONA_GENERATION_FAILED');
assert.equal(failure.status,503);
assert.equal(failure.failureClass,'provider_rate_limit');
assert.equal(failure.apiEndpoint,'/api/magi/persona');

const helperStart=ui.indexOf('function formalErrorContext(');
const helperEnd=ui.indexOf('  runMagi=async function(){',helperStart);
assert.ok(helperStart>0&&helperEnd>helperStart);
const makeUiDiagnostic=vm.runInNewContext('(()=>{'+ui.slice(helperStart,helperEnd)+';return formalErrorContext})()');
failure.magiStage='SECOND';
assert.equal(makeUiDiagnostic(failure),'二次審議 ／ AI提供元の利用制限 ／ HTTP 503');
assert.equal(makeUiDiagnostic({magiStage:'PRIMARY',failureClass:'timeout',status:503}),'一次審議 ／ AI回答の時間切れ ／ HTTP 503');
assert.equal(makeUiDiagnostic({magiStage:'SECOND',failureClass:'secret_key=abc',status:503}),'二次審議 ／ HTTP 503','untrusted failure strings are not displayed');
assert.match(ui,/MAGI_LAST_UI_DELIBERATION_ERROR=null/,'clear old UI error at start');
assert.match(ui,/MAGI_LAST_UI_DELIBERATION_ERROR=error/,'capture real failure');
assert.match(ui,/esc\(failureDetails\)/,'HTML-escape visible failure info');

const error=new Error('3賢人の回答を一時的に取得できませんでした。');
error.magiStage='SECOND';error.failureClass='provider_rate_limit';error.code='PERSONA_GENERATION_FAILED';error.status=503;
const status={textContent:'MAGI正式審議エラー — 完了済みの審議ログを保持しました。'};
const context={
  runMagi:async()=>undefined,
  document:{getElementById:()=>status,querySelector:()=>({textContent:'formal failure'})}
};
context.window=context;
context.MAGI_LAST_UI_DELIBERATION_ERROR=error;
vm.runInNewContext(guard,context,{filename:'magi-ui-runner-guard-v359.js'});
const actual=await context.runMagi().then(()=>null,e=>e);
assert.equal(actual,error,'guard must propagate the exact structured Error, not replace it with text');
assert.ok(runner.includes('failureClass:safeFailure||null'));
assert.ok(runner.includes('const diagnostic=[stage,code||(status?'));
assert.ok(!ui.includes('apiKey='),'no API secret in user-visible error');
console.log('PASS: SECOND provider failure type is visible and preserved without disclosing private content or extra provider retries');
