import assert from 'node:assert/strict';
import {
  isSelectionCase,
  deterministicFinal,
  buildSelectionResult,
  buildFinalResult,
  isReviewCase,
  buildReviewResult,
  deterministicTeamReviewCross
} from '../server/api/magi/orchestrate.js';
import { validateDialoguePresence, validateCrossLanguage, validateCrossOutput } from '../server/api/magi/_cross-output-guard.js';

const tests=[];
function test(name,fn){tests.push({name,fn});}
function persona(persona,judgment,overrides={}){
  return {
    persona,
    phase:'SECOND',
    checkedPlayers:[],
    candidatePlayers:[],
    candidateBasis:'test',
    facts:[],analysis:[],prediction:[],
    confidence:'HIGH',judgment,
    primaryReason:`${persona} reason`,
    publicStatement:`${persona} statement`,
    warnings:[],dataConflict:false,reviewRequested:false,reviewReason:'',
    changedFromPrimary:false,changeReason:'',
    ...overrides
  };
}

// Selection intent detection must distinguish "choose someone" from "evaluate this proposal".
test('S01 3番だれがいい is selection',()=>assert.equal(isSelectionCase({question:'3番だれがいい？'}),true));
test('S02 starter who is selection',()=>assert.equal(isSelectionCase({question:'次の試合、誰を先発にする？'}),true));
test('S03 closer who is selection',()=>assert.equal(isSelectionCase({question:'クローザー誰がいい？'}),true));
test('S04 defensive position choice is selection',()=>assert.equal(isSelectionCase({question:'レフトは誰が最適？'}),true));
test('S05 explicit closer proposal is not candidate selection',()=>assert.equal(isSelectionCase({question:'大野をクローザー固定どう？'}),false));
test('S06 explicit mode selection always wins',()=>assert.equal(isSelectionCase({mode:'selection',question:'候補を考えて'}),true));

// Deterministic vote protocol.
test('F01 3 GREEN becomes consensus 3-0',()=>{
  const r=deterministicFinal([persona('MELCHIOR','GREEN'),persona('BALTHASAR','GREEN'),persona('CASPER','GREEN')]);
  assert.equal(r.status,'MAGI_CONSENSUS');assert.equal(r.vote,'3-0');
});
test('F02 BLUE BLUE RED becomes majority 2-1',()=>{
  const r=deterministicFinal([persona('MELCHIOR','BLUE'),persona('BALTHASAR','BLUE'),persona('CASPER','RED')]);
  assert.equal(r.status,'MAGI_MAJORITY');assert.equal(r.vote,'2-1');
});
test('F03 GREEN BLUE RED becomes deadlock',()=>{
  const r=deterministicFinal([persona('MELCHIOR','GREEN'),persona('BALTHASAR','BLUE'),persona('CASPER','RED')]);
  assert.equal(r.status,'MAGI_DEADLOCK');assert.equal(r.vote,'1-1-1');
});
test('F04 all YELLOW becomes insufficient evidence',()=>{
  const r=deterministicFinal([persona('MELCHIOR','YELLOW'),persona('BALTHASAR','YELLOW'),persona('CASPER','YELLOW')]);
  assert.equal(r.status,'INSUFFICIENT_EVIDENCE');assert.equal(r.vote,'YELLOW-YELLOW-YELLOW');
});
test('F05 reviewRequested overrides majority',()=>{
  const r=deterministicFinal([
    persona('MELCHIOR','GREEN'),
    persona('BALTHASAR','GREEN',{reviewRequested:true,reviewReason:'重大な前提不足'}),
    persona('CASPER','RED')
  ]);
  assert.equal(r.status,'MAGI_REVIEW_REQUIRED');assert.equal(r.reviewReason,'重大な前提不足');
});
test('F06 MELCHIOR data conflict requires review',()=>{
  const r=deterministicFinal([
    persona('MELCHIOR','BLUE',{dataConflict:true}),
    persona('BALTHASAR','BLUE'),
    persona('CASPER','BLUE')
  ]);
  assert.equal(r.status,'MAGI_REVIEW_REQUIRED');
});

