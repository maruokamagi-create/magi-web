import assert from 'node:assert/strict';
import { applySemanticGuard } from '../server/api/magi/_semantic-postguard.js';

const uncertain={semanticVersion:'stub',mode:'CLARIFY',confidence:'LOW',players:[],domains:['OTHER'],timeScope:'UNSPECIFIED',clarificationQuestion:'何をしますか？'};

const generic=applySemanticGuard('ベストオーダーを1番から9番まで組んで',[],uncertain);
assert.equal(generic.mode,'DELIBERATION');
assert.equal(generic.confidence,'HIGH');
assert.ok(generic.domains.includes('LINEUP'));
assert.equal(generic.timeScope,'CURRENT_SEASON');
assert.equal(generic.clarificationQuestion,'');

const generic2=applySemanticGuard('次の試合の打順どうする？',[],uncertain);
assert.equal(generic2.mode,'DELIBERATION');
assert.ok(generic2.domains.includes('TACTICS'));

const today=applySemanticGuard('今日のベストオーダーは？',[],{...uncertain,clarificationQuestion:'今日の対戦相手を教えてください。'});
assert.equal(today.mode,'CLARIFY');
assert.match(today.clarificationQuestion,/対戦相手/);

const oldTeam=applySemanticGuard('3年生も入れてベストオーダー',[],{...uncertain,clarificationQuestion:'旧チームを含む仮想ベストオーダーですか？'});
assert.equal(oldTeam.mode,'CLARIFY');

const singleSlot=applySemanticGuard('3番は誰がいい？',[],uncertain);
assert.equal(singleSlot.mode,'CLARIFY');

console.log('FULL LINEUP SEMANTIC ROUTE RESULT: 5/5 PASS');
