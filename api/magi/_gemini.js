// MAGI v1 server-only Gemini REST helper.
// GEMINI_API_KEY and GEMINI_MODEL must be configured as server environment variables.
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(part => part?.text || '')
    .join('')
    .trim();
}

export async function callGemini({ systemInstruction, userPayload, responseSchema }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  if (!model) throw new Error('GEMINI_MODEL is not configured');

  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(userPayload) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini API error ${response.status}`;
    throw new Error(message);
  }

  const text = extractText(data);
  if (!text) throw new Error('Gemini returned no text');
  try { return JSON.parse(text); }
  catch { throw new Error('Gemini returned invalid structured JSON'); }
}