// Final proposal rendering must preserve minority and lowest confidence.
test('R01 minority opinion and lowest confidence survive finalization',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{confidence:'HIGH',primaryReason:'数値面では条件付き'}),
    balthasar:persona('BALTHASAR','BLUE',{confidence:'MEDIUM',primaryReason:'勝ち筋はある'}),
    casper:persona('CASPER','RED',{confidence:'LOW',primaryReason:'役割集中が大きい'})
  };
  const r=buildFinalResult(second,{warnings:['負担確認'],informationGaps:['直近起用状況']});
  assert.equal(r.status,'MAGI_MAJORITY');
  assert.equal(r.vote,'2-1');
  assert.equal(r.confidence,'LOW');
  assert.match(r.minorityOpinion,/CASPER/);
  assert.match(r.minorityOpinion,/役割集中/);
  assert.ok(r.reDeliberationConditions.includes('直近起用状況'));
  assert.ok(r.reDeliberationConditions.includes('負担確認'));
});

test('R02 consensus recommendation follows majority judgment',()=>{
  const r=buildFinalResult({
    melchior:persona('MELCHIOR','GREEN'),
    balthasar:persona('BALTHASAR','GREEN'),
    casper:persona('CASPER','GREEN')
  },{});
  assert.equal(r.status,'MAGI_CONSENSUS');
  assert.match(r.recommendation,/賛成判断/);
});

test('R03 deadlock has no false minority label',()=>{
  const r=buildFinalResult({
    melchior:persona('MELCHIOR','YELLOW',{primaryReason:'判断保留'}),
    balthasar:persona('BALTHASAR','RED',{primaryReason:'固定しない'}),
    casper:persona('CASPER','BLUE',{primaryReason:'条件付きで試す'})
  },{});
  assert.equal(r.status,'MAGI_DEADLOCK');
  assert.equal(r.vote,'1-1-1');
  assert.equal(r.minorityOpinion,'');
  assert.equal(r.majorReasons.length,3);
});

test('R04 cross evidence failure forces final review required',()=>{
  const r=buildFinalResult({
    melchior:persona('MELCHIOR','GREEN'),
    balthasar:persona('BALTHASAR','GREEN'),
    casper:persona('CASPER','GREEN')
  },{
    reviewRequired:true,
    reviewReason:'クロス審議の数値ラベル不一致',
    warnings:['再確認が必要'],
    informationGaps:['元データ確認']
  });
  assert.equal(r.status,'MAGI_REVIEW_REQUIRED');
  assert.equal(r.confidence,'LOW');
  assert.equal(r.minorityOpinion,'');
  assert.match(r.reviewReason,/クロス審議/);
  assert.match(r.recommendation,/再審議/);
});


test('R05 TEAM_REVIEW final uses review semantics, not proposal adoption language',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{primaryReason:'打撃成績が一部の選手に集中している'}),
    balthasar:persona('BALTHASAR','BLUE',{primaryReason:'下位打線の出塁実績が少ない'}),
    casper:persona('CASPER','BLUE',{primaryReason:'出場機会には選手間の差がある'})
  };
  const caseData={selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW'}};
  assert.equal(isReviewCase(caseData),true);
  const r=buildReviewResult(second,{informationGaps:['守備の継続観察']},caseData);
  assert.equal(r.mode,'REVIEW');
  assert.equal(r.reviewKind,'TEAM_REVIEW');
  assert.equal(r.status,'MAGI_CONSENSUS');
  assert.match(r.recommendation,/現時点で確認できる課題候補/);
  assert.doesNotMatch(r.recommendation,/採用|運用/);
  assert.ok(r.majorReasons.includes('打撃成績が一部の選手に集中している'));
});

