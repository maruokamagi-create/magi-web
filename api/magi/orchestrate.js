import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { ORCHESTRATOR } from './_prompts.js';

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

function buildFinalResult(second, cross) {
  const list = normalizeSecond(second);
  const enforced = deterministicFinal(second);
  if (!enforced.status) return null;

  const majorReasons = compactUnique(list.map(x => x?.primaryReason));
  const warnings = compactUnique([
    ...(cross?.warnings || []),
    ...list.flatMap(x => Array.isArray(x?.warnings) ? x.warnings : [])
  ]);
  const prediction = compactUnique(list.flatMap(x => Array.isArray(x?.prediction) ? x.prediction : []));
  const informationGaps = compactUnique(cross?.informationGaps || []);
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

  return {
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
  };
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });

    if (body.phase === 'CROSS_EXAMINATION') {
      if (!body.primary) return sendJson(res, 400, { error: 'Locked primary judgments are required' });
      const result = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: {
          phase: 'CROSS_EXAMINATION',
          case: body.case,
          lockedPrimaryJudgments: body.primary,
          instruction: 'Do not decide the case. Only expose agreement, disagreement, domain conflicts, warnings, information gaps, and evidence-grounded challenges.'
        },
        responseSchema: crossSchema
      });
      return sendJson(res, 200, result);
    }

    if (body.phase === 'FINAL') {
      if (!body.primary || !body.second) return sendJson(res, 400, { error: 'Primary and second judgments are required' });

      // FINAL is intentionally deterministic and local. This removes the eighth Gemini call,
      // prevents the UI from hanging at 88%, and preserves the server-enforced voting protocol.
      const result = buildFinalResult(body.second, body.crossExamination || null);
      if (!result) return sendJson(res, 400, { error: 'Second judgments are incomplete or invalid' });
      return sendJson(res, 200, result);
    }

    return sendJson(res, 400, { error: 'Unknown orchestrator phase' });
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Orchestration failed' });
  }
}
