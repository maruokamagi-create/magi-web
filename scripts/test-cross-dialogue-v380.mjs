import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const routerSrc=fs.readFileSync(new URL('../cross-dialogue-router-v380.js',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server/api/magi/dialogue.js',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../chat-ui-canonical-v387.js',import.meta.url),'utf8');
const languageSrc=fs.readFileSync(new URL('../magi-user-language-v382.js',import.meta.url),'utf8');
const indexSrc=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

function context(fetchImpl){
  const ctx={console,JSON,Promise,Set,Map,String,Number,RegExp};
  ctx.window=ctx;
  ctx.fetch=fetchImpl;
  vm.createContext(ctx);
  vm.runInContext(routerSrc,ctx);
  return ctx;
}

let calls=[];
let ctx=context(async(url)=>{calls.push(String(url));return{ok:true,status:200};});
await ctx.fetch('/api/magi/orchestrate',{method:'POST',body:JSON.stringify({phase:'CROSS_EXAMINATION',case:{question:'ベストオーダーは？'}})});
assert.deepEqual(calls,['/api/magi/dialogue'],'full lineup cross must use direct Wise Men dialogue');

calls=[];
ctx=context(async(url)=>{calls.push(String(url));return{ok:true,status:200};});
await ctx.fetch('/api/magi/orchestrate',{method:'POST',body:JSON.stringify({phase:'FINAL',case:{question:'ベストオーダーは？'}})});
assert.deepEqual(calls,['/api/magi/orchestrate'],'non-cross traffic must stay untouched');

calls=[];
ctx=context(async(url)=>{calls.push(String(url));if(String(url)==='/api/magi/dialogue')return{ok:false,status:500};return{ok:true,status:200};});
await ctx.fetch('/api/magi/orchestrate',{method:'POST',body:JSON.stringify({phase:'CROSS_EXAMINATION',case:{question:'ベストオーダーは？'}})});
assert.deepEqual(calls,['/api/magi/dialogue','/api/magi/orchestrate'],'dialogue failure must fall back to the existing cross route');

assert.match(serverSrc,/sourceClaim.*exact copied substring|sourceClaim には targetSourceMaterial/s,'dialogue must ground every reply in an actual prior claim');
assert.match(serverSrc,/15打数以上は実用上十分/,'15 at-bats policy must be explicit');
assert.match(serverSrc,/相手投手の左右.*明示的に求めない限り/,'handedness must not be a default debate topic');
assert.match(serverSrc,/急いでいる.*焦っている|急ぎ\|焦り/,'fabricated urgency motives must be prohibited');
assert.match(serverSrc,/半年後.*来年.*将来.*未来/,'arbitrary future horizon must be prohibited for current lineup questions');
assert.match(serverSrc,/試合は待ってくれない\|勝ちに行くぞ/,'Balthasar canned rhetoric must be rejected');
assert.match(serverSrc,/一番得点を取れる.*圧倒的/,'unsupported tactical certainty must be rejected');

assert.match(uiSrc,/MAGI_CHAT_UI_CANONICAL_V387/,'canonical chat renderer must be active');
assert.match(uiSrc,/fullLineupNeverRendersLegacyControlTargetRows:true/,'full lineup must never render legacy CONTROL target cards');
assert.match(uiSrc,/fetch\('\/api\/magi\/dialogue'/,'canonical renderer must hydrate direct dialogue itself');
assert.match(uiSrc,/dialogue\.forEach\(turn=>directRow/,'direct Wise Men dialogue must be rendered from canonical dialogue data');
assert.doesNotMatch(uiSrc,/controlTargetFor/,'canonical renderer must not reconstruct CONTROL-to-persona challenge cards');
assert.doesNotMatch(uiSrc,/MAGI CONTROL\s*→/,'canonical renderer must not emit legacy CONTROL target headers');

const full=uiSrc.slice(uiSrc.indexOf('function renderFullLineup'),uiSrc.indexOf('function wireEvidence'));
const primary=full.indexOf('for(const item of primary)personRow');
const opening=full.indexOf("controlRow(body,controlOpeningText(result),'争点整理')");
const dialogue=full.indexOf('dialogue.forEach(turn=>directRow');
const closing=full.indexOf("controlRow(body,controlClosingText(),'相互検証まとめ')");
const second=full.indexOf("addPhase(body,'二次判定')");
assert.ok(primary>=0&&opening>primary&&dialogue>opening&&closing>dialogue&&second>closing,'canonical phase order must be primary -> CONTROL opening -> direct dialogue -> CONTROL closing -> SECOND');

assert.match(languageSrc,/カスペル\/g,'カスパー'/,'CASPER display typo must be normalized in MAGI results');
assert.match(indexSrc,/chat-ui-canonical-v387\.js\?v=387/,'production HTML must load canonical chat renderer v387');
assert.doesNotMatch(indexSrc,/chat-ui-v196\.js/,'production HTML must not load the legacy chat renderer');
assert.doesNotMatch(indexSrc,/cross-dialogue-ui-v380\.js/,'production HTML must not load the post-hoc dialogue patcher');
assert.match(indexSrc,/magi-user-language-v382\.js\?v=385/,'production HTML must load current language normalization revision');

console.log('CROSS DIALOGUE CANONICAL V387: PASS');
