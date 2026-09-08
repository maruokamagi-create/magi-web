import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';

const ANSWER_ENGINE_VERSION = 'fixture-answer-v1';

const schema = {
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

const SYSTEM = `
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

function clean(value, max = 10000) {
  return String(value ?? '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    const question = clean(body?.question, 4000);
    const route = clean(body?.route, 80);
    const evidence = body?.evidence && typeof body.evidence === 'object' ? body.evidence : {};
    if (question.length < 2 || !route) return sendJson(res, 400, { error: 'question and route are required' });

    const result = await callGemini({
      systemInstruction: SYSTEM,
      userPayload: { question, route, evidence },
      responseSchema: schema
    });

    return sendJson(res, 200, {
      ok: true,
      answerEngineVersion: ANSWER_ENGINE_VERSION,
      ...result
    });
  } catch (error) {
    console.error('[MAGI answer fixture]', error?.message || error);
    return sendJson(res, 500, { error: 'Answer fixture execution failed' });
  }
}
