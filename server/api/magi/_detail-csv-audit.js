import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { runStrictBattingMasterAudit } from './_strict-batting-master.js';
import { BATTING_RECONCILIATION_KEYS, reconcileMasterAndDetail, STATS_SOURCE_POLICY_VERSION } from './_stats-source-policy.js';
import { runFieldingCsvAudit } from './_fielding-csv-audit.js';

const SEASONS = {
  current: { key:'current', token:'2026-2027_CURRENT_現チーム', yearToken:'2026-2027', minDate:'2026-08-02' },
  old: { key:'old', token:'2025-2026_ARCHIVE_旧チーム', yearToken:'2025-2026', minDate:null }
};

const BATTING_HEADERS = {
  AB:['打数'], H:['安打'], RBI:['打点'], R:['得点'], SINGLE:['単打'], DOUBLE:['二塁打'], TRIPLE:['三塁打'], HR:['本塁打'],
  SO:['三振'], BB:['四球'], HBP:['死球'], SB:['盗塁'], CS:['盗塁刺'], SAC:['犠打'], SF:['犠飛']
};

function resolveSeason(value) {
  const v = String(value || 'current').toLowerCase();
  return v === 'old' || v === '2025-2026' ? SEASONS.old : SEASONS.current;
}

function norm(value) {
  return String(value ?? '').replace(/[\s　]+/g, '').trim();
}

function csvFile(tree, season, domain) {
  const domainToken = domain === 'batting' ? 'BATTING_打撃' : 'FIELDING_守備';
  const nameRe = domain === 'batting' ? /^打撃詳細.*\.csv$/i : /^守備詳細.*\.csv$/i;
  const candidates = tree.filter(f => {
    const path = String(f?.path || '');
    const name = String(f?.name || '');
    return path.includes(season.token) && path.includes('03_STATS_成績データ') && path.includes('10_DETAIL_詳細データ') && path.includes(domainToken) && nameRe.test(name);
  });
  if (candidates.length !== 1) {
    throw new Error(`${season.yearToken} ${domainToken} CSVを一意に特定できませんでした (${candidates.length})`);
  }
  return candidates[0];
}

function decodeCsv(buffer) {
  const attempts = [
    ['utf-8', () => new TextDecoder('utf-8').decode(buffer)],
    ['shift_jis', () => new TextDecoder('shift_jis').decode(buffer)]
  ];
  for (const [encoding, fn] of attempts) {
    try {
      const text = fn().replace(/^\uFEFF/, '');
      if (/開催日/.test(text) && /選手名/.test(text)) return { text, encoding };
    } catch (_) {}
  }
  throw new Error('CSV文字コードを判定できませんでした（UTF-8/Shift_JIS）');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (ch === '"') { quoted = false; continue; }
      cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(cell.trim()); cell = ''; continue; }
    if (ch === '\n') {
      row.push(cell.replace(/\r$/, '').trim());
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = []; cell = ''; continue;
    }
    cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, '').trim());
    if (row.some(v => String(v).trim() !== '')) rows.push(row);
  }
  return rows;
}

