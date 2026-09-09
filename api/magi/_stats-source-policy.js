// MAGI statistics source-of-truth and reconciliation policy.
// XLSM in 00_MASTER_正本 is authoritative for season totals.
// CSV in 10_DETAIL_詳細データ is secondary evidence for per-game/conditional analysis.

export const STATS_SOURCE_POLICY_VERSION = 'xlsm-master-csv-detail-v1';
export const AUTHORITATIVE_SOURCE = 'XLSM_MASTER';
export const DETAIL_SOURCE = 'CSV_DETAIL';

// Count metrics that may exist in both the master XLSM and batting detail CSV.
// These must match exactly after CSV aggregation. Rates are intentionally excluded:
// AVG/OBP/SLG/OPS/SB% are recalculated from authoritative counts to avoid rounding drift.
export const BATTING_RECONCILIATION_KEYS = Object.freeze([
  'AB','H','RBI','R','SINGLE','DOUBLE','TRIPLE','HR','SO','BB','HBP','SB','CS','SAC','SF'
]);

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function reconcileMasterAndDetail(masterStats = {}, csvTotals = {}, keys = BATTING_RECONCILIATION_KEYS) {
  const checks = [];
  const mismatches = [];
  const resolved = {};

  for (const key of keys) {
    const master = numeric(masterStats?.[key]);
    const csv = numeric(csvTotals?.[key]);

    if (master === null && csv === null) continue;

    // If XLSM has the value, it always wins. CSV never overwrites it.
    if (master !== null) resolved[key] = masterStats[key];
    else if (csv !== null) resolved[key] = csvTotals[key];

    if (master === null || csv === null) {
      checks.push({ key, master, csv, status: master === null ? 'CSV_ONLY' : 'XLSM_ONLY' });
      continue;
    }

    const status = master === csv ? 'MATCH' : 'MISMATCH';
    const item = { key, master, csv, status };
    checks.push(item);
    if (status === 'MISMATCH') mismatches.push(item);
  }

  return {
    policyVersion: STATS_SOURCE_POLICY_VERSION,
    authoritativeSource: AUTHORITATIVE_SOURCE,
    detailSource: DETAIL_SOURCE,
    consistent: mismatches.length === 0,
    mismatches,
    checks,
    resolved,
    csvAnalysisAllowed: mismatches.length === 0,
    rule: mismatches.length
      ? 'XLSM_WINS_AND_CSV_ANALYSIS_BLOCKED'
      : 'CSV_DETAIL_ALLOWED_AFTER_RECONCILIATION'
  };
}

export function authoritativeValue(masterValue, csvValue) {
  if (masterValue !== null && masterValue !== undefined && masterValue !== '') return masterValue;
  return csvValue;
}
