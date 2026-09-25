import assert from 'node:assert/strict';
import { needsCrossEvidenceAnalysis } from '../server/api/magi/core.js';

const cases=[
 ['今のチームの弱点は？',{mode:'GENERAL',players:[],domains:['TEAM'],understoodRequest:'現チームの弱点を知りたい'},true],
 ['現チームの強みを分析して',{mode:'GENERAL',players:[],domains:['TEAM'],understoodRequest:'現チームの強みを分析する'},true],
 ['新チームはどう変わった？',{mode:'GENERAL',players:[],domains:['TEAM'],understoodRequest:'新チームの変化を知りたい'},true],
 ['大久保 夢翔をどう評価する？',{mode:'GENERAL',players:['大久保 夢翔'],domains:['TEAM'],understoodRequest:'大久保 夢翔の現在の評価'},true],
 ['大野 竜暉の課題は？',{mode:'GENERAL',players:['大野 竜暉'],domains:['TEAM'],understoodRequest:'大野 竜暉の課題'},true],
 ['橋向 結都の今の状態は？',{mode:'GENERAL',players:['橋向 結都'],domains:['TEAM'],understoodRequest:'橋向 結都の現在の状態'},true],
 ['大野 竜暉の打率は？',{mode:'SINGLE_VALUE',players:['大野 竜暉'],domains:['BATTING'],understoodRequest:'大野 竜暉の打率'},false],
 ['今季何勝何敗？',{mode:'SUMMARY',players:[],domains:['TEAM'],understoodRequest:'今季の勝敗'},false]
];
let pass=0;for(const [q,s,want] of cases){const got=needsCrossEvidenceAnalysis(q,s);assert.equal(got,want,q);pass++;console.log('PASS',q,'=>',got?'EVIDENCE_DELIBERATION':'DIRECT_LOOKUP');}
console.log(`NATURAL EVALUATION ROUTING RESULT: ${pass}/${cases.length} PASS`);
