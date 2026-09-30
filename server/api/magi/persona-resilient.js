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

export function markSecondTransientRetryable(body, payload) {
  if (String(body?.phase || '').toUpperCase() !== 'SECOND') return payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  return {
    ...payload,
    retryExhausted: false,
    retryFreshRequest: true,
    retryScope: 'SECOND_REQUEST'
  };
}

export function sanitizeSuccessfulPersona(body, payload) {
  return sanitizeLineupPersona(body, payload);
}

export default async function handler(req, res) {
  const capture = createCaptureResponse();
  await magiPersona(req, capture);

  // Keep transient SECOND failures honest (HTTP 503), but allow the browser's
  // bounded phase retry to issue a fresh SECOND request before restarting the
  // whole deliberation. No synthetic "primary maintained" judgment is created.
  if (isTransientPersonaFailure(capture)) {
    const payload = parseJson(capture.body);
    const retryPayload = markSecondTransientRetryable(req?.body, payload);
    const isSecond = String(req?.body?.phase || '').toUpperCase() === 'SECOND';
    res.setHeader('X-MAGI-Persona-Recovery', isSecond ? 'retry-second-request' : 'whole-deliberation-retry-required');
    return replayCaptured(res, capture, retryPayload && typeof retryPayload === 'object' ? retryPayload : null);
  }

  if (Number(capture.statusCode) >= 200 && Number(capture.statusCode) < 300) {
    const payload = parseJson(capture.body);
    if (payload && typeof payload === 'object') {
      return replayCaptured(res, capture, sanitizeSuccessfulPersona(req?.body, payload));
    }
  }

  return replayCaptured(res, capture);
}