function indexOfHeader(header, aliases) {
  for (const alias of aliases) {
    const idx = header.findIndex(v => norm(v) === norm(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function numberValue(value) {
  const s = String(value ?? '').replace(/,/g, '').trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(value) {
  const m = String(value || '').match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

function summarizeRows(rows) {
  if (!rows.length) throw new Error('CSVが空です');
  const header = rows[0];
  const playerCol = indexOfHeader(header, ['選手名']);
  const dateCol = indexOfHeader(header, ['開催日']);
  if (playerCol < 0 || dateCol < 0) throw new Error('CSV必須列（開催日/選手名）がありません');
  const fingerprintCount = new Map();
  const dates = [];
  const players = new Set();
  for (const r of rows.slice(1)) {
    const fp = r.join('\u001f');
    fingerprintCount.set(fp, (fingerprintCount.get(fp) || 0) + 1);
    const p = String(r[playerCol] || '').trim();
    if (p) players.add(p);
    const d = isoDate(r[dateCol]);
    if (d) dates.push(d);
  }
  const duplicateRows = [...fingerprintCount.values()].filter(n => n > 1).reduce((a,n) => a + (n - 1), 0);
  dates.sort();
  return {
    header,
    playerCol,
    dateCol,
    dataRows: rows.length - 1,
    playerCount: players.size,
    players:[...players],
    duplicateRows,
    minDate: dates[0] || '',
    maxDate: dates[dates.length - 1] || ''
  };
}

function aggregateBatting(rows) {
  const summary = summarizeRows(rows);
  const header = summary.header;
  const cols = {};
  for (const [key, aliases] of Object.entries(BATTING_HEADERS)) cols[key] = indexOfHeader(header, aliases);
  const missingColumns = BATTING_RECONCILIATION_KEYS.filter(key => cols[key] < 0);
  const totalsByPlayer = {};
  for (const r of rows.slice(1)) {
    const player = String(r[summary.playerCol] || '').trim();
    if (!player) continue;
    if (!totalsByPlayer[player]) {
      totalsByPlayer[player] = Object.fromEntries(BATTING_RECONCILIATION_KEYS.map(k => [k, 0]));
      totalsByPlayer[player]._rows = 0;
    }
    const out = totalsByPlayer[player];
    out._rows++;
    for (const key of BATTING_RECONCILIATION_KEYS) {
      if (cols[key] >= 0) out[key] += numberValue(r[cols[key]]);
    }
  }
  return { ...summary, columns:cols, missingColumns, totalsByPlayer };
}

function fieldingStructure(rows, season) {
  const summary = summarizeRows(rows);
  const required = ['守備位置','守備機会','失策'];
  const missingRequiredColumns = required.filter(label => indexOfHeader(summary.header, [label]) < 0);
  const startDateValid = !season.minDate || !summary.minDate || summary.minDate >= season.minDate;
  const structuralAllowed = summary.duplicateRows === 0 && missingRequiredColumns.length === 0 && startDateValid;
  return { ...summary, missingRequiredColumns, startDateValid, structuralAllowed };
}

export async function runDetailCsvConsistencyAudit({ season: seasonValue = 'current' } = {}) {
  const season = resolveSeason(seasonValue);
  const tree = await listMagiDriveTree({ fresh:true });
  const battingFile = csvFile(tree, season, 'batting');
  const fieldingFile = csvFile(tree, season, 'fielding');

  const [battingRaw, fieldingRaw] = await Promise.all([
    fetchDriveFileContent(battingFile),
    fetchDriveFileContent(fieldingFile)
  ]);
  const battingDecoded = decodeCsv(battingRaw.buffer);
  const fieldingDecoded = decodeCsv(fieldingRaw.buffer);
  const batting = aggregateBatting(parseCsv(battingDecoded.text));
  const fielding = fieldingStructure(parseCsv(fieldingDecoded.text), season);

  const playerNames = Object.keys(batting.totalsByPlayer);
  const master = await runStrictBattingMasterAudit({ season:season.key, players:playerNames });
  const players = [];
  for (const name of playerNames) {
    const masterStats = master?.playersByName?.[name]?.batting || {};
    const csvTotals = batting.totalsByPlayer[name] || {};
    const reconciliation = reconcileMasterAndDetail(masterStats, csvTotals);
    players.push({
      name,
      csvRows:csvTotals._rows || 0,
      masterFound:Boolean(master?.playersByName?.[name]?.batting),
      masterSource:master?.playersByName?.[name]?.source || null,
      reconciliation
    });
  }

  const battingBlockedPlayers = players.filter(p => !p.reconciliation.csvAnalysisAllowed);
  const battingGateOpen = batting.missingColumns.length === 0 && batting.duplicateRows === 0 && battingBlockedPlayers.length === 0;
  const fieldingStructureOpen = fielding.structuralAllowed;

  const fieldingNumeric = await runFieldingCsvAudit({ season:season.key });
  const fieldingAllowedPlayers = (fieldingNumeric.players || []).filter(p => p.allowed).length;
  const fieldingUnavailablePlayers = (fieldingNumeric.players || []).filter(p => !p.csv && p.master).length;
  const fieldingBlockedPlayers = (fieldingNumeric.players || []).filter(p => p.csv && !p.allowed).length;

  let overallState = 'BLOCKED';
  if (battingGateOpen && fieldingNumeric.teamWideAnalysisAllowed) overallState = 'FULL';
  else if (battingGateOpen || fieldingAllowedPlayers > 0) overallState = 'PARTIAL';

  return {
    auditVersion:'detail-csv-consistency-v3-fielding-numeric',
    policyVersion:STATS_SOURCE_POLICY_VERSION,
    season:season.key,
    seasonLabel:season.yearToken,
    authoritativeSource:{ type:'XLSM_MASTER', name:master?.source?.name || '', path:master?.source?.path || '', parser:master?.parser || '' },
    batting:{
      source:{ name:battingFile.name, path:battingFile.path, encoding:battingDecoded.encoding },
      rows:batting.dataRows,
      playerCount:batting.playerCount,
      minDate:batting.minDate,
      maxDate:batting.maxDate,
      duplicateRows:batting.duplicateRows,
      missingColumns:batting.missingColumns,
      gateOpen:battingGateOpen,
      blockedPlayerCount:battingBlockedPlayers.length,
      players
    },
    fielding:{
      source:{ name:fieldingFile.name, path:fieldingFile.path, encoding:fieldingDecoded.encoding },
      rows:fielding.dataRows,
      playerCount:fielding.playerCount,
      minDate:fielding.minDate,
      maxDate:fielding.maxDate,
      duplicateRows:fielding.duplicateRows,
      missingRequiredColumns:fielding.missingRequiredColumns,
      startDateValid:fielding.startDateValid,
      structuralGateOpen:fieldingStructureOpen,
      numericAuditVersion:fieldingNumeric.auditVersion,
      masterPlayerCount:fieldingNumeric.masterPlayerCount,
      allowedPlayerCount:fieldingAllowedPlayers,
      unavailablePlayerCount:fieldingUnavailablePlayers,
      blockedPlayerCount:fieldingBlockedPlayers,
      teamWideAnalysisAllowed:fieldingNumeric.teamWideAnalysisAllowed,
      players:fieldingNumeric.players,
      note:'守備はXLSM正本を基準に数値照合。CSV一致選手のみ試合別・条件別の詳細分析を許可し、不一致またはCSV未収録選手はXLSM集計値のみ使用する。'
    },
    overallState,
    analysisAllowed:overallState !== 'BLOCKED',
    rule:overallState === 'FULL' ? 'FULL_DETAIL_ANALYSIS_ALLOWED' : overallState === 'PARTIAL' ? 'PARTIAL_DETAIL_ANALYSIS_ALLOWED_XLSM_WINS' : 'DETAIL_ANALYSIS_BLOCKED_XLSM_REMAINS_AUTHORITATIVE'
  };
}
