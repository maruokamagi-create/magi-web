import { callGemini, checkGeminiConfiguration, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';
import { requireApprovedMember } from '../drive/_access.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { runDetailCsvConsistencyAudit } from './_detail-csv-audit.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';

const ANSWER_ENGINE_VERSION = 'fixture-answer-v1';

const answerSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    factsUsed: { type: 'ARRAY', items: { type: 'STRING' } },
    missingInformation: { type: 'ARRAY', items: { type: 'STRING' } },
    contradictions: { type: 'ARRAY', items: { type: 'STRING' } },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    refusedToInvent: { type: 'BOOLEAN' }
  },
  required: ['answer','factsUsed','missingInformation','contradictions','confidence','refusedToInvent']
};

const ANSWER_SYSTEM = `
あなたは《MAGI》の回答生成層の試験エンジン。
目的は「質問を理解した後、与えられた根拠だけを使って質問へ的確に答える」こと。

絶対原則:
- userPayload.evidence に存在しない選手成績・試合結果・資料情報を作らない。
- 推測で数値を補わない。要求された値が evidence に無ければ「確認できない」と明示し、missingInformation に入れ、refusedToInvent=true にする。
- evidence 内に矛盾する値がある場合は片方を勝手に採用しない。contradictions に内容を入れ、answer でも矛盾があることを伝え、confidence=LOW とする。
- route が BATTING_LOOKUP / PITCHING_LOOKUP / PLAYER_OVERVIEW / TEAM_LOOKUP / DOCUMENT_SEARCH の場合、回答は evidence のみを根拠にする。
- PLAYER_OVERVIEW は、質問が打撃と投手の両方を求めているなら、両方の情報が evidence にある限り両方を答える。片方しか無ければ不足を明示する。
- DOCUMENT_SEARCH は見つかった資料名をそのまま示す。見つからなければ見つからないと答える。
- answer は日本語で簡潔に、まず質問への答えを直接述べる。内部ルート名や試験ルールはユーザー向け回答に書かない。
- factsUsed は実際に回答へ使用した evidence の事実だけを書く。
- missingInformation は回答に必要だが evidence に無い情報だけを書く。
- refusedToInvent は、作り話を避けて不明・不足・矛盾を明示した場合 true。根拠が十分で通常回答できた場合 false。
`;

function detectOutputFormat(questionValue) {
  const q = String(questionValue || '');
  return /(?:PDF|ＰＤＦ)/i.test(q) ? 'PDF' : 'DEFAULT';
}

