import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../runmagi-ready-bridge-v330.js',import.meta.url),'utf8');
const sandbox={window:{},setTimeout,Promise,Date,Error};
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'runmagi-ready-bridge-v330.js'});

assert.equal(typeof sandbox.window.runMagi,'function','bridge must install runMagi while loader is still pending');
const captured=sandbox.window.runMagi;
const pending=captured.call({scope:'test'},'payload');
setTimeout(()=>{
  sandbox.window.runMagi=function(value){return `READY:${value}`;};
},120);
const result=await pending;
assert.equal(result,'READY:payload','captured bridge must delegate to the real runMagi after delayed loader initialization');

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bridgePos=index.indexOf('/runmagi-ready-bridge-v330.js');
const semanticPos=index.indexOf('/main-live-answer-v329.js?v=330');
assert.ok(bridgePos>=0,'index must load the readiness bridge');
assert.ok(semanticPos>=0,'index must load semantic-first handler');
assert.ok(bridgePos<semanticPos,'readiness bridge must load before semantic-first handler captures runMagi');

console.log('PASS runMagi delayed-bootstrap bridge');
