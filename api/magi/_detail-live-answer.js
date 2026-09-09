import { runDetailCsvConsistencyAudit } from './_detail-csv-audit.js';
import { OFFICIAL_PLAYER_REGISTRY, canonicalizeKnownNameText } from './_roster.js';

const ENGINE_VERSION = 'verified-detail-answer-v2-player-target-priority';
let oldAuditCache = { expires: 0, data: null };

function pct(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return `${(n / d * 100).toFixed(1)}%`;
}

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function detectSeason(question) {
  const q = String(question || '');
  if (/前チーム|旧チーム|2025\s*[-–—〜~]\s*2026/.test(q)) return 'old';
  if (/現チーム|今季|今シーズン|2026\s*[-–—〜~]\s*2027/.test(q)) return 'current';
  return 'unspecified';
}

function findPlayer(question) {
  const normalized = canonicalizeKnownNameText(question);
  const compact = normalized.replace(/[\s　]/g, '');
  const matches = OFFICIAL_PLAYER_REGISTRY.filter(name => {
    const noSpace = name.replace(/[\s　]/g, '');
    return normalized.includes(name) || compact.includes(noSpace);
  });
  return matches.length === 1 ? matches[0] : null;
}

function isTeamTarget(question) {
  const q = String(question || '');
  // 「前チームの宮村 龍」のような season + player 表現は個人質問。
  // 明示的な選手が1人解決できる場合は、team という語が含まれていても個人を優先する。
  if (findPlayer(q)) return false;
  return /チーム全体|全員|全選手|全体|チーム(?:の)?(?:合計|総計)|全員(?:合わせた)?/.test(q);
}

async function oldAudit() {
  const now = Date.now();
  if (oldAuditCache.data && oldAuditCache.expires > now) return oldAuditCache.data;
  const data = await runDetailCsvConsistencyAudit({ season: 'old' });
  oldAuditCache = { data, expires: now + 30_000 };
  return data;
}

function battingResolved(audit, player) {
  const row = (audit?.batting?.players || []).find(p => p.name === player);
  if (!row || !row?.reconciliation?.csvAnalysisAllowed) return null;
  return row.reconciliation.resolved || null;
}

function battingTeamTotals(audit) {
  const out = { AB:0,H:0,RBI:0,R:0,SINGLE:0,DOUBLE:0,TRIPLE:0,HR:0,SO:0,BB:0,HBP:0,SB:0,CS:0,SAC:0,SF:0 };
  for (const p of audit?.batting?.players || []) {
    if (!p?.reconciliation?.csvAnalysisAllowed) continue;
    const r = p.reconciliation.resolved || {};
    for (const k of Object.keys(out)) out[k] += num(r[k]);
  }
  return out;
}

function fieldingMaster(audit, player) {
  const row = (audit?.fielding?.players || []).find(p => p.name === player);
  if (!row || !row.allowed || !row.master) return null;
  return row.master;
}

function fieldingTeamTotals(audit) {
  const out = { CHANCES:0,ASSISTS:0,PUTOUTS:0,ERRORS:0,DP:0,TP:0,PB:0,SB_ALLOWED:0,SB_ATT:0,CS:0,PK:0,CI:0 };
  for (const p of audit?.fielding?.players || []) {
    if (!p?.allowed || !p.master) continue;
    for (const k of Object.keys(out)) out[k] += num(p.master[k]);
  }
  return out;
}

function answerObject({ audit, target, domain, values, display, answer }) {
  return {
    ok: true,
    engineVersion: ENGINE_VERSION,
    season: 'old',
    seasonLabel: audit.seasonLabel,
    sourcePolicy: audit.policyVersion,
    authoritativeSource: audit.authoritativeSource,
    detailSources: {
      batting: audit?.batting?.source || null,
      fielding: audit?.fielding?.source || null
    },
    verification: {
      overallState: audit.overallState,
      battingGateOpen: Boolean(audit?.batting?.gateOpen),
      fieldingTeamWideAnalysisAllowed: Boolean(audit?.fielding?.teamWideAnalysisAllowed),
      detailAnalysisAllowed: audit.overallState === 'FULL'
    },
    target,
    domain,
    metricValues: values,
    displayValues: display,
    answer,
    refusedToInvent: false
  };
}

function safeRefusal(answer, reason) {
  return {
    ok: true,
    engineVersion: ENGINE_VERSION,
    answer,
    reason,
    metricValues: {},
    displayValues: {},
    refusedToInvent: true
  };
}

