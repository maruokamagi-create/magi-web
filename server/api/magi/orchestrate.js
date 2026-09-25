import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { ORCHESTRATOR } from './_prompts.js';
import { failClosedCross, validateCrossOutput } from './_cross-output-guard.js';
import { canonicalizePlayerData, playerKey } from './_roster.js';
import { buildConsensusLineup, isFullLineupQuestion } from './_full-lineup.js';
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
  if (String(caseData?.mode || '').toLowerCase() === 'selection') return true;
  if (isFullLineupQuestion(caseData) || isPitchingPlanQuestion(caseData)) return true;
  const q = String(caseData?.question || '');
  const battingSlot = /(?:[1-9１-９一二三四五六七八九](?:番|ばん)(?:打者)?)/;
  const domain = /クリーンナップ|中軸|主軸|打線|打順|オーダー|紅白戦|スタメン|レギュラー|先発|起用|守備位置|ポジション|クローザー|抑え|捕手|投手|一塁|二塁|三塁|遊撃|左翼|中堅|右翼|レフト|センター|ライト/;
  const cue = /誰|だれ|どの|どれ|どちら|どう組|どうする|組んで|組む|組み合わせ|候補|選ぶ|選定|何番|一番いい|最適|ベスト|考えて|決めて/;
  return (domain.test(q) || battingSlot.test(q)) && cue.test(q);
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

function deterministicFullLineupCross(primary) {
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

function deterministicSelectionCross(primary) {
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
    const other = rows.find((candidate,j)=>j!==rowIndex && playerKey(candidate.candidates[0])!==playerKey(row.candidates[0])) || rows[(rowIndex+1)%rows.length];
    challenges[row.key].push(`${row.jp}、あなたの第1候補は${row.candidates[0]}です。${other.jp}の第1候補${other.candidates[0]}と比べ、CASE.evidenceで確認できる記録だけを使って、この候補を維持するか見直すか説明してください。`);
  });
  return { agreement, disagreement, domainConflicts:[], warnings:[], informationGaps:[], challenges };
}

export function buildFullLineupResult(second, cross) {
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

  const recommendation=consensus.lineup.map(x=>`${x.slot}番 ${x.name}`).join(' / ');
  return canonicalizePlayerData({
    mode:'FULL_LINEUP',status:'LINEUP_RESULT',recommendation,
    lineup:consensus.lineup,
    personaLineups:consensus.personaLineups,
    slotConflicts:consensus.slotConflicts,
    playerSupport:consensus.playerSupport,
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

export function buildSelectionResult(second, cross) {
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
      confidence: 'LOW', majorReasons: compactUnique(entries.map(([,v])=>v?.primaryReason)),
      warnings: compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]),
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

  const warnings = compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]);
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
    majorReasons: compactUnique(entries.map(([,v])=>v?.primaryReason)),
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
      const baseInstruction = fullLineupCase
        ? 'This is a full 1-to-9 batting-order cross-examination. Do not collapse the three proposals into a compromise yet. Compare the three locked batting orders slot by slot and as sequences. Identify concrete disagreements such as who leads off, who bats in the middle, and which adjacent combinations differ. Each Wise Man must receive a real evidence-grounded challenge that responds to his actual proposed order. Press MELCHIOR on whether statistical caution produces a workable sequence, press BALTHASAR on whether tactical flow is supported by the supplied data, and press CASPER on whether development or burden concerns justify moving specific hitters. Preserve current-team priority and use old-team evidence only as labelled reference. Do not introduce a fourth lineup.'
        : pitchingPlanCase
          ? 'This is a 7-inning four-role pitching-plan cross-examination. candidatePlayers order means STARTER, SECOND PITCHER, LATE, CLOSER. Compare the three locked plans role by role. Every Wise Man must receive a concrete challenge that names an exact role and an exact current-team player from that Wise Man plan. Challenge whether the supplied pitching evidence and sample size support that assignment. Never infer saves, closer history, leverage success, pressure handling, consecutive-use tolerance, or exact inning limits unless CASE evidence explicitly supplies them. Preserve disagreement and do not invent a fourth compromise plan.'
          : selectionCase
            ? 'Do not vote yes/no on the question. Compare the three independently extracted candidate lists after the full-player review. Use exact official player names as supplied in the locked judgments. Expose agreement, omissions, differences, risks, information gaps and evidence-grounded challenges. Resolve all relative date and season expressions from temporalContext.'
            : 'Do not decide the case. Use exact official player names as supplied in the locked judgments. Only expose agreement, disagreement, domain conflicts, warnings, information gaps, and evidence-grounded challenges. CASE/evidence remains authoritative: do not introduce unsupported statistics, unrelated players, or historical roles that are not explicitly supported. Resolve all relative date and season expressions from temporalContext.';
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
        ? buildFullLineupResult(body.second, body.crossExamination || null)
        : isPitchingPlanQuestion(body.case)
          ? buildPitchingPlanResult(body.second, body.crossExamination || null)
          : isSelectionCase(body.case)
            ? buildSelectionResult(body.second, body.crossExamination || null)
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