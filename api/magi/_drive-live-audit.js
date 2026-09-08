import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const STATS_TOKEN = '03_STATS_成績データ';
const MASTER_TOKEN = '00_MASTER_正本';

const SEASONS = {
  current: {
    key: 'current',
    label: '2026-2027現チーム',
    token: '2026-2027_CURRENT_現チーム',
    periodStart: '2026-08-02',
    players: [
      { name:'大久保 陽翔', key:'okuboHaruto' },
      { name:'大野 竜暉', key:'onoTatsuki' },
      { name:'中嶋 玲月', key:'nakajimaRei' }
    ]
  },
  old: {
    key: 'old',
    label: '2025-2026旧チーム',
    token: '2025-2026_ARCHIVE_旧チーム',
    periodStart: null,
    players: [
      { name:'大久保 陽翔', key:'okuboHaruto' },
      { name:'大野 竜暉', key:'onoTatsuki' }
    ]
  }
};

function resolveSeason(value) {
  const key = String(value || 'current').toLowerCase();
  return key === 'old' || key === '2025-2026' ? SEASONS.old : SEASONS.current;
}

function isAuthoritativeXlsm(file, season) {
  const name = String(file?.name || '');
  const path = String(file?.path || '');
  return /\.xlsm$/i.test(name) && path.includes(season.token) && path.includes(STATS_TOKEN) && path.includes(MASTER_TOKEN);
}

function norm(value) {
  return String(value ?? '').replace(/[\s　]+/g, '').trim();
}

function displayDecimal(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const n = Number(s.replace(/,/g,''));
  if (!Number.isFinite(n)) return s;
  if (Math.abs(n) < 1 && n !== 0) {
    const rendered = n.toFixed(3).replace(/^0/, '').replace(/-0\./, '-.');
    return rendered.replace(/0+$/,'').replace(/\.$/,'');
  }
  return String(n);
}

