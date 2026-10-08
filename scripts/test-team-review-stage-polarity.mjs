import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow=fs.readFileSync(new URL('../.github/workflows/magi-production-live-deliberation-selftest.yml',import.meta.url),'utf8');
const team=workflow.slice(workflow.indexOf('  exact-live-team-review:'));
assert.ok(team.startsWith('  exact-live-team-review:'),'TEAM_REVIEW job not found');

function stageFilter(stage){
  const re=new RegExp('run_stage '+stage+' 3\\s+jq -e \\'([\\s\\S]*?)\\' /tmp/team-review-'+stage+'\\.json');
  const match=team.match(re);
  assert.ok(match,'missing '+stage+' jq acceptance filter');
  return match[1];
}
function fixture(stage,statement){
  const sages={};
  for(const p of ['melchior','balthasar','casper'])sages[p]={publicStatement:'確認済みの記録だけを比較する。'};
  sages.balthasar.publicStatement=statement;
  return {[stage]:sages};
}
function check(stage,statement,expectPass){
  const body=JSON.stringify(fixture(stage,statement));
  const test=spawnSync('jq',['-e',stageFilter(stage)],{input:body,encoding:'utf8'});
  if(test.error)throw test.error;
  assert.equal(test.status,expectPass?0:1,
    stage+' expected '+(expectPass?'accepted':'rejected')+'; got '+test.status+'; stderr='+test.stderr+' stdout='+test.stdout);
}

check('primary','記録だけでは特定の選手に頼りすぎているとは断定できない。',true);
check('primary','今のチームは一部の選手に頼りすぎている部分がある。',false);
check('second','個別の数値から直ちにチーム全体の勝敗や戦術的制約の断定に繋げることはできない。',true);
check('second','打撃成績の差はチーム全体に戦術的制約があることを示している。',false);
check('second','特定の選手に頼りすぎている。',false);
check('second','記録だけでは特定の選手に頼りすぎているとは断定できない。',true);
check('second','打撃成績の差はチーム全体に戦術的制約がある。戦術的制約の断定に繋げることはできない。',false);

console.log('TEAM_REVIEW STAGED ACCEPTANCE POLARITY: 7/7 PASS');
