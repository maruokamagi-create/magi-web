import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync(new URL('../drive-index-resilience-v303.js',import.meta.url),'utf8');

function makeContext(fetchImpl){
  const ctx={AbortController,setTimeout,clearTimeout,Promise,TypeError,Error,console};
  ctx.window=ctx;
  ctx.fetch=fetchImpl;
  vm.createContext(ctx);
  vm.runInContext(src,ctx);
  return ctx;
}

let calls=0;
let ctx=makeContext(async()=>{
  calls++;
  if(calls<3)throw new TypeError('Load failed');
  return{status:200,ok:true};
});
let response=await ctx.fetch('/api/drive/index',{cache:'no-store'});
assert.equal(response.status,200);
assert.equal(calls,3,'Load failed must be retried automatically');

calls=0;
ctx=makeContext(async()=>{
  calls++;
  return{status:calls===1?503:200,ok:calls>1};
});
response=await ctx.fetch('/api/drive/index');
assert.equal(response.status,200);
assert.equal(calls,2,'temporary 5xx must be retried');

calls=0;
ctx=makeContext(async()=>{calls++;return{status:401,ok:false};});
response=await ctx.fetch('/api/drive/index');
assert.equal(response.status,401);
assert.equal(calls,1,'auth failures must not be retried');

calls=0;
ctx=makeContext(async()=>{calls++;return{status:200,ok:true};});
response=await ctx.fetch('/api/magi/core');
assert.equal(response.status,200);
assert.equal(calls,1,'non-Drive requests must stay untouched');

console.log('DRIVE INDEX RETRY: PASS');
