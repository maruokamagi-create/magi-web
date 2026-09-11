import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../engine-ui-v187.js', import.meta.url), 'utf8');
const start = source.indexOf('  const pitchingPlanMode=');
const end = source.indexOf('\n\n  const css=`', start);
if (start < 0 || end < 0) throw new Error('selection helper block not found in engine-ui-v187.js');

const helperBlock = source.slice(start, end);
const helpers = vm.runInNewContext(`(()=>{const list=v=>(Array.isArray(v)?v:[]).filter(Boolean);${helperBlock};return{pitchingPlanMode,fullLineupMode,selectionMode,selectionKind,candidateText};})()`);
const { pitchingPlanMode, fullLineupMode, selectionMode, selectionKind, candidateText } = helpers;

const cases = [
  ['U01','投手リレーどう組む？',true],
  ['U02','継投どうする？',true],
  ['U03','投手運用考えて',true],
  ['U04','7回制で先発・第2投手・終盤・クローザーどう組む？',true],
  ['U05','3番だれ？',true],
  ['U06','クローザー誰？',true],
  ['U07','守備位置どうする？',true],
  ['U08','ベストオーダー考えて',true],
  ['U09','大野をクローザー固定すべき？',false],
  ['U10','大野の投手成績教えて',false],
  ['U11','継投の意味',false],
  ['U12','クローザーとは',false]
];

const kindCases = [
  ['K01','投手リレーどう組む？','pitching'],
  ['K02','ベストオーダー考えて','lineup'],
  ['K03','3番だれ？','generic'],
  ['K04','大野をクローザー固定すべき？','proposal']
];

let passed = 0;
let total = 0;
const check = (id, ok, detail) => {
  total++;
  if (ok) passed++;
  else process.exitCode = 1;
  console.log(`${id} ${ok ? 'PASS' : 'FAIL'} ${detail}`);
};

for (const [id, question, expected] of cases) {
  const actual = Boolean(selectionMode(question));
  check(id, actual === expected, `expected=${expected} actual=${actual} :: ${question}`);
}

for (const [id, question, expected] of kindCases) {
  const actual = selectionKind(question);
  check(id, actual === expected, `expected=${expected} actual=${actual} :: ${question}`);
}

check('H01', pitchingPlanMode('継投どうする？') === true, 'pitching plan helper recognizes natural relay wording');
check('H02', fullLineupMode('打順どう組む？') === true, 'full lineup helper recognizes natural lineup wording');

const pitchingText = candidateText({candidatePlayers:['A','B','C','D']}, 'pitching');
check('R01', pitchingText === '先発 A / 第2投手 B / 終盤 C / クローザー D', `actual=${pitchingText}`);
const lineupText = candidateText({candidatePlayers:['A','B','C']}, 'lineup');
check('R02', lineupText === '1番 A / 2番 B / 3番 C', `actual=${lineupText}`);
check('R03', source.includes("result.final.mode==='PITCHING_PLAN'"), 'production UI has pitching-plan final renderer');
check('R04', source.includes("result.final.mode==='FULL_LINEUP'"), 'production UI has full-lineup final renderer');

console.log(`ENGINE UI SELECTION RESULT: ${passed}/${total} PASS`);