test('R06 TEAM_REVIEW deterministic cross gives every Wise Man a safe challenge',()=>{
  const primary={
    melchior:persona('MELCHIOR','BLUE'),
    balthasar:persona('BALTHASAR','BLUE'),
    casper:persona('CASPER','BLUE')
  };
  const cross=deterministicTeamReviewCross(primary);
  assert.ok(cross);
  assert.deepEqual(validateDialoguePresence(cross),[]);
  assert.deepEqual(validateCrossLanguage(cross),[]);
  assert.deepEqual(validateCrossOutput({question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW'}},cross,{focused:true}),[]);
  assert.equal(cross.challenges.melchior.length,1);
  assert.equal(cross.challenges.balthasar.length,1);
  assert.equal(cross.challenges.casper.length,1);
  const rendered=JSON.stringify(cross);
  assert.doesNotMatch(rendered,/特定選手への依存|試合に出ていない|負担集中|半年後.*差/);
});

test('R07 PLAYER_REVIEW final uses assessment language',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{primaryReason:'今季の確認済み記録を基準に評価できる'}),
    balthasar:persona('BALTHASAR','BLUE',{primaryReason:'実起用を含めて条件付きで評価する'}),
    casper:persona('CASPER','BLUE',{primaryReason:'追加の観察情報も確認したい'})
  };
  const caseData={evidence:{reviewKind:'PLAYER_REVIEW'}};
  assert.equal(isReviewCase(caseData),true);
  const r=buildReviewResult(second,{},caseData);
  assert.equal(r.reviewKind,'PLAYER_REVIEW');
  assert.match(r.recommendation,/現時点の評価/);
  assert.doesNotMatch(r.recommendation,/賛成判断を採用|条件付きで採用/);
});


test('R08 TEAM_REVIEW final does not elevate spread into proven dependency or weakness',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{
      primaryReason:'確認済みの打撃成績における数値の偏りが、チームの弱点としてデータ上明確に示されているため。',
      prediction:['この打撃の偏りがそのまま続けば、得点力が特定の選手に左右される可能性がある。']
    }),
    balthasar:persona('BALTHASAR','BLUE',{
      primaryReason:'確認済み記録に基づく上位打線への偏りが、勝ち進む上での戦術的弱点として明確だからだ。',
      warnings:['特定の打者へのマークが厳しくなった場合の対策不足']
    }),
    casper:persona('CASPER','BLUE',{
      primaryReason:'確認された出場機会や打数の偏りが、チームの総合力と育成面での課題となっているからだ。'
    })
  };
  const caseData={selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW'}};
  const r=buildReviewResult(second,{},caseData);
  const reasons=r.majorReasons.join('\n');
  assert.doesNotMatch(reasons,/弱点としてデータ上明確|戦術的弱点|総合力と育成面での課題|依存|頼り/);
  assert.equal(r.prediction.length,0);
  assert.match(r.recommendation,/記録や数値差だけから特定選手への依存、チーム全体の恒常的な弱点、得点への因果までは断定しない/);
  assert.ok(r.warnings.some(x=>x.includes('個別記録や数値差だけから特定選手への依存')));
  assert.ok(!r.warnings.some(x=>x.includes('対策不足')));
});

test('R09 TEAM_REVIEW preserves directly observed non-inference findings',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{primaryReason:'公式戦で失策7が記録されている。'}),
    balthasar:persona('BALTHASAR','BLUE',{primaryReason:'失策7という確認済み記録は守備面の課題として直接確認できる。'}),
    casper:persona('CASPER','BLUE',{primaryReason:'守備記録の再確認が必要だ。'})
  };
  const caseData={selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW'}};
  const r=buildReviewResult(second,{},caseData);
  assert.ok(r.majorReasons.includes('公式戦で失策7が記録されている。'));
  assert.doesNotMatch(r.recommendation,/数値差だけから特定選手への依存/);
});


test('R10 TEAM_REVIEW removes the production spread-to-weakness contradiction',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{
      primaryReason:'記録に基づいた数値の偏りは確認できる事実であり、私の判断を変える理由は見当たりません。'
    }),
    balthasar:persona('BALTHASAR','BLUE',{
      primaryReason:'戦術的な視点から、記録に見える偏りがチームの弱点であるという結論に変わりはない。'
    }),
    casper:persona('CASPER','BLUE',{
      primaryReason:'確認された出場機会や打数の偏りが、チームの総合力と育成面での課題となっているからだ。',
      warnings:['目先の効率だけに囚われると、組織全体の持続的な成長が損なわれるおそれがある。']
    })
  };
  const caseData={selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW'}};
  const r=buildReviewResult(second,{},caseData);
  const reasons=r.majorReasons.join('\n');
  assert.doesNotMatch(reasons,/判断を変える理由|チームの弱点である|戦術的な視点|総合力と育成面での課題/);
  assert.ok(r.majorReasons.includes('確認済み記録には選手間の数値差がある。'));
  assert.match(r.recommendation,/記録や数値差だけから特定選手への依存、チーム全体の恒常的な弱点、得点への因果までは断定しない/);
  assert.ok(!r.warnings.some(x=>x.includes('持続的な成長が損なわれる')));
});


