import fs from 'node:fs';
import assert from 'node:assert/strict';

const integrity=fs.readFileSync(new URL('../deliberation-integrity-v348.js', import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../api/magi-live-deliberation-selftest.js', import.meta.url),'utf8');

assert.match(integrity,/if\(isFullLineup\(caseData\)\)\{[\s\S]{0,1200}\/api\/magi\/persona/);
assert.match(integrity,/phase:'PRIMARY',persona,case:caseData/);
assert.match(integrity,/phase:'SECOND',[\s\S]{0,300}persona,[\s\S]{0,500}primarySelf:revealed\[persona\]/);
assert.match(integrity,/\/api\/magi\/persona-batch/);
assert.doesNotMatch(
  integrity.match(/if\(isFullLineup\(caseData\)\)\{[\s\S]{0,1200}?return recoverSet\(Object\.fromEntries\(rows\),caseData\);/m)?.[0]||'',
  /persona-batch/
);

assert.match(live,/selectionKind==='FULL_LINEUP'/);
assert.match(live,/post\(base,'\/api\/magi\/persona',body,\`\$\{phase\}_\$\{p\.toUpperCase\(\)\}\`/);
assert.match(live,/const raw=await post\(base,'\/api\/magi\/persona-batch'/);

console.log('FULL LINEUP PERSONA TRANSPORT RESULT: PASS');
