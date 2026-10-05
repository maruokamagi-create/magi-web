// MAGI v1 server-only Gemini REST helper.
// GEMINI_API_KEY is required. GEMINI_MODEL is optional; a vetted default is used.
import { buildCanonicalKey, canonicalFingerprint, readCanonicalResult, writeCanonicalResult } from './_canonical-cache.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash';
const DEFAULT_LAST_RESORT_MODEL = 'gemini-3.6-flash';
// FULL_LINEUP SECOND requests contain the validated CASE evidence plus the
// persona's primary judgment and cross-examination context. The same evidence
// already fits the PRIMARY request, so allow bounded headroom for those extra
// structured fields instead of rejecting the SECOND request at the gateway.
const MAX_BODY_BYTES = 512_000;
// Keep every Gemini call bounded. A persona endpoint can perform deterministic
// correction passes, so retrying the same model inside every pass can multiply
// latency beyond the serverless execution window. One model attempt per pass is
// intentional; canonical mode may still move to a fallback model when allowed.
const GEMINI_TIMEOUT_MS = 20_000;
const RATE_WINDOW_MS = 60_000;
// A complete MAGI deliberation uses multiple persona/cross/final requests and
// the browser may retry the whole run once after a transient failure. 60 keeps
// per-IP abuse bounded while allowing a legitimate full deliberation plus
// bounded persona/model recovery without self-triggering HTTP 429.
const RATE_MAX = 60;
const buckets = new Map();

const CONSISTENCY_LOCK = String(process.env.MAGI_CONSISTENCY_LOCK || 'off').trim().toLowerCase();

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.end(JSON.stringify(body));
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function requireSameOrigin(req, res) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const origin = String(req.headers?.origin || '').trim();
  const referer = String(req.headers?.referer || '').trim();
  const candidate = origin || referer;
  if (!candidate || !host) {
    sendJson(res, 403, { error: 'Same-origin request required' });
    return false;
  }
  try {
    const u = new URL(candidate);
    if (u.host.toLowerCase() !== host) {
      sendJson(res, 403, { error: 'Cross-origin request rejected' });
      return false;
    }
    return true;
  } catch {
    sendJson(res, 403, { error: 'Invalid request origin' });
    return false;
  }
}

function clientKey(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export function rateLimit(req, res) {
  const now = Date.now();
  const key = clientKey(req);
  const prior = buckets.get(key);
  const bucket = !prior || now - prior.start >= RATE_WINDOW_MS ? { start: now, count: 0 } : prior;
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > RATE_MAX) {
    res.setHeader('Retry-After', String(Math.ceil((RATE_WINDOW_MS - (now - bucket.start)) / 1000)));
    sendJson(res, 429, { error: 'Too many requests' });
    return false;
  }
  if (buckets.size > 1000) {
    for (const [k,v] of buckets) if (now - v.start >= RATE_WINDOW_MS) buckets.delete(k);
  }
  return true;
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    const estimated = Buffer.byteLength(JSON.stringify(req.body), 'utf8');
    if (estimated > MAX_BODY_BYTES) return Promise.reject(new Error('Request body too large'));
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    let done = false;
    const fail = err => { if (!done) { done = true; reject(err); } };
    req.on('data', chunk => {
      if (done) return;
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) fail(new Error('Request body too large'));
    });
    req.on('end', () => {
      if (done) return;
      try { done = true; resolve(raw ? JSON.parse(raw) : {}); }
      catch { fail(new Error('Invalid JSON body')); }
    });
    req.on('error', fail);
  });
}

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part?.text || '')
    .join('')
    .trim();
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function safeProviderQuotaDiagnostic(data) {
  const details = Array.isArray(data?.error?.details) ? data.error.details : [];
  const quotaFailure = details.find(row => String(row?.['@type'] || '').includes('QuotaFailure'));
  const violation = Array.isArray(quotaFailure?.violations) ? quotaFailure.violations[0] : null;
  const retryInfo = details.find(row => String(row?.['@type'] || '').includes('RetryInfo'));
  const quotaMetricRaw = String(violation?.quotaMetric || '');
  const quotaId = String(violation?.quotaId || '');
  const dimensions = violation?.quotaDimensions && typeof violation.quotaDimensions === 'object' ? violation.quotaDimensions : {};
  const model = String(dimensions.model || '');
  const location = String(dimensions.location || '');
  const retryDelay = String(retryInfo?.retryDelay || '');
  const providerStatus = String(data?.error?.status || '');
  const quotaMetric = quotaMetricRaw ? quotaMetricRaw.split('/').pop() : '';
  const joined = `${quotaId} ${quotaMetric}`.toLowerCase();
  const quotaWindow = /perday|requestsperday|tokensperday|daily/.test(joined) ? 'DAY'
    : /perminute|requestsperminute|tokensperminute|minute/.test(joined) ? 'MINUTE'
    : /persecond|second/.test(joined) ? 'SECOND' : 'UNKNOWN';
  const quotaScope = /permodel|model/.test(joined) || Boolean(model) ? 'MODEL' : 'PROJECT';
  return { providerStatus, quotaMetric, quotaId, model, location, retryDelay, quotaWindow, quotaScope };
}


function isModelUnavailableMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('no longer available') || text.includes('not found') || text.includes('unsupported') || text.includes('not available to new users');
}

function canFallback(error) {
  if (!error) return false;
  return error?.timedOut === true || isModelUnavailableMessage(error?.message) || error?.retryable === true;
}

