// MAGI v1 server-only Gemini REST helper.
// GEMINI_API_KEY is required. GEMINI_MODEL is optional; a vetted default is used.
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_LAST_RESORT_MODEL = 'gemini-3.6-flash';
const MAX_BODY_BYTES = 220_000;
const GEMINI_TIMEOUT_MS = 30_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 18;
const buckets = new Map();

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isModelUnavailableMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('no longer available') || text.includes('not found') || text.includes('unsupported') || text.includes('not available to new users');
}

function isTransientOutputMessage(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('returned no text') || text.includes('invalid structured json');
}

function isRetryableError(error) {
  return error?.retryable === true || error?.message === 'Gemini request timed out' || isTransientOutputMessage(error?.message);
}

function shouldTryNextModel(error) {
  return isRetryableError(error) || isModelUnavailableMessage(error?.message);
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
    return { ok: true, model, displayName: data?.displayName || model };
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
          maxOutputTokens: 2400
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini API error ${response.status}`;
      const err = new Error(message);
      err.status = response.status;
      err.retryable = isRetryableStatus(response.status);
      throw err;
    }

    const text = extractText(data);
    if (!text) {
      const err = new Error('Gemini returned no text');
      err.retryable = true;
      throw err;
    }
    try { return JSON.parse(text); }
    catch {
      const err = new Error('Gemini returned invalid structured JSON');
      err.retryable = true;
      throw err;
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Gemini request timed out');
      err.retryable = true;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function tryModel({ model, apiKey, systemInstruction, userPayload, responseSchema, retries }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await callGeminiModel({ model, apiKey, systemInstruction, userPayload, responseSchema });
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === retries) break;
      await sleep(700 + Math.floor(Math.random() * 500));
    }
  }
  throw lastError;
}

export async function callGemini({ systemInstruction, userPayload, responseSchema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const models = [
    getGeminiModel(),
    getGeminiFallbackModel(),
    getGeminiLastResortModel()
  ].filter((model, index, arr) => model && arr.indexOf(model) === index);

  let lastError;
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    try {
      return await tryModel({
        model,
        apiKey,
        systemInstruction,
        userPayload,
        responseSchema,
        retries: index === 0 ? 1 : 0
      });
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) break;
      console.warn(`[MAGI Gemini] ${model} unavailable, trying fallback: ${error?.message || error}`);
    }
  }

  throw lastError || new Error('Gemini request failed');
}