function stripOutputFormatModifier(questionValue) {
  let q = String(questionValue || '')
    .replace(/(?:PDF|ＰＤＦ)(?:形式)?(?:にして|化して|で出して|で見せて|で保存して|で作って|でお願い|で表示して|で出力して|で)?/gi, ' ')
    .replace(/(?:PDF|ＰＤＦ)(?:形式)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  q = q.replace(/(?:を|で|に|として|の形で|形式で)$/u, '').trim();
  return q;
}

function isExplicitExistingPdfSearch(questionValue) {
  const q = String(questionValue || '');
  return (
    /(?:PDF|ＰＤＦ)(?:ファイル|資料|文書|レポート)?[^。！？!?]{0,24}(?:探して|検索して|どこ|見つけて|開いて|見せて)/i.test(q) ||
    /(?:探して|検索して|どこ|見つけて|開いて|見せて)[^。！？!?]{0,24}(?:PDF|ＰＤＦ)(?:ファイル|資料|文書|レポート)?/i.test(q) ||
    /(?:Drive|ドライブ|保存済み|既存|前に作った|この前作った)[^。！？!?]{0,40}(?:PDF|ＰＤＦ)/i.test(q)
  );
}

async function classify(question, context) {
  let routed = await routeQuestion(question, context);
  routed = await recoverContextBoundDeliberation(question, context, routed);
  return routed;
}

async function routeWithOutputFormat(question, context) {
  const outputFormat = detectOutputFormat(question);
  if (outputFormat !== 'PDF') {
    const routed = await classify(question, context);
    return { ...routed, outputFormat };
  }
  const baseQuestion = stripOutputFormatModifier(question);
  const explicitExistingPdfSearch = isExplicitExistingPdfSearch(question);
  if (baseQuestion && baseQuestion !== question && !explicitExistingPdfSearch) {
    const base = await classify(baseQuestion, context);
    if (base.route !== 'CLARIFY' && base.route !== 'UNSUPPORTED') {
      return { ...base, outputFormat, outputFormatRecovered: true, outputFormatBaseQuestion: baseQuestion, outputFormatReason: 'PRESENTATION_MODIFIER' };
    }
  }
  let routed = await classify(question, context);
  routed.outputFormat = outputFormat;
  routed.outputFormatBaseQuestion = baseQuestion;
  routed.outputFormatRecovered = false;
  routed.outputFormatReason = explicitExistingPdfSearch ? 'EXISTING_PDF_SEARCH' : 'BASE_INTENT_UNRESOLVED';
  if (!explicitExistingPdfSearch && routed.route === 'DOCUMENT_SEARCH' && baseQuestion && baseQuestion !== question) {
    const base = await classify(baseQuestion, context);
    if (base.safeToExecute && base.route !== 'CLARIFY' && base.route !== 'UNSUPPORTED' && base.route !== 'DOCUMENT_SEARCH') {
      routed = { ...base, outputFormat, outputFormatRecovered: true, outputFormatBaseQuestion: baseQuestion, outputFormatReason: 'DOCUMENT_SEARCH_FALSE_POSITIVE_RECOVERED' };
    }
  }
  return routed;
}

async function runAnswerFixture(body) {
  const question = String(body?.question || '').trim().slice(0, 4000);
  const route = String(body?.route || '').trim().slice(0, 80);
  const evidence = body?.evidence && typeof body.evidence === 'object' ? body.evidence : {};
  if (question.length < 2 || !route) return { error: 'question and route are required' };
  const result = await callGemini({ systemInstruction: ANSWER_SYSTEM, userPayload: { question, route, evidence }, responseSchema: answerSchema });
  return { ok: true, answerEngineVersion: ANSWER_ENGINE_VERSION, ...result };
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const mode = String(body?.mode || '').toUpperCase();

    if (mode === 'ROUTE_QUESTION') {
      const question = String(body?.question || '').trim();
      if (!question) return sendJson(res, 400, { ok: false, error: 'question is required' });
      const routed = await routeWithOutputFormat(question, body?.context || []);
      return sendJson(res, 200, { ok: true, ...routed });
    }

    if (mode === 'ANSWER_FIXTURE') {
      const result = await runAnswerFixture(body);
      if (result?.error) return sendJson(res, 400, { ok: false, error: result.error });
      return sendJson(res, 200, result);
    }

    if (mode === 'LIVE_QUESTION_ANSWER') {
      const member = await requireApprovedMember(req, res);
      if (!member) return;
      const question = String(body?.question || '').trim();
      if (!question) return sendJson(res, 400, { ok: false, error: 'question is required' });
      try {
        const routed = await routeWithOutputFormat(question, body?.context || []);
        const result = routed?.route === 'PITCHING_LOOKUP'
          ? await buildStrictPitchingAnswer({ question, routed })
          : await buildLiveAnswer({ question, routed });
        return sendJson(res, 200, { ...result, outputFormat: routed?.outputFormat || 'DEFAULT' });
      } catch (error) {
        console.error('[MAGI live question answer]', error?.message || error);
        return sendJson(res, 502, { ok: false, error: error?.message || 'Live question answer failed' });
      }
    }

    if (mode === 'DRIVE_LIVE_AUDIT') {
      const member = await requireApprovedMember(req, res);
      if (!member) return;
      try {
        const result = await runDriveLiveAudit({ season: body?.season || 'current' });
        return sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        console.error('[MAGI live Drive audit]', error?.message || error);
        return sendJson(res, 502, { ok: false, error: error?.message || 'Live Drive audit failed' });
      }
    }

    if (mode === 'DETAIL_CSV_AUDIT') {
      const member = await requireApprovedMember(req, res);
      if (!member) return;
      try {
        const result = await runDetailCsvConsistencyAudit({ season: body?.season || 'current' });
        return sendJson(res, 200, { ok: true, ...result });
      } catch (error) {
        console.error('[MAGI detail CSV consistency]', error?.message || error);
        return sendJson(res, 502, { ok: false, error: error?.message || 'Detail CSV consistency audit failed' });
      }
    }

    const gemini = await checkGeminiConfiguration();
    return sendJson(res, gemini.ok ? 200 : 503, {
      ok: gemini.ok,
      service: 'MAGI Gemini Engine',
      protocol: '1.0',
      model: gemini.model,
      modelDisplayName: gemini.displayName || null,
      configured: gemini.ok,
      reason: gemini.ok ? null : gemini.reason
    });
  } catch (error) {
    console.error('[MAGI health/router]', error?.message || error);
    return sendJson(res, 500, { ok: false, error: 'Health/router request failed' });
  }
}
