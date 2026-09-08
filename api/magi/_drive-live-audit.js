import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const STATS_TOKEN = '03_STATS_成績データ';
const MASTER_TOKEN = '00_MASTER_正本';

const SEASONS = {
  current: {
    key: 'current',
    label: '2026-2027現チーム',
    token: '2026-2027_CURRENT_現チーム',
    periodStart: '2026-08-02',
    players: ['大久保 陽翔', '大野 竜暉', '中嶋 玲月']
  },
  old: {
    key: 'old',
    label: '2025-2026旧チーム',
    token: '2025-2026_ARCHIVE_旧チーム',
    periodStart: null,
    players: ['大久保 陽翔', '大野 竜暉']
  }
};

const currentSchema = {
  type: 'OBJECT',
  properties: {
    periodStart: { type: 'STRING' },
    periodEnd: { type: 'STRING' },
    team: {
      type: 'OBJECT',
      properties: {
        games: { type: 'INTEGER' }, wins: { type: 'INTEGER' }, draws: { type: 'INTEGER' }, losses: { type: 'INTEGER' }, OPS: { type: 'STRING' }
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

const oldSchema = {
  type: 'OBJECT',
  properties: {
    periodStart: { type: 'STRING' },
    periodEnd: { type: 'STRING' },
    team: {
      type: 'OBJECT',
      properties: {
        games: { type: 'INTEGER' }, wins: { type: 'INTEGER' }, draws: { type: 'INTEGER' }, losses: { type: 'INTEGER' }, OPS: { type: 'STRING' }
      },
      required: ['games','wins','draws','losses','OPS']
    },
    players: {
      type: 'OBJECT',
      properties: {
        okuboHaruto: { type:'OBJECT', properties:{ AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS'] },
        onoTatsuki: { type:'OBJECT', properties:{ AVG:{type:'STRING'}, OPS:{type:'STRING'} }, required:['AVG','OPS'] }
      },
      required: ['okuboHaruto','onoTatsuki']
    }
  },
  required: ['periodStart','periodEnd','team','players']
};

function extractText(data) {
  return (data?.candidates?.[0]?.content?.parts || []).map(p => p?.text || '').join('').trim();
}

function resolveSeason(value) {
  const key = String(value || 'current').toLowerCase();
  return key === 'old' || key === '2025-2026' ? SEASONS.old : SEASONS.current;
}

function isAuthoritativeXlsm(file, season) {
  const name = String(file?.name || '');
  const path = String(file?.path || '');
  return /\.xlsm$/i.test(name) && path.includes(season.token) && path.includes(STATS_TOKEN) && path.includes(MASTER_TOKEN);
}

function workbookEvidence(buffer, season) {
  const workbook = XLSX.read(buffer, { type:'buffer', cellFormula:true, cellText:true, cellDates:false });
  const needles = [
    'チーム成績','試合数','勝ち','引き分け','負け','OPS','打率','打撃部門',
    ...season.players,
    season.key === 'current' ? 'R8.' : 'R7.',
    season.key === 'current' ? '令和8' : '令和7',
    season.key === 'current' ? '2026' : '2025'
  ];
  const blocks = [];
  const usedSheets = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header:1, raw:false, defval:'' });
    const lines = rows.map((row, index) => ({
      index,
      text: (Array.isArray(row) ? row : []).map(v => String(v ?? '').trim()).join('\t')
    }));
    const picked = new Set();
    for (const line of lines) {
      if (!line.text || !needles.some(k => line.text.includes(k))) continue;
      for (let i = Math.max(0, line.index - 3); i <= Math.min(lines.length - 1, line.index + 3); i++) picked.add(i);
    }
    if (!picked.size) continue;
    usedSheets.push(sheetName);
    const excerpt = [...picked].sort((a,b)=>a-b).map(i => `${i + 1}\t${lines[i].text}`).join('\n');
    blocks.push(`### SHEET: ${sheetName}\n${excerpt}`);
  }

  if (!blocks.length) throw new Error(`${season.label} XLSM内から成績対象セルを抽出できませんでした`);
  const text = blocks.join('\n\n');
  return { text: text.slice(0, 180000), usedSheets };
}

async function extractFromXlsm(buffer, season) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const workbook = workbookEvidence(buffer, season);
  const currentRule = season.periodStart
    ? `- 今期 = ${season.periodStart}以降の2026-2027新チーム成績。periodStartは必ず ${season.periodStart}。`
    : '- これは2025-2026旧チームの通算正本。集計期間の開始日と終了日はXLSM記載値を使う。';
  const playerRule = season.key === 'current'
    ? '- 打撃成績から大久保 陽翔・大野 竜暉・中嶋 玲月のAVGとOPSを取る。'
    : '- 打撃成績から大久保 陽翔・大野 竜暉のAVGとOPSを取る。';
  const prompt = `以下はGoogle Drive上の正式XLSM正本から直接読み取ったセル文字列です。これだけを根拠に指定成績を厳密に抽出してください。\n\n対象: ${season.label}\n正式ルール:\n${currentRule}\n- PDFや画像は根拠にしない。XLSM正本のみ。\n- 推測しない。根拠のない数字を作らない。\n- チーム成績から試合数、勝ち、引き分け、負け、チームOPSを取る。\n${playerRule}\n- 小数は表示上 .912 のように返し、不要な0を先頭に付けない。\n\nXLSMセル抜粋:\n${workbook.text}`;

  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({
      contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{responseMimeType:'application/json',responseSchema:season.key === 'current' ? currentSchema : oldSchema,temperature:0,topP:1,maxOutputTokens:1200}
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini API error ${response.status}`);
  const text = extractText(data);
  if (!text) throw new Error('Gemini returned no text');
  const extracted = JSON.parse(text);
  if (season.periodStart) extracted.periodStart = season.periodStart;
  return { model, extracted, usedSheets: workbook.usedSheets };
}

export async function runDriveLiveAudit({ season: seasonValue = 'current' } = {}) {
  const season = resolveSeason(seasonValue);
  const tree = await listMagiDriveTree({ fresh:true });
  const candidates = tree.filter(file => isAuthoritativeXlsm(file, season));
  if (candidates.length !== 1) {
    const nearby = tree.filter(f => /\.xlsm$/i.test(String(f?.name || '')) && String(f?.path || '').includes(season.token));
    const names = nearby.slice(0, 8).map(f => f.path).join(' | ');
    throw new Error(`${season.label}の00_MASTER_正本XLSMを一意に特定できませんでした (${candidates.length})${names ? ` / XLSM候補: ${names}` : ''}`);
  }

  const file = candidates[0];
  const fetched = await fetchDriveFileContent(file);
  const parsed = await extractFromXlsm(fetched.buffer, season);
  return {
    live:true,
    season:season.key,
    seasonLabel:season.label,
    sourceType:'XLSM_MASTER',
    source:{id:file.id,name:file.name,path:file.path,modifiedTime:file.modifiedTime,size:file.size || fetched.buffer.length},
    usedSheets:parsed.usedSheets,
    model:parsed.model,
    extracted:parsed.extracted
  };
}
