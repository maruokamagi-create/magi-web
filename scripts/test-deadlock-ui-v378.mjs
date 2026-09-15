import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../final-decision-emphasis-v340.js',import.meta.url),'utf8');
const marker='function applyDecisionState(final,hero)';
const start=source.indexOf('function decisionPresentation(model)');
const end=source.indexOf(marker);
if(start<0||end<=start)throw new Error('decisionPresentation helper not found');
const helper=source.slice(start,end)+'\nglobalThis.__decisionPresentation=decisionPresentation;';
vm.runInThisContext(helper);
const f=globalThis.__decisionPresentation;
if(typeof f!=='function')throw new Error('decisionPresentation unavailable');

const dead=f({decisionType:'DEADLOCK',label:'1対1対1 DEADLOCK'});
if(dead.verdict!=='結論未成立')throw new Error('DEADLOCK verdict must not be final');
if(dead.title!=='参考案（未確定）')throw new Error('DEADLOCK lineup must be explicitly provisional');
if(dead.kicker.includes('最終判断'))throw new Error('DEADLOCK kicker must not say final decision');
if(dead.badge!=='1対1対1 DEADLOCK')throw new Error('DEADLOCK badge mismatch');
if(!dead.notice.includes('最終決定ではありません'))throw new Error('DEADLOCK notice missing');

const majority=f({decisionType:'MAJORITY',label:'2対1 MAJORITY'});
if(majority.verdict!=='最終ベストオーダー')throw new Error('MAJORITY normal final display changed');
if(majority.title!=='公式戦想定 ベストオーダー')throw new Error('MAJORITY title changed');
if(majority.badge!=='2対1 MAJORITY')throw new Error('MAJORITY badge mismatch');

const consensus=f({decisionType:'CONSENSUS',label:'3対0 CONSENSUS'});
if(consensus.verdict!=='最終ベストオーダー')throw new Error('CONSENSUS normal final display changed');
if(consensus.badge!=='3対0 CONSENSUS')throw new Error('CONSENSUS badge mismatch');

console.log('DEADLOCK UI V378: PASS');
