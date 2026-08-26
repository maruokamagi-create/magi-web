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

const finalSchema = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['MAGI_CONSENSUS','MAGI_MAJORITY','MAGI_DEADLOCK','INSUFFICIENT_EVIDENCE','MAGI_REVIEW_REQUIRED'] },
    vote: { type: 'STRING' },
    recommendation: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    majorReasons: { type: 'ARRAY', items: { type: 'STRING' } },
    minorityOpinion: { type: 'STRING' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    prediction: { type: 'ARRAY', items: { type: 'STRING' } },
    reviewReason: { type: 'STRING' },
    reDeliberationConditions: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['status','vote','recommendation','confidence','majorReasons','minorityOpinion','warnings','prediction','reviewReason','reDeliberationConditions']
};

const VALID = new Set(['GREEN','BLUE','YELLOW','RED']);

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
      const result = await callGemini({
        systemInstruction: ORCHESTRATOR,
        userPayload: {
          phase: 'FINAL',
          case: body.case,
          lockedPrimaryJudgments: body.primary,
          crossExamination: body.crossExamination || null,
          secondJudgments: body.second,
          instruction: 'Explain the final protocol result; do not invent a fourth opinion. Vote status is enforced by the server.'
        },
        responseSchema: finalSchema
      });

      const enforced = deterministicFinal(body.second);
      if (!enforced.status) return sendJson(res, 400, { error: 'Second judgments are incomplete or invalid' });
      result.status = enforced.status;
      result.vote = enforced.vote;
      if (enforced.status === 'MAGI_REVIEW_REQUIRED') {
        result.reviewReason = enforced.reviewReason || result.reviewReason || 'MAGI review required';
        result.recommendation = '重大警告を確認し、追加確認後に再審議する。';
      } else if (enforced.status === 'MAGI_DEADLOCK') {
        result.recommendation = '結論を強制せず、追加情報を取得して再審議する。';
      } else if (enforced.status === 'INSUFFICIENT_EVIDENCE') {
        result.recommendation = '現時点では判断材料不足。必要情報を追加して再審議する。';
      }
      return sendJson(res, 200, result);
    }

    return sendJson(res, 400, { error: 'Unknown orchestrator phase' });
  } catch (error) {
    const status = error?.message === 'Request body too large' ? 413 : 500;
    console.error('[MAGI orchestrate]', error?.message || error);
    return sendJson(res, status, { error: status === 413 ? 'Request body too large' : 'Orchestration failed' });
  }
}
