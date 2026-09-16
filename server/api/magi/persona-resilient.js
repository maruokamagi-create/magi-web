import magiPersona from './persona.js';

function parseJson(text) {
  try { return JSON.parse(String(text || '')); }
  catch { return null; }
}

function createCaptureResponse() {
  const headers = new Map();
  const capture = {
    statusCode: 200,
    headersSent: false,
    body: '',
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), { name: String(name), value });
      return this;
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase())?.value;
    },
    removeHeader(name) {
      headers.delete(String(name).toLowerCase());
    },
    end(chunk = '') {
      if (chunk !== undefined && chunk !== null) {
        this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      }
      this.headersSent = true;
      return this;
    },
    headerEntries() {
      return [...headers.values()];
    }
  };
  return capture;
}

function replayCaptured(res, capture, bodyOverride = null) {
  res.statusCode = Number(capture.statusCode || 200);
  for (const { name, value } of capture.headerEntries()) {
    try { res.setHeader(name, value); } catch {}
  }
  return res.end(bodyOverride === null ? (capture.body || '') : JSON.stringify(bodyOverride));
}

function isTransientPersonaFailure(capture) {
  if (Number(capture?.statusCode) !== 503) return false;
  const payload = parseJson(capture?.body);
  return payload?.code === 'PERSONA_GENERATION_FAILED' || payload?.retryExhausted === true;
}

function safePrimaryClone(primarySelf) {
  if (!primarySelf || typeof primarySelf !== 'object' || Array.isArray(primarySelf)) return null;
  try { return JSON.parse(JSON.stringify(primarySelf)); }
  catch { return null; }
}

function isGenericCurrentLineup(body) {
  const q = String(body?.case?.question || '').normalize('NFKC');
  const lineup = /ベストオーダー|打順|オーダー|打線/.test(q) || String(body?.case?.selectionKind || '').toUpperCase() === 'FULL_LINEUP';
  const futureAsked = /将来|半年後|来年|来季|育成|成長|長期/.test(q);
  return lineup && !futureAsked;
}

function splitSentences(value) {
  return String(value || '').split(/(?<=[。！？!?])/).map(s => s.trim()).filter(Boolean);
}

function joinSentences(parts) {
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function sanitizeLineupPersona(body, payload) {
  if (!payload || typeof payload !== 'object' || !isGenericCurrentLineup(body)) return payload;
  const evidenceText = JSON.stringify(body?.case?.evidence || {});
  const hasConfirmedCaptain = /(?:キャプテン|主将)(?!候補)/.test(evidenceText);
  const hasMentalLeadership = /精神的(?:な)?(?:柱|支柱)|精神面|メンタル|士気|まとめ役|リーダーシップ|牽引力/.test(evidenceText);

  const forbiddenSentence = sentence => {
    const s = String(sentence || '');
    if (!hasConfirmedCaptain && /(?:キャプテン|主将|副主将)(?:として|の|を|に|で)/.test(s)) return true;
    if (!hasMentalLeadership && /精神的(?:な)?(?:柱|支柱|まとまり)|精神面の柱|チームの精神的|士気を|まとめ役|リーダーシップ/.test(s)) return true;
    if (/(?:半年後|来年|来季|将来|今後の成長|成長につなが|育成につなが)/.test(s)) return true;
    return false;
  };

  const cleanText = value => joinSentences(splitSentences(value).filter(s => !forbiddenSentence(s)));
  const cleanArray = value => Array.isArray(value)
    ? value.map(cleanText).filter(Boolean)
    : [];

  const out = {
    ...payload,
    candidateBasis: cleanText(payload.candidateBasis),
    facts: cleanArray(payload.facts),
    analysis: cleanArray(payload.analysis),
    prediction: cleanArray(payload.prediction),
    primaryReason: cleanText(payload.primaryReason),
    publicStatement: cleanText(payload.publicStatement),
    warnings: cleanArray(payload.warnings),
    reviewReason: cleanText(payload.reviewReason),
    changeReason: cleanText(payload.changeReason)
  };

  const order = Array.isArray(out.candidatePlayers) ? out.candidatePlayers.map(v => String(v || '').trim()).filter(Boolean) : [];
  const orderText = order.length === 9 ? order.map((name, index) => `${index + 1}番${name}`).join('、') : '';
  if (!out.candidateBasis) out.candidateBasis = '現在確認できる記録と打線のつながりを基準に、この順番を選びました。';
  if (!out.primaryReason) out.primaryReason = '現在確認できる記録を基準に、現時点の打順として判断しました。';
  if (!out.publicStatement) out.publicStatement = orderText
    ? `${orderText} の順です。現在確認できる記録を基準に判断しました。`
    : '現在確認できる記録を基準に判断しました。';
  return out;
}

export function buildSecondFallback(body) {
  if (String(body?.phase || '').toUpperCase() !== 'SECOND') return null;
  const primary = safePrimaryClone(body?.primarySelf);
  if (!primary) return null;

  const checkedPlayers = Array.isArray(primary.checkedPlayers) ? primary.checkedPlayers : [];
  const candidatePlayers = Array.isArray(primary.candidatePlayers) ? primary.candidatePlayers : [];
  if (!checkedPlayers.length && !candidatePlayers.length && !String(primary.publicStatement || '').trim()) return null;

  const notice = '相互検証後の二次判定で一時的な通信障害が発生したため、この賢人は一次判断を暫定維持しています。';
  const originalStatement = String(primary.publicStatement || '').trim();
  const originalReason = String(primary.primaryReason || '').trim();

  return sanitizeLineupPersona(body, {
    ...primary,
    phase: 'SECOND',
    confidence: 'LOW',
    changedFromPrimary: false,
    changeReason: '',
    primaryReason: originalReason ? `${originalReason} ${notice}` : notice,
    publicStatement: originalStatement ? `${notice} ${originalStatement}` : notice,
    warnings: [...new Set([...(Array.isArray(primary.warnings) ? primary.warnings : []), notice])],
    secondFallbackUsed: true,
    secondFallbackReason: 'TRANSIENT_PERSONA_FAILURE'
  });
}

export function sanitizeSuccessfulPersona(body, payload) {
  return sanitizeLineupPersona(body, payload);
}

export default async function handler(req, res) {
  const capture = createCaptureResponse();
  await magiPersona(req, capture);

  if (isTransientPersonaFailure(capture)) {
    const fallback = buildSecondFallback(req?.body);
    if (fallback) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-MAGI-Persona-Fallback', 'second-primary-maintained');
      return res.end(JSON.stringify(fallback));
    }
  }

  if (Number(capture.statusCode) >= 200 && Number(capture.statusCode) < 300) {
    const payload = parseJson(capture.body);
    if (payload && typeof payload === 'object') {
      return replayCaptured(res, capture, sanitizeSuccessfulPersona(req?.body, payload));
    }
  }

  return replayCaptured(res, capture);
}
