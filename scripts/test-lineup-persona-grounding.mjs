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

const splitNames=disputedCurrent.evidence.allCurrentTeamCheck.players.map(p=>p.name);
const withActualSources={
 ...disputedCurrent,
 evidence:{
  ...disputedCurrent.evidence,
  battingOrderSplits:{status:'COMPLETE',players:splitNames.map(name=>({
    name,slots:name==='嶋田 栄志'?[{
      slot:4,standard:{batting:{PA:'13',AB:'11',H:'3',AVG:'.273',OBP:'.385',SLG:'.364',OPS:'.749'}},challenge:{batting:{PA:'7'}}
    },{
      slot:5,standard:{batting:{PA:'0',AB:'0',H:'0'}},challenge:{batting:{PA:'3'}}
    }]:name==='坂田 暉馬'?[{
      slot:4,standard:{batting:{PA:'4',AB:'3',H:'2',AVG:'.667',OBP:'.750',OPS:'1.417'}},challenge:{batting:{PA:'1'}}
    },{
      slot:5,standard:{batting:{PA:'8',AB:'6',H:'2',AVG:'.333',OBP:'.500',OPS:'.833'}},challenge:{batting:{PA:'0'}}
    }]:[]
  }))},
  appearanceFielding:{
    status:'COMPLETE',appearanceStatus:'COMPLETE',players:splitNames.map(name=>({
      name,appearance:{status:'COMPLETE',latestStarts:name==='嶋田 栄志'?
      [{date:'2026-09-21',order:4,competitionType:'OFFICIAL'},
       {date:'2026-09-27',order:5,competitionType:'PRACTICE',practiceRole:'CHALLENGE_GAME_2'},
       {date:'2026-10-03',order:4,competitionType:'PRACTICE',practiceRole:'REGULAR_GAME_1'}]:
      name==='坂田 暉馬'?[{date:'2026-09-25',order:5,competitionType:'OFFICIAL'}]:[]}
    }))
  },
  normalizedObservationStatus:'COMPLETE',normalizedObservations:[
    {recordedAt:'2026-09-26 08:12',sourceType:'指導者',player:'嶋田 栄志',statement:'打席でスイングを確認した。',handling:'観察'},
    {recordedAt:'2026-08-02 12:15',sourceType:'指導者',player:'嶋田 栄志',statement:'打順の起用案。',handling:'観察'},
    {recordedAt:'2026-09-26',sourceType:'保護者',player:'坂田 暉馬',statement:'打率が良くなっている。',handling:'観察'}
  ]
 }
};
const enriched=buildContestedAdjacentSlotEvidence(withActualSources,{candidatePlayers:ownSecondaryOrder},ownCross);
assert.equal(enriched.length,1);
const sh=enriched[0].players[0],sa=enriched[0].players[1];
assert.deepEqual(enriched[0].slots,[4,5]);
assert.equal(sh.actualBattingSlots[0].standard.PA,'13');
assert.equal(sh.actualBattingSlots[0].standard.OPS,'.749');
assert.equal(sh.actualBattingSlots[1].standard.status,'NO_RECORDED_PA');
assert.equal(sh.actualBattingSlots[1].challengePA,'3');
assert.deepEqual(sh.recentEligibleStarts.map(x=>x.date),['2026-09-21','2026-10-03']);
assert.equal(sh.datedCoachBattingObservations.length,1);
assert.equal(sh.datedCoachBattingObservations[0].recordedAt,'2026-09-26 08:12');
assert.equal(sh.datedCoachBattingObservations[0].policyVerified,false);
assert.equal(sa.actualBattingSlots[0].standard.PA,'4');
assert.equal(sa.actualBattingSlots[1].standard.OPS,'.833');
assert.deepEqual(sa.datedCoachBattingObservations,[]);
const actualSecond=buildPersonaRequest({case:withActualSources,primarySelf:{candidatePlayers:ownSecondaryOrder},crossExamination:ownCross},'balthasar','SECOND').payload;
assert.equal(actualSecond.contestedAdjacentSlotEvidence[0].players[0].actualBattingSlots[0].standard.PA,'13');
assert.match(actualSecond.instruction,/actualBattingSlots.standard/);
assert.match(actualSecond.instruction,/challengePA/);
assert.match(actualSecond.instruction,/recordedAt/);
const primaryActual=buildPersonaRequest({case:withActualSources},'balthasar','PRIMARY').payload;
assert.equal('contestedAdjacentSlotEvidence' in primaryActual,false);
// A missing, partial or corrupt source never creates a fictional zero rate.
for(const badStatus of ['PARTIAL','UNAVAILABLE']){
 const c={...withActualSources,evidence:{...withActualSources.evidence,
  battingOrderSplits:{...withActualSources.evidence.battingOrderSplits,status:badStatus},
  appearanceFielding:{...withActualSources.evidence.appearanceFielding,status:badStatus}}};
 const r=buildContestedAdjacentSlotEvidence(c,{candidatePlayers:ownSecondaryOrder},ownCross);
 assert.equal(r[0].players[0].actualBattingSlots,null);
 assert.equal(r[0].players[0].recentEligibleStarts,null);
}
const withDuplicate={...withActualSources,evidence:{...withActualSources.evidence,battingOrderSplits:{
 ...withActualSources.evidence.battingOrderSplits,
 players:[...withActualSources.evidence.battingOrderSplits.players.slice(1),withActualSources.evidence.battingOrderSplits.players[1]]
}}};
assert.equal(buildContestedAdjacentSlotEvidence(withDuplicate,{candidatePlayers:ownSecondaryOrder},ownCross)[0].players[0].actualBattingSlots,null);
const withImpossible={...withActualSources,evidence:{...withActualSources.evidence,battingOrderSplits:{
 ...withActualSources.evidence.battingOrderSplits,
 players:withActualSources.evidence.battingOrderSplits.players.map(p=>p.name==='嶋田 栄志'?{...p,slots:[{slot:4,standard:{batting:{PA:'2',AB:'4',H:'3'}},challenge:{batting:{PA:'0'}}}]}:p)
}}};
assert.equal(buildContestedAdjacentSlotEvidence(withImpossible,{candidatePlayers:ownSecondaryOrder},ownCross)[0].players[0].actualBattingSlots[0].standard.status,'UNVERIFIED');

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


