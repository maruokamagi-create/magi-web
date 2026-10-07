import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { ORCHESTRATOR } from './_prompts.js';
import { failClosedCross, validateCrossOutput } from './_cross-output-guard.js';
import { canonicalizePlayerData, playerKey } from './_roster.js';
import { buildConsensusLineup, isFullLineupQuestion } from './_full-lineup.js';
import { assignEvidenceGroundedFielding } from './_lineup-fielding.js';
import { buildConsensusPitchingPlan, isPitchingPlanQuestion } from './_pitching-plan.js';

const crossSchema = {
  type: 'OBJECT',
  properties: {
    agreement: { type: 'ARRAY', items: { type: 'STRING' } },
    disagreement: { type: 'ARRAY', items: { type: 'STRING' } },
    domainConflicts: { type: 'ARRAY', items: { type: 'STRING' } },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    informationGaps: { type: 'ARRAY', items: { type: 'STRING' } },
    challenges: {
      type: 'OBJECT',
      properties: {
        melchior: { type: 'ARRAY', items: { type: 'STRING' } },
        balthasar: { type: 'ARRAY', items: { type: 'STRING' } },
        casper: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['melchior','balthasar','casper']
    }
  },
  required: ['agreement','disagreement','domainConflicts','warnings','informationGaps','challenges']
};

const VALID = new Set(['GREEN','BLUE','YELLOW','RED']);
const CONFIDENCE_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2 };

function validCase(body) {
  const q = String(body?.case?.question || '').trim();
  return q.length >= 2 && q.length <= 12000;
}

export function isSelectionCase(caseData) {
  const semanticKind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  if(semanticKind==='TEAM_REVIEW'||String(caseData?.evidence?.reviewKind||'').toUpperCase()==='TEAM_REVIEW') return false;
  if(['FULL_LINEUP','PITCHING_PLAN','GENERIC_SELECTION','PITCHING_ROLE'].includes(semanticKind)) return true;
  if (String(caseData?.mode || '').toLowerCase() === 'selection') return true;
  if (isFullLineupQuestion(caseData) || isPitchingPlanQuestion(caseData)) return true;
  // Legacy fallback only when no semantic selection classification reached the orchestrator.
  const q = String(caseData?.question || '');
  const battingSlot = /(?:[1-9１-９一二三四五六七八九](?:番|ばん)(?:打者)?)/;
  const domain = /クリーンナップ|中軸|主軸|打線|打順|オーダー|紅白戦|スタメン|レギュラー|先発|起用|守備位置|ポジション|クローザー|抑え|捕手|投手|一塁|二塁|三塁|遊撃|左翼|中堅|右翼|レフト|センター|ライト/;
  const cue = /誰|だれ|どの|どれ|どちら|どう組|どうする|組んで|組む|組み合わせ|候補|選ぶ|選定|何番|一番いい|最適|ベスト|考えて|決めて/;
  return !semanticKind && (domain.test(q) || battingSlot.test(q)) && cue.test(q);
}

function jstContext() {
  const formatted = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
  return {
    timeZone: 'Asia/Tokyo',
    currentDateTime: formatted,
    instruction: '相対時刻・季節表現はこの日本時間を基準にする。現在が夏なら半年後は冬であり、次の夏は約1年後として扱う。'
  };
}

function normalizeSecond(second) {
  const list = Array.isArray(second) ? second : Object.values(second || {});
  return list.filter(Boolean).slice(0,3);
}

export function deterministicFinal(second) {
  const list = normalizeSecond(second);
  if (list.length !== 3) return { status: null, vote: '' };
  const judgments = list.map(x => String(x?.judgment || '').toUpperCase());
  if (!judgments.every(x => VALID.has(x))) return { status: null, vote: '' };

  const critical = list.find(x => x?.reviewRequested === true && String(x?.reviewReason || '').trim());
  const dataConflict = list.find(x => String(x?.persona || '').toUpperCase().startsWith('MELCHIOR') && x?.dataConflict === true);
  if (critical || dataConflict) {
    return {
      status: 'MAGI_REVIEW_REQUIRED',
      vote: judgments.join('-'),
      reviewReason: String(critical?.reviewReason || 'MELCHIOR detected an unresolved DATA CONFLICT.')
    };
  }

  if (judgments.every(x => x === 'YELLOW')) return { status: 'INSUFFICIENT_EVIDENCE', vote: 'YELLOW-YELLOW-YELLOW' };
  if (judgments.every(x => x === judgments[0])) return { status: 'MAGI_CONSENSUS', vote: '3-0' };

  const counts = judgments.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
  if (Object.values(counts).some(n => n === 2)) return { status: 'MAGI_MAJORITY', vote: '2-1' };
  return { status: 'MAGI_DEADLOCK', vote: '1-1-1' };
}