export function getGeminiModel() {
  return String(process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
}

export function getGeminiFallbackModel() {
  return String(process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL).trim();
}

export function getGeminiLastResortModel() {
  return String(process.env.GEMINI_LAST_RESORT_MODEL || DEFAULT_LAST_RESORT_MODEL).trim();
}

export function getConsistencyMode() {
  return CONSISTENCY_LOCK === 'strict' ? 'strict' : 'canonical';
}

export async function checkGeminiConfiguration() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = getGeminiModel();
  if (!apiKey) return { ok: false, model, reason: 'GEMINI_API_KEY is not configured' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, model, reason: data?.error?.message || `Gemini model check failed (${response.status})` };
    return { ok: true, model, displayName: data?.displayName || model, consistencyMode: getConsistencyMode(), canonicalCache: true };
  } catch (error) {
    return { ok: false, model, reason: error?.name === 'AbortError' ? 'Gemini model check timed out' : (error?.message || 'Gemini model check failed') };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiModel({ model, apiKey, systemInstruction, userPayload, responseSchema }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(userPayload) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          maxOutputTokens: 2400,
          temperature: 0,
          topP: 1
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini API error ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.retryable = isRetryableStatus(response.status);
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
        err.retryAfterSeconds = Math.min(60, Math.ceil(retryAfter));
      }
      err.failureClass = response.status === 429 ? 'provider_rate_limit'
        : isModelUnavailableMessage(message) ? 'model_unavailable'
        : isRetryableStatus(response.status) ? 'provider_retryable_http'
        : 'provider_http';
      if (response.status === 429) err.providerDiagnostic = safeProviderQuotaDiagnostic(data);
      throw err;
    }

    const text = extractText(data);
    if (!text) {
      const err = new Error('Gemini returned no text');
      err.retryable = true;
      err.failureClass = 'empty_text';
      throw err;
    }
    try { return JSON.parse(text); }
    catch {
      const err = new Error('Gemini returned invalid structured JSON');
      err.retryable = true;
      err.failureClass = 'invalid_structured_json';
      throw err;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Gemini request timed out');
      err.timedOut = true;
      err.retryable = true;
      err.failureClass = 'timeout';
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function tryModel({ model, apiKey, systemInstruction, userPayload, responseSchema }) {
  return callGeminiModel({ model, apiKey, systemInstruction, userPayload, responseSchema });
}

async function getOrCreateCanonicalResult({ model, apiKey, systemInstruction, userPayload, responseSchema }) {
  const key = buildCanonicalKey({ model, systemInstruction, userPayload, responseSchema });
  const fingerprint = canonicalFingerprint(key);
  const cached = await readCanonicalResult(key);
  if (cached !== null) {
    console.info(`[MAGI CANONICAL CACHE] HIT ${fingerprint}`);
    return cached;
  }

  console.info(`[MAGI CANONICAL CACHE] MISS ${fingerprint} model=${model}`);
  const result = await tryModel({ model, apiKey, systemInstruction, userPayload, responseSchema });
  const stored = await writeCanonicalResult(key, result);
  console.info(`[MAGI CANONICAL CACHE] ${stored ? 'STORED' : 'STORE-SKIPPED'} ${fingerprint} model=${model}`);
  return result;
}

export async function callGemini({ systemInstruction, userPayload, responseSchema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const strict = getConsistencyMode() === 'strict';
  const models = strict
    ? [getGeminiModel()]
    : [getGeminiModel(), getGeminiFallbackModel(), getGeminiLastResortModel()]
        .filter((model, index, arr) => model && arr.indexOf(model) === index);

  let lastError;
  const failureTrail = [];
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    try {
      return await getOrCreateCanonicalResult({
        model,
        apiKey,
        systemInstruction,
        userPayload,
        responseSchema
      });
    } catch (error) {
      lastError = error;
      failureTrail.push({
        slot: index === 0 ? 'primary' : (index === 1 ? 'fallback' : 'last_resort'),
        failureClass: String(error?.failureClass || (error?.timedOut ? 'timeout' : 'other'))
      });
      const providerRateLimited = Number(error?.status) === 429 || error?.failureClass === 'provider_rate_limit';
      if (providerRateLimited) {
        // Gemini quota metadata can distinguish a project-wide limit from a
        // per-model FreeTier limit. Only a MODEL-scoped limit is safe to route
        // to the next distinct configured model; PROJECT-scoped limits still
        // fail fast so we do not multiply requests against the same quota.
        const modelScoped = String(error?.providerDiagnostic?.quotaScope || '') === 'MODEL';
        if (strict || !modelScoped || index === models.length - 1) break;
        console.warn(`[MAGI Gemini] ${model} model-scoped quota exhausted; trying configured fallback ${models[index + 1]}`);
        continue;
      }
      if (strict || !canFallback(error) || index === models.length - 1) break;
      console.warn(`[MAGI Gemini] ${model} failed, trying fallback ${models[index + 1]}: ${error?.message || error}`);
    }
  }

  if (strict && lastError) {
    console.warn(`[MAGI CONSISTENCY LOCK] Primary model failed; fallback suppressed: ${lastError?.message || lastError}`);
  }
  const finalError = lastError || new Error('Gemini request failed');
  if (!finalError.failureClass) finalError.failureClass = 'other';
  finalError.failureTrail = failureTrail;
  throw finalError;
}
