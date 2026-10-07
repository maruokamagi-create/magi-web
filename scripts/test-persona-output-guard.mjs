import assert from 'node:assert/strict';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

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

let passed=0;
for(const {name,fn} of tests){
  try{await fn();passed++;console.log(`PASS ${name}`);}catch(error){console.error(`FAIL ${name}`);console.error(error);process.exitCode=1;break;}
}
console.log(`PERSONA OUTPUT GUARD RESULT: ${passed}/${tests.length} PASS`);
if(passed!==tests.length)process.exit(1);