// A genuine 1-1-1 final has NO chosen nine. Display a *comparison*, not
// misleading final-1-to-9 cards. A local 2:1 on 4/5 is not overall majority.
const api=browser.window.MAGI_LINEUP_REASONS_V415_API;
const uiSecond={
  melchior:{candidatePlayers:ownSecondaryOrder},
  balthasar:{candidatePlayers:[...ownSecondaryOrder.slice(0,3),ownSecondaryOrder[4],ownSecondaryOrder[3],...ownSecondaryOrder.slice(5)]},
  casper:{candidatePlayers:ownSecondaryOrder.map((name,i)=>i===5?ownSecondaryOrder[7]:i===7?ownSecondaryOrder[5]:name)}
};
const uiEntries=Object.entries(uiSecond).map(([key,value])=>({
  key,label:{melchior:'メルキオール',balthasar:'バルタザール',casper:'カスパー'}[key],
  value,order:value.candidatePlayers
}));
assert.equal(api.version,'lineup-reasons-v422');
const swaps=api.localAdjacentSwaps(uiEntries);
assert.equal(swaps.length,1);
assert.equal(swaps[0].firstSlot,4);
assert.equal(swaps[0].secondSlot,5);
assert.equal(swaps[0].left,'嶋田 栄志');
assert.equal(swaps[0].right,'坂田 暉馬');
assert.deepEqual(Array.from(swaps[0].supporting),['メルキオール','カスパー']);
assert.equal(swaps[0].dissent,'バルタザール');
const sample4=api.recordedSlotSample(withActualSources.evidence,'嶋田 栄志',4);
assert.equal(sample4.status,'RECORDED');
assert.equal(sample4.PA,13);
assert.match(sample4.text,/標準試合 13打席・11打数・3安打/);
assert.match(sample4.text,/OPS \.749/);
assert.match(sample4.text,/練習第2試合 7打席（別枠）/);
const noPA=api.recordedSlotSample(withActualSources.evidence,'嶋田 栄志',5);
assert.equal(noPA.status,'NO_PA');
assert.match(noPA.text,/標準試合0打席・0打数/);
assert.match(noPA.text,/練習第2試合 3打席/);
const panels=api.recordedDisputeCards(uiEntries,withActualSources.evidence);
assert.equal(panels.length,1);
assert.equal(panels[0].people.length,2);
assert.equal(panels[0].people[0].records.length,2);
assert.match(panels[0].people[0].starts,/2026-10-03 4番／練習第1試合/);
assert.doesNotMatch(panels[0].people[0].starts,/2026-09-27/);
assert.match(panels[0].people[0].coach,/2026-09-26 08:12/);
assert.match(panels[0].people[0].coach,/現在の固定方針ではありません/);
assert.doesNotMatch(panels[0].people[1].coach,/2026-09-26 08:12/);
const deadlock={
  case:{evidence:withActualSources.evidence},
  second:uiSecond,
  final:{mode:'FULL_LINEUP',status:'LINEUP_REVIEW_REQUIRED',finalVote:'1-1-1',lineup:[]}
};
const html=api.deadlockDisputeHtml(deadlock);
assert.match(html,/全9人案は1対1対1/);
assert.match(html,/最終オーダーは確定していません/);
assert.match(html,/バルタザールは逆順/);
assert.match(html,/4番の実績/);
assert.match(html,/5番の実績/);
assert.match(html,/13打席/);
assert.match(html,/標準試合0打席/);
assert.match(html,/2026-10-03/);
assert.match(html,/2026-09-26 08:12/);
assert.match(html,/打席数が少ない場合/);
assert.doesNotMatch(html,/最終ベストオーダー/);
const escapedObs={...withActualSources.evidence,normalizedObservations:[
 {recordedAt:'2026-10-08',sourceType:'指導者',player:'嶋田 栄志',statement:'打順 <img src=x onerror=bad()> を確認した。'}
]};
const injected=api.deadlockDisputeHtml({...deadlock,case:{evidence:escapedObs}});
assert.match(injected,/&lt;img/);
assert.doesNotMatch(injected,/<img/);
const partialUi={...withActualSources.evidence,battingOrderSplits:{...withActualSources.evidence.battingOrderSplits,status:'PARTIAL'}};
assert.equal(api.recordedSlotSample(partialUi,'嶋田 栄志',4).status,'UNAVAILABLE');
const fakeUi={...withActualSources.evidence,battingOrderSplits:{...withActualSources.evidence.battingOrderSplits,players:withImpossible.evidence.battingOrderSplits.players}};
assert.equal(api.recordedSlotSample(fakeUi,'嶋田 栄志',4).status,'UNAVAILABLE');
const duplicateUi={...withActualSources.evidence,battingOrderSplits:withDuplicate.evidence.battingOrderSplits};
assert.equal(api.recordedSlotSample(duplicateUi,'嶋田 栄志',4).status,'UNAVAILABLE');
assert.equal(api.recordedSlotSample({...withActualSources.evidence,allCurrentTeamCheck:{status:'PARTIAL',players:withActualSources.evidence.allCurrentTeamCheck.players}},'嶋田 栄志',4).status,'UNAVAILABLE');
assert.equal(api.deadlockDisputeHtml({...deadlock,final:{...deadlock.final,lineup:ownSecondaryOrder.map(name=>({name}))}}),'');
assert.equal(api.deadlockDisputeHtml({...deadlock,final:{...deadlock.final,status:'LINEUP_RESULT'}}),'');
assert.equal(api.deadlockDisputeHtml({...deadlock,final:{...deadlock.final,finalVote:'2-1'}}),'');
// Public render path must accept the deadlock's zero lineup without inventing one.
assert.match(uiSrc,/if\(finalNames\(r\)\.length!==9\)return renderDeadlock\(r\)/);
assert.match(uiSrc,/html\+=recordedDisputeHtml\(entries,r\?\.case\?\.evidence\|\|\{\}\)/);
assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/lineup-reasons-v415\.js\?v=422/);

console.log('LINEUP PERSONA GROUNDING: PASS');
