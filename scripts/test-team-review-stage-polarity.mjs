import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow=fs.readFileSync(new URL('../.github/workflows/magi-production-live-deliberation-selftest.yml',import.meta.url),'utf8');
const team=workflow.slice(workflow.indexOf('  exact-live-team-review:'));
assert.ok(team.startsWith('  exact-live-team-review:'),'TEAM_REVIEW job not found');

function stageFilter(stage){
  const stageStart=team.indexOf('run_stage '+stage+' 3');
  assert.ok(stageStart>=0,'missing '+stage+' stage');
  const section=team.slice(stageStart);
  const filterStart=section.indexOf("jq -e '");
  const filterEnd=section.indexOf("' /tmp/team-review-"+stage+".json",filterStart);
  assert.ok(filterStart>=0 && filterEnd>filterStart,'missing '+stage+' jq acceptance filter');
  return section.slice(filterStart+"jq -e '".length,filterEnd);
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

check('primary','ただし、打率の数値の差や一部の無安打状態を直ちにチーム全体の弱点や戦術的制約と断定するだけの追加的な因果関係の記録はEvidenceにない。',true);
check('primary','打撃成績の差から戦術的制約がある。',false);
check('primary','打撃成績の差から戦術的制約がある。戦術的制約と断定するだけの因果関係の記録はEvidenceにない。',false);
console.log('TEAM_REVIEW STAGED ACCEPTANCE POLARITY: 10/10 PASS');
