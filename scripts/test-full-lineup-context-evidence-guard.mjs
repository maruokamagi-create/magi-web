import assert from 'node:assert/strict';
import fs from 'node:fs';

const core=fs.readFileSync(new URL('../server/api/magi/core.js',import.meta.url),'utf8');
const selection=fs.readFileSync(new URL('../server/api/magi/_selection-live-evidence.js',import.meta.url),'utf8');
const fullLineup=fs.readFileSync(new URL('../server/api/magi/_full-lineup.js',import.meta.url),'utf8');

assert.match(fullLineup,/ベストオーダー\|ベスト打順/,'generic best-order wording must remain a full-lineup request');
assert.match(selection,/if\(hasNamedPlayer\(routed\)\) return '';/,'selection evidence still contains the named-player narrow-route guard');
assert.match(
  core,
  /const selectionRouted=String\(routed\?\.selectionKind\|\|''\)\.toUpperCase\(\)==='FULL_LINEUP'\?\{\.\.\.routed,players:\[\]\}:routed;/,
  'FULL_LINEUP must clear contextual player names only for the evidence-builder handoff'
);
assert.match(
  core,
  /buildCurrentSelectionEvidence\(\{question,routed:selectionRouted\}\)/,
  'live full-lineup evidence must use the sanitized routing view'
);
assert.match(
  core,
  /selectionKind:semantic\?\.selectionKind\|\|'NONE'/,
  'the public semantic selection kind must remain unchanged'
);

console.log('FULL LINEUP CONTEXT EVIDENCE GUARD: PASS');
