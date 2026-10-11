import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const live=fs.readFileSync('server/api/magi/_live-answer.js','utf8');
const importLine="import { runDriveLiveAudit } from './_drive-live-audit.js';";
assert.ok(live.includes(importLine),'expected existing Drive adapter');
const isolated=live.replace(importLine,"const runDriveLiveAudit=async()=>{throw Error('direct Drive access prohibited in unit test')};");
const {buildLiveAnswer}=await import('data:text/javascript;base64,'+Buffer.from(isolated).toString('base64'));
const calls=[];
const auditProvider=async ({season,players})=>{
 calls.push({season,players});
 return {source:{name:season+'-source.xlsm'},extracted:{playersByName:{
  '宮村 龍':{batting:{AVG:'.325',OPS:'.812'}},
  '大野 竜暉':{batting:{AVG:'.341',OPS:'.900'}}
 }}};
};
const routed={route:'BATTING_LOOKUP',timeScope:'CAREER',players:['宮村 龍'],domains:['BATTING']};
const oldQuestion='宮村 龍の2025-2026年（旧チーム）のシーズン全体の打撃成績一覧を見せてください。';
const result=await buildLiveAnswer({question:oldQuestion,routed,auditProvider});
assert.equal(result.season,'old','explicit old season wins over misinterpreted CAREER');
assert.equal(calls.length,1,'one season only, not cross-year');
assert.equal(calls[0].season,'old');
assert.match(result.answer,/宮村 龍/);
calls.length=0;
const currentQuestion='大野 竜暉の2026-2027年（現チーム）のシーズン全体の打撃成績一覧を見せてください。';
const current=await buildLiveAnswer({question:currentQuestion,routed:{...routed,players:['大野 竜暉']},auditProvider});
assert.equal(current.season,'current');
assert.deepEqual(calls.map(x=>x.season),['current']);

const client=fs.readFileSync('main-live-answer-v362.js','utf8');
const a=client.indexOf('function reportQuery(result,original){');
const b=client.indexOf('async function waitFor(',a);
assert.ok(a>=0&&b>a,'report query function contract');
const contract=client.slice(a,b);
const env={};vm.runInNewContext('const txt=v=>String(v||"").trim();\n'+contract+'\nthis.reportQuery=reportQuery;',env);
const report=env.reportQuery;
const fake={
 reportKind:'BATTING',semantic:{players:['宮村 龍'],timeScope:'CAREER'}
};
assert.match(report(fake,oldQuestion),/宮村 龍の旧チーム打撃成績一覧/);
assert.doesNotMatch(report(fake,oldQuestion),/通算/);
assert.match(report({...fake,semantic:{players:['大野 竜暉'],timeScope:'CAREER'}},currentQuestion),/大野 竜暉の現チーム打撃成績一覧/);
assert.match(report({...fake,semantic:{players:['大野 竜暉'],timeScope:'CAREER'}},'大野 竜暉の全年度通算打撃成績'),/大野 竜暉の通算打撃成績一覧/);
console.log('SEASON REPORT PRIORITY: PASS — explicitly selected year survives mistaken CAREER model scope');
