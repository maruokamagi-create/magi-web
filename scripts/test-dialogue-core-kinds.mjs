import assert from 'node:assert/strict';
import { debateKind, primaryDecisionSummary, challengesFromDialogue } from '../server/api/magi/dialogue.js';

assert.equal(debateKind({selectionKind:'FULL_LINEUP',question:'ベストオーダーは？'}),'FULL_LINEUP');
assert.equal(debateKind({selectionKind:'BATTING_ORDER',question:'3番は誰がいい？'}),'BATTING_ORDER');
assert.equal(debateKind({selectionKind:'PITCHING_ROLE',question:'クローザーは誰がいい？'}),'PITCHING_ROLE');
assert.equal(debateKind({selectionKind:'PITCHING_PLAN',question:'7回制の投手運用を考えて'}),'PITCHING_PLAN');
assert.equal(debateKind({question:'今日の練習どうだった？'}),'');

const primary={
  melchior:{persona:'MELCHIOR-1',candidatePlayers:['大野 竜暉','橋向 結都','大久保 陽翔','坂田 暉馬']},
  balthasar:{persona:'BALTHASAR-2',candidatePlayers:['中嶋 玲月','大野 竜暉','大久保 陽翔','橋向 結都']},
  casper:{persona:'CASPER-3',candidatePlayers:['中嶋 玲月','橋向 結都','大野 竜暉','大久保 陽翔']}
};

const batting=primaryDecisionSummary(primary,'BATTING_ORDER',{question:'3番は誰がいい？'});
assert.equal(batting.allSame,false);
assert.match(batting.disagreement.join(' '),/3番候補/);
assert.match(batting.disagreement.join(' '),/大野 竜暉/);
assert.match(batting.disagreement.join(' '),/中嶋 玲月/);

const closer=primaryDecisionSummary(primary,'PITCHING_ROLE',{question:'クローザーは誰がいい？'});
assert.equal(closer.allSame,false);
assert.match(closer.disagreement.join(' '),/クローザー候補/);

const plan=primaryDecisionSummary(primary,'PITCHING_PLAN',{question:'投手運用は？'});
assert.equal(plan.allSame,false);
assert.ok(plan.disagreement.some(x=>/先発/.test(x)));
assert.ok(plan.disagreement.some(x=>/第2投手/.test(x)));

const challenges=challengesFromDialogue([
  {speaker:'MELCHIOR-1',target:'BALTHASAR-2',statement:'Bへの確認'},
  {speaker:'BALTHASAR-2',target:'CASPER-3',statement:'Cへの確認'},
  {speaker:'CASPER-3',target:'MELCHIOR-1',statement:'Mへの確認'}
]);
assert.deepEqual(challenges.melchior,['Mへの確認']);
assert.deepEqual(challenges.balthasar,['Bへの確認']);
assert.deepEqual(challenges.casper,['Cへの確認']);

console.log('DIALOGUE CORE DEBATE KINDS: PASS');
