import assert from 'node:assert/strict';
import fs from 'node:fs';

const original=fs.readFileSync('server/api/magi/_team-game-range.js','utf8');
const statement="import { loadCanonicalTeamScoreTexts } from './_appearance-fielding-evidence.js';";
assert.ok(original.includes(statement));
const isolated=original.replace(statement,"const loadCanonicalTeamScoreTexts=async()=>{throw Error('unexpected live Drive read')};");
const {teamDateRangeFromQuestion,extractCanonicalScoreTotal,teamGameRangeFromOriginals}=await import('data:text/javascript;base64,'+Buffer.from(isolated).toString('base64'));

const fixtures=[
 ['2026-08-02','勝山クラブ','第1試合',false,'1\n10',10,1],
 ['2026-08-02','勝山クラブ','第2試合',true,'77',7,7],
 ['2026-08-09','丸岡南中','第1試合',false,'94',4,9],
 ['2026-08-09','丸岡南中','第2試合',true,'25\n4',25,4],
 ['2026-08-11','坂井中','第1試合',false,'45',5,4],
 ['2026-08-11','坂井中','第2試合',true,'35',3,5],
 ['2026-09-12','藤島中','第1試合',false,'43',3,4],
 ['2026-09-12','藤島中','第2試合',true,'42',4,2],
 ['2026-09-20','丸岡南','1回戦',false,'14',4,1],
 ['2026-09-21','三国','準決勝',false,'14\n5',5,14],
 ['2026-09-26','三国','準決勝',true,'01',0,1],
 ['2026-10-03','金津・芦原','第1試合',true,'1\n19',1,19],
 ['2026-10-03','金津・芦原','第2試合',false,'30',0,3],
 ['2026-10-10','春江中','第1試合',true,'14\n0',14,0],
 ['2026-10-10','春江中','第2試合',false,'2\n22',22,2]
];
const toItem=([date,opponent,game,first,total])=>{
 const oppLabel=opponent==='勝山クラブ'?'勝山':opponent==='三国'?'三国中':opponent;
 const teamLabel='丸岡中(丸岡クラブ)';
 const teams=first?teamLabel+'\n'+oppLabel:oppLabel+'\n'+teamLabel;
 return {
   def:{date,opponent,label:game,category:game.includes('試合')?'PRACTICE':'OFFICIAL'},
   file:{id:'original-'+date+'-'+game,name:'verified.pdf'},
   body:'スコア原本\nチーム名\n'+teams+'\n101\n200\n300\n8 9 10 11 12 合計\n'+total+'\n備考\n【勝】- 【負】-\n'
 };
};
const originals=fixtures.map(toItem);
for(let i=0;i<originals.length;i++){
 const outcome=extractCanonicalScoreTotal(originals[i].body,originals[i].def);
 assert.equal(outcome.runs,fixtures[i][5],'game '+i+' MARUOKA');
 assert.equal(outcome.allowed,fixtures[i][6],'game '+i+' opponent');
}
const all=teamGameRangeFromOriginals(originals,{from:'2026-08-02',to:'2026-10-10'});
assert.equal(all.gameCount,15);
assert.deepEqual([all.wins,all.losses,all.draws],[7,7,1]);
const oct=teamGameRangeFromOriginals(originals.slice(-2),{from:'2026-10-10',to:'2026-10-10'});
assert.equal(oct.gameCount,2);
assert.deepEqual([oct.wins,oct.losses,oct.draws],[2,0,0]);
assert.deepEqual(oct.games.map(g=>[g.runs,g.allowed]),[[14,0],[22,2]]);
assert.equal(teamGameRangeFromOriginals([],{from:'2026-10-11',to:'2026-10-11'}).gameCount,0);
assert.deepEqual(teamDateRangeFromQuestion('丸岡中の2026年10月1日から2026年10月10日までの試合成績'),{from:'2026-10-01',to:'2026-10-10'});
assert.deepEqual(teamDateRangeFromQuestion('2026/10/01〜2026/10/10のチーム戦績'),{from:'2026-10-01',to:'2026-10-10'});
assert.equal(teamDateRangeFromQuestion('2026年2月30日〜2026年3月2日'),null);
assert.equal(teamDateRangeFromQuestion('2026年10月11日〜2026年10月10日'),null);
assert.throws(()=>extractCanonicalScoreTotal('チーム名\n丸岡中\n春江中\n8 9 10 11 12 合計\n140\n備考',{opponent:'春江中'}),/AMBIGUOUS/);
assert.throws(()=>extractCanonicalScoreTotal('チーム名\n丸岡中\n春江中\n8 9 10 11 12 合計\n14\n0\n備考',{opponent:'金津・芦原'}),/IDENTITY/);
assert.throws(()=>teamGameRangeFromOriginals([{...originals[0],body:''}],{from:'2026-08-02',to:'2026-08-02'}),/ORIGINAL_MISSING/);
console.log('TEAM SCORE ORIGINALS PARSER: 15 verified fixture shapes, 7W/7L/1D, date ranges and fail-closed PASS');
