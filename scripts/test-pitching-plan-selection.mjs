import assert from 'node:assert/strict';
import { buildConsensusPitchingPlan, isPitchingPlanQuestion, validatePitchingPlanOrder } from '../server/api/magi/_pitching-plan.js';
import { buildPitchingPlanResult } from '../server/api/magi/orchestrate.js';

assert.equal(isPitchingPlanQuestion('7回制の投手運用を先発→第2投手→終盤→クローザーで組んで'),true);
assert.equal(isPitchingPlanQuestion({selectionKind:'PITCHING_PLAN',question:'投手を考えて'}),true);
assert.equal(isPitchingPlanQuestion('投手リレーどう組む？'),true);
assert.equal(isPitchingPlanQuestion('継投どうする？'),true);
assert.equal(isPitchingPlanQuestion('先発とクローザーどう組む？'),true);
assert.equal(isPitchingPlanQuestion('クローザーは誰がいい？'),false);
assert.equal(isPitchingPlanQuestion('先発は誰がいい？'),false);

const good=['橋向 結都','大久保 陽翔','坂田 暉馬','大野 竜暉'];
assert.equal(validatePitchingPlanOrder(good).ok,true);
assert.equal(validatePitchingPlanOrder(['橋向 結都','橋向 結都','坂田 暉馬','大野 竜暉']).ok,false);
assert.equal(validatePitchingPlanOrder(['宮嵜 翔','大久保 陽翔','坂田 暉馬','大野 竜暉']).ok,false);

const second={
  melchior:{persona:'MELCHIOR',candidatePlayers:['橋向 結都','大久保 陽翔','坂田 暉馬','大野 竜暉'],confidence:'MEDIUM',primaryReason:'現記録と母数を優先。',warnings:[],reviewRequested:false,dataConflict:false},
  balthasar:{persona:'BALTHASAR',candidatePlayers:['大久保 陽翔','橋向 結都','坂田 暉馬','大野 竜暉'],confidence:'HIGH',primaryReason:'役割分担を重視。',warnings:[],reviewRequested:false,dataConflict:false},
  casper:{persona:'CASPER',candidatePlayers:['橋向 結都','大久保 陽翔','大野 竜暉','坂田 暉馬'],confidence:'MEDIUM',primaryReason:'役割集中を避ける。',warnings:[],reviewRequested:false,dataConflict:false}
};
const cross={agreement:['4役で運用案を比較する。'],disagreement:['先発と終盤の配置が分かれる。'],domainConflicts:[],warnings:[],informationGaps:[],challenges:{melchior:['先発 橋向 結都の母数で固定してよいですか。'],balthasar:['第2投手 橋向 結都の配置根拠は十分ですか。'],casper:['終盤 大野 竜暉への役割集中をどう見ますか。']}};

const consensus=buildConsensusPitchingPlan(second);
assert.ok(consensus);
assert.equal(consensus.plan.length,4);
assert.ok(['melchior','balthasar','casper'].includes(consensus.selectedFromPersona));
const selected=second[consensus.selectedFromPersona].candidatePlayers;
assert.deepEqual(consensus.plan.map(x=>x.name),selected);
assert.ok(consensus.roleConflicts.length>0);

const final=buildPitchingPlanResult(second,cross);
assert.equal(final.mode,'PITCHING_PLAN');
assert.equal(final.status,'PITCHING_PLAN_RESULT');
assert.equal(final.plan.length,4);
assert.deepEqual(final.plan.map(x=>x.roleLabel),['先発','第2投手','終盤','クローザー']);
assert.match(final.recommendation,/先発/);
assert.match(final.recommendation,/クローザー/);

const broken={...second,casper:{...second.casper,candidatePlayers:['橋向 結都','大久保 陽翔','大野 竜暉']}};
const review=buildPitchingPlanResult(broken,cross);
assert.equal(review.status,'PITCHING_PLAN_REVIEW_REQUIRED');
assert.equal(review.plan.length,0);

console.log('PITCHING PLAN SELECTION RESULT: PASS');