test('R11 TEAM_REVIEW final surfaces direct recent hitless fact from structured Evidence',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{primaryReason:'確認済みの打撃成績には選手間の数値差がある。'}),
    balthasar:persona('BALTHASAR','BLUE',{primaryReason:'確認済み記録を継続して見る。'}),
    casper:persona('CASPER','BLUE',{primaryReason:'追加の観察情報が必要だ。'})
  };
  const caseData={
    selectionKind:'TEAM_REVIEW',
    evidence:{
      reviewKind:'TEAM_REVIEW',
      selectionKind:'TEAM_REVIEW',
      recentSix:{
        status:'COMPLETE',
        gameCount:6,
        players:[
          {name:'井坂 悠聖',batting:{AB:'9',H:'0'}},
          {name:'大久保 夢翔',batting:{AB:'4',H:'0'}},
          {name:'長侶 穹',batting:{AB:'6',H:'0'}},
          {name:'吉田 真翔',batting:{AB:'5',H:'0'}},
          {name:'鰐渕 将太',batting:{AB:'3',H:'0'}},
          {name:'武田 晴琉翔',batting:{AB:'5',H:'0'}},
          {name:'大野 竜暉',batting:{AB:'14',H:'5'}},
          {name:'上村 蓮',batting:{AB:'0',H:'0'}}
        ]
      }
    }
  };
  const r=buildReviewResult(second,{},caseData);
  assert.match(r.majorReasons[0],/直近6試合/);
  assert.match(r.majorReasons[0],/6選手が安打0/);
  assert.doesNotMatch(r.majorReasons[0],/得点源|得点力|依存|戦術|弱点/);
  assert.match(r.recommendation,/直近6試合/);
  assert.match(r.recommendation,/恒常的な弱点、得点への因果までは断定しない/);
});

// Selection aggregation: no hard-coded clean-up wording, preserve split/review states.
test('C01 shared top candidate produces selection result',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['大野 竜暉','橋向 結都']}),
    balthasar:persona('BALTHASAR','GREEN',{candidatePlayers:['大野 竜暉','大久保 陽翔']}),
    casper:persona('CASPER','BLUE',{confidence:'MEDIUM',candidatePlayers:['橋向 結都','大野 竜暉']})
  };
  const r=buildSelectionResult(second,{warnings:[],informationGaps:[]});
  assert.equal(r.status,'SELECTION_RESULT');
  assert.ok(r.centerCandidates.includes('大野 竜暉'));
  assert.match(r.recommendation,/中心候補/);
  assert.doesNotMatch(r.recommendation,/クリーンナップ/);
});

test('C02 totally split candidates stay selection split',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['大野 竜暉']}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['大久保 陽翔']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.equal(r.status,'SELECTION_SPLIT');
  assert.deepEqual(r.centerCandidates,[]);
  assert.match(r.recommendation,/各賢人の上位候補/);
  assert.doesNotMatch(r.recommendation,/クリーンナップ/);
});

test('C03 review request blocks candidate finalization',()=>{
  const second={
    melchior:persona('MELCHIOR','YELLOW',{candidatePlayers:['大野 竜暉'],reviewRequested:true,reviewReason:'成績表の値が矛盾'}),
    balthasar:persona('BALTHASAR','GREEN',{candidatePlayers:['大野 竜暉']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.equal(r.status,'SELECTION_REVIEW_REQUIRED');
  assert.deepEqual(r.centerCandidates,[]);
  assert.match(r.reviewReason,/矛盾/);
});

test('C04 non-current candidate name is filtered from selection arrays',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['宮嵜 翔','大野 竜暉']}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['大野 竜暉']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{});
  assert.ok(!r.recommendedCandidates.includes('宮嵜 翔'));
  assert.ok(!r.alternateCandidates.includes('宮嵜 翔'));
  assert.ok(r.recommendedCandidates.includes('大野 竜暉'));
});

