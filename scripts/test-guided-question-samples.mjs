import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sample=fs.readFileSync('question-sample-routes-v395.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const canonical=fs.readFileSync('server/api/magi/_roster.js','utf8');
const seasonRosters=key=>{
 const m=canonical.match(new RegExp('export const '+key+' = Object.freeze\\(\\[([\\s\\S]*?)\\]\\)'));
 assert.ok(m,'server registry includes '+key);
 return [...m[1].matchAll(/'([^']+)'/g)].map(v=>v[1]);
};
const grade3=seasonRosters('THIRD_YEAR_ROSTER');
const grade2=seasonRosters('SECOND_YEAR_ROSTER');
const grade1=seasonRosters('FIRST_YEAR_ROSTER');
assert.match(html,/\/question-sample-routes-v395\.js\?v=396/);
assert.doesNotMatch(html,/\/question-sample-routes-v394\.js/);
assert.doesNotMatch(sample,/name="playerText|type="text"|name="period"/,'no manual player-name field or disconnected season menu');
assert.doesNotMatch(sample,/\.click\(\)|MAGI_SEMANTIC_RUN_V2\(/,'no automatic semantic/deliberation run');
const injected=sample.replace(/\}\)\(\);\s*$/, 'window.__sampleTest={build,ROSTERS,SAMPLES,playerOptions,formFields,refreshPlayerOptions,starterQuestion};})();');
assert.notEqual(injected,sample,'harness exported helpers');
const window={addEventListener(){}};
const document={getElementById(){return null},documentElement:{}};
class MutationObserver{observe(){} disconnect(){}}
vm.runInNewContext(injected,{window,document,MutationObserver});
const {build,ROSTERS,SAMPLES,playerOptions,formFields,refreshPlayerOptions,starterQuestion}=window.__sampleTest;
assert.equal(window.MAGI_QUESTION_SAMPLE_ROUTES_META.version,'v395');
assert.equal(SAMPLES.length,12,'preserve all sample prompts');
assert.equal(SAMPLES.filter(x=>x.guided).length,7,'seven prompts use a guided dialog');
assert.deepEqual(Array.from(ROSTERS['2025-2026']),[...grade3,...grade2,...grade1]);
assert.deepEqual(Array.from(ROSTERS['2026-2027']),[...grade2,...grade1]);
assert.equal(ROSTERS['2025-2026'].length,23,'former team includes all 23 enrolled players');
assert.equal(ROSTERS['2026-2027'].length,14,'current team includes the active 14');
assert.ok(ROSTERS['2025-2026'].includes('宮村 龍'));
assert.ok(!ROSTERS['2026-2027'].includes('宮村 龍'));
assert.ok(ROSTERS['2025-2026'].includes('鰐渕 将太'));
assert.ok(!ROSTERS['2025-2026'].includes('鰐淵 将太'));
assert.equal((playerOptions('2025-2026').match(/<option/g)||[]).length,24);
assert.equal((playerOptions('2026-2027').match(/<option/g)||[]).length,15);
for(const id of ['PLAYER_BATTING','PLAYER_PITCHING','PLAYER_FIELDING','PLAYER_COMPARE','STARTER_EVAL']){
 const fields=formFields(id);
 assert.match(fields,/name="season"/,'season chosen before player');
 assert.match(fields,/name="player"/,'player selection present');
 assert.doesNotMatch(fields,/<input[^>]+type="text"/,'manual player input absent');
}
const one={value:'宮村 龍',innerHTML:''},two={value:'宮嵜 翔',innerHTML:''},year={value:'2025-2026'};
const form={querySelector(sel){assert.equal(sel,'select[name="season"]');return year},querySelectorAll(){return [one,two]}};
refreshPlayerOptions(form);
assert.equal(one.value,'','clear stale player when season changes');
assert.equal((one.innerHTML.match(/<option/g)||[]).length,24);
year.value='2026-2027';refreshPlayerOptions(form);
assert.equal((one.innerHTML.match(/<option/g)||[]).length,15);
assert.ok(!one.innerHTML.includes('宮村 龍'),'graduated player removed after changing year');
const oldBatting=build('PLAYER_BATTING',{season:'2025-2026',player:'宮村 龍'});
assert.match(oldBatting,/宮村 龍の2025-2026年（旧チーム）のシーズン全体の打撃成績一覧/);
const currentBatting=build('PLAYER_BATTING',{season:'2026-2027',player:'大野 竜暉'});
assert.match(currentBatting,/大野 竜暉の2026-2027年（現チーム）のシーズン全体の打撃成績一覧/);
assert.match(build('PLAYER_PITCHING',{season:'2025-2026',player:'宮嵜 翔'}),/宮嵜 翔.*旧チーム.*投手成績一覧/);
assert.match(build('PLAYER_FIELDING',{season:'2025-2026',player:'宮村 龍'}),/宮村 龍.*旧チーム.*守備成績一覧/);
assert.throws(()=>build('PLAYER_BATTING',{season:'2026-2027',player:'宮村 龍'}),/選手リスト/);
assert.throws(()=>build('PLAYER_BATTING',{season:'2025-2026',player:'存在しない選手'}),/選手リスト/);
assert.throws(()=>build('PLAYER_BATTING',{season:'2024-2025',player:'宮村 龍'}),/対象年度/);
assert.match(build('PLAYER_COMPARE',{season:'2025-2026',player:'宮村 龍',player2:'宮嵜 翔',axis:'打撃'}),/2025-2026年（旧チーム）.*宮村 龍と宮嵜 翔/);
assert.throws(()=>build('PLAYER_COMPARE',{season:'2025-2026',player:'宮村 龍',player2:'宮村 龍'}),/異なる選手/);
assert.match(build('STARTER_EVAL',{season:'2025-2026',player:'宮村 龍'}),/2025-2026年（旧チーム）当時/);
assert.equal(build('STARTER_EVAL',{season:'2026-2027',player:'大野 竜暉'}),starterQuestion('大野 竜暉','2026-2027'));
assert.match(build('TEAM_RECORD',{start:'2026-09-20',end:'2026-10-10'}),/2026年09月20日から2026年10月10日まで/);
assert.throws(()=>build('TEAM_RECORD',{start:'2026-10-11',end:'2026-10-01'}),/開始日以降/);
assert.match(build('BATTING_SLOT',{slot:'3'}),/3番打者/);
for(const id of ['BEST_ORDER','ACE_SELECTION','PITCHING_PLAN_7','TEAM_REVIEW','STARTER_EVAL']){
 assert.ok(SAMPLES.find(s=>s.id===id),'retains original sample '+id);
}
console.log('SEASON PLAYER PICKER: PASS — 23 historical, 14 current, no typed field, exact-year results, safe switching');
