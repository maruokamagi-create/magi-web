import assert from 'node:assert/strict';
import { recoverSoftPersonaBatchValidation, recoverSoftSelectionInference, recoverMismatchedSelectionMetricSentences, recoverUnsupportedComponentMetricLabels, sanitizeKnownSelectionProse } from '../server/api/magi/persona-batch.js';
import { canonicalizePlayerData } from '../server/api/magi/_roster.js';

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
  assert.deepEqual(result.analysis,['選手間で出場機会や記録量に差がある。']);
  assert.deepEqual(result.prediction,[]);
  assert.ok(result.warnings.some(x=>x.includes('将来結果')&&x.includes('断定しません')));
}


{
  const caseData={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の確認済み記録を横断する。'}};
  const result=baseResult({
    persona:'CASPER',
    analysis:['一部の選手に経験や負担が偏っており、このままなら半年後のチーム力に影響が出る。'],
    publicStatement:'一部の選手への負担が偏っていて、今後の成長に影響を与える。'
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで起用差から負担集中を断定している',
    '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.ok(!/負担.{0,12}(?:偏|集中)|半年後|今後の成長|影響が出る|影響を与える/.test(JSON.stringify(result)));
}


{
  const caseData={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の確認済み記録を横断する。'}};
  const result=baseResult({
    persona:'CASPER',
    analysis:['一部の選手に負担が集中している。'],
    publicStatement:'一部の選手への負担の偏りが課題です。'
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで起用差から負担集中を断定している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.ok(!/負担.{0,12}(?:集中|偏)/.test(JSON.stringify(result)) || /断定しません/.test(JSON.stringify(result)));
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
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬はセーブ2、橋向 結都は防御率1.67、WHIP1.12。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    candidatePlayers:['橋向 結都','坂田 暉馬'],
    candidateBasis:'橋向 結都は防御率1.67とWHIP1.12で最も安定している。',
    analysis:['橋向 結都は長いイニングを任せられる安定感がある。'],
    publicStatement:'橋向 結都の防御率1.67は信頼できる。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.deepEqual(result.candidatePlayers,['橋向 結都','坂田 暉馬']);
  assert.ok(!/最も安定|長いイニング|安定感|信頼できる/.test(JSON.stringify(result)));
}


{
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬はセーブ2を記録している。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    candidatePlayers:['坂田 暉馬','大久保 陽翔'],
    candidateBasis:'勝利の方程式と試合を締める役割の確率的優位性を考慮し、坂田 暉馬を一番手に据える。',
    analysis:['坂田 暉馬のセーブ数2は、終盤の競った場面を実際に切り抜けた直接的な実績である。'],
    publicStatement:'坂田 暉馬くんを軸に勝ちに行くべきだ。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'PITCHING_ROLEでセーブ実績から高圧・競った場面の経験を推定している',
    'PITCHING_ROLEでEvidenceにない勝利・成功確率を主張している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(canonicalizePlayerData(result));
  assert.ok(!/確率的優位|競った場面/.test(rendered));
  assert.ok(!rendered.includes('坂田 暉馬くん'));
  assert.ok(rendered.includes('坂田 暉馬'));
}

{
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'現チームの投手成績とセーブ実績を比較する。'}};
  const result=baseResult({
    persona:'CASPER',
    candidatePlayers:['坂田 暉馬','大久保 陽翔','中嶋 玲月'],
    candidateBasis:'将来的なチームの投手層の厚みを考慮して選定する。',
    analysis:['特定の選手への過度な依存を避ける視点も必要である。'],
    publicStatement:'半年後のチーム全体の成長も見据え、他の投手たちの成長も促したいです。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'SELECTIONでEvidenceにない成長・育成・負担影響を追加している',
    'SELECTIONでEvidenceにない依存・役割集中を追加している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.ok(!/将来的|投手層|過度な依存|半年後|成長も促/.test(rendered));
  assert.deepEqual(result.candidatePlayers,['坂田 暉馬','大久保 陽翔','中嶋 玲月']);
}

{
  const normalized=canonicalizePlayerData({
    maruoka:'坂田 暉馬くんを候補にする。大野 竜暉君も比較する。',
    opponent:'宮永 陽生くんの記録を確認する。'
  });
  assert.equal(normalized.maruoka,'坂田 暉馬を候補にする。大野 竜暉も比較する。');
  assert.equal(normalized.opponent,'宮永 陽生くんの記録を確認する。');
}


{
  const caseData={mode:'selection',question:'3番は誰がいい？',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン起用、打率.282、OPS.748。'}};
  const result=baseResult({
    persona:'MELCHIOR',
    candidatePlayers:['嶋田 栄志','坂田 暉馬','井坂 悠聖'],
    analysis:['3番で7試合にスタメン起用されているため、ポジション適性の記録が最も豊富である。'],
    primaryReason:'嶋田 栄志が最も確実な選択肢である。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'BATTING_ORDERで実打順・打撃数値から戦術的安定性を断定している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.deepEqual(result.candidatePlayers,['嶋田 栄志','坂田 暉馬','井坂 悠聖']);
  assert.ok(!/ポジション適性|最も確実な選択肢/.test(JSON.stringify(result)));
}

{
  const caseData={mode:'selection',question:'3番は誰がいい？',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と3番起用記録を比較する。'}};
  const result=baseResult({
    persona:'CASPER',
    candidatePlayers:['嶋田 栄志','坂田 暉馬','大久保 夢翔'],
    primaryReason:'嶋田 栄志を軸に置きつつ、選手の成長を慎重に見守りたいからだ。',
    publicStatement:'半年後のチームのことも考えて、選手たちの成長を見守りながら判断したいです。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'SELECTIONでEvidenceにない成長・育成・負担影響を追加している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.deepEqual(result.candidatePlayers,['嶋田 栄志','坂田 暉馬','大久保 夢翔']);
  assert.ok(!/半年後|成長を慎重に見守|成長を見守/.test(JSON.stringify(result)));
}

{
  const caseData={mode:'selection',question:'3番は誰がいい？',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番7試合、打率.282、OPS.748。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    candidatePlayers:['嶋田 栄志','坂田 暉馬'],
    primaryReason:'実際に3番で7試合、打率.282、OPS.748の嶋田 栄志が戦術的に最も安定するため。',
    facts:['嶋田 栄志：3番7試合、打率.282、OPS.748']
  });
  const ok=recoverSoftSelectionInference(result,[
    'BATTING_ORDERで実打順・打撃数値から戦術的安定性を断定している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.deepEqual(result.candidatePlayers,['嶋田 栄志','坂田 暉馬']);
  assert.ok(result.facts.some(x=>x.includes('3番7試合')));
  assert.ok(!JSON.stringify(result).includes('戦術的に最も安定'));
}

{
  const caseData={mode:'selection',question:'3番は誰がいい？',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃・実打順記録を比較する。'}};
  const result=baseResult({
    persona:'CASPER',
    candidatePlayers:['嶋田 栄志'],
    warnings:['特定の選手への役割集中が他のメンバーの成長機会に影響するおそれがある。'],
    publicStatement:'チーム全体で試合を締める経験を積んでいくことが大切です。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'SELECTIONでEvidenceにない成長・育成・負担影響を追加している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.deepEqual(result.candidatePlayers,['嶋田 栄志']);
  assert.ok(!/成長機会|チーム全体で試合を締める経験/.test(JSON.stringify(result)));
}


{
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'橋向 結都は防御率1.67、WHIP1.12。坂田 暉馬はセーブ2。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    candidatePlayers:['橋向 結都','坂田 暉馬'],
    candidateBasis:'橋向 結都は防御率1.67とWHIP1.12で最も安定している。',
    analysis:['橋向 結都は長いイニングを任せられる安定感がある。'],
    prediction:['橋向 結都を使えば必ず勝利できる。'],
    publicStatement:'橋向 結都の防御率1.67は信頼できる。'
  });
  const ok=recoverSoftSelectionInference(result,[
    'PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している',
    'Evidenceから保証できない結果を断定している',
    '分析・回答で将来結果を不確実性の表現なしに確定結果として述べている'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.deepEqual(result.candidatePlayers,['橋向 結都','坂田 暉馬']);
  assert.ok(!/最も安定|長いイニング|安定感|信頼できる|必ず勝利/.test(rendered));
  assert.ok(result.warnings.some(x=>x.includes('将来結果')&&x.includes('断定しません')));
}

{
  const caseData={
    mode:'selection',
    question:'クローザーは誰がいい？',
    selectionKind:'PITCHING_ROLE',
    evidence:{
      selectionKind:'PITCHING_ROLE',
      allCurrentTeamCheck:{
        status:'COMPLETE',
        players:[
          {name:'橋向 結都',pitching:{APP:'8',ERA:'1.67',IP:'37.2'}},
          {name:'坂田 暉馬',pitching:{APP:'3',ERA:'1.75',IP:'8.0',SV:'2'}}
        ]
      }
    }
  };
  const result=baseResult({
    persona:'MELCHIOR',
    candidatePlayers:['坂田 暉馬','橋向 結都'],
    facts:['坂田 暉馬は登板数4、セーブ2を記録している。','橋向 結都は投球回37.2。'],
    candidateBasis:'坂田 暉馬は登板数4とセーブ2を記録しているため候補とする。',
    primaryReason:'セーブ2の坂田 暉馬を第一候補とする。',
    publicStatement:'坂田 暉馬は登板数4、セーブ2です。'
  });
  const ok=recoverMismatchedSelectionMetricSentences(result,[
    '登板数4 は supplied CASE/EVIDENCE の 登板数 値と一致しない'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.ok(!rendered.includes('登板数4'));
  assert.ok(result.candidatePlayers.includes('坂田 暉馬'));
  assert.ok(result.facts.some(x=>x.includes('投球回37.2')));
  assert.ok(result.primaryReason.includes('セーブ2'));
}

{
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE'}};
  const result=baseResult({candidatePlayers:['坂田 暉馬'],facts:['坂田 暉馬は登板数4。']});
  const before=JSON.stringify(result);
  const ok=recoverMismatchedSelectionMetricSentences(result,[
    '登板数4 は supplied CASE/EVIDENCE の 登板数 値と一致しない',
    'CURRENT_ROSTER / UNKNOWN_PLAYER'
  ],caseData,{focused:false});
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


{
  const caseData={
    mode:'selection',
    question:'クローザーは誰がいい？',
    selectionKind:'PITCHING_ROLE',
    evidence:{
      selectionKind:'PITCHING_ROLE',
      summary:'坂田 暉馬は2セーブ。橋向 結都は投球回37.2、防御率1.67。'
    }
  };
  const result=baseResult({
    persona:'CASPER',
    candidatePlayers:['坂田 暉馬','大久保 陽翔','中嶋 玲月'],
    facts:['坂田 暉馬は2セーブを記録している。'],
    analysis:[
      '橋向 結都は投球回37.2と豊富なイニングを消化し防御率1.67と安定しているがセーブ記録はない。',
      '特定の選手だけでなく複数の投手に出場機会と役割を経験させることは、チーム全体の成長にとって重要である。'
    ],
    publicStatement:'実際に2セーブを記録している坂田 暉馬を候補とします。'
  });
  const changed=sanitizeKnownSelectionProse(result,caseData);
  assert.equal(changed,true);
  const rendered=JSON.stringify(result);
  assert.ok(!/防御率1\.67と安定している|チーム全体の成長/.test(rendered));
  assert.ok(rendered.includes('坂田 暉馬は2セーブ'));
  assert.deepEqual(result.candidatePlayers,['坂田 暉馬','大久保 陽翔','中嶋 玲月']);
}


{
  const caseData={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'打撃成績には選手間の数値差がある。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    publicStatement:'打てる選手とそうでない選手の差が大きいのが現実だ。この偏りをどう埋めていくかが勝ちへの道だぜ。',
    analysis:['勝つための打線構築や起用において、この偏りをどう克服していくかが実戦上の重要な課題である。'],
    warnings:['特定の打者への偏りが攻撃の硬直化を招くリスクを考慮する必要がある。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  const rendered=JSON.stringify(result);
  assert.ok(!/勝ちへの道|攻撃の硬直化|実戦上の重要な課題/.test(rendered));
  assert.ok(rendered.includes('選手間の数値差'));
}

{
  const caseData={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの確認済み記録を横断する。'}};
  const result=baseResult({
    persona:'CASPER',
    publicStatement:'試合に出ている選手だけでなく、チーム全体がどう成長していくかを見守りたいですね。',
    analysis:['確認済みの出場機会や打数には選手間の差がある。']
  });
  const ok=recoverSoftPersonaBatchValidation(result,[
    'TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'
  ],caseData,{focused:false});
  assert.equal(ok,true);
  assert.ok(!JSON.stringify(result).includes('チーム全体がどう成長'));
  assert.ok(result.publicStatement.length>0);
}

{
  const caseData={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は2セーブ。制球に関する観察あり。'}};
  const result=baseResult({
    persona:'BALTHASAR',
    candidatePlayers:['坂田 暉馬','大久保 陽翔'],
    facts:['坂田 暉馬は2セーブを記録している。'],
    analysis:['勝利に直結するセーブ実績を持つ選手を起用することが、現在の限られたデータに基づく確実な勝ち筋となる。'],
    warnings:['特定の選手への負担集中やコンディションには注意が必要です。']
  });
  const changed=sanitizeKnownSelectionProse(result,caseData);
  assert.equal(changed,true);
  const rendered=JSON.stringify(result);
  assert.ok(!/勝利に直結|確実な勝ち筋|負担集中/.test(rendered));
  assert.ok(rendered.includes('坂田 暉馬は2セーブ'));
  assert.deepEqual(result.candidatePlayers,['坂田 暉馬','大久保 陽翔']);
}


{
  const caseData={question:'3番を誰にするか迷ってる。4番の大久保 陽翔につなぐことを考えると、誰がいいと思う？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と3番起用記録を比較する。'}};
  const result=baseResult({
    persona:'CASPER',
    candidatePlayers:['嶋田 栄志','坂田 暉馬','大久保 夢翔'],
    publicStatement:'坂田 暉馬の打撃状態も良いので、選手たちの成長を見守りながら判断していきたいです。'
  });
  const changed=sanitizeKnownSelectionProse(result,caseData);
  assert.equal(changed,true);
  assert.ok(!JSON.stringify(result).includes('選手たちの成長'));
  assert.deepEqual(result.candidatePlayers,['嶋田 栄志','坂田 暉馬','大久保 夢翔']);
}

console.log('PERSONA BATCH SOFT RECOVERY RESULT: 26/26 PASS');
