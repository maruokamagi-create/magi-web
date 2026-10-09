import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeSuccessfulPersona } from '../server/api/magi/persona-resilient.js';
import { personaFullLineupIssues, buildPersonaRequest } from '../server/api/magi/persona.js';
import { buildContestedAdjacentSlotEvidence } from '../server/api/magi/_lineup-contested-evidence.js';

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

const disputedCurrent={
  question:'ベストオーダーは？',
  selectionKind:'FULL_LINEUP',
  evidence:{
    allCurrentTeamCheck:{
      status:'COMPLETE',
      players:['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'].map(name=>({
        name,batting:name==='嶋田 栄志'?{AB:39,AVG:'.282',SLG:'.385',OPS:'.748'}:name==='坂田 暉馬'?{AB:26,AVG:'.308',SLG:'.423',OPS:'.861'}:{AB:4,AVG:'.250',OPS:'.600'}
      }))
    },
    recentSix:{status:'COMPLETE',gameCount:6,players:[{name:'嶋田 栄志',batting:{AB:21,AVG:'.238',OPS:'.638'}},{name:'坂田 暉馬',batting:{AB:16,AVG:'.250',OPS:'.775'}}]}
  }
};
const ownSecondaryOrder=['大野 竜暉','大久保 陽翔','中嶋 玲月','嶋田 栄志','坂田 暉馬','武澤 大翔','橋向 結都','井坂 悠聖','武田 晴琉翔'];
const ownCross={disagreement:['4番と5番で意見が割れています。'],challenges:['4番嶋田 栄志と5番坂田 暉馬の順番を再比較してください。']};
const pairs=buildContestedAdjacentSlotEvidence(disputedCurrent,{candidatePlayers:ownSecondaryOrder},ownCross);
assert.equal(pairs.length,1);
assert.deepEqual(pairs[0].slots,[4,5]);
assert.equal(pairs[0].players[0].name,'嶋田 栄志');
assert.equal(pairs[0].players[0].current.OPS,'.748');
assert.equal(pairs[0].players[1].current.OPS,'.861');
assert.equal(pairs[0].players[1].recentSix.OPS,'.775');
assert.deepEqual(buildContestedAdjacentSlotEvidence(disputedCurrent,{candidatePlayers:ownSecondaryOrder},{disagreement:['4番に意見があります']}),[]);
assert.deepEqual(buildContestedAdjacentSlotEvidence({...disputedCurrent,evidence:{...disputedCurrent.evidence,allCurrentTeamCheck:{status:'UNAVAILABLE',players:disputedCurrent.evidence.allCurrentTeamCheck.players}}},{candidatePlayers:ownSecondaryOrder},ownCross),[]);
const secondPayload=buildPersonaRequest({case:disputedCurrent,primarySelf:{candidatePlayers:ownSecondaryOrder},crossExamination:ownCross},'melchior','SECOND').payload;
assert.equal(secondPayload.contestedAdjacentSlotEvidence.length,1);
assert.match(secondPayload.instruction,/CONTESTED ADJACENT SLOTS/);
assert.match(secondPayload.instruction,/relative batting-slot advantage is NOT demonstrated/);
assert.match(secondPayload.instruction,/Total at-bats alone describe sample size/);
const primaryPayload=buildPersonaRequest({case:disputedCurrent},'melchior','PRIMARY').payload;
assert.equal('contestedAdjacentSlotEvidence' in primaryPayload,false);
assert.match(fs.readFileSync(new URL('../server/api/magi/persona-batch.js',import.meta.url),'utf8'),/contestedAdjacentSlotEvidence: payload.contestedAdjacentSlotEvidence/);

console.log('LINEUP PERSONA GROUNDING: PASS');
