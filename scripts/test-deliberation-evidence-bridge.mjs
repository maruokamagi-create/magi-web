import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src=await readFile(new URL('../engine-ui-v187.js',import.meta.url),'utf8');

assert.ok(
  src.includes('evidence:evidence||null'),
  'E01: deliberation UI must pass the complete evidence object into MAGI_ENGINE_V1'
);
assert.equal(
  src.includes('evidence:evidence?{count:evidence.count,files:evidence.files,text:evidence.text}:null'),
  false,
  'E02: deliberation UI must not strip structured allCurrentTeamCheck/historicalReference evidence'
);

console.log('PASS E01 complete evidence object is forwarded to MAGI_ENGINE_V1');
console.log('PASS E02 legacy count/files/text-only evidence bridge is absent');
console.log('DELIBERATION EVIDENCE BRIDGE RESULT: 2/2 PASS');