export async function buildVerifiedDetailAnswer({ question }) {
  const q = String(question || '').trim();
  if (!q) return safeRefusal('質問が空です。', 'EMPTY_QUESTION');

  const season = detectSeason(q);
  if (season === 'current') {
    return safeRefusal('現チームの詳細CSVは未確定のため、現時点ではCSV詳細分析を確定値として回答しません。', 'CURRENT_DETAIL_CSV_NOT_FINAL');
  }
  if (season !== 'old') {
    return safeRefusal('現チームか前チームか、対象シーズンを指定してください。', 'SEASON_UNSPECIFIED');
  }

  const audit = await oldAudit();
  if (audit.overallState !== 'FULL') {
    return safeRefusal('前チームの詳細データ照合がFULL OPENではないため、CSV詳細分析を停止します。', 'OLD_DETAIL_GATE_NOT_FULL');
  }

  const team = isTeamTarget(q);
  const player = team ? null : findPlayer(q);
  if (!team && !player) return safeRefusal('対象選手を一意に特定できません。', 'PLAYER_UNRESOLVED');
  const target = team ? { type:'TEAM', label:'前チーム全体' } : { type:'PLAYER', player };

  const fieldingIntent = /守備|守備機会|補殺|刺殺|失策|エラー|捕逸|許盗塁|盗塁企図|盗塁阻止|捕手|牽制刺|捕妨害/.test(q);

  if (fieldingIntent) {
    const s = team ? fieldingTeamTotals(audit) : fieldingMaster(audit, player);
    if (!s) return safeRefusal(`${player || '前チーム'}の守備CSVはXLSM正本との照合許可がありません。`, 'FIELDING_DETAIL_NOT_ALLOWED');
    const values = {}, display = {}, parts = [];
    const push = (k, label, value, suffix='') => { values[k]=value; display[k]=`${value}${suffix}`; parts.push(`${label}${display[k]}`); };

    if (/守備率/.test(q)) {
      const rate = pct(num(s.PUTOUTS)+num(s.ASSISTS), num(s.CHANCES));
      values.FIELDING_PCT = rate; display.FIELDING_PCT = rate ?? '算出不可'; parts.push(`守備率${display.FIELDING_PCT}`);
    }
    if (/守備機会/.test(q)) push('CHANCES','守備機会',num(s.CHANCES));
    if (/補殺/.test(q)) push('ASSISTS','補殺',num(s.ASSISTS));
    if (/刺殺/.test(q) && !/盗塁阻止/.test(q)) push('PUTOUTS','刺殺',num(s.PUTOUTS));
    if (/失策|エラー/.test(q)) push('ERRORS','失策',num(s.ERRORS));
    if (/捕逸/.test(q)) push('PB','捕逸',num(s.PB));
    if (/許盗塁/.test(q)) push('SB_ALLOWED','許盗塁',num(s.SB_ALLOWED));
    if (/盗塁企図/.test(q)) push('SB_ATT','盗塁企図',num(s.SB_ATT));
    if (/盗塁阻止率/.test(q)) {
      const rate = pct(num(s.CS), num(s.SB_ATT));
      values.CS_PCT = rate; display.CS_PCT = rate ?? '算出不可'; parts.push(`盗塁阻止率${display.CS_PCT}`);
    }
    if (/盗塁阻止(?:数)?/.test(q)) push('CS','盗塁阻止',num(s.CS));
    if (/牽制刺/.test(q)) push('PK','牽制刺',num(s.PK));
    if (/捕妨害/.test(q)) push('CI','捕妨害',num(s.CI));
    if (/捕手回数|捕手としての回数|捕手.*回数/.test(q)) { values.C_INN=s.C_INN; display.C_INN=String(s.C_INN); parts.push(`捕手回数${display.C_INN}`); }

    if (!parts.length) return safeRefusal('守備で確認したい項目を特定できません。', 'FIELDING_METRIC_UNRESOLVED');
    const subject = team ? '前チーム全体' : player;
    return answerObject({ audit, target, domain:'FIELDING', values, display, answer:`${subject}は、${parts.join('、')}です。` });
  }

  const s = team ? battingTeamTotals(audit) : battingResolved(audit, player);
  if (!s) return safeRefusal(`${player || '前チーム'}の打撃・走塁CSVはXLSM正本との照合許可がありません。`, 'BATTING_DETAIL_NOT_ALLOWED');
  const values = {}, display = {}, parts = [];
  const push = (k, label, value) => { values[k]=value; display[k]=String(value); parts.push(`${label}${value}`); };

  if (/盗塁成功率|盗塁率/.test(q)) {
    const rate = pct(num(s.SB), num(s.SB)+num(s.CS));
    values.SB_PCT=rate; display.SB_PCT=rate ?? '算出不可'; parts.push(`盗塁成功率${display.SB_PCT}`);
  }
  if (/盗塁刺/.test(q)) push('CS','盗塁刺',num(s.CS));
  if (/盗塁/.test(q) && !/盗塁成功率|盗塁率|盗塁刺/.test(q)) push('SB','盗塁',num(s.SB));
  if (/四死球/.test(q)) {
    push('BB','四球',num(s.BB)); push('HBP','死球',num(s.HBP));
    values.BB_HBP = num(s.BB)+num(s.HBP); display.BB_HBP=String(values.BB_HBP); parts.push(`四死球計${values.BB_HBP}`);
  } else {
    if (/四球/.test(q)) push('BB','四球',num(s.BB));
    if (/死球/.test(q)) push('HBP','死球',num(s.HBP));
  }
  if (/犠打/.test(q)) push('SAC','犠打',num(s.SAC));
  if (/犠飛/.test(q)) push('SF','犠飛',num(s.SF));

  if (!parts.length) return safeRefusal('走塁・四死球・犠打・犠飛のどの項目を確認するか特定できません。', 'BATTING_DETAIL_METRIC_UNRESOLVED');
  const domain = /盗塁/.test(q) ? 'RUNNING' : 'BATTING_DETAIL';
  const subject = team ? '前チーム全体' : player;
  return answerObject({ audit, target, domain, values, display, answer:`${subject}は、${parts.join('、')}です。` });
}
