import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const routerSrc=fs.readFileSync(new URL('../cross-dialogue-router-v380.js',import.meta.url),'utf8');
const serverSrc=fs.readFileSync(new URL('../server/api/magi/dialogue.js',import.meta.url),'utf8');
const uiSrc=fs.readFileSync(new URL('../cross-dialogue-ui-v380.js',import.meta.url),'utf8');

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

assert.match(serverSrc,/sourceClaim.*exact copied substring|sourceClaim には sourceMaterial/s,'dialogue must ground every reply in an actual prior claim');
assert.match(serverSrc,/15打数以上は実用上十分/,'15 at-bats policy must be explicit');
assert.match(serverSrc,/相手投手の左右.*明示的に求めない限り/,'handedness must not be a default debate topic');
assert.match(serverSrc,/固定する.*言っていないのに固定起用を批判してはいけません/,'fabricated fixed-lineup criticism must be prohibited');
assert.match(uiSrc,/MAGI CONTROL\\s\*→/,'legacy CONTROL challenge cards must be removed when direct dialogue is present');
assert.match(uiSrc,/data-magi-direct-dialogue/,'direct dialogue exchanges must be rendered');

console.log('CROSS DIALOGUE V380: PASS');