test('C06 pitching-role final removes unsupported stability and win-probability prose',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['坂田 暉馬','橋向 結都'],primaryReason:'坂田 暉馬はセーブ2を記録している。'}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['橋向 結都','坂田 暉馬'],primaryReason:'橋向 結都は防御率1.67で安定した投球成績を示し、勝利の確率を高められると考えられる。'}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都','坂田 暉馬'],primaryReason:'橋向 結都と坂田 暉馬の確認済み記録を比較した。',warnings:['特定の選手への役割集中が他のメンバーの成長機会に影響するおそれがある。']})
  };
  const r=buildSelectionResult(second,{}, {selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE'}});
  const rendered=JSON.stringify(r);
  assert.doesNotMatch(rendered,/安定した投球|勝利の確率|成長機会に影響/);
  assert.ok(r.majorReasons.some(x=>x.includes('セーブ2')));
});

test('C07 batting-order final removes unsupported tactical-stability and growth prose',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['嶋田 栄志','坂田 暉馬'],primaryReason:'嶋田 栄志は3番で7試合起用されている。'}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['嶋田 栄志','中嶋 玲月'],primaryReason:'3番で7試合、打率.282、OPS.748の嶋田 栄志が戦術的に最も安定するため。'}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['嶋田 栄志','坂田 暉馬'],primaryReason:'チームの戦術と出場実績の双方で裏付けがあるため。',warnings:['特定の選手への役割集中が他のメンバーの成長機会に影響するおそれがある。']})
  };
  const r=buildSelectionResult(second,{}, {selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER'}});
  const rendered=JSON.stringify(r);
  assert.doesNotMatch(rendered,/戦術的に最も安定|チームの戦術.{0,24}裏付け|成長機会に影響/);
  assert.ok(r.majorReasons.some(x=>x.includes('3番で7試合起用')));
});



test('C08 closer final uses structured save fact and removes Live 122 meta/future rhetoric',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔','橋向 結都'],
      primaryReason:'バルタザールからの指摘に対する回答として、坂田 暉馬の第1候補維持を確認する。現チームで実際に2セーブを挙げている記録を重視する。'
    }),
    balthasar:persona('BALTHASAR','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔'],
      primaryReason:'カスパーからの問いかけに対し、坂田 暉馬を第1候補に据える理由を明確にする。現チームにおけるセーブ実績という明確な事実を根拠として勝ちに行くために、この選択を変える理由はない。'
    }),
    casper:persona('CASPER','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔','中嶋 玲月'],
      primaryReason:'メルキオールからの問いかけに答え、坂田 暉馬を軸としつつも将来のチーム力と複数起用の可能性を残すために判断を維持する。'
    })
  };
  const caseData={
    selectionKind:'PITCHING_ROLE',
    evidence:{
      selectionKind:'PITCHING_ROLE',
      allCurrentTeamCheck:{
        status:'COMPLETE',
        players:[
          {name:'坂田 暉馬',pitching:{SV:'2'}},
          {name:'大久保 陽翔',pitching:{SV:'0'}},
          {name:'橋向 結都',pitching:{SV:'0'}}
        ]
      }
    }
  };
  const r=buildSelectionResult(second,{},caseData);
  const reasons=r.majorReasons.join('\n');
  assert.ok(r.majorReasons.some(x=>x==='坂田 暉馬は現チームで2セーブを記録している。'));
  assert.doesNotMatch(reasons,/バルタザールから|カスパーから|メルキオールから|勝ちに行くため|この選択を変える理由|将来のチーム力/);
});

test('C09 closer final normalizes Maruoka honorific but leaves opponent honorific alone',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['坂田 暉馬'],primaryReason:'坂田 暉馬くんはセーブ2。'}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['坂田 暉馬'],primaryReason:'坂田 暉馬くんを候補にする。'}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['坂田 暉馬'],primaryReason:'宮永 陽生くんの話ではなく、坂田 暉馬くんの現チーム記録を確認する。'})
  };
  const caseData={selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',allCurrentTeamCheck:{players:[{name:'坂田 暉馬',pitching:{SV:'2'}}]}}};
  const r=buildSelectionResult(second,{},caseData);
  const rendered=JSON.stringify(r);
  assert.doesNotMatch(rendered,/坂田 暉馬くん/);
  assert.match(rendered,/宮永 陽生くん/);
});


