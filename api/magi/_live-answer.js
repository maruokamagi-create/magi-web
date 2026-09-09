import { runDriveLiveAudit } from './_drive-live-audit.js';

const ANSWER_VERSION = 'live-xlsm-answer-v1';

const PLAYER_KEYS = {
  '大久保 陽翔': 'okuboHaruto',
  '大野 竜暉': 'onoTatsuki',
  '中嶋 玲月': 'nakajimaRei'
};

function text(value) {
  return String(value || '').trim();
}

function seasonFromRequest(routed, question) {
  const q = text(question);
  const specific = text(routed?.specificSeason);
  if (/2025\s*[-–—〜~]\s*2026/.test(specific) || /2025\s*[-–—〜~]\s*2026/.test(q) || /旧チーム/.test(q)) return 'old';
  if (/2026\s*[-–—〜~]\s*2027/.test(specific) || /2026\s*[-–—〜~]\s*2027/.test(q) || /現チーム/.test(q)) return 'current';
  if (routed?.timeScope === 'PREVIOUS_SEASON' || /昨季|去年|前年度|前シーズン/.test(q)) return 'old';
  if (routed?.timeScope === 'CAREER' || /通算|全期間/.test(q)) return 'career';
  return 'current';
}

function periodLabel(season, data) {
  if (season === 'current') return '今期';
  if (season === 'old') return '2025-2026旧チーム';
  return data?.seasonLabel || '';
}

function resultBase({ routed, answer, evidence = [], source = null, season = null, refusedToInvent = false, limitation = null }) {
  return {
    ok: true,
    answerEngineVersion: ANSWER_VERSION,
    route: routed?.route || '',
    routerVersion: routed?.routerVersion || null,
    understoodRequest: routed?.understoodRequest || '',
    season,
    answer,
    evidence,
    source,
    refusedToInvent,
    limitation
  };
}

function battingMetric(question) {
  const q = text(question);
  if (/OPS/i.test(q)) return 'OPS';
  if (/打率|AVG/i.test(q)) return 'AVG';
  return 'SUMMARY';
}

function teamMetric(question) {
  const q = text(question);
  if (/OPS/i.test(q)) return 'OPS';
  if (/勝敗|成績|戦績|何勝|勝ち|負け|引き分け/.test(q)) return 'RECORD';
  return 'SUMMARY';
}

export async function buildLiveAnswer({ question, routed }) {
  const q = text(question);

  if (routed?.route === 'CLARIFY') {
    return resultBase({ routed, answer: routed?.clarificationQuestion || 'もう少し具体的に教えてください。' });
  }

  if (routed?.route === 'UNSUPPORTED') {
    return resultBase({ routed, answer: 'その質問は現在のMAGI成績回答の対象外です。', refusedToInvent: true, limitation: 'UNSUPPORTED_ROUTE' });
  }

  const season = seasonFromRequest(routed, q);
  if (season === 'career') {
    return resultBase({
      routed,
      season,
      answer: '通算成績は現チームと旧チームの打撃集計を合算して再計算する必要があります。現在のライブ回答ではまだ通算合算を接続していないため、数値は出しません。',
      refusedToInvent: true,
      limitation: 'CAREER_AGGREGATION_NOT_CONNECTED'
    });
  }

  if (!['BATTING_LOOKUP', 'TEAM_LOOKUP'].includes(routed?.route)) {
    return resultBase({
      routed,
      season,
      answer: '質問の意味は理解できていますが、この回答経路はまだ正本XLSMとのライブ接続対象になっていません。',
      refusedToInvent: true,
      limitation: 'ROUTE_NOT_YET_CONNECTED'
    });
  }

  const live = await runDriveLiveAudit({ season });
  const source = {
    type: live?.sourceType || 'XLSM_MASTER',
    name: live?.source?.name || '',
    path: live?.source?.path || '',
    modifiedTime: live?.source?.modifiedTime || null,
    parser: live?.parser || null
  };
  const label = periodLabel(season, live);

  if (routed.route === 'TEAM_LOOKUP') {
    const team = live?.extracted?.team || {};
    const metric = teamMetric(q);
    if (metric === 'OPS') {
      if (!team.OPS) return resultBase({ routed, season, source, answer: 'チームOPSの計算に必要な正本データを確認できませんでした。', refusedToInvent: true, limitation: 'TEAM_OPS_MISSING' });
      return resultBase({
        routed, season, source,
        answer: `${label}のチームOPSは${team.OPS}です。`,
        evidence: [`OPS=${team.OPS}`, `OBP=${team.OBP || ''}`, `SLG=${team.SLG || ''}`, `method=${team?.opsCalculation?.method || 'CALCULATED'}`]
      });
    }
    if ([team.wins, team.draws, team.losses].some(v => v === null || v === undefined)) {
      return resultBase({ routed, season, source, answer: 'チーム勝敗を正本XLSMから確認できませんでした。', refusedToInvent: true, limitation: 'TEAM_RECORD_MISSING' });
    }
    return resultBase({
      routed, season, source,
      answer: `${label}のチーム成績は${team.wins}勝${team.losses}敗${team.draws}分です。`,
      evidence: [`games=${team.games}`, `wins=${team.wins}`, `draws=${team.draws}`, `losses=${team.losses}`]
    });
  }

  const players = Array.isArray(routed?.players) ? routed.players : [];
  if (players.length !== 1) {
    return resultBase({ routed, season, source, answer: '対象選手を一人に特定できませんでした。', refusedToInvent: true, limitation: 'PLAYER_NOT_UNIQUE' });
  }
  const playerName = players[0];
  const key = PLAYER_KEYS[playerName];
  const stats = key ? live?.extracted?.players?.[key] : null;
  if (!stats) {
    return resultBase({
      routed, season, source,
      answer: `${playerName}の${label}打撃成績を、現在のライブXLSM抽出対象から確認できませんでした。数値は作りません。`,
      refusedToInvent: true,
      limitation: 'PLAYER_NOT_IN_LIVE_EXTRACT'
    });
  }

  const metric = battingMetric(q);
  if (metric === 'OPS') {
    return resultBase({ routed, season, source, answer: `${playerName}の${label}OPSは${stats.OPS}です。`, evidence: [`${playerName}: OPS=${stats.OPS}`] });
  }
  if (metric === 'AVG') {
    return resultBase({ routed, season, source, answer: `${playerName}の${label}打率は${stats.AVG}です。`, evidence: [`${playerName}: AVG=${stats.AVG}`] });
  }
  return resultBase({
    routed, season, source,
    answer: `${playerName}の${label}打撃成績は、打率${stats.AVG}、OPS${stats.OPS}です。`,
    evidence: [`${playerName}: AVG=${stats.AVG}`, `${playerName}: OPS=${stats.OPS}`]
  });
}
