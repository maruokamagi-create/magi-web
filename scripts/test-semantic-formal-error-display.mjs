import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const semantic=readFileSync(new URL('../main-live-answer-v362.js',import.meta.url),'utf8');
const first=semantic.indexOf('function semanticFormalErrorDetails(');
const last=semantic.indexOf('function clearPreviousResult(){',first);
assert.ok(first>0&&last>first,'semantic error formatter must exist before question clearing');
const w={MAGI_LAST_FORMAL_ERROR:{}};
const describe=vm.runInNewContext('(()=>{'+semantic.slice(first,last)+';return semanticFormalErrorDetails;})()', {window:w});
assert.equal(describe({magiStage:'SECOND',failureClass:'provider_rate_limit',status:503}),
  '停止地点・原因分類：二次審議 ／ AI提供元の利用制限 ／ HTTP 503');
assert.equal(describe({magiStage:'SECOND',failureClass:'timeout',status:503}),
  '停止地点・原因分類：二次審議 ／ AI回答の時間切れ ／ HTTP 503');
assert.equal(describe({magiStage:'PRIMARY',failureClass:'provider_retryable_http',status:503}),
  '停止地点・原因分類：一次審議 ／ AI提供元の一時的な通信障害 ／ HTTP 503');
w.MAGI_LAST_FORMAL_ERROR={stage:'SECOND',failureClass:'model_unavailable',status:503};
assert.equal(describe({message:'3賢人の回答を一時的に取得できませんでした。'}),
  '停止地点・原因分類：二次審議 ／ AIモデルの一時利用不可 ／ HTTP 503',
  'preserve a previous formal error if the outer handler only received a generic message');
w.MAGI_LAST_FORMAL_ERROR={};
assert.equal(describe({failureClass:'api_key=SECRET',status:503}),
  '停止地点・原因分類：HTTP 503','untrusted causes are never displayed');
assert.equal(describe({}),'停止地点・原因分類：未確認（診断情報を取得できませんでした）');
assert.match(semantic,/window\.MAGI_LAST_FORMAL_ERROR=null;\s*window\.MAGI_LAST_UI_DELIBERATION_ERROR=null;/,
  'new question must clear previous diagnostics');
assert.match(semantic,/const diagnostic=semanticFormalErrorDetails\(e\)/,
  'canonical outer semantic handler MUST inspect error details');
assert.match(semantic,/処理を停止しました：\$\{txt\(e\?\.message\)[^\n]*\\n\$\{diagnostic\}/,
  'the outer status must present the actual diagnosis, not replace it with generic text');
assert.match(semantic,/正本Evidenceが揃わない、または画面と一致しない場合は結果を出しません/,
  'fail-closed request gating preserved');
console.log('PASS: real semantic error status exposes safe PRIMARY/SECOND diagnostic and handles lost metadata');