test('C10 natural-third final removes certainty and generic growth rationale',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['嶋田 栄志','坂田 暉馬','井坂 悠聖'],primaryReason:'記録に基づき3番打順でのスタメン起用実績が最も多い嶋田 栄志を第一候補とする。'}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['嶋田 栄志','坂田 暉馬','中嶋 玲月'],primaryReason:'4番につなぐ打順として、実際に3番で7試合のスタメン実績がある嶋田 栄志が最も確実な選択肢だからだ。'}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['嶋田 栄志','坂田 暉馬','大久保 夢翔'],primaryReason:'3番としての起用実績が最も積み上がっている嶋田 栄志を軸に置きつつ、選手の成長を慎重に見守りたいからだ。'})
  };
  const caseData={selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER'}};
  const r=buildSelectionResult(second,{},caseData);
  const reasons=r.majorReasons.join('\n');
  assert.match(reasons,/3番打順でのスタメン起用実績が最も多い/);
  assert.doesNotMatch(reasons,/最も確実な選択肢|選手の成長を慎重に見守/);
});
test('C11 closer final removes Live 124 debate-meta, certain-win and unsupported burden prose',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔','橋向 結都'],
      primaryReason:'指摘された通り、坂田 暉馬の起用は投球回4という小さな母数に基づくものである。ただ、現時点で2セーブが確認できるのは同選手のみであるため、私の判断は変えません。'
    }),
    balthasar:persona('BALTHASAR','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔'],
      primaryReason:'勝利に直結するセーブ実績を持つ選手を起用することが、現在の限られたデータに基づく確実な勝ち筋となる。',
      warnings:['特定の選手への負担集中やコンディションには注意が必要です。']
    }),
    casper:persona('CASPER','BLUE',{
      candidatePlayers:['坂田 暉馬','大久保 陽翔','中嶋 玲月'],
      primaryReason:'指摘されたように小さな母数に基づく実績だけで固定化することには弱点があります。ただ、チーム全体のバランスを見守るため、僕の判断はこのままにします。'
    })
  };
  const caseData={
    selectionKind:'PITCHING_ROLE',
    evidence:{
      selectionKind:'PITCHING_ROLE',
      allCurrentTeamCheck:{players:[
        {name:'坂田 暉馬',pitching:{SV:'2'}},
        {name:'大久保 陽翔',pitching:{SV:'0'}},
        {name:'橋向 結都',pitching:{SV:'0'}}
      ]}
    }
  };
  const r=buildSelectionResult(second,{},caseData);
  const rendered=JSON.stringify(r);
  assert.ok(r.majorReasons.includes('坂田 暉馬は現チームで2セーブを記録している。'));
  assert.doesNotMatch(rendered,/指摘された|私の判断は変え|確実な勝ち筋|勝利に直結|負担集中|僕の判断はこのまま/);
});

test('C05 cross evidence failure blocks candidate finalization',()=>{
  const second={
    melchior:persona('MELCHIOR','BLUE',{candidatePlayers:['大野 竜暉']}),
    balthasar:persona('BALTHASAR','BLUE',{candidatePlayers:['大野 竜暉']}),
    casper:persona('CASPER','BLUE',{candidatePlayers:['橋向 結都']})
  };
  const r=buildSelectionResult(second,{
    reviewRequired:true,
    reviewReason:'クロス審議にEvidence不一致',
    warnings:['再確認が必要'],
    informationGaps:['元データ確認']
  });
  assert.equal(r.status,'SELECTION_REVIEW_REQUIRED');
  assert.deepEqual(r.centerCandidates,[]);
  assert.deepEqual(r.recommendedCandidates,[]);
  assert.equal(r.confidence,'LOW');
  assert.match(r.reviewReason,/Evidence不一致/);
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){
    console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;
  }
}
console.log(`DELIBERATION FINAL UNIT RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exit(1);