function compactUnique(values, limit = 6) {
  const out = [];
  for (const value of values || []) {
    const text = String(value || '').trim();
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function lowestConfidence(list) {
  const values = list.map(x => String(x?.confidence || 'LOW').toUpperCase());
  return values.sort((a,b)=>(CONFIDENCE_ORDER[a] ?? 0) - (CONFIDENCE_ORDER[b] ?? 0))[0] || 'LOW';
}

function crossDiscussion(cross){
  const c=canonicalizePlayerData(cross||{});
  return {
    agreement:Array.isArray(c?.agreement)?c.agreement:[],
    disagreement:Array.isArray(c?.disagreement)?c.disagreement:[],
    domainConflicts:Array.isArray(c?.domainConflicts)?c.domainConflicts:[],
    challenges:c?.challenges||{melchior:[],balthasar:[],casper:[]},
    informationGaps:Array.isArray(c?.informationGaps)?c.informationGaps:[]
  };
}

export function deterministicFullLineupCross(primary) {
  const specs = [
    ['melchior','メルキオール'],
    ['balthasar','バルタザール'],
    ['casper','カスパー']
  ];
  const rows = specs.map(([key,jp]) => {
    const value = primary?.[key] || {};
    const order = Array.isArray(value?.candidatePlayers) ? value.candidatePlayers.map(x=>String(x||'').trim()).filter(Boolean) : [];
    return { key, jp, order };
  });
  if (rows.some(row => row.order.length !== 9 || new Set(row.order.map(playerKey)).size !== 9)) return null;

  const agreement = [];
  const disagreement = [];
  const differentSlots = [];
  for (let i=0;i<9;i++) {
    const values = rows.map(row=>row.order[i]);
    const unique = [...new Set(values.map(playerKey))];
    if (unique.length === 1) agreement.push(`${i+1}番は3賢人とも${values[0]}で一致しています。`);
    else {
      differentSlots.push(i);
      disagreement.push(`${i+1}番は${rows.map(row=>`${row.jp}：${row.order[i]}`).join('／')}で意見が分かれています。`);
    }
  }

  const challenges = { melchior:[], balthasar:[], casper:[] };
  rows.forEach((row,rowIndex)=>{
    const slot = differentSlots.find(i=>rows.some((other,j)=>j!==rowIndex && playerKey(other.order[i])!==playerKey(row.order[i]))) ?? 3;
    const own = row.order[slot];
    const other = rows.find((candidate,j)=>j!==rowIndex && playerKey(candidate.order[slot])!==playerKey(own));
    if (other) {
      challenges[row.key].push(`${row.jp}、あなたは${slot+1}番に${own}を置いています。${other.jp}の${other.order[slot]}案と比べ、確認できた記録と打線のつながりから、この配置を維持するか見直すか説明してください。`);
    } else {
      challenges[row.key].push(`${row.jp}、3賢人とも${slot+1}番に${own}を置いています。一致しているからこそ、この配置の弱点と、どんな記録の変化なら見直すか確認してください。`);
    }
  });

  return {
    agreement: agreement.slice(0,4),
    disagreement: disagreement.slice(0,4),
    domainConflicts: [],
    warnings: [],
    informationGaps: [],
    challenges
  };
}

export function deterministicTeamReviewCross(primary) {
  const specs = [
    ['melchior','メルキオール'],
    ['balthasar','バルタザール'],
    ['casper','カスパー']
  ];
  const rows = specs.map(([key,jp]) => ({key,jp,value:primary?.[key]||null}));
  if (rows.some(row => !row.value || typeof row.value !== 'object')) return null;

  return {
    agreement:['3賢人とも、現チームの確認済み記録と観察事実を基準に現在の課題候補を再検証します。'],
    disagreement:['何を現時点の課題候補として重く見るかは、3賢人それぞれの視点で再検証します。'],
    domainConflicts:['数値記録、試合運用、起用・観察記録の3つの視点を分けて確認します。'],
    warnings:[],
    informationGaps:[],
    challenges:{
      melchior:['バルタザールからメルキオールへ：記録上の数値差について、どこまでが直接確認できる事実かを再整理し、数値差だけでは確認できないことも明示してください。'],
      balthasar:['カスパーからバルタザールへ：打撃成績の差について、試合運用に関して記録から直接確認できる事実と、まだ確認できない因果を分けてください。'],
      casper:['メルキオールからカスパーへ：出場機会や打数の差について、確認済みの起用記録・観察事実と、それだけでは確認できない解釈を分けてください。']
    }
  };
}

export function deterministicSelectionCross(primary) {
  const specs = [['melchior','メルキオール'],['balthasar','バルタザール'],['casper','カスパー']];
  const rows = specs.map(([key,jp]) => {
    const value = primary?.[key] || {};
    const candidates = Array.isArray(value?.candidatePlayers) ? value.candidatePlayers.map(x=>String(x||'').trim()).filter(Boolean) : [];
    return { key, jp, candidates };
  });
  if (rows.some(row => row.candidates.length < 1)) return null;
  const top = rows.map(row=>row.candidates[0]);
  const agreement = [];
  const disagreement = [];
  if (new Set(top.map(playerKey)).size === 1) agreement.push(`3賢人とも第1候補は${top[0]}で一致しています。`);
  else disagreement.push(`第1候補は${rows.map(row=>`${row.jp}：${row.candidates[0]}`).join('／')}で意見が分かれています。`);
  const challenges = { melchior:[], balthasar:[], casper:[] };
  rows.forEach((row,rowIndex)=>{
    // Cross-examination must always be another Wise Man challenging this persona.
    // When all three top choices agree, rotate the challenger instead of rendering self -> self.
    const challenger = rows[(rowIndex+1)%rows.length];
    const alternative = rows.find((candidate,j)=>j!==rowIndex && playerKey(candidate.candidates[0])!==playerKey(row.candidates[0]));
    if(alternative){
      challenges[row.key].push(`${alternative.jp}から${row.jp}へ：あなたの第1候補${row.candidates[0]}と、私の第1候補${alternative.candidates[0]}を比較してください。確認できた記録だけを使い、クローザー等の質問で指定された役割への適合理由と弱点を説明し、この候補を維持するか見直してください。`);
    }else{
      challenges[row.key].push(`${challenger.jp}から${row.jp}へ：第1候補${row.candidates[0]}は3賢人で一致しています。一致しているからこそ、確認できた記録だけを使い、この選手を質問で指定された役割に置く弱点と、どんな記録なら見直すか説明してください。`);
    }
  });
  return { agreement, disagreement, domainConflicts:[], warnings:[], informationGaps:[], challenges };
}

export function buildFullLineupResult(second, cross, caseData={}) {
  const normalizedSecond = canonicalizePlayerData(second);
  const normalizedCross = canonicalizePlayerData(cross || {});
  const entries = Array.isArray(normalizedSecond) ? normalizedSecond.map((v,i)=>[String(i),v]) : Object.entries(normalizedSecond || {});
  if (entries.length !== 3) return null;

  const crossReviewReason = normalizedCross?.reviewRequired === true ? String(normalizedCross?.reviewReason || 'クロス審議の再確認が必要です。') : '';
  const critical = entries.find(([,x]) => x?.reviewRequested === true && String(x?.reviewReason || '').trim());
  const dataConflict = entries.find(([,x]) => String(x?.persona || '').toUpperCase().startsWith('MELCHIOR') && x?.dataConflict === true);
  const warnings = compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]);
  const informationGaps = compactUnique(normalizedCross?.informationGaps || []);

  if (critical || dataConflict || crossReviewReason) {
    return canonicalizePlayerData({
      mode:'FULL_LINEUP',status:'LINEUP_REVIEW_REQUIRED',recommendation:'1〜9番を確定せず、未解決の確認事項を解消して再審議する。',
      lineup:[],personaLineups:Object.fromEntries(entries.map(([k,v])=>[k,Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),slotConflicts:[],playerSupport:[],
      confidence:'LOW',majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),warnings,
      reDeliberationConditions:compactUnique([...informationGaps,...warnings],5),reviewReason:crossReviewReason||String(critical?.[1]?.reviewReason||'MELCHIOR detected an unresolved DATA CONFLICT.'),
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  const consensus=buildConsensusLineup(normalizedSecond);
  if(!consensus){
    return canonicalizePlayerData({
      mode:'FULL_LINEUP',status:'LINEUP_REVIEW_REQUIRED',recommendation:'3賢人の二次案に9人の打順として不完全な案があるため、打順を確定しない。',
      lineup:[],personaLineups:Object.fromEntries(entries.map(([k,v])=>[k,Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),slotConflicts:[],playerSupport:[],
      confidence:'LOW',majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),warnings,
      reDeliberationConditions:compactUnique(['各賢人が現チームの異なる9選手を1番〜9番の順で再提示する',...informationGaps,...warnings],5),reviewReason:'二次打順案の構造が不完全',
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  if(consensus.decisionStatus==='DEADLOCK'){
    return canonicalizePlayerData({
      mode:'FULL_LINEUP',
      status:'LINEUP_REVIEW_REQUIRED',
      recommendation:'3賢人の二次打順案が1対1対1で一致していないため、最終オーダーを勝手に確定しない。',
      lineup:[],
      battingOrder:[],
      fieldingStatus:'NOT_EVALUATED',
      fieldingReason:'LINEUP_DEADLOCK',
      personaLineups:consensus.personaLineups,
      slotConflicts:consensus.slotConflicts,
      playerSupport:consensus.playerSupport,
      proposalGroups:consensus.proposalGroups,
      deliberationDecision:consensus.decisionStatus,
      finalVote:consensus.finalVote,
      selectedFromPersona:'',
      minorityPersonas:[],
      confidence:'LOW',
      majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),
      warnings:compactUnique([...warnings,'3賢人の二次打順案が1対1対1。合意度スコアで1案を恣意的に選ばずDEADLOCKとする。']),
      reDeliberationConditions:compactUnique(['3賢人のうち少なくとも2賢人が同一の1〜9番案に到達するまで再審議する',...informationGaps,...warnings],5),
      reviewReason:'FULL_LINEUP_DEADLOCK_1_1_1',
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

    const fielding=assignEvidenceGroundedFielding(consensus.lineup,caseData?.evidence?.appearanceFielding);
  if(fielding.status!=='COMPLETE'){
    const fieldingReason=fielding.status==='AMBIGUOUS'
      ? '実績Evidence上で同順位の守備配置が複数残るため、推測で守備位置を確定しない。'
      : fielding.status==='UNAVAILABLE'
        ? '出場詳細・守備詳細Evidenceが完全な状態ではないため、守備位置を推測で確定しない。'
        : '選出9人だけでは、公式戦または練習第1試合の先発Evidenceから9守備位置を一意に成立させられない。途中守備や練習第2試合だけでは標準先発守備を補わない。';
    return canonicalizePlayerData({
      mode:'FULL_LINEUP',status:'LINEUP_REVIEW_REQUIRED',
      recommendation:'打順案は得られたが、守備位置を実績Evidenceだけで確定できないため最終オーダーは未確定。',
      lineup:[],
      battingOrder:consensus.lineup,
      fieldingStatus:fielding.status,
      fieldingReason:fielding.reason||'FIELDING_UNRESOLVED',
      fieldingDetails:fielding,
      personaLineups:consensus.personaLineups,
      slotConflicts:consensus.slotConflicts,
      playerSupport:consensus.playerSupport,
      proposalGroups:consensus.proposalGroups,
      deliberationDecision:consensus.decisionStatus,
      finalVote:consensus.finalVote,
      selectedFromPersona:consensus.selectedFromPersona,
      minorityPersonas:consensus.minorityPersonas,
      confidence:'LOW',
      majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),
      warnings:compactUnique([...warnings,fieldingReason]),
      reDeliberationConditions:compactUnique([fieldingReason,...informationGaps,...warnings],5),
      reviewReason:fieldingReason,
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  const recommendation=fielding.lineup.map(x=>`${x.slot}番 ${x.name}（${x.positionLabel||x.position}）`).join(' / ');
  return canonicalizePlayerData({
    mode:'FULL_LINEUP',status:'LINEUP_RESULT',recommendation,
    lineup:fielding.lineup,
    fieldingStatus:fielding.status,
    fieldingRule:fielding.rule,
    personaLineups:consensus.personaLineups,
    slotConflicts:consensus.slotConflicts,
    playerSupport:consensus.playerSupport,
    proposalGroups:consensus.proposalGroups,
    deliberationDecision:consensus.decisionStatus,
    finalVote:consensus.finalVote,
    selectedFromPersona:consensus.selectedFromPersona,
    minorityPersonas:consensus.minorityPersonas,
    confidence:lowestConfidence(entries.map(([,v])=>v)),
    majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),
    warnings,
    reDeliberationConditions:compactUnique([...informationGaps,...warnings],5),
    reviewReason:'',
    crossDiscussion:crossDiscussion(normalizedCross)
  });
}

export function buildPitchingPlanResult(second, cross) {
  const normalizedSecond=canonicalizePlayerData(second);
  const normalizedCross=canonicalizePlayerData(cross||{});
  const entries=Array.isArray(normalizedSecond)?normalizedSecond.map((v,i)=>[String(i),v]):Object.entries(normalizedSecond||{});
  if(entries.length!==3)return null;

  const crossReviewReason=normalizedCross?.reviewRequired===true?String(normalizedCross?.reviewReason||'クロス審議の再確認が必要です。'):'';
  const critical=entries.find(([,x])=>x?.reviewRequested===true&&String(x?.reviewReason||'').trim());
  const dataConflict=entries.find(([,x])=>String(x?.persona||'').toUpperCase().startsWith('MELCHIOR')&&x?.dataConflict===true);
  const warnings=compactUnique([...(normalizedCross?.warnings||[]),...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]);
  const informationGaps=compactUnique(normalizedCross?.informationGaps||[]);

  if(critical||dataConflict||crossReviewReason){
    return canonicalizePlayerData({
      mode:'PITCHING_PLAN',status:'PITCHING_PLAN_REVIEW_REQUIRED',recommendation:'投手運用を確定せず、未解決の確認事項を解消して再審議する。',
      plan:[],personaPlans:Object.fromEntries(entries.map(([k,v])=>[k,Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),roleConflicts:[],playerSupport:[],
      confidence:'LOW',majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),warnings,
      reDeliberationConditions:compactUnique([...informationGaps,...warnings],5),reviewReason:crossReviewReason||String(critical?.[1]?.reviewReason||'MELCHIOR detected an unresolved DATA CONFLICT.'),
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  const consensus=buildConsensusPitchingPlan(normalizedSecond);
  if(!consensus){
    return canonicalizePlayerData({
      mode:'PITCHING_PLAN',status:'PITCHING_PLAN_REVIEW_REQUIRED',recommendation:'3賢人の二次案に4役の投手運用として不完全な案があるため、運用を確定しない。',
      plan:[],personaPlans:Object.fromEntries(entries.map(([k,v])=>[k,Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),roleConflicts:[],playerSupport:[],
      confidence:'LOW',majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),warnings,
      reDeliberationConditions:compactUnique(['各賢人が現チームの異なる4投手を先発→第2投手→終盤→クローザーの順で再提示する',...informationGaps,...warnings],5),reviewReason:'二次投手運用案の構造が不完全',
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  const recommendation=consensus.plan.map(x=>`${x.roleLabel} ${x.name}`).join(' / ');
  return canonicalizePlayerData({
    mode:'PITCHING_PLAN',status:'PITCHING_PLAN_RESULT',recommendation,
    plan:consensus.plan,
    personaPlans:consensus.personaPlans,
    roleConflicts:consensus.roleConflicts,
    playerSupport:consensus.playerSupport,
    selectedFromPersona:consensus.selectedFromPersona,
    confidence:lowestConfidence(entries.map(([,v])=>v)),
    majorReasons:compactUnique(entries.map(([,v])=>v?.primaryReason)),warnings,
    reDeliberationConditions:compactUnique([...informationGaps,...warnings],5),reviewReason:'',
    crossDiscussion:crossDiscussion(normalizedCross)
  });
}

function selectionKindOf(caseData){
  return String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
}

function groundSelectionFinalText(value,caseData,{warning=false}={}){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const kind=selectionKindOf(caseData);
  if(!['PITCHING_ROLE','BATTING_ORDER'].includes(kind))return raw;

  const stripMeta=sentence=>String(sentence||'')
    .replace(/^(?:メルキオール|バルタザール|カスパー)からの(?:指摘|問いかけ)(?:に対する回答として|に対し|に答え)?[、,]?\s*/,'')
    .replace(/^自分への(?:指摘|問いかけ)(?:に対し|に答え)?[、,]?\s*/,'')
    .replace(/^(?:指摘された(?:通り|ように)|指摘の通り|二人の考えは分かります?|言いたいことは分かる)[、,]?\s*/,'')
    .trim();
  const unsafePitching=sentence=>
    /(?:安定した投球|安定した実績|安定感|信頼でき|信頼性|長いイニング|イニングを任せられ|勝利の確率|勝利に直結|勝ちに直結|勝ち筋|勝ちパターン|確率的優位|勝利の方程式|競った場面.{0,22}(?:切り抜け|実績)|勝ちに行くため|この選択を変える理由は(?:ない|ありません)|将来のチーム力|投手層.{0,18}(?:厚み|広げ)|選手層.{0,18}(?:厚み|広げ)|半年後)/.test(sentence);
  const unsafeBatting=sentence=>
    /(?:戦術的に最も安定|戦術.{0,24}(?:裏付け|安定|合致)|チームの戦術.{0,24}(?:裏付け|合致)|最も確実な選択肢|実績.{0,32}(?:その位置に置く.{0,18}確実|選択.{0,18}確実)|チームの安定.{0,18}(?:つなが|可能性)|定着度が高い|役割が定着|打順の軸.{0,12}安定|3番.{0,18}経験値|実戦経験.{0,18}(?:豊富|蓄積)|ポジション適性.{0,18}(?:豊富|高い)|役割集中.{0,36}(?:成長|育成|影響)|成長機会.{0,24}影響|チームの形.{0,18}馴染)/.test(sentence)
    ||(!hasExplicitSlotContinuity&&/(?:3番|打順|起用実績|スタメン|7試合).{0,90}(?:固定されて|固定する|継続起用|継続する|打順の継続性|崩す理由にはなら|チームの形.{0,18}馴染|戦術.{0,24}合致)/.test(sentence))
    ||(!hasExplicitFormObservation&&/(?:直近|打率|OPS|打撃成績|数値).{0,70}(?:勢い.{0,18}(?:落|陰り)|低調(?:な状態)?|状態の波|安定した打撃|安定して残|調子.{0,12}(?:良|悪|落))/.test(sentence))
    ||/(?:打順|起用).{0,50}(?:変える|変動|頻繁に変).{0,60}(?:全体の)?(?:つながり|連携).{0,24}(?:影響|崩|悪化)/.test(sentence);
  const evidenceText=JSON.stringify(caseData?.evidence||{});
  const hasExplicitSlotContinuity=/(?:3番|打順).{0,30}(?:固定|継続|維持|方針)|(?:固定|継続|維持).{0,30}(?:3番|打順)/.test(evidenceText);
  const hasExplicitFormObservation=/(?:勢い|低調|好調|不調|状態の波|調子.{0,12}(?:良|悪|落)|安定した打撃)/.test(evidenceText);
  const hasDirectBurdenEvidence=/(?:負担.{0,10}(?:大きい|大きすぎる|重い|過大|過度|集中|蓄積)|過度な負担|蓄積疲労|疲労蓄積|コンディション.{0,16}(?:負担|影響))/.test(evidenceText);
  const unsafeShared=sentence=>
    /(?:役割集中.{0,36}(?:成長|育成|影響)|成長機会.{0,24}影響|チーム全体で.{0,24}経験を積|チーム全体の成長|チーム全体.{0,20}負担|役割の分散|今後.{0,18}(?:成長|育成)|(?:大切に)?育てて|育てる|調整の過程|選手の成長.{0,18}(?:見守|考慮)|半年後|将来.{0,18}成長|将来(?:的)?な.{0,18}(?:チーム|投手層|選手層)|負担をかけすぎ|(?:過度な)?依存|他の投手.{0,24}成長|別の投手.{0,24}成長|成長も促)/.test(sentence)
    ||/(?:^|。)(?:指摘された|指摘の通り|二人の考え|3賢人|三賢人).{0,120}(?:判断|選択|維持|見直|変え)/.test(sentence)
    ||/(?:私の判断.{0,24}(?:変えない|変えません)|俺はこの選択.{0,24}変え|僕の判断.{0,24}(?:このまま|維持|変え)|初志.{0,24}維持|(?:他の記録が示されない限り|他の記録がない限り).{0,48}(?:判断|選択).{0,24}(?:変更|変える).{0,16}(?:理由は(?:ない|ありません)|必要は(?:ない|ありません)))/.test(sentence)
    ||(!hasDirectBurdenEvidence && /(?:過度な負担|負担集中|特定の選手への負担|特定の選手に負担|コンディション.{0,20}負担)/.test(sentence));
  const unsafe=kind==='PITCHING_ROLE'
    ? sentence=>unsafePitching(sentence)||unsafeShared(sentence)
    : sentence=>unsafeBatting(sentence)||unsafeShared(sentence);
  const kept=raw.split(/(?<=[。！？!?])/).map(stripMeta).filter(Boolean).filter(s=>!unsafe(s));
  if(kept.length)return kept.join('');
  if(warning)return '';
  return kind==='PITCHING_ROLE'
    ? '確認済みの投手成績・セーブ実績・指導者観察を比較した。'
    : '確認済みの打撃成績と実際の打順起用記録を比較した。';
}

function directSelectionEvidenceReasons(caseData){
  const kind=selectionKindOf(caseData);
  if(kind!=='PITCHING_ROLE')return [];
  const players=Array.isArray(caseData?.evidence?.allCurrentTeamCheck?.players)
    ? caseData.evidence.allCurrentTeamCheck.players
    : [];
  const savers=players.map(player=>({
    name:String(player?.name||'').trim(),
    saves:Number(String(player?.pitching?.SV??'').replace(/,/g,''))
  })).filter(row=>row.name&&Number.isFinite(row.saves)&&row.saves>0)
    .sort((a,b)=>b.saves-a.saves||a.name.localeCompare(b.name,'ja'));
  return savers.slice(0,3).map(row=>`${row.name}は現チームで${row.saves}セーブを記録している。`);
}

export function buildSelectionResult(second, cross, caseData={}) {
  const normalizedSecond = canonicalizePlayerData(second);
  const normalizedCross = canonicalizePlayerData(cross || {});
  const entries = Array.isArray(normalizedSecond) ? normalizedSecond.map((v,i)=>[String(i),v]) : Object.entries(normalizedSecond || {});
  if (entries.length !== 3) return null;

  const crossReviewReason = normalizedCross?.reviewRequired === true ? String(normalizedCross?.reviewReason || 'クロス審議の再確認が必要です。') : '';
  const critical = entries.find(([,x]) => x?.reviewRequested === true && String(x?.reviewReason || '').trim());
  const dataConflict = entries.find(([,x]) => String(x?.persona || '').toUpperCase().startsWith('MELCHIOR') && x?.dataConflict === true);
  if (critical || dataConflict || crossReviewReason) {
    return canonicalizePlayerData({
      mode: 'SELECTION', status: 'SELECTION_REVIEW_REQUIRED', recommendation: '候補を確定せず、未解決の確認事項を解消して再審議する。',
      centerCandidates: [], recommendedCandidates: [], alternateCandidates: [], candidateSupport: [],
      personaSelections: Object.fromEntries(entries.map(([k,v])=>[k, Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),
      confidence: 'LOW', majorReasons: compactUnique([...directSelectionEvidenceReasons(caseData), ...entries.map(([,v])=>groundSelectionFinalText(v?.primaryReason,caseData)).filter(Boolean)]),
      warnings: compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])].map(v=>groundSelectionFinalText(v,caseData,{warning:true})).filter(Boolean)),
      reDeliberationConditions: compactUnique([...(normalizedCross?.informationGaps||[]), ...(normalizedCross?.warnings||[])],5),
      reviewReason: crossReviewReason || String(critical?.[1]?.reviewReason || 'MELCHIOR detected an unresolved DATA CONFLICT.'),
      crossDiscussion:crossDiscussion(normalizedCross)
    });
  }

  const map = new Map();
  const personaSelections = {};
  for (const [persona, v] of entries) {
    const raw = Array.isArray(v?.candidatePlayers) ? v.candidatePlayers : [];
    const unique = [];
    const seen = new Set();
    for (const name of raw) {
      const display = String(name || '').trim();
      const key = playerKey(display);
      if (!key || seen.has(key)) continue;
      seen.add(key); unique.push(display);
    }
    personaSelections[persona] = unique;
    unique.forEach((name, index) => {
      const key = playerKey(name);
      const row = map.get(key) || {
        name,
        support: 0,
        firstPlaceCount: 0,
        rankScore: 0,
        rankTotal: 0,
        personas: []
      };
      row.support += 1;
      row.firstPlaceCount += index === 0 ? 1 : 0;
      row.rankScore += Math.max(1, 6 - index);
      row.rankTotal += index + 1;
      row.personas.push(persona);
      map.set(key, row);
    });
  }

  const ranked = [...map.values()]
    .sort((a,b)=>
      b.support-a.support ||
      b.firstPlaceCount-a.firstPlaceCount ||
      b.rankScore-a.rankScore ||
      a.rankTotal-b.rankTotal ||
      a.name.localeCompare(b.name,'ja')
    )
    .map((row,index)=>({
      ...row,
      overallRank: index + 1,
      averageRank: row.support ? Number((row.rankTotal / row.support).toFixed(2)) : null
    }));

  const top = ranked[0] || null;
  const secondRanked = ranked[1] || null;
  const centerCandidates = [];
  if (top && top.support >= 2) {
    centerCandidates.push(top.name);
    const nearTie = secondRanked &&
      secondRanked.support === top.support &&
      secondRanked.firstPlaceCount === top.firstPlaceCount &&
      (top.rankScore - secondRanked.rankScore) <= 1;
    if (nearTie) centerCandidates.push(secondRanked.name);
  }

  let recommendedLimit = Math.min(3, ranked.length);
  if (ranked.length >= 4 && ranked[3].support >= 2) recommendedLimit = 4;
  const recommendedCandidates = ranked.slice(0,recommendedLimit).map(x=>x.name);
  const alternateCandidates = ranked.slice(recommendedLimit).map(x=>x.name);

  const centerText = centerCandidates.length
    ? `中心候補：${centerCandidates.join('・')}。`
    : '3賢人の中心候補はまだ一本化していない。';
  const recommendedText = !recommendedCandidates.length
    ? '候補を確定できない。'
    : centerCandidates.length
      ? `有力候補：${recommendedCandidates.join('・')}。`
      : `各賢人の上位候補：${recommendedCandidates.join('・')}。`;

  const warnings = compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]
    .map(v=>groundSelectionFinalText(v,caseData,{warning:true})).filter(Boolean));
  const informationGaps = compactUnique(normalizedCross?.informationGaps || []);
  return canonicalizePlayerData({
    mode: 'SELECTION',
    status: centerCandidates.length ? 'SELECTION_RESULT' : 'SELECTION_SPLIT',
    recommendation: `${centerText}${recommendedText}`,
    centerCandidates,
    recommendedCandidates,
    alternateCandidates,
    candidateSupport: ranked,
    personaSelections,
    confidence: lowestConfidence(entries.map(([,v])=>v)),
    majorReasons: compactUnique([...directSelectionEvidenceReasons(caseData), ...entries.map(([,v])=>groundSelectionFinalText(v?.primaryReason,caseData)).filter(Boolean)]),
    warnings,
    reDeliberationConditions: compactUnique([...informationGaps, ...warnings],5),
    reviewReason: '',
    crossDiscussion:crossDiscussion(normalizedCross)
  });
}

export function buildFinalResult(second, cross) {
  const normalizedSecond = canonicalizePlayerData(second);
  const normalizedCross = canonicalizePlayerData(cross || {});
  const list = normalizeSecond(normalizedSecond);
  const enforced = deterministicFinal(normalizedSecond);
  if (!enforced.status) return null;

  const majorReasons = compactUnique(list.map(x => x?.primaryReason));
  const warnings = compactUnique([
    ...(normalizedCross?.warnings || []),
    ...list.flatMap(x => Array.isArray(x?.warnings) ? x.warnings : [])
  ]);
  const prediction = compactUnique(list.flatMap(x => Array.isArray(x?.prediction) ? x.prediction : []));
  const informationGaps = compactUnique(normalizedCross?.informationGaps || []);
  const reDeliberationConditions = compactUnique([...informationGaps, ...warnings], 5);
  const crossReviewReason = normalizedCross?.reviewRequired === true ? String(normalizedCross?.reviewReason || 'クロス審議の再確認が必要です。') : '';
  const effectiveStatus = crossReviewReason ? 'MAGI_REVIEW_REQUIRED' : enforced.status;

  const judgments = list.map(x => String(x?.judgment || '').toUpperCase());
  const counts = judgments.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
  const majorityJudgment = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
  const minority = effectiveStatus === 'MAGI_MAJORITY'
    ? list.find(x => String(x?.judgment || '').toUpperCase() !== majorityJudgment)
    : null;

  let recommendation = '三賢人の二次判定を基に判断する。';
  if (effectiveStatus === 'MAGI_REVIEW_REQUIRED') recommendation = '重大警告を確認し、追加確認後に再審議する。';
  else if (effectiveStatus === 'MAGI_DEADLOCK') recommendation = '結論を強制せず、追加情報を取得して再審議する。';
  else if (effectiveStatus === 'INSUFFICIENT_EVIDENCE') recommendation = '現時点では判断材料不足。必要情報を追加して再審議する。';
  else if (majorityJudgment === 'GREEN') recommendation = '賛成判断を採用する。';
  else if (majorityJudgment === 'BLUE') recommendation = '条件付きで採用し、条件を確認しながら運用する。';
  else if (majorityJudgment === 'RED') recommendation = '現時点では採用しない。';
  else if (majorityJudgment === 'YELLOW') recommendation = '判断を保留し、追加情報を取得する。';

  return canonicalizePlayerData({
    mode: 'PROPOSAL',
    status: effectiveStatus,
    vote: enforced.vote,
    recommendation,
    confidence: crossReviewReason ? 'LOW' : lowestConfidence(list),
    majorReasons,
    minorityOpinion: minority ? `${minority.persona || 'MINORITY'}: ${minority.primaryReason || minority.changeReason || '少数意見あり'}` : '',
    warnings,
    prediction,
    reviewReason: crossReviewReason || enforced.reviewReason || '',
    reDeliberationConditions,
    crossDiscussion:crossDiscussion(normalizedCross)
  });
}


export function isReviewCase(caseData) {
  const kind=String(caseData?.evidence?.reviewKind||caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  return kind==='TEAM_REVIEW'||kind==='PLAYER_REVIEW';
}

function groundTeamReviewReason(value){
  const raw=String(value||'').trim();
  if(!raw)return {text:'',changed:false};

  const battingContext=/(?:打撃成績|打率|OPS|上位打線|上位陣|下位打線)/.test(raw);
  const usageContext=/(?:出場機会|打数|起用)/.test(raw);
  const genericSpreadContext=/(?:記録|数値|成績|データ).{0,28}(?:偏り|差|ばらつき)|(?:偏り|差|ばらつき).{0,28}(?:記録|数値|成績|データ)/.test(raw);
  const battingOverclaim=/(?:弱点|依存|頼り|偏重|得点力|勝ち進|左右)/.test(raw);
  const usageOverclaim=/(?:弱点|課題|負担|育成|総合力|集中)/.test(raw);
  const genericSpreadOverclaim=/(?:弱点|戦術|課題|判断を変え|結論|明白|勝ち|得点力|攻撃|育成|総合力)/.test(raw);

  if(genericSpreadContext&&genericSpreadOverclaim){
    return {text:'確認済み記録には選手間の数値差がある。',changed:true};
  }
  if(battingContext&&battingOverclaim){
    return {text:'確認済みの打撃成績には選手間の数値差がある。',changed:true};
  }
  if(usageContext&&usageOverclaim){
    return {text:'確認済みの出場機会や打数には選手間の差がある。',changed:true};
  }
  return {text:raw,changed:false};
}

function groundTeamReviewWarning(value){
  const raw=String(value||'').trim();
  if(!raw)return {text:'',changed:false};
  if(/(?:特定.{0,12}マーク|マーク.{0,12}厳しく|対策不足)/.test(raw)){
    return {text:'',changed:true};
  }
  if(/(?:場合|囚われると|このまま|将来|半年後|1年後).{0,70}(?:損な|低下|悪化|左右|勝ち|影響|成長|チーム力)/.test(raw)){
    return {text:'',changed:true};
  }
  if(/(?:特定.{0,24}(?:選手|打者).{0,32}(?:調子|打撃).{0,32}(?:得点|勝敗).{0,20}左右|得点.{0,24}左右されるリスク|戦術(?:的)?な?.{0,12}(?:制約|問題)|組織的な成長|チーム全体.{0,18}(?:成長|底上げ))/.test(raw)){
    return {text:'',changed:true};
  }
  if(/(?:負担集中|育成機会.{0,8}不足)/.test(raw)){
    return {text:'出場機会や打数の差は確認できるが、その影響は追加Evidenceなしに断定しない。',changed:true};
  }
  return {text:raw,changed:false};
}

function teamReviewDirectRecentBattingFinding(caseData){
  const recent=caseData?.evidence?.recentSix;
  if(String(recent?.status||'').toUpperCase()!=='COMPLETE')return '';
  const gameCount=Number(recent?.gameCount);
  const players=Array.isArray(recent?.players)?recent.players:[];
  if(!Number.isFinite(gameCount)||gameCount<=0||!players.length)return '';
  const hitless=players.filter(player=>{
    const batting=player?.batting||{};
    const ab=Number(String(batting?.AB??'').replace(/,/g,''));
    const hits=Number(String(batting?.H??'').replace(/,/g,''));
    return Number.isFinite(ab)&&ab>0&&Number.isFinite(hits)&&hits===0;
  }).map(player=>String(player?.name||'').trim()).filter(Boolean);
  if(!hitless.length)return '';
  return `直近${gameCount}試合で、打数が記録された選手のうち${hitless.join('、')}の${hitless.length}選手が安打0である。`;
}

export function buildReviewResult(second, cross, caseData={}) {
  const normalizedSecond=canonicalizePlayerData(second);
  const normalizedCross=canonicalizePlayerData(cross||{});
  const list=normalizeSecond(normalizedSecond);
  const enforced=deterministicFinal(normalizedSecond);
  if(!enforced.status)return null;

  const reviewKind=String(caseData?.evidence?.reviewKind||caseData?.selectionKind||caseData?.evidence?.selectionKind||'REVIEW').toUpperCase();
  const rawMajorReasons=compactUnique(list.map(x=>x?.primaryReason));
  const rawWarnings=compactUnique([...(normalizedCross?.warnings||[]),...list.flatMap(x=>Array.isArray(x?.warnings)?x.warnings:[])]);
  const rawPrediction=compactUnique(list.flatMap(x=>Array.isArray(x?.prediction)?x.prediction:[]));
  let teamReviewGroundingAdjusted=false;
  const directTeamReviewFinding=reviewKind==='TEAM_REVIEW'?teamReviewDirectRecentBattingFinding(caseData):'';
  const majorReasons=reviewKind==='TEAM_REVIEW'
    ? compactUnique([
        directTeamReviewFinding,
        ...rawMajorReasons.map(value=>{
          const grounded=groundTeamReviewReason(value);
          if(grounded.changed)teamReviewGroundingAdjusted=true;
          return grounded.text;
        })
      ])
    : rawMajorReasons;
  const warnings=reviewKind==='TEAM_REVIEW'
    ? compactUnique([
        ...rawWarnings.map(value=>{
          const grounded=groundTeamReviewWarning(value);
          if(grounded.changed)teamReviewGroundingAdjusted=true;
          return grounded.text;
        }),
        ...((teamReviewGroundingAdjusted||directTeamReviewFinding)?['TEAM_REVIEWでは、確認済みの個別記録や数値差だけから特定選手への依存・チーム全体の恒常的な弱点・得点への因果・将来結果を断定しない。']:[])
      ])
    : rawWarnings;
  const prediction=reviewKind==='TEAM_REVIEW'?[]:rawPrediction;
  const informationGaps=compactUnique(normalizedCross?.informationGaps||[]);
  const crossReviewReason=normalizedCross?.reviewRequired===true?String(normalizedCross?.reviewReason||'クロス審議の再確認が必要です。'):'';
  const effectiveStatus=crossReviewReason?'MAGI_REVIEW_REQUIRED':enforced.status;
  const judgments=list.map(x=>String(x?.judgment||'').toUpperCase());
  const counts=judgments.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
  const majorityJudgment=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  const minority=effectiveStatus==='MAGI_MAJORITY'?list.find(x=>String(x?.judgment||'').toUpperCase()!==majorityJudgment):null;

  let recommendation='';
  if(effectiveStatus==='MAGI_REVIEW_REQUIRED')recommendation='重大な未確認事項を解消してから、現状評価をやり直す。';
  else if(effectiveStatus==='MAGI_DEADLOCK')recommendation='評価を一本化せず、3賢人の相違点を残して追加情報を確認する。';
  else if(effectiveStatus==='INSUFFICIENT_EVIDENCE')recommendation='現時点では評価材料不足。必要情報を追加して再評価する。';
  else {
    const lead=majorReasons[0]||list.find(x=>String(x?.publicStatement||'').trim())?.publicStatement||'3賢人の二次評価を確認する。';
    recommendation=reviewKind==='TEAM_REVIEW'
      ? `現時点で確認できる課題候補：${lead}${(teamReviewGroundingAdjusted||directTeamReviewFinding)?' この記録や数値差だけから特定選手への依存、チーム全体の恒常的な弱点、得点への因果までは断定しない。':''}`
      : `現時点の評価：${lead}`;
  }

  return canonicalizePlayerData({
    mode:'REVIEW',
    reviewKind,
    status:effectiveStatus,
    vote:enforced.vote,
    recommendation,
    confidence:crossReviewReason?'LOW':lowestConfidence(list),
    majorReasons,
    minorityOpinion:minority?`${minority.persona||'MINORITY'}: ${minority.primaryReason||minority.changeReason||'少数意見あり'}`:'',
    warnings,
    prediction,
    reviewReason:crossReviewReason||enforced.reviewReason||'',
    reDeliberationConditions:compactUnique([...informationGaps,...warnings],5),
    crossDiscussion:crossDiscussion(normalizedCross)
  });
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req,res) || !rateLimit(req,res))return;
  try {
    const body = await readBody(req);
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    if (body.phase === 'CROSS_EXAMINATION') {
      if (!body.primary) return sendJson(res, 400, { error: 'Locked primary judgments are required' });
      const selectionCase = isSelectionCase(body.case);
      const fullLineupCase = selectionCase && isFullLineupQuestion(body.case);
      const pitchingPlanCase = selectionCase && isPitchingPlanQuestion(body.case);
      const pitchingRoleCase = selectionCase && !pitchingPlanCase && String(body?.case?.selectionKind||body?.case?.evidence?.selectionKind||'').toUpperCase()==='PITCHING_ROLE';
      const baseInstruction = fullLineupCase
        ? 'This is a full 1-to-9 batting-order cross-examination. Do not collapse the three proposals into a compromise yet. Compare the three locked batting orders slot by slot and as sequences. Identify concrete disagreements such as who leads off, who bats in the middle, and which adjacent combinations differ. Each Wise Man must receive a real evidence-grounded challenge that responds to his actual proposed order. Press MELCHIOR on whether statistical caution produces a workable sequence, press BALTHASAR on whether tactical flow is supported by the supplied data, and press CASPER on whether development or burden concerns justify moving specific hitters. Preserve current-team priority and use old-team evidence only as labelled reference. Do not introduce a fourth lineup.'
        : pitchingPlanCase
          ? 'This is a 7-inning four-role pitching-plan cross-examination. candidatePlayers order means STARTER, SECOND PITCHER, LATE, CLOSER. Compare the three locked plans role by role. Every Wise Man must receive a concrete challenge that names an exact role and an exact current-team player from that Wise Man plan. Challenge whether the supplied pitching evidence and sample size support that assignment. Never infer saves, closer history, leverage success, pressure handling, consecutive-use tolerance, or exact inning limits unless CASE evidence explicitly supplies them. Preserve disagreement and do not invent a fourth compromise plan.'
          : pitchingRoleCase
            ? 'This is cross-examination for ONE requested pitching role only. Stay on the exact role in the user question. Compare only candidates present in CASE.evidence pitchingEligible. Do not discuss starter value, long-inning value, whole pitching plans, team balance months later, pressure handling, saves, closer history, fatigue, or leverage success unless CASE evidence explicitly supplies those facts. Each challenge must come from a DIFFERENT Wise Man than the challenged persona. If all three chose the same first candidate, rotate challenger identities and challenge the shared choice using missing role-specific evidence. Never expose internal identifiers such as CASE.evidence to the user-facing challenge text.'
            : selectionCase
              ? 'Do not vote yes/no on the question. Compare the three independently extracted candidate lists after the full-player review. Use exact official player names as supplied in the locked judgments. Expose agreement, omissions, differences, risks, information gaps and evidence-grounded challenges. Resolve all relative date and season expressions from temporalContext.'
            : 'Do not decide the case. Use exact official player names as supplied in the locked judgments. Only expose agreement, disagreement, domain conflicts, warnings, information gaps, and evidence-grounded challenges. CASE/evidence remains authoritative: do not introduce unsupported statistics, unrelated players, or historical roles that are not explicitly supported. Resolve all relative date and season expressions from temporalContext.';
      // Candidate-selection/full-lineup cross examination is deterministic from
      // the three locked PRIMARY judgments. Avoid an unnecessary Gemini call here:
      // this preserves real cross-persona challenges while reserving provider quota
      // for the three independent SECOND judgments.
      if (selectionCase && !pitchingPlanCase) {
        const deterministicCross = fullLineupCase
          ? deterministicFullLineupCross(body.primary)
          : deterministicSelectionCross(body.primary);
        if (deterministicCross) return sendJson(res, 200, canonicalizePlayerData(deterministicCross));
      }
      const teamReviewCase = isReviewCase(body.case)
        && String(body?.case?.evidence?.reviewKind||body?.case?.selectionKind||body?.case?.evidence?.selectionKind||'').toUpperCase()==='TEAM_REVIEW';
      if (teamReviewCase) {
        const deterministicCross = deterministicTeamReviewCross(body.primary);
        if (deterministicCross) {
          const issues = validateCrossOutput(body.case, deterministicCross, { focused:true });
          return sendJson(res, 200, canonicalizePlayerData(issues.length ? failClosedCross(issues) : deterministicCross));
        }
      }

      const basePayload = {
        phase: 'CROSS_EXAMINATION',
        temporalContext: jstContext(),
        case: canonicalizePlayerData(body.case),
        lockedPrimaryJudgments: canonicalizePlayerData(body.primary),
        instruction: baseInstruction
      };

      let rawResult;
      let result;
      let guardIssues;
      try {
        rawResult = await callGemini({
          systemInstruction: ORCHESTRATOR,
          userPayload: basePayload,
          responseSchema: crossSchema
        });
        result = canonicalizePlayerData(rawResult);
        guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
      } catch (crossError) {
        const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : (selectionCase && !pitchingPlanCase ? deterministicSelectionCross(body.primary) : null);
        if (fallback) return sendJson(res, 200, canonicalizePlayerData(fallback));
        throw crossError;
      }

      for (let attempt = 0; guardIssues.length && attempt < 2; attempt++) {
        const correctionPayload = {
          ...basePayload,
          invalidDraft: result,
          correctionIssues: guardIssues,
          correctionAttempt: attempt + 1,
          instruction: `${baseInstruction} CORRECTION PASS ${attempt + 1}: The previous cross-examination draft failed deterministic evidence validation. Correct every item in correctionIssues. Remove unsupported claims instead of paraphrasing them. Missing information may be named as a gap, but must never be presented as an existing fact. Return the complete schema again.`
        };
        try {
          rawResult = await callGemini({
            systemInstruction: ORCHESTRATOR,
            userPayload: correctionPayload,
            responseSchema: crossSchema
          });
          result = canonicalizePlayerData(rawResult);
          guardIssues = validateCrossOutput(body.case, result, { focused: !selectionCase });
        } catch (correctionError) {
          const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : (selectionCase && !pitchingPlanCase ? deterministicSelectionCross(body.primary) : null);
          if (fallback) {
            result = fallback;
            guardIssues = [];
            break;
          }
          throw correctionError;
        }
      }

      if (guardIssues.length) {
        const fallback = fullLineupCase ? deterministicFullLineupCross(body.primary) : (selectionCase && !pitchingPlanCase ? deterministicSelectionCross(body.primary) : null);
        result = fallback || failClosedCross(guardIssues);
      }
      return sendJson(res, 200, canonicalizePlayerData(result));
    }

    if (body.phase === 'FINAL') {
      if (!body.primary || !body.second) return sendJson(res, 400, { error: 'Primary and second judgments are required' });
      const result = isFullLineupQuestion(body.case)
        ? buildFullLineupResult(body.second, body.crossExamination || null, body.case || {})
        : isPitchingPlanQuestion(body.case)
          ? buildPitchingPlanResult(body.second, body.crossExamination || null)
          : isSelectionCase(body.case)
            ? buildSelectionResult(body.second, body.crossExamination || null, body.case || {})
            : isReviewCase(body.case)
              ? buildReviewResult(body.second, body.crossExamination || null, body.case || {})
              : buildFinalResult(body.second, body.crossExamination || null);
      if (!result) return sendJson(res, 400, { error: 'Second judgments are incomplete or invalid' });
      return sendJson(res, 200, canonicalizePlayerData(result));
    }

    return sendJson(res, 400, { error: 'Unknown orchestrator phase' });
  } catch (error) {
    const tooLarge = error?.message === 'Request body too large';
    const transient = error?.timedOut === true || error?.retryable === true || [408,429,500,502,503,504].includes(Number(error?.status));
    const status = tooLarge ? 413 : (transient ? 503 : 500);
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, {
      error: tooLarge ? '送信データが大きすぎます。' : (transient ? '相互検証を一時的に取得できませんでした。' : '相互検証を作成できませんでした。'),
      code: tooLarge ? 'REQUEST_TOO_LARGE' : 'CROSS_EXAMINATION_FAILED',
      retryExhausted: transient
    });
  }
}