function toInt(value) {
  const n = Number(String(value ?? '').replace(/,/g,'').trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseEraDate(text) {
  const m = String(text || '').match(/R\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{1,2})/i);
  if (!m) return null;
  const year = 2018 + Number(m[1]);
  return `${year}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

function parseGregorianDate(text) {
  const m = String(text || '').match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

function allRows(buffer) {
  const workbook = XLSX.read(buffer, { type:'buffer', cellFormula:true, cellText:true, cellDates:false });
  return workbook.SheetNames.map(sheetName => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header:1, raw:false, defval:'' });
    return { sheetName, rows: rows.map(r => Array.isArray(r) ? r.map(v => String(v ?? '').trim()) : []) };
  });
}

function findPeriod(sheets, season) {
  if (season.periodStart) {
    let end = null;
    for (const { rows } of sheets) {
      for (const row of rows) {
        const line = row.join(' ');
        const dates = [...line.matchAll(/R\s*\d{1,2}[.\/-]\d{1,2}[.\/-]\d{1,2}|20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/gi)]
          .map(m => parseEraDate(m[0]) || parseGregorianDate(m[0]))
          .filter(Boolean);
        if (dates.length >= 2 && dates.includes(season.periodStart)) end = dates[dates.length - 1];
      }
    }
    return { start: season.periodStart, end: end || '' };
  }

  for (const { rows } of sheets) {
    for (const row of rows) {
      const line = row.join(' ');
      const dates = [...line.matchAll(/R\s*\d{1,2}[.\/-]\d{1,2}[.\/-]\d{1,2}|20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/gi)]
        .map(m => parseEraDate(m[0]) || parseGregorianDate(m[0]))
        .filter(Boolean);
      if (dates.length >= 2) return { start: dates[0], end: dates[dates.length - 1] };
    }
  }
  return { start:'', end:'' };
}

function rowHasLabels(row, labels) {
  const cells = row.map(norm);
  return labels.every(label => cells.some(c => c === norm(label) || c.includes(norm(label))));
}

function nextDataRow(rows, start, neededCols) {
  for (let i = start + 1; i < Math.min(rows.length, start + 6); i++) {
    const row = rows[i] || [];
    const populated = neededCols.filter(idx => String(row[idx] ?? '').trim() !== '').length;
    if (populated >= Math.max(2, Math.ceil(neededCols.length * 0.6))) return row;
  }
  return null;
}

function headerIndex(row, label) {
  const target = norm(label);
  return row.findIndex(cell => {
    const c = norm(cell);
    return c === target || c.includes(target);
  });
}

function findTeamRecord(sheets) {
  let team = { games:null, wins:null, draws:null, losses:null, OPS:'' };

  for (const { rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (!rowHasLabels(h, ['試合数','勝ち','引き分け','負け'])) continue;
      const cols = ['試合数','勝ち','引き分け','負け'].map(x => headerIndex(h,x));
      if (cols.some(x => x < 0)) continue;
      const data = nextDataRow(rows, i, cols);
      if (!data) continue;
      const values = cols.map(c => toInt(data[c]));
      if (values.every(v => v !== null)) {
        [team.games, team.wins, team.draws, team.losses] = values;
        break;
      }
    }
    if (team.games !== null) break;
  }

  // Team OPS is normally in the aggregate batting row immediately below the
  // batting header containing OBP / SLG / OPS. Read the cached XLSM cell value
  // directly; no LLM is involved.
  for (const { rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (!rowHasLabels(h, ['OPS']) || !(rowHasLabels(h,['出塁率']) || rowHasLabels(h,['長打率']) || rowHasLabels(h,['打率']))) continue;
      const opsCol = headerIndex(h,'OPS');
      if (opsCol < 0) continue;
      const data = nextDataRow(rows, i, [opsCol]);
      if (!data) continue;
      const candidate = displayDecimal(data[opsCol]);
      if (candidate) { team.OPS = candidate; break; }
    }
    if (team.OPS) break;
  }

  if ([team.games,team.wins,team.draws,team.losses].some(v => v === null)) {
    throw new Error('XLSM正本からチーム成績（試合数/勝敗）を特定できませんでした');
  }
  if (!team.OPS) throw new Error('XLSM正本からチームOPSを特定できませんでした');
  return team;
}

function findPlayerBatting(sheets, playerName) {
  const target = norm(playerName);
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const playerCol = row.findIndex(cell => norm(cell).includes(target));
      if (playerCol < 0) continue;

      // Find the nearest preceding batting header. Some master workbooks place
      // several title rows between the header and the first player, so allow a
      // generous window while still requiring both AVG and OPS labels.
      for (let h = i - 1; h >= Math.max(0, i - 20); h--) {
        const header = rows[h] || [];
        const opsCol = headerIndex(header,'OPS');
        let avgCol = headerIndex(header,'打率');
        if (avgCol < 0) avgCol = headerIndex(header,'AVG');
        if (opsCol < 0 || avgCol < 0) continue;
        const AVG = displayDecimal(row[avgCol]);
        const OPS = displayDecimal(row[opsCol]);
        if (AVG && OPS) return { AVG, OPS, sheetName, row:i + 1 };
      }
    }
  }
  throw new Error(`XLSM正本から${playerName}の打率/OPSを特定できませんでした`);
}

function extractFromXlsm(buffer, season) {
  const sheets = allRows(buffer);
  const period = findPeriod(sheets, season);
  const team = findTeamRecord(sheets);
  const players = {};
  const usedSheets = new Set();

  for (const player of season.players) {
    const found = findPlayerBatting(sheets, player.name);
    players[player.key] = { AVG: found.AVG, OPS: found.OPS };
    usedSheets.add(found.sheetName);
  }

  if (!period.start) throw new Error(`${season.label} XLSM正本から集計開始日を特定できませんでした`);
  return {
    parser:'deterministic-xlsx-v1',
    usedSheets:[...usedSheets],
    extracted:{ periodStart:period.start, periodEnd:period.end, team, players }
  };
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
  const parsed = extractFromXlsm(fetched.buffer, season);
  return {
    live:true,
    season:season.key,
    seasonLabel:season.label,
    sourceType:'XLSM_MASTER',
    source:{id:file.id,name:file.name,path:file.path,modifiedTime:file.modifiedTime,size:file.size || fetched.buffer.length},
    usedSheets:parsed.usedSheets,
    parser:parsed.parser,
    model:null,
    extracted:parsed.extracted
  };
}
