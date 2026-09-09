import * as XLSX from 'xlsx';
import { getCache } from '@vercel/functions';
import { fetchDriveFileContent, getDriveFileMetadata, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER, OFFICIAL_PLAYER_REGISTRY } from './_roster.js';

const STATS_TOKEN = '03_STATS_成績データ';
const MASTER_TOKEN = '00_MASTER_正本';
const SNAPSHOT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CURRENT_MASTER_FILE_ID = process.env.MAGI_CURRENT_MASTER_FILE_ID || '11ABgSFKN-9Bhde1hJ_n-Qytz0cuImM0E';

const SEASONS = {
  current: {
    key: 'current',
    label: '2026-2027現チーム',
    token: '2026-2027_CURRENT_現チーム',
    periodStart: '2026-08-02',
    defaults: [
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
    defaults: [
      { name:'大久保 陽翔', key:'okuboHaruto' },
      { name:'大野 竜暉', key:'onoTatsuki' }
    ]
  }
};

const BATTING_FIELDS = {
  AVG: ['打率','AVG'], AB: ['打数'], H: ['安打'], RBI: ['打点'], R: ['得点'],
  SINGLE: ['単打'], DOUBLE: ['二塁打'], TRIPLE: ['三塁打'], HR: ['本塁打'],
  SO: ['三振'], BB: ['四球'], HBP: ['死球'], OBP: ['出塁率'], SLG: ['長打率'],
  OPS: ['OPS'], RISP: ['得点圏'], SB: ['盗塁'], CS: ['盗塁刺'], SAC: ['犠打'], SF: ['犠飛']
};

const PITCHING_FIELDS = {
  APP: ['登板数','登板'], ERA: ['防御率'], IP: ['投球回数','投球回'], H: ['被安打'],
  R: ['失点'], ER: ['自責点'], BB: ['与四球'], SO: ['奪三振'], WHIP: ['WHIP'],
  BAA: ['被打率'], HR: ['被本塁打','被本塁'], WP: ['暴投']
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
    const decimals = (s.match(/\.(\d+)/)?.[1]?.length || 3);
    return n.toFixed(Math.max(1, Math.min(decimals, 3))).replace(/^0/, '').replace(/-0\./, '-.');
  }
  return s.replace(/,/g,'');
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
          .map(m => parseEraDate(m[0]) || parseGregorianDate(m[0])).filter(Boolean);
        if (dates.length >= 2 && dates.includes(season.periodStart)) end = dates[dates.length - 1];
      }
    }
    return { start: season.periodStart, end: end || '' };
  }
  for (const { rows } of sheets) {
    for (const row of rows) {
      const line = row.join(' ');
      const dates = [...line.matchAll(/R\s*\d{1,2}[.\/-]\d{1,2}[.\/-]\d{1,2}|20\d{2}[.\/-]\d{1,2}[.\/-]\d{1,2}/gi)]
        .map(m => parseEraDate(m[0]) || parseGregorianDate(m[0])).filter(Boolean);
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
    const populated = neededCols.filter(idx => idx >= 0 && String(row[idx] ?? '').trim() !== '').length;
    if (populated >= Math.max(1, Math.ceil(neededCols.filter(x => x >= 0).length * 0.6))) return row;
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

function calculateTeamOpsFromBattingTotals(sheets) {
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
      return { OPS:threeDecimal(OBP + SLG), OBP:threeDecimal(OBP), SLG:threeDecimal(SLG), method:'CALCULATED_FROM_TEAM_TOTALS', sheetName, inputs:{AB,H,singles,doubles,triples,HR,BB,HBP,SF} };
    }
  }
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (headerIndex(h,'選手名') >= 0 || !rowHasLabels(h, ['出塁率','長打率'])) continue;
      const obpCol = headerIndex(h,'出塁率');
      const slgCol = headerIndex(h,'長打率');
      const data = nextDataRow(rows, i, [obpCol, slgCol]);
      if (!data) continue;
      const OBP = decimalNumber(data[obpCol]);
      const SLG = decimalNumber(data[slgCol]);
      if (OBP === null || SLG === null) continue;
      return { OPS:threeDecimal(OBP + SLG), OBP:threeDecimal(OBP), SLG:threeDecimal(SLG), method:'CALCULATED_FROM_AGGREGATE_OBP_SLG', sheetName, inputs:null };
    }
  }
  throw new Error('XLSM正本からチームOPS計算に必要な打撃集計値を特定できませんでした');
}

