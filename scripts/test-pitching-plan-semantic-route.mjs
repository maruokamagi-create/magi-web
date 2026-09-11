import assert from 'node:assert/strict';
import { applySemanticGuard } from '../server/api/magi/_semantic-postguard.js';

const uncertain={semanticVersion:'stub',mode:'CLARIFY',confidence:'LOW',players:[],domains:['OTHER'],timeScope:'UNSPECIFIED',clarificationQuestion:'何をしますか？'};

const plan=applySemanticGuard('7回制の投手運用を先発→第2投手→終盤→クローザーの4役で組んで',[],uncertain);
assert.equal(plan.mode,'DELIBERATION');
assert.equal(plan.confidence,'HIGH');
assert.ok(plan.domains.includes('PITCHING'));
assert.ok(plan.domains.includes('TACTICS'));
assert.equal(plan.timeScope,'CURRENT_SEASON');
assert.equal(plan.clarificationQuestion,'');
assert.equal(plan.gameInnings,7);

const relay=applySemanticGuard('投手リレーどう組む？',[],uncertain);
assert.equal(relay.mode,'DELIBERATION');
assert.ok(relay.domains.includes('PITCHING'));
assert.equal(relay.gameInnings,7);

const twoRoles=applySemanticGuard('先発とクローザーどう組む？',[],uncertain);
assert.equal(twoRoles.mode,'DELIBERATION');

const nineContext=applySemanticGuard('投手リレーどう組む？',[{role:'user',text:'次の試合は7回じゃなく9回制'}],uncertain);
assert.equal(nineContext.mode,'DELIBERATION');
assert.equal(nineContext.gameInnings,9);
assert.match(nineContext.understoodRequest,/9回制/);

const nineExplicit=applySemanticGuard('9回制の投手運用どう組む？',[],uncertain);
assert.equal(nineExplicit.mode,'DELIBERATION');
assert.equal(nineExplicit.gameInnings,9);

const gameSpecific=applySemanticGuard('今日の継投どうする？',[],{...uncertain,clarificationQuestion:'今日の対戦相手を教えてください。'});
assert.equal(gameSpecific.mode,'CLARIFY');
assert.match(gameSpecific.clarificationQuestion,/対戦相手/);

const singleStarter=applySemanticGuard('先発は誰がいい？',[],uncertain);
assert.equal(singleStarter.mode,'CLARIFY');

const singleCloser=applySemanticGuard('クローザー誰がいい？',[],uncertain);
assert.equal(singleCloser.mode,'CLARIFY');

console.log('PITCHING PLAN SEMANTIC ROUTE RESULT: 8/8 PASS');
