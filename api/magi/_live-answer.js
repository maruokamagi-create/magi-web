import { runDriveLiveAudit } from './_drive-live-audit.js';

const ANSWER_VERSION = 'live-xlsm-answer-v2-generic-player-stats';

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

const BATTING_METRICS = [
  { key:'OPS', label:'OPS', re:/OPS/i },
  { key:'OBP', label:'出塁率', re:/出塁率|OBP/i },
  { key:'SLG', label:'長打率', re:/長打率|SLG/i },
  { key:'AVG', label:'打率', re:/打率|AVG/i },
  { key:'HR', label:'本塁打', re:/本塁打|ホームラン|HR/i },
  { key:'RBI', label:'打点', re:/打点|RBI/i },
  { key:'DOUBLE', label:'二塁打', re:/二塁打/ },
  { key:'TRIPLE', label:'三塁打', re:/三塁打/ },
  { key:'H', label:'安打', re:/安打|ヒット/ },
  { key:'BB', label:'四球', re:/四球/ },
  { key:'HBP', label:'死球', re:/死球/ },
  { key:'SO', label:'三振', re:/三振/ },
  { key:'SB', label:'盗塁', re:/盗塁(?!刺)/ },
  { key:'CS', label:'盗塁刺', re:/盗塁刺/ },
  { key:'SAC', label:'犠打', re:/犠打|送りバント/ },
  { key:'SF', label:'犠飛', re:/犠飛/ },
  { key:'AB', label:'打数', re:/打数/ },
  { key:'R', label:'得点', re:/得点/ }
];

const PITCHING_METRICS = [
  { key:'ERA', label:'防御率', re:/防御率|ERA/i },
  { key:'WHIP', label:'WHIP', re:/WHIP/i },
  { key:'SO', label:'奪三振', re:/奪三振/ },
  { key:'BB', label:'与四球', re:/与四球/ },
  { key:'IP', label:'投球回', re:/投球回数|投球回|イニング/ },
  { key:'APP', label:'登板数', re:/登板数|登板/ },
  { key:'BAA', label:'被打率', re:/被打率/ },
  { key:'ER', label:'自責点', re:/自責点/ },
  { key:'R', label:'失点', re:/失点/ },
  { key:'H', label:'被安打', re:/被安打/ },
  { key:'HR', label:'被本塁打', re:/被本塁打|被本塁/ },
  { key:'WP', label:'暴投', re:/暴投/ }
];

function detectMetric(question, metrics) {
  const q = text(question);
  return metrics.find(m => m.re.test(q)) || null;
}

function sourceFromLive(live) {
  return {
    type: live?.sourceType || 'XLSM_MASTER',
    name: live?.source?.name || '',
    path: live?.source?.path || '',
    modifiedTime: live?.source?.modifiedTime || null,
    parser: live?.parser || null
  };
}

function availableSummary(stats, preferred) {
  return preferred.filter(([key]) => stats?.[key] !== undefined && stats?.[key] !== '').map(([key,label]) => `${label}${stats[key]}`);
}

function answerSingleMetric({ routed, season, source, playerName, label, domainLabel, stats, metric }) {
  const value = stats?.[metric.key];
  if (value === undefined || value === '') {
    return resultBase({
      routed, season, source,
      answer: `${playerName}の${label}${domainLabel}${metric.label}は、正本XLSMから確認できませんでした。数値は作りません。`,
      refusedToInvent:true,
      limitation:`${domainLabel === '投手' ? 'PITCHING' : 'BATTING'}_METRIC_MISSING_${metric.key}`
    });
  }
  return resultBase({
    routed, season, source,
    answer:`${playerName}の${label}${metric.label}は${value}です。`,
    evidence:[`${playerName}: ${metric.key}=${value}`]
  });
}

