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

const relay=applySemanticGuard('投手リレーどう組む？',[],uncertain);
assert.equal(relay.mode,'DELIBERATION');
assert.ok(relay.domains.includes('PITCHING'));

const twoRoles=applySemanticGuard('先発とクローザーどう組む？',[],uncertain);
assert.equal(twoRoles.mode,'DELIBERATION');

const gameSpecific=applySemanticGuard('今日の継投どうする？',[],{...uncertain,clarificationQuestion:'今日の対戦相手を教えてください。'});
assert.equal(gameSpecific.mode,'CLARIFY');
assert.match(gameSpecific.clarificationQuestion,/対戦相手/);

const singleStarter=applySemanticGuard('先発は誰がいい？',[],uncertain);
assert.equal(singleStarter.mode,'CLARIFY');

const singleCloser=applySemanticGuard('クローザー誰がいい？',[],uncertain);
assert.equal(singleCloser.mode,'CLARIFY');

console.log('PITCHING PLAN SEMANTIC ROUTE RESULT: 6/6 PASS');
