import assert from 'node:assert/strict';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';
import { reconcileLineupOrderExplanation } from '../server/api/magi/_lineup-order-explanation-reconcile.js';

const CASE={
  question:'大野 竜暉をクローザー固定すべき？',
  evidence:{
    currentTeam:{player:'大野 竜暉',pitching:{appearances:3,innings:'5.0',strikeouts:7,walks:2}},
    oldTeam:{player:'大野 竜暉',pitching:{era:'1.69',innings:'54.0',strikeouts:50}},
    operationalConcern:'捕手との兼任負担を考慮する必要がある'
  }
};
function result(overrides={}){
  return {facts:[],analysis:[],prediction:[],primaryReason:'',publicStatement:'',warnings:[],reviewReason:'',changeReason:'',...overrides};
}
const tests=[];function test(name,fn){tests.push({name,fn});}

test('G01 valid pitching labels pass',()=>{
  const r=result({facts:['現チームは登板3試合、投球回5.0、奪三振7、与四球2。','旧チームの防御率は1.69、54.0イニング、奪三振50。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G02 innings mislabeled as appearances is blocked',()=>{
  const r=result({publicStatement:'現チームでの登板はまだ5回です。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('登板数5')));
});

test('G03 walks cannot become four-dead-balls',()=>{
  const r=result({facts:['現チームは四死球2です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('四死球')));
});

test('G04 invented WHIP is blocked',()=>{
  const r=result({analysis:['WHIPは0.95です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('WHIP0.95')));
});

test('G05 wrong ERA is blocked',()=>{
  const r=result({facts:['旧チームの防御率は2.10です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('防御率2.10')));
});

test('G06 supplied old ERA is accepted',()=>{
  const r=result({facts:['旧チームの防御率は1.69です。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G07 unrelated current roster player is blocked in focused proposal',()=>{
  const r=result({publicStatement:'大久保 陽翔も候補に入れます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('大久保 陽翔')));
});

test('G08 unrelated roster names are allowed when not focused',()=>{
  const r=result({publicStatement:'大久保 陽翔も候補に入れます。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:false}),[]);
});

test('G09 invented save count is blocked',()=>{
  const r=result({analysis:['セーブ数は3です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('セーブ3')));
});

test('G10 stat quality adjective without baseline is blocked',()=>{
  const r=result({primaryReason:'与四球の少なさを評価して条件付きで起用する。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G11 unsupported historical closer performance is blocked',()=>{
  const r=result({prediction:['旧チーム同様に重要な場面で試合を締めくくるだろう。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('G12 explicit comparison baseline permits stat-quality language',()=>{
  const compared={...CASE,evidence:{...CASE.evidence,comparison:'チーム平均より与四球が少ない'}};
  const r=result({analysis:['与四球が少ない点は比較上の強みです。']});
  assert.deepEqual(validatePersonaOutput(compared,r,{focused:true}),[]);
});

test('G13 strikeout-walk ratio qualitative claim without baseline is blocked',()=>{
  const r=result({analysis:['奪三振7と与四球2の割合は悪くない。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G14 unsupported pressure-experience inference is blocked',()=>{
  const r=result({analysis:['旧チーム54.0回の実績はプレッシャーのかかる場面での経験値として軽視できない。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('G15 raw strikeout count cannot become generic strikeout ability without baseline',()=>{
  const r=result({publicStatement:'三振が取れる力は買いです。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('比較基準')));
});

test('G16 explicit missing closer evidence disclaimer is allowed',()=>{
  const r=result({warnings:['旧チームでのクローザーとしての起用実績を示す記録は含まれていません。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G17 explicit no-baseline quality disclaimer is allowed',()=>{
  const r=result({analysis:['比較基準がないため、与四球が少ないとは言えません。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G18 plain walk label is checked against supplied walks',()=>{
  const r=result({facts:['四球2です。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G19 wrong plain walk label is blocked',()=>{
  const r=result({facts:['四球5です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('与四球5')));
});

test('G20 bare inning count used as sample is blocked',()=>{
  const r=result({publicStatement:'現チームのサンプルはまだ5回と少ないです。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('投球回5')));
});


test('G20b batting-order count is not mistaken for innings when the number overlaps IP',()=>{
  const battingOrderCase={
    ...CASE,
    question:'3番を誰にする？',
    evidence:{
      ...CASE.evidence,
      currentTeam:{
        ...CASE.evidence.currentTeam,
        pitching:{...CASE.evidence.currentTeam.pitching,innings:'1.0'}
      }
    }
  };
  const r=result({publicStatement:'現チームでは3番起用が1回と少ないです。'});
  const issues=validatePersonaOutput(battingOrderCase,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('投球回1')));
});

test('G21 explicit inning unit is accepted',()=>{
  const r=result({publicStatement:'現チームの投球回は5.0回です。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G22 burden intensity cannot be strengthened beyond evidence',()=>{
  const r=result({publicStatement:'捕手との兼任負担が大きすぎるので固定は避けます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('負担の大きさ')));
});

test('G23 supplied burden concern phrasing is allowed',()=>{
  const r=result({publicStatement:'捕手との兼任負担を考慮する必要があります。'});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G24 definite future harm in assertive text is blocked',()=>{
  const r=result({publicStatement:'捕手との兼任負担で半年後の成長に影響が出てしまいます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('具体的悪影響')));
});

test('G25 conditional future burden prediction is allowed',()=>{
  const r=result({prediction:['負担を考慮せず固定した場合、コンディションに影響を与える可能性があります。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G26 hard future certainty is blocked',()=>{
  const r=result({prediction:['この起用なら必ず勝利を維持できます。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('保証できない')));
});

test('G27 fatigue and burden accumulation is blocked without evidence',()=>{
  const r=result({warnings:['捕手と投手の兼任による疲労や負担の蓄積に注意が必要です。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('負担の大きさ')));
});

test('G28 certainty in user-facing action language is blocked',()=>{
  const r=result({publicStatement:'条件付きで試しながら確実に勝ちを拾っていこう。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('保証できない')));
});

test('G29 unhedged causal growth prediction is blocked',()=>{
  const r=result({prediction:['慎重な段階的起用を続けることで、選手が成長しチームの戦力として定着する。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G30 hedged growth prediction is allowed',()=>{
  const r=result({prediction:['慎重な段階的起用を続けた場合、選手の成長につながる可能性があります。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G31 bare decimal inning after appearance count is blocked',()=>{
  const r=result({publicStatement:'現チームの登板数がまだ3試合5.0と少ないため、固定は早いです。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('投球回5.0')));
});

test('G32 assertive future team impact is blocked',()=>{
  const r=result({publicStatement:'捕手との兼任負担や現チームのサンプルが少ない状況で固定してしまうと、半年後のチームに響きます。'});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('具体的悪影響')||x.includes('不確実性')));
});

test('G33 unhedged causal win-pattern prediction is blocked',()=>{
  const r=result({prediction:['状態を見極めながら起用することで、負担を抑えつつチームの勝ちパターンを作れる。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G34 conditional loss prediction still needs probability hedge',()=>{
  const r=result({prediction:['慎重になりすぎて好機の起用を逃せば、勝利のチャンスを失うことにつながる。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G35 explicit probability hedge allows win-pattern prediction',()=>{
  const r=result({prediction:['状態を見極めながら起用することで、チームの勝ちパターンを作れる可能性があります。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});

test('G36 negative condition causal outcome still requires hedge',()=>{
  const r=result({prediction:['慎重な起用を続けなければ疲労やコンディション不良でチームの勝利計画が狂う。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G37 future combat-strength certainty is blocked',()=>{
  const r=result({prediction:['段階的な起用管理を行えば、捕手と投手の負担を軽減しつつ、将来の確かな戦力として育てていくことができます。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('不確実性')));
});

test('G38 unsupported unfamiliar-pressure premise is blocked even when hedged',()=>{
  const r=result({prediction:['不慣れな緊迫場面で破綻を招く恐れがあります。']});
  const issues=validatePersonaOutput(CASE,r,{focused:true});
  assert.ok(issues.some(x=>x.includes('役割経験')));
});

test('G39 missing pressure-experience disclaimer remains allowed',()=>{
  const r=result({analysis:['緊迫した場面での経験はEvidenceにないため確認できません。']});
  assert.deepEqual(validatePersonaOutput(CASE,r,{focused:true}),[]);
});


test('G40 team review cannot assert hitter dependency from batting spread alone',()=>{
  const teamCase={
    question:'今の丸岡中の弱点は何？',
    selectionKind:'TEAM_REVIEW',
    evidence:{
      reviewKind:'TEAM_REVIEW',
      selectionKind:'TEAM_REVIEW',
      allCurrentTeamCheck:{status:'COMPLETE',players:[]},
      summary:'現チームの確認済み記録を横断する。'
    }
  };
  const r=result({analysis:['中嶋 玲月、大野 竜暉、大久保 陽翔への得点生産の依存度が高い。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('依存')));
});

test('G41 team review may describe measured concentration without dependency claim',()=>{
  const teamCase={
    question:'今の丸岡中の弱点は何？',
    selectionKind:'TEAM_REVIEW',
    evidence:{
      reviewKind:'TEAM_REVIEW',
      selectionKind:'TEAM_REVIEW',
      allCurrentTeamCheck:{status:'COMPLETE',players:[]},
      summary:'現チームの確認済み記録を横断する。'
    }
  };
  const r=result({analysis:['確認できた打撃成績は一部の選手に集中している。']});
  assert.deepEqual(validatePersonaOutput(teamCase,r,{focused:false}),[]);
});

test('G42 team review cannot disguise dependency as relying on high-average hitters',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({analysis:['特定の高打率選手に頼っている部分がある。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('依存・頼り・偏重')));
});

test('G43 team review cannot infer burden concentration from usage spread alone',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({analysis:['一部の選手に経験や負担が偏りがちだ。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('負担集中')));
});

test('G44 team review cannot invent non-appearing players',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({analysis:['試合に出場していない選手たちの育成も課題だ。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('未出場選手')));
});


test('G45 team review catches colloquial relying-on-top-order wording',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({publicStatement:'上位に頼りっきりじゃ、厳しい試合を勝ち抜けねえぞ。'});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('依存・頼り・偏重')));
});


test('G46 production team review blocks batting-spread weakness wording',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({publicStatement:'今の弱点は打線の偏りだね。上位は打っているけど、当たっていない選手との差が大きいから、そこをどう補って点を取るかが勝負の分かれ道になる。'});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('数値差・偏り')));
});

test('G47 production team review blocks individual hitlessness to scoring-source inference',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'直近6試合の個別打撃記録を含む。'}};
  const r=result({facts:['直近6試合の打撃成績では、一部の選手が打率.000に低迷しており、得点源が限定されやすい状況にある。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('チーム得点・戦術')));
});

test('G48 production team review blocks future-development coaching advice',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({publicStatement:'目の前の試合だけでなく、半年後や1年後を見据えてチーム全体をどう育てていくかが大切です。'});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('将来・育成・一般論')));
});

test('G49 production team review blocks numeric-spread-is-weakness wording',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({publicStatement:'確認済みの打撃成績データに基づく数値の偏りこそが俺たちの弱点だ。'});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('数値差・偏り')));
});

test('G50 production team review blocks spread-to-scoring-tactical causality',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',allCurrentTeamCheck:{status:'COMPLETE',players:[]},summary:'現チームの確認済み記録を横断する。'}};
  const r=result({analysis:['打撃成績の数値差から確認できる範囲内で、当たっている選手と当たっていない選手の差が、試合中の得点力や戦術的な課題に直結している。']});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('数値差・偏り')||x.includes('チーム得点・戦術')));
});

test('G51 team review preserves direct recent hitless fact without causal inference',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',recentSix:{status:'COMPLETE'},summary:'直近6試合の個別打撃記録を含む。'}};
  const r=result({facts:['直近6試合では6選手が安打0（打率.000）となっている。']});
  assert.deepEqual(validatePersonaOutput(teamCase,r,{focused:false}),[]);
});

test('G52 team review preserves directly observed fielding record',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'公式戦の守備記録を含む。'}};
  const r=result({facts:['公式戦で失策7が記録されている。']});
  assert.deepEqual(validatePersonaOutput(teamCase,r,{focused:false}),[]);
});


test('G53 team review allows explicit polite non-assertion boundary wording',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの確認済み記録を横断する。'}};
  const r=result({warnings:['TEAM_REVIEWでは、確認済み記録と解釈を分け、数値差だけから特定選手への依存や弱点を断定しません。']});
  assert.deepEqual(validatePersonaOutput(teamCase,r,{focused:false}),[]);
});


test('G54 closer role blocks numeric stability and trust claims',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬はセーブ2、橋向 結都は防御率1.67・WHIP1.12。'}};
  const r=result({persona:'BALTHASAR',publicStatement:'橋向 結都の防御率1.67は信頼できる。',analysis:['橋向 結都は防御率1.67と安定している。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('安定・信頼・長いイニング適性')));
});

test('G55 closer role blocks long-inning inference from volume',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'橋向 結都は投球回37.2。'}};
  const r=result({persona:'BALTHASAR',analysis:['橋向 結都は長いイニングを任せられる安定感がある。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('安定・信頼・長いイニング適性')));
});

test('G56 batting-order selection blocks unsupported tactical stability',()=>{
  const battingCase={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合、打率.282、OPS.748。'}};
  const r=result({persona:'BALTHASAR',primaryReason:'実際に3番で7試合、打率.282、OPS.748の嶋田 栄志が戦術的に最も安定するため。'});
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('戦術的安定性')));
});

test('G57 CASPER selection cannot invent growth opportunity or burden impact',()=>{
  const battingCase={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃・実打順記録を比較する。'}};
  const r=result({persona:'CASPER',warnings:['特定の選手への役割集中が他のメンバーの成長機会に影響するおそれがある。'],publicStatement:'チーム全体で試合を締める経験を積んでいくことが大切です。'});
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('成長・育成・負担影響')));
});


test('G58 closer role cannot infer pressured-game experience from save count alone',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬はセーブ2を記録している。'}};
  const r=result({persona:'BALTHASAR',analysis:['坂田 暉馬のセーブ数2は、終盤の競った場面を実際に切り抜けた直接的な実績である。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('高圧・競った場面')));
});

test('G59 closer role cannot claim unsupported win probability',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬はセーブ2を記録している。'}};
  const r=result({persona:'BALTHASAR',candidateBasis:'勝利の方程式と試合を締める役割の確率的優位性を考慮する。'});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('勝利・成功確率')));
});

test('G60 CASPER closer cannot invent future roster growth frame without Evidence',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'現チームの投手成績とセーブ実績を比較する。'}};
  const r=result({persona:'CASPER',candidateBasis:'将来的なチームの投手層の厚みを考慮する。',publicStatement:'半年後のチーム全体の成長も見据えたいです。'});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('成長・育成・負担影響')));
});

test('G61 CASPER closer cannot invent dependency from small sample',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は投球回4、セーブ2。'}};
  const r=result({persona:'CASPER',analysis:['投球回が少ないため、特定の選手への過度な依存を避ける視点が必要である。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('依存・役割集中')));
});


test('G62 team-review explicit non-assertion about burden concentration is allowed',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの確認済み記録を横断する。'}};
  const r=result({publicStatement:'数値差だけで負担集中までは断定しません。'});
  assert.deepEqual(validatePersonaOutput(teamCase,r,{focused:false}),[]);
});

test('G63 batting-order usage cannot become position suitability or certainty',()=>{
  const battingCase={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン起用。'}};
  const r=result({persona:'MELCHIOR',analysis:['3番で7試合に起用されているため、ポジション適性の記録が最も豊富である。'],primaryReason:'嶋田 栄志が最も確実な選択肢である。'});
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('戦術的安定性')));
});

test('G64 CASPER current batting-order question cannot add半年後 growth frame',()=>{
  const battingCase={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と3番起用記録を比較する。'}};
  const r=result({persona:'CASPER',primaryReason:'選手の成長を慎重に見守りたいからだ。',publicStatement:'半年後のチームも考えて判断したいです。'});
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('成長・育成・負担影響')));
});

test('G65 CASPER development wording is allowed when the user explicitly asks about development',()=>{
  const battingCase={question:'半年後を見据えて3番を育成するなら誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と起用記録を比較する。'}};
  const r=result({persona:'CASPER',publicStatement:'半年後の成長も見据えて候補を比較します。'});
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('成長・育成・負担影響')));
});


test('G66 CASPER closer blocks explicit team-wide growth claim in analysis',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'現チームの投手成績とセーブ実績を比較する。'}};
  const r=result({persona:'CASPER',analysis:['特定の選手だけでなく複数の投手に出場機会と役割を経験させることは、チーム全体の成長にとって重要である。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('成長・育成・負担影響')));
});


test('G67 TEAM_REVIEW blocks spread-to-win-path and attack-rigidity claims',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'打撃成績には選手間の数値差がある。'}};
  const r=result({
    persona:'BALTHASAR',
    publicStatement:'打てる選手とそうでない選手の差が大きい。この偏りをどう埋めるかが勝ちへの道だ。',
    warnings:['特定の打者への偏りが攻撃の硬直化を招くリスクを考慮する必要がある。']
  });
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('数値差・偏り')));
});

test('G68 TEAM_REVIEW blocks generic team-growth advice in current weakness review',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの確認済み記録を横断する。'}};
  const r=result({persona:'CASPER',publicStatement:'試合に出ている選手だけでなく、チーム全体がどう成長していくかを見守りたいですね。'});
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('将来・育成・一般論')));
});

test('G69 closer role blocks save-to-victory causality and certain win-path claims',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は2セーブを記録している。'}};
  const r=result({persona:'BALTHASAR',analysis:['勝利に直結するセーブ実績を持つ選手を起用することが、現在の限られたデータに基づく確実な勝ち筋となる。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('勝利・成功確率')));
});

test('G70 unsupported reverse-order burden wording is blocked',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は2セーブ。制球に関する観察あり。'}};
  const r=result({persona:'CASPER',analysis:['特定の選手への過度な負担が生じないよう観察を続ける必要がある。'],warnings:['特定の選手への負担集中やコンディションには注意が必要です。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('負担の大きさや具体的悪影響')));
});

test('G71 directly observed burden concentration remains usable',()=>{
  const closerCase={question:'クローザーは誰がいい？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'観察記録：特定の選手への負担集中が確認されている。'}};
  const r=result({persona:'CASPER',warnings:['特定の選手への負担集中には注意が必要です。']});
  const issues=validatePersonaOutput(closerCase,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('負担の大きさや具体的悪影響')));
});


test('G72 FULL_LINEUP blocks batting-number-to-scoring and win-advantage claims',()=>{
  const fullCase={question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績と実打順・守備記録を比較する。'}};
  const r=result({
    persona:'BALTHASAR',
    analysis:['中嶋 玲月の打率とOPSを根拠に4番へ置く形が最も得点効率に結びつく。'],
    publicStatement:'この形が一番勝てる確率を高めると判断した。'
  });
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('BEST_ORDERで打撃数値・打順から得点効率・勝利優位を断定')));
});


test('G73 batting-order start count cannot become settled role, experience value or lineup stability',()=>{
  const battingCase={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン起用。'}};
  const r=result({
    persona:'BALTHASAR',
    analysis:['嶋田 栄志は3番としての実戦経験が最も豊富で、チーム内での役割が定着している。'],
    primaryReason:'3番で7試合起用されている嶋田 栄志を置くことで、打順の軸を安定させられる。'
  });
  const issues=validatePersonaOutput(battingCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('戦術的安定性')));
});

test('G74 TEAM_REVIEW blocks tactical-constraint, scoring-dependency risk and generic growth framing',()=>{
  const teamCase={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'打撃成績には選手間の数値差がある。'}};
  const r=result({
    persona:'BALTHASAR',
    analysis:['打撃成績の差は試合を勝ち抜く上で戦術的な制約になり得る。'],
    warnings:['特定の選手の調子に得点が左右されるリスクを考慮する必要がある。','チーム全体の底上げにつながる課題を意識することが大切だ。']
  });
  const issues=validatePersonaOutput(teamCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('数値差・偏り')));
  assert.ok(issues.some(x=>x.includes('将来・育成・一般論')));
});


test('G75 FULL_LINEUP blocks Live132 scoring-chance, batting-stability and defensive-effect leakage',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',recentSix:{gameCount:6},summary:'現チームの打撃成績、直近6試合、実打順、公式戦・練習第1試合の先発守備資格を比較する。'}
  };
  const r=result({
    persona:'CASPER',
    analysis:[
      '中嶋 玲月は通算打率 .485と高い数値を記録しており、3番打者として起用することで得点機会を創出する可能性があると考えられます。',
      '嶋田 栄志は通算OPS .748と安定しており、4番打者として打線をつなぐ役割が期待されます。',
      '守備位置の適性を考慮した配置により、守備の安定性が維持される可能性があります。'
    ],
    publicStatement:'守備の安定も考慮し、この打順でチームの連携を深めることを目指します。'
  });
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('得点機会・安定性')));
  assert.ok(issues.some(x=>x.includes('守備安定性や連携効果')));
});

test('G76 FULL_LINEUP blocks a mismatched recent-game window',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',recentSix:{gameCount:6},summary:'直近6試合の打撃成績を使用する。'}
  };
  const r=result({persona:'BALTHASAR',primaryReason:'直近5試合の打撃成績でも打率.375・OPS .849を記録している。'});
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('直近試合数をEvidenceと異なる値')));
});

test('G77 FULL_LINEUP allows the exact supplied recent-game window count',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',recentSix:{gameCount:6},summary:'直近6試合の打撃成績を使用する。'}
  };
  const r=result({persona:'MELCHIOR',primaryReason:'直近6試合の打撃成績を現在状態の比較材料として確認した。'});
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('直近試合数をEvidenceと異なる値')));
});

test('G78 FULL_LINEUP blocks unsupported current-slot fixation',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',summary:'現在の打撃成績と実打順を比較する。固定方針の記録はない。'}
  };
  const r=result({persona:'BALTHASAR',publicStatement:'中嶋 玲月を3番で固定する。'});
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('Evidenceにない打順固定')));
});


test('G79 closer blocks Live132 win-path, win-directness and win-pattern prose',()=>{
  const caseData={mode:'selection',question:'クローザーは誰がいい？',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'坂田 暉馬は現チームで2セーブを記録している。'}};
  const r=result({
    persona:'BALTHASAR',
    candidatePlayers:['坂田 暉馬'],
    candidateBasis:'セーブ2の実績を重視し、終盤の勝ちパターンを構築するために坂田 暉馬を選ぶ。',
    publicStatement:'実際にセーブを2つ取っている坂田 暉馬を置くことが一番の勝ち筋で、現時点で最も勝ちに直結する。'
  });
  const issues=validatePersonaOutput(caseData,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('PITCHING_ROLEでEvidenceにない勝利・成功確率')));
});

test('G80 batting-order blocks Live132 incumbency, tactical-fit, form-label and continuity causality',()=>{
  const caseData={mode:'selection',question:'3番は誰がいい？',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン、打率.282、OPS .748。直近6試合は打率.238、OPS .638。'}};
  const r=result({
    persona:'CASPER',
    candidatePlayers:['嶋田 栄志','坂田 暉馬'],
    analysis:[
      '嶋田 栄志は3番で7試合スタメン起用されており、これまでの戦術的運用に最も合致する。',
      '現チームの戦術の中で3番に固定されてきた経過がある。',
      '直近6試合の打率が.238、OPS .638で、打撃の勢いが少し落ちている。',
      'これまでのチームの形に最も馴染む。'
    ],
    warnings:['短期的な打撃成績の変動だけで打順を頻繁に変えると、全体のつながりに影響するおそれがある。']
  });
  const issues=validatePersonaOutput(caseData,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('戦術的安定性')));
  assert.ok(issues.some(x=>x.includes('固定・継続優位・戦術適合')));
  assert.ok(issues.some(x=>x.includes('勢い・低調・安定')));
  assert.ok(issues.some(x=>x.includes('つながり・連携への因果')));
});


test('G81 FULL_LINEUP blocks Live production scoring-optimization and win-proximity wording',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績、実打順、守備起用実績を比較する。'}
  };
  const r=result({
    persona:'BALTHASAR',
    primaryReason:'1番から5番の現在成績を軸に、得点力を最大化する並びとした。',
    prediction:['現在の数値を維持できれば、打線が機能して得点力を発揮できる可能性がある。'],
    warnings:['守備連携の習熟度次第では、連係ミスを防ぎながら勝利へ近づくことができると考えられる。']
  });
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('得点力最大化・勝利接近')));
});

test('G82 FULL_LINEUP blocks a rationale that narrates a different batting order from candidatePlayers',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績、実打順、守備起用実績を比較する。'}
  };
  const order=['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔'];
  const r=result({
    persona:'MELCHIOR',
    candidatePlayers:order,
    candidateBasis:'1番捕手は大野 竜暉、2番遊撃手は大久保 陽翔、3番中堅手は嶋田 栄志、4番一塁手は中嶋 玲月、5番二塁手は坂田 暉馬とする。',
    publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番嶋田 栄志、4番中嶋 玲月、5番坂田 暉馬の並びです。'
  });
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('candidatePlayersと打順説明が矛盾')));
});

test('G83 FULL_LINEUP allows numbered proposal prose when it matches candidatePlayers',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーを、守備位置込みで審議して',
    mode:'selection',
    selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃成績、実打順、守備起用実績を比較する。'}
  };
  const order=['大野 竜暉','大久保 陽翔','中嶋 玲月','坂田 暉馬','嶋田 栄志','井坂 悠聖','武澤 大翔','橋向 結都','武田 晴琉翔'];
  const r=result({
    persona:'MELCHIOR',
    candidatePlayers:order,
    candidateBasis:'1番捕手は大野 竜暉、2番遊撃手は大久保 陽翔、3番一塁手は中嶋 玲月、4番二塁手は坂田 暉馬、5番中堅手は嶋田 栄志とする。',
    publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番中嶋 玲月、4番坂田 暉馬、5番嶋田 栄志の並びです。'
  });
  const issues=validatePersonaOutput(fullCase,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('candidatePlayersと打順説明が矛盾')));
});

test('G84 TEAM_REVIEW blocks standalone tactical conclusions without a same-sentence batting spread',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の確認済み個別記録。'}};
  const r=result({
    persona:'BALTHASAR',
    publicStatement:'特定の好調な選手だけでなく、全体の得点力をどう形作るかが勝負の分かれ道だ。'
  });
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.some(x=>x.includes('TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張')));
});

test('G85 TEAM_REVIEW preserves explicit non-causal evidence limitations',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の確認済み個別記録。'}};
  const r=result({persona:'BALTHASAR',publicStatement:'記録だけでは勝負の分かれ道までは断定できません。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.some(x=>x.includes('TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張')));
});

test('G86 TEAM_REVIEW rejects unsupported over-reliance even without explicit dependency keywords',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個別打撃記録のみ。'}};
  const r=result({persona:'CASPER',publicStatement:'今のチームは一部の選手に頼りすぎている部分があります。'});
  assert.ok(validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定している'));
});

test('G87 TEAM_REVIEW allows explicit non-assertion of over-reliance',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個別打撃記録のみ。'}};
  const r=result({persona:'CASPER',publicStatement:'記録だけで特定選手に頼りすぎているとは断定できない。'});
  assert.ok(!validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定している'));
});

test('G88 TEAM_REVIEW rejects spread-to-attack-power harm without scoring Evidence',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個人別打撃成績。チーム得点への因果は確認されていない。'}};
  const samples=[
    '打撃成績の偏りがそのまま攻撃力の制限につながる点に注意すること。',
    'この打撃成績の偏りが試合展開における攻撃の選択肢や得点ルートを狭めている可能性がある。'
  ];
  for(const statement of samples){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',warnings:[statement]}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張している'),statement);
  }
});

test('G89 TEAM_REVIEW preserves explicit non-causality and measured spread statements',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個人別打撃成績のみ。'}};
  const r=result({persona:'BALTHASAR',facts:['確認済みの打撃成績には選手間の数値差がある。'],warnings:['打撃成績の偏りが攻撃力の制限につながるとは断定できない。']});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張している'));
});

test('G90 TEAM_REVIEW rejects unmeasured long-term development impact even as a possibility',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個別打撃・起用記録のみ。'}};
  const statements=[
    'チームの現状を評価する際、打撃成績の数値差や出場機会の偏りは、長期的なチームの成長や選手層の厚さに影響を与える可能性がある。',
    '一部の選手への打撃成績の数値差や出場機会の偏りが長期的なチーム作りに与える影響に配慮すること。'
  ];
  for(const statement of statements){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',warnings:[statement]}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで個別記録から長期的な成長・経験機会への効果を推定している'),statement);
  }
});

test('G91 TEAM_REVIEW permits limited observation without any forecast impact',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個別打撃・起用記録のみ。'}};
  const r=result({persona:'CASPER',facts:['確認済みの出場機会や打数には選手間の差がある。'],warnings:['起用機会の差だけでは長期的なチームの成長への影響は断定できない。']});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWで個別記録から長期的な成長・経験機会への効果を推定している'));
});

test('G92 BATTING_ORDER rejects speculative fixed-role experience effects for CASPER',()=>{
  const c={question:'3番は誰がいい？',mode:'selection',selectionKind:'BATTING_ORDER',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打順別先発と打撃成績。'}};
  const statements=[
    '特定の選手への固定がチーム全体の経験機会に影響を与えるおそれがあります。',
    '選手全体の成長につながる起用を考えたい。'
  ];
  for(const statement of statements){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',warnings:[statement]}),{focused:false});
    assert.ok(issues.includes('SELECTIONでEvidenceにない成長・育成・負担影響を追加している'),statement);
  }
});

test('G93 TEAM_REVIEW rejects invented current growth-opportunity weakness',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個別打撃・起用記録のみ。'}};
  const r=result({persona:'CASPER',analysis:['試合に出る選手だけでなく、出場機会が少ない選手も含めた全体の成長機会をどう確保するかという点が現在の課題である。']});
  assert.ok(validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G94 TEAM_REVIEW preserves explicit uncertainty about growth opportunity',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個別の起用記録のみ。'}};
  const r=result({persona:'CASPER',warnings:['全体の成長機会の不足が現在の課題かどうかは、この記録だけでは断定できない。']});
  assert.ok(!validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G95 TEAM_REVIEW rejects unverified growth-opportunity concern disguised as question',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個別打撃・出場記録のみ。'}};
  const r=result({persona:'CASPER',publicStatement:'他の選手にも成長の機会がしっかり回っているか気にかかります。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G96 TEAM_REVIEW permits explicit evidence gap about growth opportunity',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個別打撃・出場記録のみ。'}};
  const r=result({persona:'CASPER',publicStatement:'成長の機会が全員に十分回っているかは、この記録だけでは確認できない。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G97 TEAM_REVIEW rejects scoring concentration inferred from individual batting averages',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個別打率と打数だけが記録されている。'}};
  const phrases=[
    '特定の選手に得点力が偏っている現状は無視できない。',
    '特定の打者に成績が集中している現状は、実戦における攻撃の選択肢に影響を与える可能性がある。'
  ];
  for(const phrase of phrases){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:phrase}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張している'),phrase);
  }
});

test('G98 TEAM_REVIEW preserves explicitly unproven team-scoring concentration',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個別打率と打数だけが記録されている。'}};
  const r=result({persona:'BALTHASAR',publicStatement:'特定の選手に得点力が偏っているかは、個別の打率だけでは確認できない。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWで個別打撃の偏りからチーム攻撃力への未確認の効果を主張している'));
});

test('G99 TEAM_REVIEW refuses generic growth prescriptions and malformed replacement fragments',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'14名の打撃成績と出場回数のみ。'}};
  const bad=[
    '目先の試合の勝敗だけでなく、控え選手の経験や全体の成長バランスを見据えた運用が求められる。',
    '選手間の出場機会の差していないか、チーム全体で取り組む姿勢が問われている。'
  ];
  for(const sentence of bad){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',analysis:[sentence]}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'),sentence);
  }
});

test('G100 TEAM_REVIEW permits explicit evidence limit for development allocation',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'14名の打撃成績と出場回数のみ。'}};
  const r=result({persona:'CASPER',analysis:['控え選手の経験や成長に関する運用の必要性は、現記録だけでは確認できない。']});
  assert.ok(!validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G93 TEAM_REVIEW blocks ungrounded scoring-route loss and win-necessity rhetoric',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個別打撃成績だけ。'}};
  const examples=[
    '試合中の得点ルートが限定されるリスクについて考慮する必要がある。',
    'どうやって点を取るか、そこをはっきりさせないと勝てないぞ。'
  ];
  for(const phrase of examples){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:phrase}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'),phrase);
  }
});

test('G94 TEAM_REVIEW preserves an explicit non-causal scoring-route limit',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個別の打撃記録のみ。'}};
  const r=result({persona:'BALTHASAR',publicStatement:'個別の成績だけでは、得点ルートが限定されるとは断定できない。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'));
});

test('G94 TEAM_REVIEW refuses reserve-development inference as a present team weakness',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現在の打撃成績と出場機会のみ。育成上の弱点を裏付ける観察はない。'}};
  const r=result({persona:'CASPER',publicStatement:'出る選手だけがチームじゃないです。出場記録の少ない選手の経験や控えの育成という課題も、今のチームの大切な弱点として見ていく必要があります。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G95 TEAM_REVIEW allows explicit rejection of invented reserve-development weakness',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの実際の出場記録のみ。'}};
  const r=result({persona:'CASPER',publicStatement:'出場記録だけで控えの育成がチームの弱点だとは断定できない。'});
  const issues=validatePersonaOutput(c,r,{focused:false});
  assert.ok(!issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('G96 TEAM_REVIEW rejects projected late scoring decline from individual batting record',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'個人別打撃成績のみ。チーム得点の推移は未確認。'}};
  const cases=[
    '下位打線や直近で安打のない選手たちの出塁や進塁打の確率を高める手が打てなければ、試合終盤の得点力が限定される。',
    '特定のバッターだけに頼った状態では厳しい。'
  ];
  for(const claim of cases){
    const result={persona:'BALTHASAR',publicStatement:claim};
    const issues=validatePersonaOutput(c,result,{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'),claim);
  }
});

test('G97 TEAM_REVIEW allows explicit denials of the same hypothetical outcomes',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個人成績のみ。'}};
  const r=result({persona:'BALTHASAR',publicStatement:'出塁を改善できなければ得点力が低下するとは断定できない。'});
  assert.ok(!validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'));
});

test('G98 TEAM_REVIEW blocks win-key and unverified missing attack alternatives',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個人別成績のみ。'}};
  for(const claim of [
    '試合を勝ち抜くためには、上位の好調な打線だけでなく、下位打線の出塁や得点機での効率的な進め方が勝敗の鍵を握る。',
    '攻撃の軸が抑え込まれた場合の代替策が不足する懸念がある。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',warnings:[claim]}),{focused:false});
    assert.ok(issues.includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'),claim);
  }
});

test('G99 TEAM_REVIEW preserves explicit rejection of victory-key/alternative shortage inferences',()=>{
  const c={question:'今の丸岡中の弱点は何？',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個人別成績のみ。'}};
  const r=result({persona:'BALTHASAR',facts:['打撃成績に選手間の数値差がある。'],warnings:[
    '下位打線の出塁が勝敗の鍵を握るとは断定できない。',
    '攻撃の軸を抑えられた場合の代替策が不足するとは確認できない。'
  ]});
  assert.ok(!validatePersonaOutput(c,r,{focused:false}).includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'));
});

test('Live natural-third rejects inferred role, team stability, attack gain and future leadership',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と3番の先発起用回数のみ。'}};
  const claims=[
    '嶋田 栄志は3番で7試合起用されており、安定した選択肢となる。',
    '嶋田 栄志は3番の役割に慣れている可能性がある。',
    '中嶋 玲月の高い打率を活かすことが、最も有効な戦術だ。',
    '嶋田 栄志を3番に置けばチームの安定につながる可能性があります。',
    '嶋田 栄志の起用は現在の打順の安定性を維持する可能性がある。',
    '3番の起用実績から打順構成における連続性を維持できる可能性がある。',
    '中嶋 玲月の起用は打線の攻撃力を高める可能性がある。',
    '中嶋 玲月は将来的にチームを支える存在になるかもしれません。'
  ];
  for(const claim of claims){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',publicStatement:claim}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),claim+' -> '+issues.join(' / '));
  }
});

test('Live natural-third preserves measured starts/rates and explicit lack of effect evidence',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの打撃成績と3番の先発起用回数のみ。'}};
  const statements=[
    '嶋田 栄志は3番で7試合のスタメン起用が記録されている。',
    '中嶋 玲月は打率 .485、OPS 1.120 を記録している。',
    '3番起用だけでチームの安定につながるとは断定できない。',
    '役割に慣れているかは確認できない。'
  ];
  for(const statement of statements){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+issues.join(' / '));
  }
});

test('BATTING_ORDER blocks invented adaptation, team stability and scoring impact from starts or OPS',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番に誰を起用すべき？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チーム3番起用記録、打率、OPS。チーム得点因果や打順適応力の測定はない。'}};
  const claims=[
    '嶋田 栄志は3番打順での経験が豊富であり、チームの戦術的な軸となっている可能性がある。',
    '嶋田 栄志は3番打順での起用が最も多く、役割の継続性が確認できる。',
    '嶋田 栄志は3番での起用実績が7回あり、打順への適応が確認されている。',
    '嶋田 栄志は3番での起用回数が多く、打順の安定性において強みを持つ。',
    'チームの安定を考えると、まずは嶋田 栄志を軸にするのが良い。',
    '嶋田 栄志の起用実績を尊重し、チームの安定性を優先するため。',
    '坂田 暉馬のOPSは嶋田 栄志を上回っており、得点機を拡大する可能性がある。',
    'OPSが高く、4番へのつなぎとして有効な可能性がある。',
    '坂田 暉馬の3番での起用経験が少ない点はリスクとなる可能性がある。',
    '嶋田 栄志の3番起用実績を根拠に打順構成の安定を図る。'
  ];
  for(const statement of claims){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' '+JSON.stringify(issues));
  }
});

test('BATTING_ORDER retains measured starts, metrics and explicit lack of evidence for effects',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番に誰を起用すべき？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チーム3番起用記録、打率、OPS。'}};
  for(const statement of [
    '嶋田 栄志は3番で7試合のスタメン起用が記録されている。',
    '坂田 暉馬のOPS .861は嶋田 栄志のOPS .748を上回る。',
    '3番への適応力や得点機増加は、今の記録だけでは確認できない。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement);
  }
});

test('Live natural third rejects slot starts to player trust and next-batter benefit claims',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'今季通算打率・OPSと3番先発起用回数の記録のみ。'}};
  for(const statement of [
    '今の数字なら坂田 暉馬の方が4番の大久保 陽翔へつなぐ役割として期待できるはずだ。',
    '嶋田 栄志は3番での起用実績が最も豊富であり、記録に基づく信頼性が高いため候補を維持します。',
    '3番起用実績が多く、打順での信頼度が高い。',
    '4番へつなぐ役割として有効だと判断する。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('Live natural third preserves measured usage and negated success claims',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'今季通算打率・OPSと3番先発起用回数の記録のみ。'}};
  for(const statement of [
    '嶋田 栄志は3番で7試合先発した記録がある。',
    '坂田 暉馬のOPSは.861で、嶋田 栄志のOPSは.748。',
    '3番での起用実績が多くても信頼性が高いとは断定できない。',
    '4番へつなぐ役割として有効だとは断定できない。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('Live BATTING_ORDER blocks tactical, next-batter, development and burden effects without data',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番を誰にするか迷っている。4番へのつなぎを考えると？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チーム通算打率・OPSと実際の3番先発回数のみ。'}};
  const samples=[
    '俺は中嶋 玲月を3番に推す。通算打率.485にOPS 1.120という数字がある以上、4番の大久保 陽翔につなぐ打順として十分に機能するはずだ。',
    '現チーム通算で打率.485、OPS 1.120を記録している中嶋 玲月を軸に、4番大久保 陽翔への接続を最適化する視点で選出する。',
    '現チームで最高水準の打率.485とOPS 1.120を記録している中嶋 玲月を3番に据えることが戦術上有利だからだ。',
    '中嶋 玲月の高い打率とOPSは攻撃の軸として機能する可能性がある。',
    'これまでの試合で3番としての出場実績が最も多い嶋田 栄志を置きつつ、チーム全体の経験の蓄積を考慮する。',
    '積み上げてきた経験が今後のチームの力になっていくと考えています。',
    'これまでの出場実績と経験の蓄積とチーム全体のバランスを考慮する。',
    '固定化が選手の負担に影響するおそれがある。',
    '嶋田 栄志は3番でのスタメン起用実績が7試合あり、実際の出場詳細に基づく適合が確認できる。',
    '嶋田 栄志の継続的な3番起用は、これまでのチーム構成における重要な役割を担っている。'
  ];
  for(const statement of samples){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',publicStatement:statement}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('Live BATTING_ORDER leaves measured batting and explicit evidence-limit sentences alone',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番を誰にするか迷っている',evidence:{selectionKind:'BATTING_ORDER',summary:'打撃成績と打順記録のみ。'}};
  for(const statement of [
    '嶋田 栄志は3番として7試合にスタメン出場した。',
    '中嶋 玲月の打率.485、OPS 1.120を記録で確認した。',
    '4番につなぐ打順として十分に機能するかは確認できない。',
    '過去の起用実績だけでは打順への適合は確認できない。',
    '固定化が選手の負担に影響するかは根拠がない。',
    '打率だけで戦術上有利とは断定できない。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'CASPER',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('Live NATURAL_THIRD SECOND rejects next-batter optimality and statistics-to-win-probability leaps',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'今季個人打撃成績と実打順のみ。勝率への寄与は未測定。'}};
  for(const statement of [
    '中嶋 玲月の現チーム通算打率.485、OPS 1.120、得点圏打率.545という高い数値を最優先し、4番につなぐ打順として最適と判断する。',
    'メルキオールの指摘する嶋田 栄志の3番起用実績は事実だが、得点力を最大化する観点では中嶋 玲月の打撃数値を上位に置く方が勝つ確率を高めると考えられる。',
    'OPSが高い打者の3番起用は勝率を高める可能性がある。',
    '4番の前につなぐ打順として最適だ。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' '+JSON.stringify(issues));
  }
});

test('BATTING_ORDER still allows objective comparisons and explicit absence of win-rate evidence',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'今季のOPSと3番先発記録のみ。'}};
  for(const statement of [
    'OPSが.861の坂田 暉馬とOPSが1.120の中嶋 玲月を比較する。',
    '今の資料から、4番につなぐ打順として最適かは判断できない。',
    '打撃数値だけでは勝つ確率を高める効果は確認できない。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' '+JSON.stringify(issues));
  }
});

test('Live NATURAL_THIRD rejects 4th-hitter bridge as a selection rationale even without advantage keywords',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'現チームの3番先発回数・OPSのみ。次打者との得点因果は未検証。'}};
  for(const statement of [
    'じゃあ俺は、3番スタメンを7回経験している嶋田 栄志か、OPS .861の坂田 暉馬を推す。4番の大久保につなぐならこのどちらかだ。',
    '4番の大久保 陽翔につなぐ役割として、3番でのスタメン実績が多い嶋田 栄志を維持する。',
    '次打者につなぐためにこの3番候補を選ぶ。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',primaryReason:statement}),{focused:false});
    assert.ok(issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('BATTING_ORDER accepts explicit bridge non-evidence statements and unrelated verified starts',()=>{
  const c={mode:'selection',selectionKind:'BATTING_ORDER',question:'3番は誰がいい？',evidence:{selectionKind:'BATTING_ORDER',summary:'嶋田 栄志は3番で7試合スタメン。'}};
  for(const statement of [
    '嶋田 栄志の3番スタメンは7試合と記録されている。',
    '4番へのつなぎの効果があるかどうかは確認できない。',
    '4番の大久保 陽翔につなぐ役割を担えるかは現資料では判断できない。'
  ]){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(!issues.includes('BATTING_ORDERで打順実績から未確認の役割適性・チーム効果を推定している'),statement+' -> '+JSON.stringify(issues));
  }
});

test('Live TEAM_REVIEW rejects documented opponent, load and growth inference classes',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チーム14名の個別打撃率と起用回数のみ。対戦相手への対策効果、身体負荷、成長成果は未検証。'}};
  const cases=[
    ['相手に研究された時に点数が止まる。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'],
    ['相手投手陣に対策された場合の攻撃力低下が戦術上の大きなリスクとなる。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'],
    ['試合に勝つための得点を生み出すルートが特定の上位打線に偏っている。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'],
    ['3人がチームの攻撃を牽引している。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'],
    ['一定の出場や投球の負荷がかかっていることが記録されている。','TEAM_REVIEWで起用差から負担集中を断定している'],
    ['長い目で見て強いチームになるための課題を見据えましょう。','TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'],
    ['出場機会の差があり、打数や経験値に差が生じている。','TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'],
    ['一部選手への過度な起用偏重がもたらす長期的なチーム編成への影響に注意する。','TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'],
    ['ここをどう崩していくかが勝負だ。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している']
  ];
  for(const [statement,expected] of cases){
    const issues=validatePersonaOutput(c,result({persona:'BALTHASAR',publicStatement:statement}),{focused:false});
    assert.ok(issues.includes(expected),statement+' => '+JSON.stringify(issues));
  }
});

test('Live TEAM_REVIEW retains verified individual facts and explicit limitations',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの出場詳細と打撃成績のみ。'}};
  const safe=[
    '現チームの打撃成績には選手間の数値差が記録されている。',
    '橋向 結都は投手として8試合に先発した。',
    '投球の身体的負荷がかかっているかは確認できない。',
    '相手に研究された場合に得点が止まるとは断定できない。',
    '起用偏重が長期的なチーム編成に影響するかは未確認である。',
    '出場回数に違いはあるが、経験値に差が生じているかは不明である。'
  ];
  for(const statement of safe){
    const issues=validatePersonaOutput(c,result({persona:'MELCHIOR',publicStatement:statement}),{focused:false});
    assert.ok(!issues.some(v=>v.startsWith('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果')||v.startsWith('TEAM_REVIEWで起用差から負担集中')||v.startsWith('TEAM_REVIEWでEvidenceにない将来・育成')),statement+' => '+JSON.stringify(issues));
  }
});

test('TEAM_REVIEW blocks malformed usage wording created during a cleanup pass',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現在の出場回数や打数の一覧。'}};
  const invalid=result({persona:'CASPER',analysis:['出場機会には差があり、選手間の出場機会の差いる状況が見受けられる。']});
  const issues=validatePersonaOutput(c,invalid,{focused:false});
  assert.ok(issues.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'),JSON.stringify(issues));
  const valid=result({persona:'CASPER',analysis:['選手によって出場回数や打数に差がある。']});
  const clean=validatePersonaOutput(c,valid,{focused:false});
  assert.ok(!clean.includes('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している'));
});

test('Live TEAM_REVIEW rejects conditional opponent-narrowing and lineup-fixation effects',()=>{
  const c={question:'今の丸岡中の弱点は何？',mode:'proposal',selectionKind:'TEAM_REVIEW',evidence:{reviewKind:'TEAM_REVIEW',selectionKind:'TEAM_REVIEW',summary:'現チームの個別打撃成績・出場回数のみ。相手の対策効果と組織の長期的影響は未確認。'}};
  const unsafe=[
    ['特定の打者に頼った構成のままでは、相手に対策された際に攻撃の幅が狭まるおそれがある。','TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果を主張している'],
    ['目先の勝利だけに固執して選手起用が固定化されると、組織としての総合力が低下する可能性がある。','TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している']
  ];
  for(const [statement,code] of unsafe){
    const issues=validatePersonaOutput(c,result({warnings:[statement]}),{focused:false});
    assert.ok(issues.includes(code),statement+' => '+JSON.stringify(issues));
  }
  for(const safe of [
    '相手に対策された場合に攻撃の幅が狭まるかは確認できない。',
    '選手起用が固定化されるとチーム力が低下するとは断定できない。',
    '現チームには個別打撃成績の数値差がある。'
  ]){
    const issues=validatePersonaOutput(c,result({warnings:[safe]}),{focused:false});
    assert.ok(!issues.some(v=>v.includes('TEAM_REVIEWで得点経路の制限や勝敗への未確認の因果')||v.includes('TEAM_REVIEWでEvidenceにない将来・育成')),safe+' => '+JSON.stringify(issues));
  }
});

test('Live FULL_LINEUP rejects a truncated numbered player name while preserving structured nine',()=>{
  const lineup=['大野 竜暉','大久保 陽翔','中嶋 玲月','嶋田 栄志','坂田 暉馬','武澤 大翔','橋向 結都','井坂 悠聖','武田 晴琉翔'];
  const c={question:'今の丸岡中のベストオーダー',mode:'selection',selectionKind:'FULL_LINEUP',evidence:{selectionKind:'FULL_LINEUP',summary:'正式14名の守備資格と出場記録'}};
  const rows=lineup.slice(0,8).map((name,index)=>(index+1)+'番'+name).join('、');
  const malformed=result({persona:'MELCHIOR',candidatePlayers:lineup,publicStatement:rows+'、9番田です。'});
  const issues=validatePersonaOutput(c,malformed,{focused:false});
  assert.ok(issues.includes('BEST_ORDERのcandidatePlayersと打順説明が矛盾している'),JSON.stringify(issues));
  const corrected=reconcileLineupOrderExplanation(malformed,issues);
  assert.ok(corrected,'prose-only numbered-name conflict should be recoverable');
  assert.deepEqual(corrected.candidatePlayers,lineup,'structured lineup must remain unchanged');
  assert.ok(!corrected.publicStatement.includes('9番田です'));
  assert.ok(corrected.publicStatement.includes('9番武田 晴琉翔'));
  assert.deepEqual(validatePersonaOutput(c,corrected,{focused:false}),[]);
  const before=JSON.stringify(malformed);
  assert.equal(reconcileLineupOrderExplanation(malformed,[...issues,'数値3 は supplied CASE/EVIDENCE の値と一致しない']),null);
  assert.equal(JSON.stringify(malformed),before,'numeric mismatch must remain fail-closed');

  const surnameShort=result({persona:'MELCHIOR',candidatePlayers:lineup,
    publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番中嶋 玲月、9番武田です。'});
  assert.ok(!validatePersonaOutput(c,surnameShort,{focused:false}).includes('BEST_ORDERのcandidatePlayersと打順説明が矛盾している'));
  const givenShort=result({persona:'MELCHIOR',candidatePlayers:lineup,
    publicStatement:'1番大野 竜暉、2番大久保 陽翔、3番中嶋 玲月、9番晴琉翔です。'});
  assert.ok(!validatePersonaOutput(c,givenShort,{focused:false}).includes('BEST_ORDERのcandidatePlayersと打順説明が矛盾している'));
});

test('Live closer must not label innings and ERA as measured stability',()=>{
  const c={question:'今のクローザー候補は？',mode:'selection',selectionKind:'PITCHING_ROLE',evidence:{selectionKind:'PITCHING_ROLE',summary:'現チーム投球回と防御率、セーブ数の記録。'}};
  const statement='橋向 結都の投球回と防御率の安定性は事実ですが、セーブ実績を比較します。';
  const issues=validatePersonaOutput(c,result({persona:'MELCHIOR',publicStatement:statement}),{focused:false});
  assert.ok(issues.includes('PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している'),JSON.stringify(issues));
  const allowed=result({persona:'MELCHIOR',publicStatement:'投球回と防御率の記録は確認できますが、それだけでは安定性を断定できません。'});
  assert.ok(!validatePersonaOutput(c,allowed,{focused:false}).includes('PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している'));
});


test('G-live161 FULL_LINEUP blocks hedged scoring chance and defense stability without adjacent numeric language',()=>{
  const fullCase={
    question:'今の丸岡中のベストオーダーは？',mode:'selection',selectionKind:'FULL_LINEUP',
    evidence:{selectionKind:'FULL_LINEUP',summary:'現チームの打撃数値と先発守備位置が確認できる'}
  };
  for(const sentence of [
    'このオーダーにより、上位打線で得点機会を創出できる可能性がある。',
    '橋向 結都の投球と大野 竜暉の捕手起用により、守備の安定を図れる可能性がある。',
    '下位打線がつながれば、得点力が増す可能性がある。',
    '実績のあるポジションに配置し、守備の安定を優先した。',
    '上位で得点機を作るのが俺の狙いだ。'
  ]){
    const issues=validatePersonaOutput(fullCase,result({persona:'BALTHASAR',publicStatement:sentence}),{focused:false});
    assert.ok(issues.some(x=>x.includes('BEST_ORDERで打撃数値・打順から得点機会・安定性を推定')),sentence+' => '+issues.join(';'));
  }
  const allowed=validatePersonaOutput(fullCase,result({persona:'BALTHASAR',publicStatement:'両選手の打順順序による得点機会の創出や守備の安定は、この記録だけでは確認できません。'}),{focused:false});
  assert.ok(!allowed.some(x=>x.includes('BEST_ORDERで打撃数値・打順から得点機会・安定性を推定')),allowed.join(';'));
});

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`PERSONA OUTPUT GUARD RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);