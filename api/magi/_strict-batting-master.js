import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const STATS_TOKEN = '03_STATS_成績データ';
const MASTER_TOKEN = '00_MASTER_正本';

const SEASONS = {
  current: { key:'current', label:'2026-2027現チーム', token:'2026-2027_CURRENT_現チーム' },
  old: { key:'old', label:'2025-2026旧チーム', token:'2025-2026_ARCHIVE_旧チーム' }
};

const BATTING_FIELDS = {
  AVG:['打率','AVG'], AB:['打数'], H:['安打'], RBI:['打点'], R:['得点'],
  SINGLE:['単打'], DOUBLE:['二塁打'], TRIPLE:['三塁打'], HR:['本塁打'],
  SO:['三振'], BB:['四球'], HBP:['死球'], OBP:['出塁率'], SLG:['長打率'], OPS:['OPS'],
  RISP:['得点圏'], SB:['盗塁'], CS:['盗塁刺'], SAC:['犠打'], SF:['犠飛']
};

function resolveSeason(value) {
  const v = String(value || 'current').toLowerCase();
  return v === 'old' || v === '2025-2026' ? SEASONS.old : SEASONS.current;
}

function norm(value) {
  return String(value ?? '').replace(/[\s　]+/g, '').trim();
}

function isAuthoritativeXlsm(file, season) {
  const name = String(file?.name || '');
  const path = String(file?.path || '');
  return /\.xlsm$/i.test(name) && path.includes(season.token) && path.includes(STATS_TOKEN) && path.includes(MASTER_TOKEN);
}

function displayDecimal(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const n = Number(s.replace(/,/g,''));
  if (!Number.isFinite(n)) return s;
  if (Math.abs(n) < 1 && n !== 0) {
    const decimals = (s.match(/\.(\d+)/)?.[1]?.length || 3);
    return n.toFixed(Math.max(1, Math.min(decimals, 3))).replace(/^0/, '').replace(/-0\./, '-.');
  }
  return s.replace(/,/g,'');
}

function headerIndexAliases(row, aliases) {
  for (const alias of aliases) {
    const exact = row.findIndex(cell => norm(cell) === norm(alias));
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = row.findIndex(cell => norm(cell).includes(norm(alias)));
    if (partial >= 0) return partial;
  }
  return -1;
}

function readFields(header, row) {
  const stats = {};
  for (const [key, aliases] of Object.entries(BATTING_FIELDS)) {
    const col = headerIndexAliases(header, aliases);
    if (col < 0) continue;
    const raw = String(row[col] ?? '').trim();
    if (raw) stats[key] = displayDecimal(raw);
  }
  return stats;
}

function sheetPriority(sheetName) {
  const n = norm(sheetName);
  if (n === norm('打撃一覧')) return 1000;
  if (n === norm('年末用打撃一覧')) return 900;
  if (n.startsWith(norm('打撃一覧'))) return 800;
  if (n.includes(norm('打撃'))) return 400;
  return 0;
}

function allRows(buffer) {
  const workbook = XLSX.read(buffer, { type:'buffer', cellFormula:true, cellText:true, cellDates:false });
  return workbook.SheetNames.map(sheetName => ({
    sheetName,
    rows:XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header:1, raw:false, defval:'' })
      .map(r => Array.isArray(r) ? r.map(v => String(v ?? '').trim()) : [])
  }));
}

function findStrictBattingRow(sheets, playerName) {
  const target = norm(playerName);
  const rankedSheets = [...sheets].sort((a,b) => sheetPriority(b.sheetName) - sheetPriority(a.sheetName));
  const candidates = [];

  for (const { sheetName, rows } of rankedSheets) {
    const priority = sheetPriority(sheetName);
    if (priority <= 0) continue;
    for (let h = 0; h < rows.length; h++) {
      const header = rows[h] || [];
      const playerCol = headerIndexAliases(header, ['選手名']);
      const core = ['打率','打数','安打','OPS'].map(label => headerIndexAliases(header, [label]));
      if (playerCol < 0 || core.filter(i => i >= 0).length < 3) continue;

      const duplicateSensitive = ['三振','四球','死球'].every(label =>
        header.filter(cell => norm(cell) === norm(label)).length <= 1
      );
      if (!duplicateSensitive) continue;

      for (let i = h + 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const playerCell = norm(row[playerCol] || '');
        if (!playerCell) continue;
        if (!(playerCell === target || playerCell.includes(target))) continue;
        const stats = readFields(header, row);
        const completeness = Object.keys(stats).length;
        if (!(stats.AB || stats.H || stats.AVG || stats.OPS)) continue;
        candidates.push({ stats, sheetName, row:i + 1, headerRow:h + 1, priority, completeness });
      }
    }
  }

  candidates.sort((a,b) => (b.priority - a.priority) || (b.completeness - a.completeness) || (a.row - b.row));
  return candidates[0] || null;
}

export async function runStrictBattingMasterAudit({ season:seasonValue='current', players=[] } = {}) {
  const season = resolveSeason(seasonValue);
  const tree = await listMagiDriveTree({ fresh:true });
  const candidates = tree.filter(file => isAuthoritativeXlsm(file, season));
  if (candidates.length !== 1) throw new Error(`${season.label}の00_MASTER_正本XLSMを一意に特定できませんでした (${candidates.length})`);

  const file = candidates[0];
  const fetched = await fetchDriveFileContent(file);
  const sheets = allRows(fetched.buffer);
  const requested = [...new Set((Array.isArray(players) ? players : []).filter(Boolean))];
  const playersByName = {};
  for (const name of requested) {
    const found = findStrictBattingRow(sheets, name);
    playersByName[name] = found ? {
      batting:found.stats,
      source:{ sheetName:found.sheetName, row:found.row, headerRow:found.headerRow }
    } : { batting:null, source:null };
  }

  return {
    parser:'strict-batting-xlsx-v1-summary-table',
    season:season.key,
    source:{ id:file.id, name:file.name, path:file.path, modifiedTime:file.modifiedTime, size:file.size || fetched.buffer.length },
    playersByName
  };
}
