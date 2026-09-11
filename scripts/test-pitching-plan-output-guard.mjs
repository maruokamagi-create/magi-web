import assert from 'node:assert/strict';
import { validatePitchingPlanPersonaOutput, validatePitchingPlanCrossOutput } from '../server/api/magi/_pitching-plan-output-guard.js';

const players=[
  {name:'井坂 悠聖',pitching:null},
  {name:'大久保 陽翔',pitching:{APP:'6',ERA:'2.80',IP:'20.0',SO:'22',BB:'7'}},
  {name:'大野 竜暉',pitching:{APP:'5',ERA:'2.10',IP:'12.0',SO:'15',BB:'4'}},
  {name:'坂田 暉馬',pitching:{APP:'3',ERA:'3.20',IP:'7.0',SO:'6',BB:'3'}},
  {name:'嶋田 栄志',pitching:null},{name:'武澤 大翔',pitching:null},
  {name:'橋向 結都',pitching:{APP:'7',ERA:'2.40',IP:'24.0',SO:'24',BB:'8'}},
  {name:'上村 蓮',pitching:null},
  {name:'大久保 夢翔',pitching:{APP:'2',ERA:'4.20',IP:'5.0',SO:'5',BB:'2'}},
  {name:'長侶 穹',pitching:null},{name:'中嶋 玲月',pitching:null},{name:'吉田 真翔',pitching:null},{name:'鰐渕 将太',pitching:null},{name:'武田 晴琉翔',pitching:null}
];
const CASE={
  mode:'selection',selectionKind:'PITCHING_PLAN',question:'7回制の投手運用を先発→第2投手→終盤→クローザーで組んで',
  evidence:{allCurrentTeamCheck:{status:'COMPLETE',players},sampleSizeRule:'率系指標は登板数・投球回などの母数とセットで読む。小さい母数を安定した実力と断定しない。'}
};
function result(overrides={}){return{candidateBasis:'',facts:[],analysis:[],prediction:[],primaryReason:'',publicStatement:'',warnings:[],reviewReason:'',changeReason:'',...overrides};}

assert.deepEqual(validatePitchingPlanPersonaOutput(CASE,result({publicStatement:'先発は橋向 結都、第2投手は大久保 陽翔、終盤は大野 竜暉、クローザーは坂田 暉馬とします。'})),[]);

let issues=validatePitchingPlanPersonaOutput(CASE,result({analysis:['現チームで投球記録が確認できる選手は4人しかいません。']}));
assert.ok(issues.some(x=>x.includes('実数5人')));

issues=validatePitchingPlanPersonaOutput(CASE,result({analysis:['大野 竜暉は防御率2.10で安定した投球をしています。']}));
assert.ok(issues.some(x=>x.includes('安定性')));

issues=validatePitchingPlanPersonaOutput(CASE,result({warnings:['坂田 暉馬はクローザーとして十分な母数には達していません。']}));
assert.ok(issues.some(x=>x.includes('母数基準')));

issues=validatePitchingPlanPersonaOutput(CASE,result({analysis:['大野 竜暉はクローザー適性がある。']}));
assert.ok(issues.some(x=>x.includes('役割適性')));

const cross={agreement:['今季の投手記録を比較する。'],disagreement:[],domainConflicts:[],warnings:['坂田 暉馬はクローザーとして十分な母数には達していない。'],informationGaps:[],challenges:{melchior:['先発 橋向 結都をどう見るか。'],balthasar:['第2投手 大久保 陽翔をどう見るか。'],casper:['クローザー 坂田 暉馬をどう見るか。']}};
issues=validatePitchingPlanCrossOutput(CASE,cross);
assert.ok(issues.some(x=>x.includes('母数基準')));

const withThreshold={...CASE,evidence:{...CASE.evidence,sampleThreshold:'クローザー候補は最低5登板を母数基準とする'}};
issues=validatePitchingPlanPersonaOutput(withThreshold,result({warnings:['坂田 暉馬はクローザーとして十分な母数には達していません。']}));
assert.deepEqual(issues,[]);

console.log('PITCHING PLAN OUTPUT GUARD RESULT: PASS');
