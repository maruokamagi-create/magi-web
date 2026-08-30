import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { ORCHESTRATOR } from './_prompts.js';
import { canonicalizePlayerData, playerKey } from './_roster.js';

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

function isSelectionCase(caseData) {
  if (String(caseData?.mode || '').toLowerCase() === 'selection') return true;
  const q = String(caseData?.question || '');
  const domain = /クリーンナップ|中軸|主軸|打線|打順|スタメン|レギュラー|先発|起用|守備位置|ポジション/;
  const cue = /誰|どの|どれ|どちら|どう組|組み合わせ|候補|選ぶ|選定|何番/;
  return domain.test(q) && cue.test(q);
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

function deterministicFinal(second) {
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

function buildSelectionResult(second, cross) {
  const normalizedSecond = canonicalizePlayerData(second);
  const normalizedCross = canonicalizePlayerData(cross || {});
  const entries = Array.isArray(normalizedSecond) ? normalizedSecond.map((v,i)=>[String(i),v]) : Object.entries(normalizedSecond || {});
  if (entries.length !== 3) return null;

  const critical = entries.find(([,x]) => x?.reviewRequested === true && String(x?.reviewReason || '').trim());
  const dataConflict = entries.find(([,x]) => String(x?.persona || '').toUpperCase().startsWith('MELCHIOR') && x?.dataConflict === true);
  if (critical || dataConflict) {
    return canonicalizePlayerData({
      mode: 'SELECTION', status: 'SELECTION_REVIEW_REQUIRED', recommendation: '候補を確定せず、未解決の確認事項を解消して再審議する。',
      centerCandidates: [], recommendedCandidates: [], alternateCandidates: [], candidateSupport: [],
      personaSelections: Object.fromEntries(entries.map(([k,v])=>[k, Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]])),
      confidence: lowestConfidence(entries.map(([,v])=>v)), majorReasons: compactUnique(entries.map(([,v])=>v?.primaryReason)),
      warnings: compactUnique([...(normalizedCross?.warnings||[]), ...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]),
      reDeliberationConditions: compactUnique([...(normalizedCross?.informationGaps||[]), ...(normalizedCross?.warnings||[])],5),
      reviewReason: String(critical?.[1]?.reviewReason || 'MELCHIOR detected an unresolved DATA CONFLICT.')
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
  const recommendedText = recommendedCandidates.length
    ? `クリーンナップ有力候補：${recommendedCandidates.join('・')}。`
    : '候補を確定できない。';

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
    reviewReason: ''
  });
}

function buildFinalResult(second, cross) {
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

  const judgments = list.map(x => String(x?.judgment || '').toUpperCase());
  const counts = judgments.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{});
  const majorityJudgment = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
  const minority = list.find(x => String(x?.judgment || '').toUpperCase() !== majorityJudgment);

  let recommendation = '三賢人の二次判定を基に判断する。';
  if (enforced.status === 'MAGI_REVIEW_REQUIRED') recommendation = '重大警告を確認し、追加確認後に再審議する。';
  else if (enforced.status === 'MAGI_DEADLOCK') recommendation = '結論を強制せず、追加情報を取得して再審議する。';
  else if (enforced.status === 'INSUFFICIENT_EVIDENCE') recommendation = '現時点では判断材料不足。必要情報を追加して再審議する。';
  else if (majorityJudgment === 'GREEN') recommendation = '賛成判断を採用する。';
  else if (majorityJudgment === 'BLUE') recommendation = '条件付きで採用し、条件を確認しながら運用する。';
  else if (majorityJudgment === 'RED') recommendation = '現時点では採用しない。';
  else if (majorityJudgment === 'YELLOW') recommendation = '判断を保留し、追加情報を取得する。';

  return canonicalizePlayerData({
    mode: 'PROPOSAL',
    status: enforced.status,
    vote: enforced.vote,
    recommendation,
    confidence: lowestConfidence(list),
    majorReasons,
    minorityOpinion: minority ? `${minority.persona || 'MINORITY'}: ${minority.primaryReason || minority.changeReason || '少数意見あり'}` : '',
    warnings,
    prediction,
    reviewReason: enforced.reviewReason || '',
    reDeliberationConditions
  });
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    if (body.phase === 'CROSS_EXAMINATION') {
      if (!body.primary) return sendJson(res, 400, { error: 'Locked primary judgments are required' });
      const rawResult = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: {
          phase: 'CROSS_EXAMINATION',
          temporalContext: jstContext(),
          case: canonicalizePlayerData(body.case),
          lockedPrimaryJudgments: canonicalizePlayerData(body.primary),
          instruction: isSelectionCase(body.case)
            ? 'Do not vote yes/no on the question. Compare the three independently extracted candidate lists after the full-player review. Use exact official player names as supplied in the locked judgments. Expose agreement, omissions, differences, risks, information gaps and evidence-grounded challenges. Resolve all relative date and season expressions from temporalContext.'
            : 'Do not decide the case. Use exact official player names as supplied in the locked judgments. Only expose agreement, disagreement, domain conflicts, warnings, information gaps, and evidence-grounded challenges. Resolve all relative date and season expressions from temporalContext.'
        },
        responseSchema: crossSchema
      });
      return sendJson(res, 200, canonicalizePlayerData(rawResult));
    }

    if (body.phase === 'FINAL') {
      if (!body.primary || !body.second) return sendJson(res, 400, { error: 'Primary and second judgments are required' });
      const result = isSelectionCase(body.case)
        ? buildSelectionResult(body.second, body.crossExamination || null)
        : buildFinalResult(body.second, body.crossExamination || null);
      if (!result) return sendJson(res, 400, { error: 'Second judgments are incomplete or invalid' });
      return sendJson(res, 200, canonicalizePlayerData(result));
    }

    return sendJson(res, 400, { error: 'Unknown orchestrator phase' });
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Orchestration failed' });
  }
}
