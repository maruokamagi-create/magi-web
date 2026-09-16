import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../cross-dialogue-ui-v380.js',import.meta.url),'utf8');
assert.match(ui,/result\?\.crossExamination\?\.dialogue/);
assert.match(ui,/speaker\.jp/);
assert.match(ui,/→ \$\{esc\(target\)\}/);
assert.match(ui,/data-magi-direct-dialogue/);
console.log('CROSS DIALOGUE UI CONTRACT: PASS');
