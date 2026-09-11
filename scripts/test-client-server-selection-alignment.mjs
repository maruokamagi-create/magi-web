import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isPitchingPlanQuestion } from '../server/api/magi/_pitching-plan.js';
import { isFullLineupQuestion } from '../server/api/magi/_full-lineup.js';

const source = readFileSync(new URL('../engine-ui-v187.js', import.meta.url), 'utf8');
const start = source.indexOf('  const pitchingPlanMode=');
const end = source.indexOf('\n\n  const css=`', start);
if (start < 0 || end < 0) throw new Error('client selection helper block not found');
const helperBlock = source.slice(start, end);
const { pitchingPlanMode, fullLineupMode, selectionMode, selectionKind } = vm.runInNewContext(`(()=>{const list=v=>(Array.isArray(v)?v:[]).filter(Boolean);${helperBlock};return{pitchingPlanMode,fullLineupMode,selectionMode,selectionKind};})()`);

const orchestrateSource = readFileSync(new URL('../server/api/magi/orchestrate.js', import.meta.url), 'utf8');
const selectionMatch = orchestrateSource.match(/export function isSelectionCase\(caseData\) \{([\s\S]*?)\n\}/);
if (!selectionMatch) throw new Error('server isSelectionCase source not found');
const isSelectionCase = vm.runInNewContext(`(function(caseData){${selectionMatch[1]}\n})`, { isPitchingPlanQuestion, isFullLineupQuestion });

const cases = [
  ['A01','投手リレーどう組む？','pitching'],
  ['A02','継投どうする？','pitching'],
  ['A03','7回制で先発・第2投手・終盤・クローザーどう組む？','pitching'],
  ['A04','ベストオーダー考えて','lineup'],
  ['A05','打順どう組む？','lineup'],
  ['A06','オーダー作って','lineup'],
  ['A07','3番だれ？','generic'],
  ['A08','クローザー誰？','generic'],
  ['A09','守備位置どうする？','generic'],
  ['A10','大野をクローザー固定すべき？','proposal'],
  ['A11','大野の投手成績教えて','proposal'],
  ['A12','継投の意味','proposal']
];

let passed = 0;
for (const [id, question, expectedKind] of cases) {
  const clientKind = selectionKind(question);
  const clientSelection = selectionMode(question);
  const serverPitching = isPitchingPlanQuestion({question, mode:'proposal'});
  const serverLineup = isFullLineupQuestion({question, mode:'proposal'});
  const serverSelection = isSelectionCase({question, mode:'proposal'});

  const kindAligned = expectedKind === 'pitching'
    ? clientKind === 'pitching' && pitchingPlanMode(question) && serverPitching
    : expectedKind === 'lineup'
      ? clientKind === 'lineup' && fullLineupMode(question) && serverLineup
      : clientKind === expectedKind;
  const selectionAligned = clientSelection === serverSelection;
  const specialExclusive = expectedKind === 'pitching'
    ? !serverLineup
    : expectedKind === 'lineup'
      ? !serverPitching
      : true;
  const ok = kindAligned && selectionAligned && specialExclusive;
  if (ok) passed++; else process.exitCode = 1;
  console.log(`${id} ${ok?'PASS':'FAIL'} kind=${clientKind}/${expectedKind} clientSelection=${clientSelection} serverSelection=${serverSelection} serverPitching=${serverPitching} serverLineup=${serverLineup} :: ${question}`);
}

console.log(`CLIENT SERVER SELECTION ALIGNMENT: ${passed}/${cases.length} PASS`);
