import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildConsensusLineup } from '../server/api/magi/_full-lineup.js';

const names=['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','大久保 夢翔','上村 蓮','橋向 結都','武澤 大翔'];
const second={
 melchior:{candidatePlayers:names},
 balthasar:{candidatePlayers:[names[0],names[1],names[4],names[2],names[3],names[5],names[7],names[6],'井坂 悠聖']},
 casper:{candidatePlayers:[names[0],names[1],names[2],names[3],names[4],names[8],names[7],names[6],'武田 晴琉翔']}
};
assert.equal(buildConsensusLineup(second).decisionStatus,'DEADLOCK');
const final={mode:'FULL_LINEUP',status:'LINEUP_REVIEW_REQUIRED',finalVote:'1-1-1',
 deliberationDecision:'DEADLOCK',fieldingStatus:'NOT_EVALUATED',lineup:[],reviewReason:'FULL_LINEUP_DEADLOCK_1_1_1'};
const original=async()=>({second,final});
const win={MAGI_ENGINE_V1:{version:'serial-integrity',deliberate:original}};
vm.runInNewContext(readFileSync(new URL('../lineup-finalizer-v350.js',import.meta.url),'utf8'),{window:win});
assert.equal(win.MAGI_ENGINE_V1.deliberate,original,'retired client asset must not alter the formal engine');
const out=await win.MAGI_ENGINE_V1.deliberate();
assert.equal(out.final.status,'LINEUP_REVIEW_REQUIRED');
assert.equal(out.final.finalVote,'1-1-1');
assert.deepEqual(out.final.lineup,[]);
const boot=readFileSync(new URL('../magi-app-bootstrap-v363.js',import.meta.url),'utf8');
assert.doesNotMatch(boot,/await load\(\x60\/lineup-finalizer-v350\.js/);
assert.doesNotMatch(boot,/waitCapability\(finalizerReady\)/);
assert.match(boot,/waitCapability\(integrityReady\)/,'preserve authentic engine integrity guard');

const ui=readFileSync(new URL('../final-decision-emphasis-v340.js',import.meta.url),'utf8');
const start=ui.indexOf('function structuredLineup(){');
const end=ui.indexOf('function parseLineup(',start);
assert.ok(start>0&&end>start);
const source=ui.slice(start,end);
const check=vm.runInNewContext('(()=>{'+source+'return structuredLineup;})()',{window:{MAGI_LAST_DELIBERATION_RESULT:{final}}});
assert.equal(check(),null,'a 1-1-1 deadlock cannot be turned into nine display cards');
const bad={...final,status:'LINEUP_RESULT',fieldingStatus:'NOT_EVALUATED',
 lineup:names.map((name,i)=>({slot:i+1,name}))};
const fail=vm.runInNewContext('(()=>{'+source+'return structuredLineup;})()',{window:{MAGI_LAST_DELIBERATION_RESULT:{final:bad}}});
assert.equal(fail(),null,'nine hitter names do not prove standard defense');
const verified={...bad,fieldingStatus:'COMPLETE',
 lineup:names.map((name,i)=>({slot:i+1,name,position:['捕','遊','一','二','中','投','左','三','右'][i]}))};
const good=vm.runInNewContext('(()=>{'+source+'return structuredLineup;})()',{window:{MAGI_LAST_DELIBERATION_RESULT:{final:verified}}});
assert.equal(good().lineup.length,9);
const duplicate={...verified,lineup:verified.lineup.map((r,i)=>({...r,position:i===8?'左':r.position}))};
const no=vm.runInNewContext('(()=>{'+source+'return structuredLineup;})()',{window:{MAGI_LAST_DELIBERATION_RESULT:{final:duplicate}}});
assert.equal(no(),null,'same player-position slot cannot fill two defensive positions');
assert.match(ui,/if\(isFullLineup&&!structured\)return false/);
const reasons=readFileSync(new URL('../lineup-reasons-v415.js',import.meta.url),'utf8');
assert.match(reasons,/if\(r\?\.final\?\.status!=='LINEUP_RESULT'\|\|r\?\.final\?\.fieldingStatus!=='COMPLETE'\)return renderDeadlock\(r\)/);
assert.match(reasons,/\/\^\[1-9\]\$\/\.test\(slot\)/,'invalid null batting order is omitted');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/lineup-reasons-v415\.js\?v=425/);
assert.match(html,/final-decision-emphasis-v340\.js\?v=381/);
assert.match(html,/magi-app-bootstrap-v363\.js\?v=431/);
console.log('PASS: true 1-1-1 server deadlock stays unresolved, no selected nine or fake defensive assignments');
