import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const routerSrc=fs.readFileSync(new URL('../cross-dialogue-router-v380.js',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server/api/magi/dialogue.js',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../cross-dialogue-ui-v380.js',import.meta.url),'utf8');
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
assert.match(uiSrc,/row\.className=`magiMsg \$\{speaker\.cls\}`/,'direct dialogue chat identity must be the actual Wise Man');
assert.match(uiSrc,/speaker\.img/,'direct dialogue must use the actual Wise Man portrait');
assert.match(uiSrc,/speaker\.jp/,'direct dialogue must use the actual Wise Man name');
assert.match(uiSrc,/controlInterventionRestored:true/,'MAGI CONTROL intervention must be restored');
assert.match(uiSrc,/preservesSecondJudgment:true/,'cross-dialogue patch must preserve second judgments');
assert.match(uiSrc,/removesDuplicateCrossBlocks:true/,'cross-dialogue patch must remove duplicated cross blocks');
assert.match(uiSrc,/dialogueHydrationFallback:true/,'missing embedded dialogue must be hydrated from the direct dialogue route');
assert.match(uiSrc,/persistentChatObserver:true/,'late-render chat must remain patchable');
assert.match(uiSrc,/new MutationObserver/,'late chat rendering must be observed');
assert.match(uiSrc,/fetch\('\/api\/magi\/dialogue'/,'UI must recover direct dialogue when the final result lacks it');
assert.match(uiSrc,/phaseOrder:'PRIMARY_CONTROL_DIALOGUE_SECOND'/,'phase order must be primary -> control/dialogue -> second judgment');
assert.match(uiSrc,/while\(node&&node!==secondStart\)/,'existing cross section must be replaced rather than appended');
const opening=uiSrc.indexOf("controlChat(controlOpeningText(result),'争点整理')");
const dialogue=uiSrc.indexOf('for(const turn of dialogue)');
const closing=uiSrc.indexOf("controlChat(controlClosingText(),'相互検証まとめ')");
const second=uiSrc.indexOf("phaseNode('二次判定')");
assert.ok(opening>=0&&dialogue>opening&&closing>dialogue&&second>closing,'MAGI CONTROL and Wise Men dialogue must appear before SECOND JUDGMENT');
assert.match(languageSrc,/カスペル\/g,'カスパー'/,'CASPER display typo must be normalized in MAGI results');
assert.match(indexSrc,/cross-dialogue-ui-v380\.js\?v=386/,'production HTML must load cross-dialogue UI revision v386');
assert.match(indexSrc,/magi-user-language-v382\.js\?v=385/,'production HTML must load current language normalization revision');

console.log('CROSS DIALOGUE V386: PASS');
