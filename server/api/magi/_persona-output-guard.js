import { CURRENT_ROSTER } from './_roster.js';
import { validatePitchingPlanPersonaOutput } from './_pitching-plan-output-guard.js';

function text(value){return String(value ?? '').trim();}
function numberValue(value){
  if(typeof value==='number' && Number.isFinite(value)) return value;
  const s=text(value).replace(/,/g,'');
  if(!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function sameNumber(a,b){return Math.abs(a-b)<1e-9;}
function pushMetric(map,key,value){
  const n=numberValue(value);if(n===null)return;
  if(!map[key])map[key]=[];
  if(!map[key].some(x=>sameNumber(x,n)))map[key].push(n);
}
function sentenceParts(value){
  return String(value||'').split(/[。！？!?\n]+/).map(s=>s.trim()).filter(Boolean);
}
function isEvidenceGapStatement(sentence){
  const s=String(sentence||'');
  return /(?:確認でき(?:ない|ません)|裏付け(?:られない|られません)|証明でき(?:ない|ません)|断定でき(?:ない|ません)|とは言え(?:ない|ません)|根拠(?:が|は)?(?:ない|ありません)|記録(?:が|は)?(?:ない|ありません|含まれていない|含まれていません)|Evidence(?:に|上に)?(?:ない|ありません)|未確認|不明|示されていない|示されていません|前提にでき(?:ない|ません)|直接.{0,12}でき(?:ない|ません))/.test(s);
}

const KEY_MAP=new Map([
  ['appearances','APP'],['appearance','APP'],['app','APP'],['登板数','APP'],
  ['innings','IP'],['inning','IP'],['ip','IP'],['投球回','IP'],['投球回数','IP'],
  ['strikeouts','SO'],['strikeout','SO'],['so','SO'],['奪三振','SO'],
  ['walks','BB'],['walk','BB'],['bb','BB'],['与四球','BB'],
  ['hbp','HBP'],['hitbypitch','HBP'],['hit_by_pitch','HBP'],['与死球','HBP'],
  ['era','ERA'],['防御率','ERA'],['whip','WHIP'],
  ['saves','SV'],['save','SV'],['sv','SV'],['セーブ','SV']
]);

function collectMetrics(value,map={}){
  if(Array.isArray(value)){for(const x of value)collectMetrics(x,map);return map;}
  if(!value||typeof value!=='object')return map;
  for(const [rawKey,v] of Object.entries(value)){
    const normalized=String(rawKey).replace(/[\s_-]/g,'').toLowerCase();
    let metric=null;
    for(const [key,mapped] of KEY_MAP){
      if(normalized===String(key).replace(/[\s_-]/g,'').toLowerCase()){metric=mapped;break;}
    }
    if(metric)pushMetric(map,metric,v);
    if(v&&typeof v==='object')collectMetrics(v,map);
  }
  return map;
}

function hasStructuredPeerComparison(caseData){
  const block=caseData?.evidence?.allCurrentTeamCheck;
  const players=Array.isArray(block?.players)?block.players:[];
  if(players.length!==CURRENT_ROSTER.length)return false;
  const names=new Set(players.map(p=>text(p?.name)).filter(Boolean));
  if(names.size!==CURRENT_ROSTER.length||CURRENT_ROSTER.some(name=>!names.has(name)))return false;
  const counts=new Map();
  const walk=(value,prefix='')=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return;
    for(const [key,v] of Object.entries(value)){
      if(key==='name'||key==='positions')continue;
      const path=prefix?`${prefix}.${key}`:key;
      if(numberValue(v)!==null)counts.set(path,(counts.get(path)||0)+1);
      else if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,path);
    }
  };
  players.forEach(player=>walk(player));
  return [...counts.values()].some(count=>count>=2);
}

function outputText(result){
  return [
    result?.candidateBasis,
    ...(Array.isArray(result?.facts)?result.facts:[]),
    ...(Array.isArray(result?.analysis)?result.analysis:[]),
    ...(Array.isArray(result?.prediction)?result.prediction:[]),
    result?.primaryReason,
    result?.publicStatement,
    ...(Array.isArray(result?.warnings)?result.warnings:[]),
    result?.reviewReason,
    result?.changeReason
  ].map(text).filter(Boolean).join('。');
}
function assertiveOutputText(result){
  return [
    result?.candidateBasis,
    ...(Array.isArray(result?.facts)?result.facts:[]),
    ...(Array.isArray(result?.analysis)?result.analysis:[]),
    result?.primaryReason,
    result?.publicStatement,
    ...(Array.isArray(result?.warnings)?result.warnings:[]),
    result?.reviewReason,
    result?.changeReason
  ].map(text).filter(Boolean).join('。');
}
function predictionOutputText(result){
  return (Array.isArray(result?.prediction)?result.prediction:[]).map(text).filter(Boolean).join('。');
}

