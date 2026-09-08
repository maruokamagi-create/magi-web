import { callGemini } from './_gemini.js';

const recoverySchema = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['KEEP_CLARIFY', 'RESOLVE_DELIBERATION'] },
    confidence: { type: 'STRING', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    reason: { type: 'STRING' }
  },
  required: ['verdict', 'confidence', 'reason']
};

function clean(value, max = 700) {
  return String(value ?? '').trim().slice(0, max);
}

export async function recoverContextBoundDeliberation(questionValue, contextValue, routedValue) {
  const question = clean(questionValue, 4000);
  const context = Array.isArray(contextValue) ? contextValue.slice(-12) : [];
  const routed = routedValue && typeof routedValue === 'object' ? routedValue : null;

  // This stage only reviews a high-confidence CLARIFY that arose inside an existing conversation.
  // It never broadens an already executable route, and it never invents a player identity.
  if (!question || !routed || routed.route !== 'CLARIFY' || routed.confidence !== 'HIGH' || !context.length) return routedValue;
  if (!Array.isArray(routed.players) || routed.players.length !== 1) return routedValue;
  if (Array.isArray(routed.unresolvedEntities) && routed.unresolvedEntities.length) return routedValue;

  const audit = await callGemini({
    systemInstruction: `あなたは《MAGI》会話ルーターの二次監査役。回答そのものは作らず、現在のCLARIFY（聞き返し）が本当に必要かだけを判定する。

最重要原則:
- ユーザーの「質問の意味」が確定しているなら、証拠やデータが十分かどうかを理由に聞き返してはいけない。証拠不足は後段の審議が評価する問題であり、質問理解ルーターの曖昧さではない。
- 直前の会話で数値・資料・比較結果などが一意に確定しており、最新発言が「それを見て判断して」「その数字で決めて」等、その既存情報を根拠として起用・打順・戦術などの判断を明確に依頼しているなら RESOLVE_DELIBERATION。
- ユーザーが明示的に既存情報だけを基準に判断してほしいと述べている場合、期間・追加資料・別の指標を勝手に要求してはいけない。必要なら後段の審議が「この根拠だけでは不十分」と結論できる。
- ただし、誰についてか、何を判断するのか、「それ」が何を指すのかが複数解釈できる場合は KEEP_CLARIFY。
- 選手名は firstClassification.players の1名から変更しない。別人を推測しない。
- 単なる事実照会は RESOLVE_DELIBERATION にしない。
- 少しでも質問目的が曖昧なら KEEP_CLARIFY。
`,
    userPayload: {
      question,
      suppliedContext: context,
      firstClassification: {
        route: routed.route,
        confidence: routed.confidence,
        understoodRequest: routed.understoodRequest,
        routeReason: routed.routeReason,
        players: routed.players,
        domains: routed.domains,
        timeScope: routed.timeScope,
        clarificationQuestion: routed.clarificationQuestion,
        ambiguities: routed.ambiguities,
        validationIssues: routed.validationIssues
      }
    },
    responseSchema: recoverySchema
  });

  const verdict = String(audit?.verdict || 'KEEP_CLARIFY').toUpperCase();
  const confidence = String(audit?.confidence || 'LOW').toUpperCase();
  if (verdict !== 'RESOLVE_DELIBERATION' || confidence !== 'HIGH') {
    return {
      ...routed,
      conversationRecoveryApplied: true,
      conversationRecoveryVerdict: verdict,
      conversationRecoveryReason: clean(audit?.reason)
    };
  }

  return {
    ...routed,
    modelRoute: 'DELIBERATION',
    route: 'DELIBERATION',
    confidence: 'HIGH',
    needsClarification: false,
    clarificationQuestion: '',
    needsDeliberation: true,
    safetyStatus: 'READY',
    safeToExecute: true,
    validationIssues: [],
    conversationRecoveryApplied: true,
    conversationRecoveryVerdict: verdict,
    conversationRecoveryReason: clean(audit?.reason),
    routeReason: clean(audit?.reason) || routed.routeReason
  };
}
