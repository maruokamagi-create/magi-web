import assert from 'node:assert/strict';
import { recoverSoftPersonaBatchValidation, recoverUnsupportedComponentMetricLabels } from '../server/api/magi/persona-batch.js';

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
    publicStatement:'上位に頼りっきりじゃ、厳しい試合を勝ち抜けねえぞ。'
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定している'
  ]);
  assert.equal(ok,true);
  assert.ok(!result.publicStatement.includes('頼りっきり'));
  assert.equal(result.publicStatement,'選手間の打撃成績に数値差がある。');
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


{
  const caseData={
    mode:'selection',
    question:'3番は誰がいい？',
    evidence:{
      allCurrentTeamCheck:{
        status:'COMPLETE',
        players:[
          {name:'中嶋 玲月',batting:{AVG:'.320',OPS:'.860'}},
          {name:'大久保 陽翔',batting:{AVG:'.333',OPS:'.812'}}
        ]
      }
    }
  };
  const result=baseResult({
    candidatePlayers:['中嶋 玲月'],
    analysis:['出塁率と長打率の高さを評価する。'],
    publicStatement:'中嶋 玲月は出塁率と長打率が良いので第一候補です。'
  });
  const ok=recoverUnsupportedComponentMetricLabels(result,[
    'Evidenceにない長打率を、存在する指標として述べている',
    'Evidenceにない出塁率を、存在する指標として述べている'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.ok(!JSON.stringify(result).includes('出塁率'));
  assert.ok(!JSON.stringify(result).includes('長打率'));
  assert.ok(result.publicStatement.includes('中嶋 玲月'));
}

{
  const caseData={mode:'selection',question:'3番は誰がいい？',evidence:{allCurrentTeamCheck:{status:'COMPLETE',players:[]}}};
  const result=baseResult({
    candidatePlayers:['中嶋 玲月'],
    publicStatement:'中嶋 玲月の出塁率.400を評価します。'
  });
  const before=JSON.stringify(result);
  const ok=recoverUnsupportedComponentMetricLabels(result,[
    'Evidenceにない出塁率を、存在する指標として述べている'
  ],caseData,{focused:false});
  assert.equal(ok,false);
  assert.equal(JSON.stringify(result),before);
}

{
  const caseData={mode:'selection',question:'3番は誰がいい？',evidence:{allCurrentTeamCheck:{status:'COMPLETE',players:[]}}};
  const result=baseResult({analysis:['出塁率が高い。']});
  const before=JSON.stringify(result);
  const ok=recoverUnsupportedComponentMetricLabels(result,[
    'Evidenceにない出塁率を、存在する指標として述べている',
    'FULL_LINEUP_STANDARD_DEFENSE / NO_COMPLETE_STANDARD_STARTING_MATCHING'
  ],caseData,{focused:false});
  assert.equal(ok,false);
  assert.equal(JSON.stringify(result),before);
}

console.log('PERSONA BATCH SOFT RECOVERY RESULT: 7/7 PASS');
