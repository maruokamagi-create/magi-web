import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const LEDGER='docs/MAGI_DEVELOPMENT_STATE.md';
const PROTECTED=[
  /^api\/magi/i,
  /^server\/api\/magi/i,
  /^engine\/magi/i,
  /^magi-.*\.js$/i,
  /^formal-.*\.js$/i,
  /^deliberation-.*\.js$/i,
  /^\.github\/workflows\/magi-/i
];

function sh(args){
  return execFileSync('git',args,{encoding:'utf8'}).trim();
}

const event=process.env.GITHUB_EVENT_NAME||'';
const base=process.env.MAGI_BASE_SHA||process.env.GITHUB_BASE_SHA||'';
const head=process.env.MAGI_HEAD_SHA||process.env.GITHUB_SHA||'HEAD';
if(!fs.existsSync(LEDGER)) throw new Error('MAGI continuity ledger is missing');

const body=fs.readFileSync(LEDGER,'utf8');
for(const heading of [
  '## Non-negotiable project objective',
  '## Definition of done for the current stabilization work',
  '## Architecture invariants',
  '## Data safety invariants',
  '## Current unresolved priority',
  '## Important failed/incomplete approaches',
  '## Required development protocol',
  '## Next concrete work'
]){
  if(!body.includes(heading)) throw new Error('Ledger missing required section: '+heading);
}
if(!/State base main SHA:\s*[0-9a-f]{40}/i.test(body)) throw new Error('Ledger missing 40-char State base main SHA');

if(event==='pull_request' && base){
  const changed=sh(['diff','--name-only',base,head]).split(/\r?\n/).filter(Boolean);
  const productionChanged=changed.some(path=>PROTECTED.some(rx=>rx.test(path)) && path!==LEDGER);
  const ledgerChanged=changed.includes(LEDGER);
  if(productionChanged && !ledgerChanged){
    console.error('Protected MAGI files changed without updating '+LEDGER);
    console.error(changed.join('\n'));
    process.exit(1);
  }
  console.log(JSON.stringify({productionChanged,ledgerChanged,changed},null,2));
}else{
  console.log('Ledger structure valid. PR coupling check skipped for event '+event);
}
