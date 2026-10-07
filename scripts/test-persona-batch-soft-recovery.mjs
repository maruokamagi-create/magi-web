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
  assert.ok(result.warnings.some(x=>x.includes('将来結果')&&x.includes('断定しません')));
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
    question:'今の丸岡中の弱点は何？',
    selectionKind:'TEAM_REVIEW',
    evidence:{
      reviewKind:'TEAM_REVIEW',
      selectionKind:'TEAM_REVIEW',
      recentSix:{status:'COMPLETE'},
      summary:'現チーム14名の確認済み記録と直近6試合の個別打撃記録を横断する。'
    }
  };
  const result=baseResult({
    facts:['直近6試合の打撃成績では、一部の選手が打率.000に低迷しており、得点源が限定されやすい状況にある。'],
    analysis:['打撃成績の数値差から、当たっている選手と当たっていない選手の差が、試合中の得点力や戦術的な課題に直結している。'],
    primaryReason:'確認済みの打撃成績データに基づく数値の偏りこそがチームの弱点だ。',
    publicStatement:'今の弱点は打線の偏りだね。目の前の試合だけでなく、半年後や1年後を見据えてチーム全体を育てることが大切だ。',
    warnings:['目先の勝敗だけに囚われて選手層の育成を疎かにしないこと。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張している',
    'TEAM_REVIEWで個別打撃結果からチーム得点・戦術への因果を断定している',
    'TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.ok(result.facts.some(x=>x.includes('直近6試合')));
  assert.ok(!/得点源が限定|得点力や戦術的な課題に直結|半年後|1年後|育成を疎か|こそがチームの弱点/.test(rendered));
  assert.ok(result.warnings.some(x=>x.includes('数値差だけから弱点・因果・将来影響を断定しません')));
}

{
  const caseData={
    question:'今の丸岡中の弱点は何？',
    selectionKind:'TEAM_REVIEW',
    evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',recentSix:{status:'COMPLETE'},summary:'直近6試合の個別打撃記録を含む。'}
  };
  const result=baseResult({
    facts:['直近6試合では6選手が安打0（打率.000）となっている。'],
    publicStatement:'確認できる事実として、直近6試合では6選手が安打0です。'
  });
  const before=JSON.stringify(result);
  const ok=recoverSoftPersonaBatchValidation(result,[],caseData,{focused:false});
  assert.equal(ok,false);
  assert.equal(JSON.stringify(result),before);
}


{
  const caseData={
    mode:'selection',
    question:'今の丸岡中のクローザーは誰がいい？',
    selectionKind:'PITCHING_ROLE',
    evidence:{
      selectionKind:'PITCHING_ROLE',
      allCurrentTeamCheck:{status:'COMPLETE',players:[]},
      pitchingEligible:['坂田 暉馬','大野 竜暉']
    }
  };
  const result=baseResult({
    candidatePlayers:['坂田 暉馬','大野 竜暉'],
    candidateBasis:'坂田 暉馬を固定すれば終盤が安定して勝ちパターンを作れる。',
    primaryReason:'確認済みの投手記録を比較する。',
    publicStatement:'坂田 暉馬をクローザーにすれば確実に勝ちを拾える。',
    analysis:['この起用なら終盤が安定する。'],
    prediction:['このまま固定すれば勝利につながる。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'Evidenceから保証できない結果を断定している',
    '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている',
    '将来予測を不確実性の表現なしに確定結果として述べている'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.ok(result.candidatePlayers.includes('坂田 暉馬'));
  assert.ok(!/確実に勝ち|勝ちパターンを作れる|終盤が安定する|勝利につながる/.test(rendered));
  assert.ok(result.warnings.some(x=>x.includes('将来結果')&&x.includes('断定しません')));
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

console.log('PERSONA BATCH SOFT RECOVERY RESULT: 8/8 PASS');