function findTeamRecord(sheets) {
  const team = { games:null, wins:null, draws:null, losses:null, OPS:'', OBP:'', SLG:'', opsCalculation:null };
  for (const { rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const h = rows[i] || [];
      if (!rowHasLabels(h, ['試合数','勝ち','引き分け','負け'])) continue;
      const cols = ['試合数','勝ち','引き分け','負け'].map(x => headerIndex(h,x));
      if (cols.some(x => x < 0)) continue;
      const data = nextDataRow(rows, i, cols);
      if (!data) continue;
      const values = cols.map(c => toInt(data[c]));
      if (values.every(v => v !== null)) { [team.games,team.wins,team.draws,team.losses] = values; break; }
    }
    if (team.games !== null) break;
  }
  if ([team.games,team.wins,team.draws,team.losses].some(v => v === null)) throw new Error('XLSM正本からチーム成績（試合数/勝敗）を特定できませんでした');
  const calculated = calculateTeamOpsFromBattingTotals(sheets);
  team.OPS = calculated.OPS; team.OBP = calculated.OBP; team.SLG = calculated.SLG;
  team.opsCalculation = { method:calculated.method, sheetName:calculated.sheetName, inputs:calculated.inputs };
  return team;
}

function domainHeaderScore(row, domain) {
  const markers = domain === 'pitching'
    ? ['防御率','投球回','WHIP','奪三振','自責点','被打率']
    : ['打率','OPS','出塁率','長打率','打数','安打'];
  return markers.filter(m => headerIndex(row, m) >= 0).length;
}

function readFields(header, row, fieldMap) {
  const stats = {};
  for (const [key, aliases] of Object.entries(fieldMap)) {
    const col = headerIndexAliases(header, aliases);
    if (col < 0) continue;
    const raw = String(row[col] ?? '').trim();
    if (!raw) continue;
    stats[key] = displayDecimal(raw);
  }
  return stats;
}

function findPlayerDomainStats(sheets, playerName, domain) {
  const target = norm(playerName);
  const fieldMap = domain === 'pitching' ? PITCHING_FIELDS : BATTING_FIELDS;
  for (const { sheetName, rows } of sheets) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!row.some(cell => norm(cell) === target || norm(cell).includes(target))) continue;
      let best = null;
      for (let h = i - 1; h >= Math.max(0, i - 30); h--) {
        const header = rows[h] || [];
        const score = domainHeaderScore(header, domain);
        if (score < 2) continue;
        if (!best || score > best.score) best = { header, score, h };
        if (score >= 4) break;
      }
      if (!best) continue;
      const stats = readFields(best.header, row, fieldMap);
      const essential = domain === 'pitching' ? (stats.ERA || stats.IP || stats.WHIP || stats.SO) : (stats.AVG || stats.OPS || stats.AB || stats.H);
      if (essential) return { stats, sheetName, row:i + 1, headerRow:best.h + 1 };
    }
  }
  return null;
}

