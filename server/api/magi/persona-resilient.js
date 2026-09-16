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

function replayCaptured(res, capture) {
  res.statusCode = Number(capture.statusCode || 200);
  for (const { name, value } of capture.headerEntries()) {
    try { res.setHeader(name, value); } catch {}
  }
  return res.end(capture.body || '');
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

  return {
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
  };
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

  return replayCaptured(res, capture);
}
