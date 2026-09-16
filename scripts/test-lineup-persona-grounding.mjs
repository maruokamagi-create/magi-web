import assert from 'node:assert/strict';
import { sanitizeSuccessfulPersona } from '../server/api/magi/persona-resilient.js';

const body={case:{question:'ベストオーダーは？',selectionKind:'FULL_LINEUP',evidence:{}}};
const order=['大野 竜暉','坂田 暉馬','中嶋 玲月','大久保 陽翔','嶋田 栄志','鰐渕 将太','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const raw={
  persona:'BALTHASAR-2',phase:'SECOND',candidatePlayers:order,
  candidateBasis:'今の打撃記録を重視する。キャプテンの大久保 陽翔を4番に据えて精神的な柱にする。',
  facts:[],analysis:['中嶋 玲月の数字を中軸で活用する。','半年後の成長も見据える。'],prediction:[],
  confidence:'MEDIUM',judgment:'BLUE',primaryReason:'主将としての役割を4番に生かす。',
  publicStatement:'1番大野 竜暉、2番坂田 暉馬、3番中嶋 玲月、4番大久保 陽翔でいく。キャプテンの4番起用で精神的なまとまりを作る。',
  warnings:[],dataConflict:false,reviewRequested:false,reviewReason:'',changedFromPrimary:false,changeReason:''
};
const cleaned=sanitizeSuccessfulPersona(body,raw);
const all=JSON.stringify(cleaned);
assert.doesNotMatch(all,/キャプテン|主将として|精神的な柱|精神的なまとまり|半年後/);
assert.deepEqual(cleaned.candidatePlayers,order);
assert.match(cleaned.publicStatement,/1番大野 竜暉/);
assert.match(cleaned.analysis.join(' '),/中嶋 玲月/);

const futureBody={case:{question:'半年後を見据えたベストオーダーは？',selectionKind:'FULL_LINEUP',evidence:{}}};
const future=sanitizeSuccessfulPersona(futureBody,{...raw,publicStatement:'半年後の成長も見据えて考える。'});
assert.match(future.publicStatement,/半年後/);
console.log('LINEUP PERSONA GROUNDING: PASS');
