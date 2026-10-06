import assert from 'node:assert/strict';
import { recoverSoftPersonaBatchValidation } from '../server/api/magi/persona-batch.js';

function baseResult(overrides={}) {
  return {
    facts: [],
    analysis: [],
    prediction: [],
    candidateBasis: '',
    primaryReason: '',
    publicStatement: '',
    warnings: [],
    ...overrides
  };
}

{
  const result=baseResult({
    analysis:['一部の選手に経験や負担が偏りがちだ。'],
    prediction:['このまま続ければ必ずチーム力が上がる。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで起用差から負担集中を断定している',
    '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている'
  ]);
  assert.equal(ok,true);
  assert.deepEqual(result.analysis,[]);
  assert.deepEqual(result.prediction,[]);
  assert.ok(result.warnings.some(x=>x.includes('将来結果を断定')));
}

{
  const result=baseResult({
    publicStatement:'捕手との兼任負担が大きすぎるので、今後は必ず成長に悪影響が出る。',
    prediction:['このままなら必ず悪化する。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている',
    '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている'
  ]);
  assert.equal(ok,true);
  assert.ok(!result.publicStatement.includes('大きすぎる'));
  assert.deepEqual(result.prediction,[]);
}

{
  const result=baseResult({analysis:['候補9人の構造が壊れている。']});
  const before=JSON.stringify(result);
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで起用差から負担集中を断定している',
    'FULL_LINEUP_STANDARD_DEFENSE / NO_COMPLETE_STANDARD_STARTING_MATCHING'
  ]);
  assert.equal(ok,false);
  assert.equal(JSON.stringify(result),before);
}

console.log('PERSONA BATCH MIXED SOFT RECOVERY RESULT: 3/3 PASS');