function validatePattern({all,metric,label,re,metrics,issues}){
  const expected=metrics[metric]||[];
  const rx=new RegExp(re.source,re.flags.includes('g')?re.flags:`${re.flags}g`);
  let m;
  while((m=rx.exec(all))){
    const n=numberValue(m[1]);
    if(n===null)continue;
    if(!expected.length){issues.push(`${label}${m[1]} は supplied CASE/EVIDENCE に存在しない`);continue;}
    if(!expected.some(x=>sameNumber(x,n))){issues.push(`${label}${m[1]} は supplied CASE/EVIDENCE の ${label} 値と一致しない`);}
  }
}

function validateAmbiguousInningLanguage(parts,metrics,issues){
  const innings=metrics.IP||[];
  const appearances=metrics.APP||[];
  if(!innings.length)return;
  for(const sentence of parts){
    if(/投球回|イニング/.test(sentence))continue;
    // A bare "N回" can also be an appearance/count in a non-pitching domain.
    // Do not reinterpret an explicitly batting-order sentence (e.g. "3番起用が1回")
    // as innings merely because the same numeric value exists in IP evidence.
    if(/(?:[1-9]番(?:打者|起用|で|を|に|経験)|打順|打者|打席|打撃|打率|OPS|出塁率|長打率)/.test(sentence))continue;
    const candidates=[];
    const explicitBare=sentence.match(/(?:サンプル|現チーム).{0,24}?([0-9]+(?:\.[0-9]+)?)\s*回/);
    if(explicitBare&&!explicitBare[1].includes('.'))candidates.push({value:explicitBare[1],label:`${explicitBare[1]}回`});
    const unlabeledNearJudgment=sentence.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:と|で|しか|のみ)(?:少な|小さ)/);
    if(unlabeledNearJudgment)candidates.push({value:unlabeledNearJudgment[1],label:unlabeledNearJudgment[1]});
    for(const candidate of candidates){
      const n=numberValue(candidate.value);
      if(n===null)continue;
      if(innings.some(x=>sameNumber(x,n))&&!appearances.some(x=>sameNumber(x,n))){
        issues.push(`投球回${candidate.value} を単位不明の「${candidate.label}」と表現している`);
      }
    }
  }
}

export function hasUnhedgedOutcomePrediction(sentence){
  const s=String(sentence||'');
  const outcome=/(?:勝利|勝率|勝ち|成功|成長|定着|戦力|チーム力|コンディション|パフォーマンス|故障|低下|改善|回復|安定|好機|機会|攻撃力|得点力)/.test(s);
  const directFuture=/(?:半年後|来年|将来|今後).{0,48}(?:響く|響き|影響が出|影響を与え|損な|低下|悪化|安定|広が|定着|高ま|高め|向上|強く|育つ|育て)/.test(s);
  if(!outcome&&!directFuture)return false;
  const hedge=/(?:可能性|かもしれ|おそれ|恐れ|リスク|見込み|予想|考えられ|だろう|でしょう|し得る|あり得る)/.test(s);
  const hard=/(?:絶対|必ず|確実に)/.test(s);
  if(hard)return true;
  const causalGuarantee=/(?:ことで|すれば|なら|場合|なければ|れば|と|ば|たら|ため).{0,80}(?:成長する|成長し|定着する|勝てる|勝利できる|維持できる|改善する|回復する|作れる|築ける|安定する|広がる|失う|損なう|響く|響き|影響が出る|影響を与える|抑えられる|守れる|つながる|狂う|崩れる|悪化する|高まる|高める|向上する|強くなる|育つ|育てる|育てていく|できます|できる)/.test(s);
  return (causalGuarantee||directFuture)&&!hedge;
}

export function isHardOutcomeGuarantee(sentence){
  const s=String(sentence||'');
  return /(?:絶対|必ず|確実に).{0,40}(?:勝|成功|抑え|防げ|改善|成長|維持|回避|無事|拾|安定|定着|戦力|悪化|低下|故障|損な)/.test(s);
}

