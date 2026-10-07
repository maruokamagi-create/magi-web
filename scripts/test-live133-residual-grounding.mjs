import assert from 'node:assert/strict';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';
import { recoverSoftPersonaBatchValidation, recoverSoftSelectionInference } from '../server/api/magi/persona-batch.js';
import { buildSelectionResult } from '../server/api/magi/orchestrate.js';

function result(overrides={}){
  return {
    persona:'MELCHIOR',phase:'PRIMARY',facts:[],analysis:[],prediction:[],
    candidatePlayers:[],candidateBasis:'',primaryReason:'',publicStatement:'',
    warnings:[],reviewReason:'',changeReason:'',reviewRequested:false,dataConflict:false,
    confidence:'MEDIUM',judgment:'BLUE',...overrides
  };
}

{
  const c={question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績、実打順、守備起用実績を比較する。'}};
  const r=result({
    persona:'BALTHASAR',
    candidatePlayers:['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔'],
    primaryReason:'現在成績を軸に、得点力を最大化する並びとした。',
    prediction:['打線が機能して得点力を発揮できる可能性がある。'],
    warnings:['守備連携次第では勝利へ近づくことができる。']
  });
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('得点力最大化・勝利接近')));
}

{
  const c={question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績、実打順、守備起用実績を比較する。'}};
  const r=result({
    candidatePlayers:['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔'],
    candidateBasis:'1番捕手は大野 竜暉、2番遊撃手は大久保 陽翔、3番中堅手は嶋田 栄志、4番一塁手は中嶋 玲月、5番二塁手は坂田 暉馬とする。',
    publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番嶋田 栄志、4番中嶋 玲月、5番坂田 暉馬。'
  });
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('candidatePlayersと打順説明が矛盾')));
}

{
  const c={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は2セーブ。制球に関する指導者観察あり。'}};
  const r=result({
    persona:'CASPER',candidatePlayers:['坂田 暉馬','大久保 陽翔'],
    candidateBasis:'チーム全体の経験と役割の分散を考慮し、今後の成長や調整の過程を見守る。',
    publicStatement:'チーム全体の負担も考えながら大切に育てていきたいです。'
  });
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('成長・育成・負担影響')));
  const ok=recoverSoftSelectionInference(r,issues,c,{focused:false});
  assert.equal(ok,true);
  assert.ok(!/役割の分散|今後の成長|調整の過程|チーム全体の負担|育て/.test(JSON.stringify(r)));
}

{
  const c={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン。'}};
  const r=result({
    persona:'CASPER',candidatePlayers:['嶋田 栄志','坂田 暉馬'],
    publicStatement:'実績がある選手をその位置に置くのが確実です。実績に基づいた選択がチームの安定につながる可能性があります。他の記録が示されない限り、この判断を変更する理由はありません。'
  });
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('固定・継続優位・戦術適合')));
  assert.ok(issues.some(x=>x.includes('判断変更不要')));
  const ok=recoverSoftSelectionInference(r,issues,c,{focused:false});
  assert.equal(ok,true);
  assert.ok(!/確実|チームの安定|変更する理由はありません/.test(JSON.stringify(r)));
}

{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'打撃成績には選手間の数値差がある。'}};
  for(const r of [
    result({persona:'BALTHASAR',publicStatement:'成績差をどうやり繰りして勝ちに繋げるかが勝負だ。',facts:['打線全体としての生産力に濃淡がある。'],analysis:['下位の生産力をどう補うかが戦術上の重要なポイントになる。'],warnings:['特定の打者に成績が集中している現状の戦術的リスクを無視しないこと。']}),
    result({persona:'CASPER',publicStatement:'これからのチームの成長を考え、チーム全体がどう強くなっていくかを見守りたいです。',warnings:['組織全体の育成機会を損なわないこと。']})
  ]){
    const issues=validatePersonaOutput(c,r,{focused:false});
    assert.ok(issues.length>0);
    const ok=recoverSoftPersonaBatchValidation(r,issues,c,{focused:false});
    assert.equal(ok,true);
    assert.ok(!/勝ちに繋げ|戦術上の重要なポイント|戦術的リスク|生産力に濃淡|これからのチームの成長|チーム全体がどう強く|見守りたい|組織全体の育成機会/.test(JSON.stringify(r)));
  }
}

{
  const c={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',allCurrentTeamCheck:{players:[{name:'坂田 暉馬',pitching:{SV:'2'}}]}}};
  const second={
    melchior:result({persona:'MELCHIOR',phase:'SECOND',candidatePlayers:['坂田 暉馬'],primaryReason:'坂田 暉馬は2セーブを記録している。'}),
    balthasar:result({persona:'BALTHASAR',phase:'SECOND',candidatePlayers:['坂田 暉馬'],primaryReason:'坂田 暉馬は2セーブを記録している。'}),
    casper:result({persona:'CASPER',phase:'SECOND',candidatePlayers:['坂田 暉馬'],primaryReason:'セーブ実績を評価しつつ、今後の成長や役割の分散も考慮する。'})
  };
  const final=buildSelectionResult(second,{agreement:[],disagreement:[],warnings:[],informationGaps:[],challenges:{}},c);
  assert.ok(!/今後の成長|役割の分散/.test(JSON.stringify(final.majorReasons)));
}

console.log('LIVE 133 RESIDUAL GROUNDING RESULT: PASS');
