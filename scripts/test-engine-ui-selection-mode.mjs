import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../engine-ui-v187.js', import.meta.url), 'utf8');
const match = source.match(/const selectionMode=q=>\{([\s\S]*?)\n  \};/);
if (!match) throw new Error('selectionMode source not found in engine-ui-v187.js');

const selectionMode = vm.runInNewContext(`(q=>{${match[1]}\n})`);

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

let passed = 0;
for (const [id, question, expected] of cases) {
  const actual = Boolean(selectionMode(question));
  const ok = actual === expected;
  console.log(`${id} ${ok ? 'PASS' : 'FAIL'} expected=${expected} actual=${actual} :: ${question}`);
  if (!ok) process.exitCode = 1;
  else passed++;
}

console.log(`ENGINE UI SELECTION RESULT: ${passed}/${cases.length} PASS`);
