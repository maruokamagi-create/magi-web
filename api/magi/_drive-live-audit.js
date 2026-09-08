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

function decimalNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g,'').trim());
  return Number.isFinite(n) ? n : null;
}

function threeDecimal(value) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(3).replace(/^0/, '').replace(/-0\./, '-.');
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

function calculateTeamOpsFromBattingTotals(sheets) {
  // Team OPS is NOT stored as an authoritative field in the master workbook.
  // It must be calculated from team batting aggregates. Never average player OPS.
  // Standard formula:
  //   OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
  //   SLG = TB / AB
  //   TB  = 1B + 2*2B + 3*3B + 4*HR
  //   OPS = OBP + SLG
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (headerIndex(h,'選手名') >= 0) continue;
      if (!rowHasLabels(h, ['打数','二塁打','三塁打','本塁打','四球','死球','犠飛'])) continue;

      const abCol = headerIndex(h,'打数');
      const hCol = headerIndex(h,'安打');
      const singleCol = headerIndex(h,'単打');
      const d2Col = headerIndex(h,'二塁打');
      const d3Col = headerIndex(h,'三塁打');
      const hrCol = headerIndex(h,'本塁打');
      const bbCol = headerIndex(h,'四球');
      const hbpCol = headerIndex(h,'死球');
      const sfCol = headerIndex(h,'犠飛');
      if (abCol < 0 || d2Col < 0 || d3Col < 0 || hrCol < 0 || bbCol < 0 || hbpCol < 0 || sfCol < 0) continue;
      if (hCol < 0 && singleCol < 0) continue;

      const needed = [abCol,d2Col,d3Col,hrCol,bbCol,hbpCol,sfCol,hCol >= 0 ? hCol : singleCol];
      const data = nextDataRow(rows, i, needed);
      if (!data) continue;

      const AB = decimalNumber(data[abCol]);
      const doubles = decimalNumber(data[d2Col]);
      const triples = decimalNumber(data[d3Col]);
      const HR = decimalNumber(data[hrCol]);
      const BB = decimalNumber(data[bbCol]);
      const HBP = decimalNumber(data[hbpCol]);
      const SF = decimalNumber(data[sfCol]);
      let H = hCol >= 0 ? decimalNumber(data[hCol]) : null;
      let singles = singleCol >= 0 ? decimalNumber(data[singleCol]) : null;
      if ([AB,doubles,triples,HR,BB,HBP,SF].some(v => v === null) || AB <= 0) continue;
      if (H === null && singles !== null) H = singles + doubles + triples + HR;
      if (singles === null && H !== null) singles = H - doubles - triples - HR;
      if (H === null || singles === null) continue;

      const obpDen = AB + BB + HBP + SF;
      if (obpDen <= 0) continue;
      const OBP = (H + BB + HBP) / obpDen;
      const TB = singles + (2 * doubles) + (3 * triples) + (4 * HR);
      const SLG = TB / AB;
      const OPS = OBP + SLG;
      return {
        OPS: threeDecimal(OPS),
        OBP: threeDecimal(OBP),
        SLG: threeDecimal(SLG),
        method:'CALCULATED_FROM_TEAM_TOTALS',
        sheetName,
        inputs:{ AB,H,singles,doubles,triples,HR,BB,HBP,SF }
      };
    }
  }

  // Fallback: some workbooks expose aggregate OBP and SLG but omit the raw
  // extra-base totals on the same summary table. OPS is still calculated here
  // as OBP + SLG; it is never read as a stored team OPS field.
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (headerIndex(h,'選手名') >= 0) continue;
      if (!rowHasLabels(h, ['出塁率','長打率'])) continue;
      const obpCol = headerIndex(h,'出塁率');
      const slgCol = headerIndex(h,'長打率');
      const data = nextDataRow(rows, i, [obpCol, slgCol]);
      if (!data) continue;
      const OBP = decimalNumber(data[obpCol]);
      const SLG = decimalNumber(data[slgCol]);
      if (OBP === null || SLG === null) continue;
      return {
        OPS: threeDecimal(OBP + SLG),
        OBP: threeDecimal(OBP),
        SLG: threeDecimal(SLG),
        method:'CALCULATED_FROM_AGGREGATE_OBP_SLG',
        sheetName,
        inputs:null
      };
    }
  }

  throw new Error('XLSM正本からチームOPS計算に必要な打撃集計値を特定できませんでした');
}

function findTeamRecord(sheets) {
  let team = { games:null, wins:null, draws:null, losses:null, OPS:'', OBP:'', SLG:'', opsCalculation:null };

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

  if ([team.games,team.wins,team.draws,team.losses].some(v => v === null)) {
    throw new Error('XLSM正本からチーム成績（試合数/勝敗）を特定できませんでした');
  }

  const calculated = calculateTeamOpsFromBattingTotals(sheets);
  team.OPS = calculated.OPS;
  team.OBP = calculated.OBP;
  team.SLG = calculated.SLG;
  team.opsCalculation = {
    method:calculated.method,
    sheetName:calculated.sheetName,
    inputs:calculated.inputs
  };
  return team;
}

function findPlayerBatting(sheets, playerName) {
  const target = norm(playerName);
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const playerCol = row.findIndex(cell => norm(cell).includes(target));
      if (playerCol < 0) continue;

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

  if (team.opsCalculation?.sheetName) usedSheets.add(team.opsCalculation.sheetName);
  for (const player of season.players) {
    const found = findPlayerBatting(sheets, player.name);
    players[player.key] = { AVG: found.AVG, OPS: found.OPS };
    usedSheets.add(found.sheetName);
  }

  if (!period.start) throw new Error(`${season.label} XLSM正本から集計開始日を特定できませんでした`);
  return {
    parser:'deterministic-xlsx-v2-team-ops-calculated',
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
