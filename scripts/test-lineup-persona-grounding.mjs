import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSuccessfulPersona } from '../server/api/magi/persona-resilient.js';
import { personaFullLineupIssues } from '../server/api/magi/persona.js';

const personaSrc=fs.readFileSync(new URL('../server/api/magi/persona.js',import.meta.url),'utf8');
assert.match(personaSrc,/PRIMARY publicStatement must not be only a nine-name announcement/);
assert.match(personaSrc,/SECOND publicStatement must explicitly answer at least one concrete point/);
assert.match(personaSrc,/specific slot\/player comparison and include at least one exact supplied number/);
assert.match(personaSrc,/STANDARD DEFENSE ELIGIBILITY/);
assert.match(personaSrc,/official game or in 練習第1試合/);

const guardOrder=['大野 竜暉','大久保 陽翔','嶋田 栄志','中嶋 玲月','坂田 暉馬','武澤 大翔','上村 蓮','橋向 結都','武田 晴琉翔'];
const standardPositions=['捕','遊','中','一','二','右','三','投','左'];
const standardCase={evidence:{appearanceFielding:{status:'COMPLETE',players:guardOrder.map((name,i)=>({
  name,
  appearance:{officialStartingPositions:{[standardPositions[i]]:1},practiceFirstStartingPositions:{},startingPositions:{[standardPositions[i]]:1},recentStartingPositions:{[standardPositions[i]]:1}},
  fielding:{positions:{[standardPositions[i]]:1}}
}))}}};
assert.equal(personaFullLineupIssues({candidatePlayers:guardOrder},true,standardCase).length,0);
const substituteOnlyCase={evidence:{appearanceFielding:{status:'COMPLETE',players:guardOrder.map((name,i)=>({
  name,
  appearance:{officialStartingPositions:{},practiceFirstStartingPositions:{},startingPositions:{[standardPositions[i]]:1},recentStartingPositions:{}},
  fielding:{positions:{[standardPositions[i]]:1}}
}))}}};
assert.match(personaFullLineupIssues({candidatePlayers:guardOrder},true,substituteOnlyCase).join(' '),/FULL_LINEUP_STANDARD_DEFENSE/);

const body={case:{question:'ベストオーダーは？',selectionKind:'FULL_LINEUP',evidence:{}}};
const order=['大野 竜暉','坂田 暉馬','中嶋 玲月','大久保 陽翔','嶋田 栄志','鰐渕 将太','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const raw={
  persona:'BALTHASAR-2',phase:'SECOND',candidatePlayers:order,
  candidateBasis:'今の打撃記録を重視する。キャプテンの大久保 陽翔を4番に据えて精神的な柱にする。',
  facts:[],analysis:['中嶋 玲月の数字を中軸で活用する。','半年後の成長も見据える。'],prediction:[],
  confidence:'MEDIUM',judgment:'BLUE',primaryReason:'主将としての役割を4番に生かす。',
  publicStatement:'1番大野 竜暉くん、2番坂田 暉馬くん、3番中嶋 玲月くん、4番大久保 陽翔くんでいく。キャプテンの4番起用で精神的なまとまりを作る。',
  warnings:[],dataConflict:false,reviewRequested:false,reviewReason:'',changedFromPrimary:false,changeReason:''
};
const cleaned=sanitizeSuccessfulPersona(body,raw);
const all=JSON.stringify(cleaned);
assert.doesNotMatch(all,/キャプテン|主将として|精神的な柱|精神的なまとまり|半年後/);
assert.deepEqual(cleaned.candidatePlayers,order);
assert.match(cleaned.publicStatement,/1番大野 竜暉/);
assert.doesNotMatch(cleaned.publicStatement,/くん|君/);
assert.match(cleaned.analysis.join(' '),/中嶋 玲月/);

const futureBody={case:{question:'半年後を見据えたベストオーダーは？',selectionKind:'FULL_LINEUP',evidence:{}}};
const future=sanitizeSuccessfulPersona(futureBody,{...raw,publicStatement:'半年後の成長も見据えて考える。'});
assert.match(future.publicStatement,/半年後/);

// Real UI helper regression: a 2–1 adjacent swap is a disputed batting decision,
// not evidence that the majority's fourth hitter has superior batting numbers.
const uiSrc=fs.readFileSync(new URL('../lineup-reasons-v415.js',import.meta.url),'utf8');
const browser={
  window:{},
  document:{readyState:'loading',documentElement:{},addEventListener(){}},
  MutationObserver:class{observe(){}},
  setInterval(){return 1;},
  clearInterval(){},
  console
};
vm.runInNewContext(uiSrc,browser,{filename:'lineup-reasons-v415.js'});
const reviews=browser.window.MAGI_LINEUP_REASONS_V415_API.adjacentSwapReviews;
assert.equal(typeof reviews,'function');
const currentOrder=['大野 竜暉','大久保 陽翔','中嶋 玲月','嶋田 栄志','坂田 暉馬','武澤 大翔','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const swapOrder=[...currentOrder];[swapOrder[3],swapOrder[4]]=[swapOrder[4],swapOrder[3]];
const judges=[
  {label:'メルキオール',order:currentOrder},
  {label:'バルタザール',order:swapOrder},
  {label:'カスパー',order:currentOrder}
];
const batting=new Map([
  ['嶋田栄志',{AB:39,AVG:'.282',OBP:'.364',SLG:'.385',OPS:'.748'}],
  ['坂田暉馬',{AB:26,AVG:'.308',OBP:'.438',SLG:'.423',OPS:'.861'}]
]);
const conflict=reviews(judges,currentOrder,batting);
assert.equal(conflict.length,1);
assert.equal(conflict[0].firstSlot,4);
assert.equal(conflict[0].secondSlot,5);
assert.match(conflict[0].text,/4番嶋田 栄志・5番坂田 暉馬/);
assert.match(conflict[0].text,/少数派（バルタザール）/);
assert.match(conflict[0].text,/\.748/);
assert.match(conflict[0].text,/\.861/);
assert.match(conflict[0].text,/OPS・長打率は坂田 暉馬が高い/);
assert.match(conflict[0].text,/打順位置の優位性を証明しません/);
assert.equal(reviews(judges.map(j=>({...j,order:currentOrder})),currentOrder,batting).length,0);
const missing=reviews(judges,currentOrder,new Map());
assert.match(missing[0].text,/数値Evidence未取得/);
assert.match(missing[0].text,/優劣は保留/);
assert.equal(reviews(judges,currentOrder.slice(0,8),batting).length,1);
assert.match(uiSrc,/for\(const review of adjacentSwapReviews\(entries,names,statsMap\)\)/);
console.log('LINEUP PERSONA GROUNDING: PASS');