export async function buildLiveAnswer({ question, routed }) {
  const q = text(question);

  if (routed?.route === 'CLARIFY') {
    return resultBase({ routed, answer: routed?.clarificationQuestion || 'もう少し具体的に教えてください。' });
  }
  if (routed?.route === 'UNSUPPORTED') {
    return resultBase({ routed, answer:'その質問は現在のMAGI成績回答の対象外です。', refusedToInvent:true, limitation:'UNSUPPORTED_ROUTE' });
  }

  const season = seasonFromRequest(routed, q);
  if (season === 'career') {
    return resultBase({
      routed, season,
      answer:'通算成績は現チームと旧チームの同じ指標を合算・再計算する必要があります。現在のライブ回答ではまだ通算合算を接続していないため、数値は出しません。',
      refusedToInvent:true,
      limitation:'CAREER_AGGREGATION_NOT_CONNECTED'
    });
  }

  const supported = ['BATTING_LOOKUP','PITCHING_LOOKUP','PLAYER_OVERVIEW','TEAM_LOOKUP'];
  if (!supported.includes(routed?.route)) {
    return resultBase({
      routed, season,
      answer:'質問の意味は理解できていますが、この回答経路はまだ正本XLSMとのライブ接続対象になっていません。',
      refusedToInvent:true,
      limitation:'ROUTE_NOT_YET_CONNECTED'
    });
  }

  if (routed.route === 'TEAM_LOOKUP') {
    const live = await runDriveLiveAudit({ season, players:[] });
    const source = sourceFromLive(live);
    const label = periodLabel(season, live);
    const team = live?.extracted?.team || {};
    if (/OPS/i.test(q)) {
      if (!team.OPS) return resultBase({ routed, season, source, answer:'チームOPSの計算に必要な正本データを確認できませんでした。', refusedToInvent:true, limitation:'TEAM_OPS_MISSING' });
      return resultBase({ routed, season, source, answer:`${label}のチームOPSは${team.OPS}です。`, evidence:[`OPS=${team.OPS}`,`OBP=${team.OBP || ''}`,`SLG=${team.SLG || ''}`,`method=${team?.opsCalculation?.method || 'CALCULATED'}`] });
    }
    if (/出塁率|OBP/i.test(q)) {
      return resultBase({ routed, season, source, answer:`${label}のチーム出塁率は${team.OBP}です。`, evidence:[`OBP=${team.OBP}`] });
    }
    if (/長打率|SLG/i.test(q)) {
      return resultBase({ routed, season, source, answer:`${label}のチーム長打率は${team.SLG}です。`, evidence:[`SLG=${team.SLG}`] });
    }
    if ([team.wins,team.draws,team.losses].some(v => v === null || v === undefined)) {
      return resultBase({ routed, season, source, answer:'チーム勝敗を正本XLSMから確認できませんでした。', refusedToInvent:true, limitation:'TEAM_RECORD_MISSING' });
    }
    return resultBase({ routed, season, source, answer:`${label}のチーム成績は${team.wins}勝${team.losses}敗${team.draws}分です。`, evidence:[`games=${team.games}`,`wins=${team.wins}`,`draws=${team.draws}`,`losses=${team.losses}`] });
  }

  const players = Array.isArray(routed?.players) ? routed.players : [];
  if (players.length !== 1) {
    return resultBase({ routed, season, answer:'対象選手を一人に特定できませんでした。', refusedToInvent:true, limitation:'PLAYER_NOT_UNIQUE' });
  }

  const playerName = players[0];
  const live = await runDriveLiveAudit({ season, players:[playerName] });
  const source = sourceFromLive(live);
  const label = periodLabel(season, live);
  const player = live?.extracted?.playersByName?.[playerName] || null;
  if (!player) {
    return resultBase({ routed, season, source, answer:`${playerName}の${label}成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'PLAYER_NOT_IN_LIVE_EXTRACT' });
  }

  if (routed.route === 'BATTING_LOOKUP') {
    const stats = player.batting;
    if (!stats) return resultBase({ routed, season, source, answer:`${playerName}の${label}打撃成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'BATTING_NOT_FOUND' });
    const metric = detectMetric(q, BATTING_METRICS);
    if (metric) return answerSingleMetric({ routed, season, source, playerName, label, domainLabel:'打撃', stats, metric });
    const parts = availableSummary(stats, [['AVG','打率'],['OPS','OPS'],['H','安打'],['RBI','打点'],['HR','本塁打']]);
    return resultBase({ routed, season, source, answer:`${playerName}の${label}打撃成績は、${parts.join('、')}です。`, evidence:parts });
  }

  if (routed.route === 'PITCHING_LOOKUP') {
    const stats = player.pitching;
    if (!stats) return resultBase({ routed, season, source, answer:`${playerName}の${label}投手成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'PITCHING_NOT_FOUND' });
    const metric = detectMetric(q, PITCHING_METRICS);
    if (metric) return answerSingleMetric({ routed, season, source, playerName, label, domainLabel:'投手', stats, metric });
    const parts = availableSummary(stats, [['ERA','防御率'],['IP','投球回'],['SO','奪三振'],['BB','与四球'],['WHIP','WHIP']]);
    return resultBase({ routed, season, source, answer:`${playerName}の${label}投手成績は、${parts.join('、')}です。`, evidence:parts });
  }

  const batting = player.batting;
  const pitching = player.pitching;
  const battingParts = batting ? availableSummary(batting, [['AVG','打率'],['OPS','OPS']]) : [];
  const pitchingParts = pitching ? availableSummary(pitching, [['ERA','防御率'],['IP','投球回'],['SO','奪三振'],['WHIP','WHIP']]) : [];
  if (!battingParts.length && !pitchingParts.length) {
    return resultBase({ routed, season, source, answer:`${playerName}の${label}打撃・投手成績を確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'PLAYER_OVERVIEW_NOT_FOUND' });
  }
  const sections = [];
  if (battingParts.length) sections.push(`打撃は${battingParts.join('、')}`);
  if (pitchingParts.length) sections.push(`投手は${pitchingParts.join('、')}`);
  if (!battingParts.length) sections.push('打撃成績は確認できません');
  if (!pitchingParts.length) sections.push('投手成績は確認できません');
  return resultBase({ routed, season, source, answer:`${playerName}の${label}成績は、${sections.join('。')}。`, evidence:[...battingParts,...pitchingParts], refusedToInvent:!battingParts.length || !pitchingParts.length, limitation:(!battingParts.length || !pitchingParts.length) ? 'PARTIAL_PLAYER_OVERVIEW' : null });
}
