import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const TARGET_NAME = '丸岡中軟式野球部_通算成績一覧2026-2027.pdf';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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
        okuboHaruto: { type:'OBJECT', properties:{ AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS'] },
        onoTatsuki: { type:'OBJECT', properties:{ AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS'] },
        nakajimaRei: { type:'OBJECT', properties:{ AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS'] }
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
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const prompt = `このPDFだけを根拠に、指定した成績を厳密に抽出してください。
対象は丸岡中学校軟式野球部の2026-2027新チーム成績です。
ルール:
- 推測しない。
- PDFにある集計期間の開始日と終了日を西暦YYYY-MM-DDに直す。令和8年=2026年。
- チーム成績から試合数、勝ち、引き分け、負け、チームOPSを取る。
- 打撃部門から大久保 陽翔・大野 竜暉・中嶋 玲月のAVGとOPSを取る。
- 小数はPDF記載値を文字列で返す。`;

  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({
      contents:[{role:'user',parts:[{text:prompt},{inlineData:{mimeType:'application/pdf',data:buffer.toString('base64')}}]}],
      generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:0,topP:1,maxOutputTokens:1200}
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini API error ${response.status}`);
  const text = extractText(data);
  if (!text) throw new Error('Gemini returned no text');
  return { model, extracted: JSON.parse(text) };
}

export async function runDriveLiveAudit() {
  const tree = await listMagiDriveTree({ fresh:true });
  const candidates = tree.filter(f => f?.name === TARGET_NAME && f?.mimeType === 'application/pdf');
  if (candidates.length !== 1) throw new Error(`対象PDFを一意に特定できませんでした (${candidates.length})`);
  const file = candidates[0];
  const fetched = await fetchDriveFileContent(file);
  const parsed = await extractFromPdf(fetched.buffer);
  return {
    live:true,
    source:{id:file.id,name:file.name,path:file.path,modifiedTime:file.modifiedTime,size:file.size || fetched.buffer.length},
    model:parsed.model,
    extracted:parsed.extracted
  };
}
