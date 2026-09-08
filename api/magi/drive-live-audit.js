import { requireApprovedMember } from '../drive/_access.js';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { requirePost, requireSameOrigin, rateLimit, sendJson } from './_gemini.js';

const TARGET_NAME = '丸岡中軟式野球部_通算成績一覧2026-2027.pdf';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();

const schema = {
  type: 'OBJECT',
  properties: {
    periodStart: { type: 'STRING' },
    periodEnd: { type: 'STRING' },
    team: {
      type: 'OBJECT',
      properties: {
        games: { type: 'INTEGER' },
        wins: { type: 'INTEGER' },
        draws: { type: 'INTEGER' },
        losses: { type: 'INTEGER' },
        OPS: { type: 'STRING' }
      },
      required: ['games','wins','draws','losses','OPS']
    },
    players: {
      type: 'OBJECT',
      properties: {
        okuboHaruto: {
          type: 'OBJECT', properties: { AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS']
        },
        onoTatsuki: {
          type: 'OBJECT', properties: { AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS']
        },
        nakajimaRei: {
          type: 'OBJECT', properties: { AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS']
        }
      },
      required: ['okuboHaruto','onoTatsuki','nakajimaRei']
    }
  },
  required: ['periodStart','periodEnd','team','players']
};

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('').trim();
}

async function extractFromPdf(buffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const prompt = `このPDFだけを根拠に、指定した成績を厳密に抽出してください。\n
対象は丸岡中学校軟式野球部の2026-2027新チーム成績です。\n
ルール:\n- 推測しない。\n- PDFにある集計期間の開始日と終了日を西暦YYYY-MM-DDに直す。令和8年=2026年。\n- チーム成績から試合数、勝ち、引き分け、負け、チームOPSを取る。\n- 打撃部門から以下3選手の打率AVGとOPSを取る。\n  大久保 陽翔 / 大野 竜暉 / 中嶋 玲月\n- 小数はPDFに記載された値を文字列で返す。`.trim();

  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role:'user', parts:[
        { text: prompt },
        { inlineData: { mimeType:'application/pdf', data: buffer.toString('base64') } }
      ]}],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0,
        topP: 1,
        maxOutputTokens: 1200
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini API error ${response.status}`);
  const text = extractText(data);
  if (!text) throw new Error('Gemini returned no text');
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  const member = await requireApprovedMember(req, res);
  if (!member) return;
  try {
    const tree = await listMagiDriveTree({ fresh: true });
    const candidates = tree.filter(f => f?.name === TARGET_NAME && f?.mimeType === 'application/pdf');
    if (candidates.length !== 1) {
      return sendJson(res, 409, { ok:false, error:`対象PDFを一意に特定できませんでした (${candidates.length})` });
    }
    const file = candidates[0];
    const fetched = await fetchDriveFileContent(file);
    const extracted = await extractFromPdf(fetched.buffer);
    return sendJson(res, 200, {
      ok: true,
      live: true,
      source: { id:file.id, name:file.name, path:file.path, modifiedTime:file.modifiedTime, size:file.size || fetched.buffer.length },
      model: MODEL,
      extracted
    });
  } catch (error) {
    console.error('[MAGI Drive live audit]', error?.message || error);
    return sendJson(res, 502, { ok:false, error:error?.message || 'live_drive_audit_failed' });
  }
}