function extractFromXlsm(buffer, season, requestedPlayers) {
  const sheets = allRows(buffer);
  const period = findPeriod(sheets, season);
  const team = findTeamRecord(sheets);
  const explicit = Array.isArray(requestedPlayers);
  const targetNames = explicit ? [...new Set(requestedPlayers.filter(Boolean))] : season.defaults.map(p => p.name);
  const playersByName = {};
  const legacyPlayers = {};
  const usedSheets = new Set();
  if (team.opsCalculation?.sheetName) usedSheets.add(team.opsCalculation.sheetName);

  for (const name of targetNames) {
    const batting = findPlayerDomainStats(sheets, name, 'batting');
    const pitching = findPlayerDomainStats(sheets, name, 'pitching');
    if (!explicit && !batting) throw new Error(`XLSM正本から${name}の打撃成績を特定できませんでした`);
    playersByName[name] = {
      batting: batting?.stats || null,
      pitching: pitching?.stats || null,
      sources: {
        batting: batting ? { sheetName:batting.sheetName, row:batting.row, headerRow:batting.headerRow } : null,
        pitching: pitching ? { sheetName:pitching.sheetName, row:pitching.row, headerRow:pitching.headerRow } : null
      }
    };
    if (batting) usedSheets.add(batting.sheetName);
    if (pitching) usedSheets.add(pitching.sheetName);
  }

  for (const item of season.defaults) {
    const batting = playersByName[item.name]?.batting;
    if (batting) legacyPlayers[item.key] = { AVG:batting.AVG || '', OPS:batting.OPS || '' };
  }

  if (!period.start) throw new Error(`${season.label} XLSM正本から集計開始日を特定できませんでした`);
  return {
    parser:'deterministic-xlsx-v3-generic-player-stats',
    usedSheets:[...usedSheets],
    extracted:{ periodStart:period.start, periodEnd:period.end, team, players:legacyPlayers, playersByName }
  };
}

async function readSnapshot(key) {
  try {
    return (await getCache().get(key)) || null;
  } catch (error) {
    console.warn('[MAGI stats snapshot cache read]', error?.message || error);
    return null;
  }
}

async function writeSnapshot(key, value) {
  try {
    await getCache().set(key, value, { ttl:SNAPSHOT_CACHE_TTL_SECONDS, tags:['magi-stats-snapshot-v1'] });
  } catch (error) {
    console.warn('[MAGI stats snapshot cache write]', error?.message || error);
  }
}

async function resolveMasterFile(season) {
  if (season.key === 'current' && CURRENT_MASTER_FILE_ID) {
    try {
      const meta = await getDriveFileMetadata(CURRENT_MASTER_FILE_ID);
      return {
        ...meta,
        path:`20_TEAM_DATA_チームデータ/${season.token}/${STATS_TOKEN}/${MASTER_TOKEN}/${meta.name}`
      };
    } catch (error) {
      console.warn('[MAGI current master direct metadata fallback]', error?.message || error);
    }
  }

  const tree = await listMagiDriveTree({ fresh:true });
  const candidates = tree.filter(file => isAuthoritativeXlsm(file, season));
  if (candidates.length !== 1) {
    const nearby = tree.filter(f => /\.xlsm$/i.test(String(f?.name || '')) && String(f?.path || '').includes(season.token));
    const names = nearby.slice(0, 8).map(f => f.path).join(' | ');
    throw new Error(`${season.label}の00_MASTER_正本XLSMを一意に特定できませんでした (${candidates.length})${names ? ` / XLSM候補: ${names}` : ''}`);
  }
  return candidates[0];
}

function seasonRoster(season) {
  return season.key === 'current' ? CURRENT_ROSTER : OFFICIAL_PLAYER_REGISTRY;
}

export async function runDriveLiveAudit({ season: seasonValue = 'current', players = null } = {}) {
  const season = resolveSeason(seasonValue);
  const file = await resolveMasterFile(season);
  const cacheKey = `magi:stats-snapshot:v1:${season.key}:${file.id}:${String(file.modifiedTime || '')}`;
  const cached = await readSnapshot(cacheKey);
  if (cached?.extracted?.playersByName) {
    return { ...cached, cacheHit:true };
  }

  const fetched = await fetchDriveFileContent(file);
  const parsed = extractFromXlsm(fetched.buffer, season, seasonRoster(season));
  const result = {
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
  await writeSnapshot(cacheKey, result);
  return { ...result, cacheHit:false };
}