export function validatePersonaOutput(caseData,result,{focused=false}={}){
  const issues=[];
  const all=outputText(result);
  const parts=sentenceParts(all);
  const assertive=assertiveOutputText(result);
  const assertiveParts=sentenceParts(assertive);
  const prediction=predictionOutputText(result);
  const predictionParts=sentenceParts(prediction);
  const caseText=JSON.stringify(caseData||{});
  const evidenceText=JSON.stringify(caseData?.evidence||{});
  const metrics=collectMetrics(caseData||{});

  if(/四死球/.test(all) && !/四死球/.test(caseText)){
    issues.push('四死球という合算値は supplied CASE/EVIDENCE に存在しない');
  }

  const patterns=[
    {metric:'APP',label:'登板数',re:/登板(?:数)?(?:は|が|：|:|=|\s|まだ){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'APP',label:'登板数',re:/([0-9]+(?:\.[0-9]+)?)\s*試合(?:に)?登板/g},
    {metric:'IP',label:'投球回',re:/投球回(?:数)?(?:は|が|：|:|=|\s|まだ){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'IP',label:'投球回',re:/([0-9]+(?:\.[0-9]+)?)\s*イニング/g},
    {metric:'SO',label:'奪三振',re:/奪三振(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'BB',label:'与四球',re:/与四球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'BB',label:'与四球',re:/四球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'HBP',label:'与死球',re:/与死球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'ERA',label:'防御率',re:/防御率(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'WHIP',label:'WHIP',re:/WHIP(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/gi},
    {metric:'SV',label:'セーブ',re:/セーブ(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g}
  ];
  for(const p of patterns)validatePattern({all,...p,metrics,issues});
  validateAmbiguousInningLanguage(parts,metrics,issues);

  const hasComparisonBaseline=/(?:比較|平均|基準|順位|上位|下位|チーム内|リーグ|相手別|平均との差|多い|少ない|高い|低い|良い|悪い)/.test(evidenceText) || hasStructuredPeerComparison(caseData);
  if(!hasComparisonBaseline){
    const unsupportedQuality=[
      /(?:与四球|四球)(?:数)?(?:の|が|は)?(?:少な|多い|多く|少なく)/,
      /奪三振(?:数)?(?:の|が|は)?(?:多い|少ない|高い|低い)/,
      /(?:奪三振|三振|与四球|四球).{0,24}(?:割合|比率|率).{0,12}(?:良い|悪い|悪くない|良くない|高い|低い)/,
      /(?:奪三振|三振).{0,14}(?:取れる力|奪える力|奪三振力|三振力)/,
      /防御率(?:の|が|は)?(?:低い|高い|良い|悪い|優秀)/,
      /(?:打率|OPS|出塁率|長打率)(?:の|が|は)?(?:高い|低い|良い|悪い|優秀)/i,
      /(?:圧倒的|抜群|非常に優秀|極めて優秀)(?:な|の)?(?:投球|成績|数字|実績|防御率|奪三振|制球)?/
    ];
    const unsupportedSentence=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&unsupportedQuality.some(re=>re.test(sentence)));
    if(unsupportedSentence)issues.push('比較基準のない統計値を定性的な強弱・優劣へ変換している');
  }

  const hasSluggingEvidence=/(?:"SLG"|"slugging"|長打率|二塁打|三塁打|本塁打|ホームラン)/i.test(evidenceText);
  if(!hasSluggingEvidence){
    const unsupportedLabel=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&/長打率/.test(sentence));
    if(unsupportedLabel)issues.push('Evidenceにない長打率を、存在する指標として述べている');
    const unsupported=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&/(?:長打力|長打能力|長打性能)/.test(sentence));
    if(unsupported)issues.push('OPS等の合成指標だけから長打力を単独で推定している');
  }
  const hasOnBaseEvidence=/(?:"OBP"|"onBase"|出塁率)/i.test(evidenceText);
  if(!hasOnBaseEvidence){
    const unsupportedLabel=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&/出塁率/.test(sentence));
    if(unsupportedLabel)issues.push('Evidenceにない出塁率を、存在する指標として述べている');
    const unsupported=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&/(?:出塁力|出塁能力)/.test(sentence));
    if(unsupported)issues.push('OPSや打率だけから出塁能力を単独で推定している');
  }

  const hasHistoricalCloserEvidence=/(?:セーブ|クローザー|抑え|守護神|終盤|締め(?:た|る|くく)|プレッシャー|勝負どころ|重要な場面|高レバレッジ)/.test(evidenceText);
  if(!hasHistoricalCloserEvidence && /クローザー|抑え/.test(String(caseData?.question||''))){
    const unsupportedRole=[
      /旧チーム(?:同様|でも|で).{0,40}(?:締め|クローザー|抑え|守護神|セーブ)/,
      /旧チーム.{0,40}(?:プレッシャー|勝負どころ|重要な場面|高レバレッジ).{0,24}(?:経験|実績|対応|強い|慣れ)/,
      /(?:54(?:\.0)?回|投球回).{0,40}(?:プレッシャー|勝負どころ|重要な場面|終盤).{0,24}(?:経験|実績|対応|強い|慣れ)/,
      /(?:不慣れ|慣れていない|経験不足).{0,20}(?:緊迫|プレッシャー|終盤|勝負どころ|重要な場面)/,
      /(?:緊迫|プレッシャー|終盤|勝負どころ|重要な場面).{0,20}(?:不慣れ|慣れていない|経験不足)/
    ];
    const unsupportedSentence=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&unsupportedRole.some(re=>re.test(sentence)));
    if(unsupportedSentence)issues.push('旧チームのクローザー・終盤・高圧場面の実績がEvidenceにないのに、その役割経験を前提にしている');
  }

  const reviewKind=String(caseData?.evidence?.reviewKind||caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  if(reviewKind==='TEAM_REVIEW'){
    const dependencyLike=/(?:依存|頼っている|頼る|頼り切|頼り(?:っ|つ)?きり|上位偏重|主力偏重|特定選手偏重)/;
    const dependencyHedge=/(?:可能性|見方|考えられ|とみられ|傾向|断定(?:しない|しません|できない|できません)|断定でき|確認できない|Evidenceにない|根拠がない)/;
    const unsupportedDependency=assertiveParts.find(sentence=>
      dependencyLike.test(sentence)
      && !isEvidenceGapStatement(sentence)
      && !dependencyHedge.test(sentence)
    );
    if(unsupportedDependency)issues.push('TEAM_REVIEWで打撃成績の偏りから依存・頼り・偏重を断定している');

    const hasBurdenConcentrationEvidence=/(?:負担.{0,12}(?:集中|偏)|(?:一部|特定).{0,24}負担.{0,12}(?:集中|偏))/.test(evidenceText);
    if(!hasBurdenConcentrationEvidence){
      const burdenNonAssertion=/(?:断定(?:しない|しません|できない|できません)|確認できない|Evidenceにない|根拠がない)/;
      const unsupportedBurdenConcentration=parts.find(sentence=>
        !isEvidenceGapStatement(sentence)
        && /(?:負担.{0,12}(?:集中|偏)|経験や負担.{0,12}(?:集中|偏)|(?:一部|特定).{0,24}負担.{0,12}(?:集中|偏))/.test(sentence)
        && !burdenNonAssertion.test(sentence)
      );
      if(unsupportedBurdenConcentration)issues.push('TEAM_REVIEWで起用差から負担集中を断定している');
    }

    const hasNonAppearanceEvidence=/(?:出場していない|試合に出ていない|出場0|出場なし|出場機会なし)/.test(evidenceText);
    if(!hasNonAppearanceEvidence){
      const unsupportedNonAppearance=parts.find(sentence=>
        !isEvidenceGapStatement(sentence)
        && /(?:試合に出ていない|試合に出場していない|出場していない)選手/.test(sentence)
      );
      if(unsupportedNonAppearance)issues.push('TEAM_REVIEWでEvidenceにない未出場選手を前提にしている');
    }

    // A measured spread is a fact about the supplied sample. It is not, by itself,
    // proof of a team-wide weakness, scoring dependency, tactical failure or
    // development impact. Keep those inference boundaries visible in PRIMARY and
    // SECOND too, not only in the synthesized FINAL.
    const spreadLike=/(?:数値(?:差|の開き|の偏り)|打撃成績.{0,24}(?:差|偏り|開き)|成績.{0,24}(?:差|偏り|開き)|打線.{0,10}偏り|(?:差|開き)が(?:大きい|激しい)|上位.{0,20}下位|下位.{0,20}上位|高い数字.{0,36}低い|当たっている選手.{0,30}当たっていない選手|(?:打撃|起用).{0,18}(?:バランス|機会).{0,18}(?:偏り|偏って))/;
    const spreadOverclaim=/(?:弱点|戦術(?:上)?(?:の)?(?:課題)?|育成(?:上)?の課題|得点源|得点力|打線.{0,12}(?:つながり|厚み)|勝負.{0,12}分かれ道|直結|チーム力)/;
    const groundingHedge=/(?:断定(?:しない|しません|できない|できません)|とは言えない|追加(?:の)?Evidence|追加情報|確認できない|根拠がない|課題候補|可能性|おそれ|考えられ)/;
    const unsupportedSpreadOverclaim=parts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && spreadLike.test(sentence)
      && spreadOverclaim.test(sentence)
      && !groundingHedge.test(sentence)
    );
    if(unsupportedSpreadOverclaim)issues.push('TEAM_REVIEWで数値差・偏りをチーム全体の弱点・戦術・育成影響へ拡張している');

    // Individual batting outcomes may be reported directly, but they do not prove
    // a team scoring route, game result or tactical consequence without explicit
    // team-level outcome evidence.
    const individualBattingCue=/(?:無安打|安打0|打率\s*\.?0(?:00)?|低打率|打てていない|当たっていない)/;
    const teamOutcomeCue=/(?:得点源|得点力|得点ルート|打線.{0,12}(?:つながり|厚み)|勝負.{0,12}分かれ道|勝ち|勝利|戦術(?:上)?(?:の)?課題|直結)/;
    const unsupportedBattingCausality=parts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && individualBattingCue.test(sentence)
      && teamOutcomeCue.test(sentence)
      && !groundingHedge.test(sentence)
    );
    if(unsupportedBattingCausality)issues.push('TEAM_REVIEWで個別打撃結果からチーム得点・戦術への因果を断定している');

    // Current-state TEAM_REVIEW warnings must describe evidence limits or observed
    // facts. Generic future/development coaching advice is not evidence.
    const unsupportedDevelopmentAdvice=parts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && /(?:半年後|1年後|将来|チーム全体で.{0,18}成長|成長していく道筋|育成上の課題|選手層の育成を疎か|目先の勝敗|短期的な結果)/.test(sentence)
      && !groundingHedge.test(sentence)
    );
    if(unsupportedDevelopmentAdvice)issues.push('TEAM_REVIEWでEvidenceにない将来・育成・一般論を現在の弱点評価へ追加している');
  }

  const selectionKind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  const isPitchingRole=selectionKind==='PITCHING_ROLE';
  const isBattingOrder=selectionKind==='BATTING_ORDER';
  const isSelectionLike=Boolean(selectionKind&&selectionKind!=='NONE'&&selectionKind!=='TEAM_REVIEW')||String(caseData?.mode||'').toLowerCase()==='selection';
  const persona=String(result?.persona||'').toUpperCase();

  if(isPitchingRole){
    const unsupportedPitchingStability=assertiveParts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && (
        /(?:防御率|WHIP|登板|投球回|イニング).{0,45}(?:安定(?:した|して|感)|信頼でき|信頼性|任せられ)/.test(sentence)
        || /(?:安定(?:した|して|感)|信頼でき|信頼性|任せられ).{0,45}(?:防御率|WHIP|登板|投球回|イニング)/.test(sentence)
        || /(?:長い|多くの?)イニング.{0,18}(?:任せ|投げら|投げ切)/.test(sentence)
      )
    );
    if(unsupportedPitchingStability)issues.push('PITCHING_ROLEで投手数値から安定・信頼・長いイニング適性を断定している');

    const hasPressureEvidence=/(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面|高レバレッジ)/.test(evidenceText);
    if(!hasPressureEvidence){
      const unsupportedSavePressure=assertiveParts.find(sentence=>
        !isEvidenceGapStatement(sentence)
        && /(?:セーブ|締める実績|終盤).{0,42}(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面)|(?:競った場面|高圧場面|プレッシャー|勝負どころ|重要な場面).{0,42}(?:セーブ|締める実績|終盤)/.test(sentence)
      );
      if(unsupportedSavePressure)issues.push('PITCHING_ROLEでセーブ実績から高圧・競った場面の経験を推定している');
    }

    const unsupportedProbability=assertiveParts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && /(?:確率的優位|勝利の確率|勝率を高め|勝てる確率|成功確率|勝利確率)/.test(sentence)
    );
    if(unsupportedProbability)issues.push('PITCHING_ROLEでEvidenceにない勝利・成功確率を主張している');
  }

  if(isBattingOrder){
    const unsupportedSlotTactics=assertiveParts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && (
        /(?:3番|打順|起用|打率|AVG|OPS).{0,70}(?:戦術的に最も安定|戦術.{0,18}(?:裏付け|安定)|最も確実な選択肢|定着度が高い|ポジション適性.{0,18}(?:豊富|高い))/.test(sentence)
        || /(?:戦術的に最も安定|戦術.{0,18}(?:裏付け|安定)|最も確実な選択肢|定着度が高い|ポジション適性.{0,18}(?:豊富|高い)).{0,70}(?:3番|打順|起用|打率|AVG|OPS)/.test(sentence)
      )
    );
    if(unsupportedSlotTactics)issues.push('BATTING_ORDERで実打順・打撃数値から戦術的安定性を断定している');
  }

  if(isSelectionLike&&persona.startsWith('CASPER')){
    const developmentRequested=/(?:半年後|来年|将来|育成|成長|経験を積ませ|選手層|投手層)/.test(String(caseData?.question||''));
    const unsupportedDevelopment=assertiveParts.find(sentence=>
      !isEvidenceGapStatement(sentence)
      && /(?:成長機会|育成|チームの成長|チーム全体で.{0,20}経験|経験を積んでいく|負担をかけすぎ|役割集中.{0,28}(?:成長|育成|影響)|半年後|将来(?:的)?な.{0,18}(?:チーム|投手層|選手層)|投手層.{0,18}(?:厚み|広げ)|選手層.{0,18}(?:厚み|広げ)|他の投手.{0,24}成長|成長も促|選手の成長.{0,18}(?:見守|考慮))/.test(sentence)
      && !developmentRequested
    );
    if(unsupportedDevelopment)issues.push('SELECTIONでEvidenceにない成長・育成・負担影響を追加している');

    const hasDependencyEvidence=/(?:依存|頼り|負担集中|役割集中)/.test(evidenceText);
    if(!hasDependencyEvidence){
      const unsupportedDependency=parts.find(sentence=>
        !isEvidenceGapStatement(sentence)
        && /(?:過度な)?依存|頼りすぎ|頼り切/.test(sentence)
      );
      if(unsupportedDependency)issues.push('SELECTIONでEvidenceにない依存・役割集中を追加している');
    }
  }

  const hasStrongBurdenEvidence=/(?:負担.{0,8}(?:大きい|大きすぎる|重い|過大|過度)|蓄積疲労|疲労蓄積|疲労.{0,8}蓄積|負担.{0,8}蓄積|コンディション.{0,12}影響|成長.{0,12}影響)/.test(evidenceText);
  if(!hasStrongBurdenEvidence){
    const unsupportedBurden=[
      /負担(?:が|は|も)?(?:大きい|大きすぎる|重い|過大|過度)/,
      /蓄積疲労|疲労蓄積|疲労(?:や|と|・)?負担.{0,8}蓄積|(?:疲労|負担).{0,8}(?:蓄積|積み重な)/,
      /(?:兼任|負担).{0,24}(?:コンディション|成長|パフォーマンス).{0,16}(?:影響が出|影響を与え|低下し|壊し|損な)/,
      /(?:コンディション|成長|パフォーマンス).{0,24}(?:兼任|負担).{0,16}(?:影響が出|影響を与え|低下し|壊し|損な)/,
      /(?:兼任|負担|固定).{0,48}(?:半年後|来年|将来|今後).{0,24}(?:響く|響き|影響が出|影響を与え|損な|低下|悪化)/
    ];
    const unsupportedSentence=assertiveParts.find(sentence=>!isEvidenceGapStatement(sentence)&&unsupportedBurden.some(re=>re.test(sentence)));
    if(unsupportedSentence)issues.push('Evidenceの「負担を考慮する必要がある」を、負担の大きさや具体的悪影響の断定へ強めている');
  }

  if(parts.some(isHardOutcomeGuarantee)){
    issues.push('Evidenceから保証できない結果を断定している');
  }
  if(assertiveParts.some(hasUnhedgedOutcomePrediction)){
    issues.push('分析・回答で将来結果を不確実性の表現なしに確定結果として述べている');
  }
  if(predictionParts.some(hasUnhedgedOutcomePrediction)){
    issues.push('将来予測を不確実性の表現なしに確定結果として述べている');
  }

  if(focused){
    for(const player of CURRENT_ROSTER){
      if(caseText.includes(player))continue;
      if(all.includes(player))issues.push(`CASE外の選手 ${player} を focused proposal に持ち込んでいる`);
    }
  }

  issues.push(...validatePitchingPlanPersonaOutput(caseData,result));
  return [...new Set(issues)];
}