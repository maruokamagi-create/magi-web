import { checkGeminiConfiguration, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';

function detectOutputFormat(questionValue) {
  const q = String(questionValue || '');
  return /(?:PDF|ＰＤＦ)/i.test(q) ? 'PDF' : 'DEFAULT';
}

function stripOutputFormatModifier(questionValue) {
  return String(questionValue || '')
    .replace(/(?:PDF|ＰＤＦ)(?:形式)?(?:にして|化して|で出して|で見せて|で保存して|で作って|でお願い|で表示して|で出力して|で)?/gi, ' ')
    .replace(/(?:PDF|ＰＤＦ)(?:形式)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExplicitExistingPdfSearch(questionValue) {
  const q = String(questionValue || '');
  // PDFそのものを既存資料として探す依頼だけはDOCUMENT_SEARCHの意味を保持する。
  // 「成績をPDFで」のような出力形式指定とは分離する。
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

  // 原則: PDFは「何をするか」ではなく「どう出すか」。
  // したがって、まずPDF指定を外した本体質問を分類する。
  // 例: 「大野竜暉の打撃成績をPDFで」
  //   -> BATTING_LOOKUP + outputFormat=PDF
  // 例: 「陽翔を4番にすべきかPDFでまとめて」
  //   -> DELIBERATION + outputFormat=PDF
  if (baseQuestion && baseQuestion !== question && !explicitExistingPdfSearch) {
    const base = await classify(baseQuestion, context);
    if (base.route !== 'CLARIFY' && base.route !== 'UNSUPPORTED') {
      return {
        ...base,
        outputFormat,
        outputFormatRecovered: true,
        outputFormatBaseQuestion: baseQuestion,
        outputFormatReason: 'PRESENTATION_MODIFIER'
      };
    }
  }

  // 既存PDFを探す依頼、またはPDFを外しても意味が確定しない場合は原文で分類する。
  let routed = await classify(question, context);
  routed.outputFormat = outputFormat;
  routed.outputFormatBaseQuestion = baseQuestion;
  routed.outputFormatRecovered = false;
  routed.outputFormatReason = explicitExistingPdfSearch ? 'EXISTING_PDF_SEARCH' : 'BASE_INTENT_UNRESOLVED';

  // 原文がPDF語に引っ張られてDOCUMENT_SEARCHへ寄っても、
  // PDFを外した本体質問が安全に実行可能なら本体質問を優先する。
  if (!explicitExistingPdfSearch && routed.route === 'DOCUMENT_SEARCH' && baseQuestion && baseQuestion !== question) {
    const base = await classify(baseQuestion, context);
    if (base.safeToExecute && base.route !== 'CLARIFY' && base.route !== 'UNSUPPORTED' && base.route !== 'DOCUMENT_SEARCH') {
      routed = {
        ...base,
        outputFormat,
        outputFormatRecovered: true,
        outputFormatBaseQuestion: baseQuestion,
        outputFormatReason: 'DOCUMENT_SEARCH_FALSE_POSITIVE_RECOVERED'
      };
    }
  }

  return routed;
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);

    // Standalone semantic-router lab path. This is not wired into MAGI-WEB's main execution button yet.
    if (String(body?.mode || '').toUpperCase() === 'ROUTE_QUESTION') {
      const question = String(body?.question || '').trim();
      if (!question) return sendJson(res, 400, { ok: false, error: 'question is required' });
      const routed = await routeWithOutputFormat(question, body?.context || []);
      return sendJson(res, 200, { ok: true, ...routed });
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
