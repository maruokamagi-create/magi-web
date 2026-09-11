import { runDriveLiveAudit } from './_drive-live-audit.js';

const ANSWER_VERSION = 'live-xlsm-answer-v3-exact-requested-metrics';

function text(value) {
  return String(value || '').trim();
}

function seasonFromRequest(routed, question) {
  const q = text(question);
  const specific = text(routed?.specificSeason);
  if (/通算|全期間/.test(q) || routed?.timeScope === 'CAREER') return 'career';
  if (/2025\s*[-–—〜~]\s*2026/.test(specific) || /2025\s*[-–—〜~]\s*2026/.test(q) || /旧チーム/.test(q)) return 'old';
  if (/2026\s*[-–—〜~]\s*2027/.test(specific) || /2026\s*[-–—〜~]\s*2027/.test(q) || /現チーム/.test(q)) return 'current';
  if (routed?.timeScope === 'PREVIOUS_SEASON' || /昨季|去年|前年度|前シーズン/.test(q)) return 'old';
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

const TEAM_METRICS = [
  { key:'OPS', label:'チームOPS', re:/チーム[^。！？!?]{0,12}OPS|OPS/i },
  { key:'OBP', label:'チーム出塁率', re:/チーム[^。！？!?]{0,12}(?:出塁率|OBP)|出塁率|OBP/i },
  { key:'SLG', label:'チーム長打率', re:/チーム[^。！？!?]{0,12}(?:長打率|SLG)|長打率|SLG/i }
];

function regexIndex(q, re) {
  const flags = re.flags.replace('g','');
  const copy = new RegExp(re.source, flags);
  const m = copy.exec(q);
  return m ? m.index : -1;
}

function detectMetrics(question, metrics) {
  const q = text(question);
  return metrics
    .map((metric, order) => ({ metric, index: regexIndex(q, metric.re), order }))
    .filter(x => x.index >= 0)
    .sort((a,b) => a.index - b.index || a.order - b.order)
    .map(x => x.metric)
    .filter((metric, index, all) => all.findIndex(x => x.key === metric.key) === index);
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

function answerMetricSet({ routed, season, source, playerName, label, stats, metrics, domainLabel }) {
  const found = [];
  const missing = [];
  for (const metric of metrics) {
    const value = stats?.[metric.key];
    if (value === undefined || value === '') missing.push(metric);
    else found.push({ metric, value });
  }

  const evidence = found.map(({metric,value}) => `${playerName}: ${metric.key}=${value}`);
  const foundText = found.map(({metric,value}) => `${metric.label}は${value}`).join('、');
  const missingText = missing.map(metric => metric.label).join('・');
  let answer = '';
  if (found.length) answer = `${playerName}の${label}${foundText}です。`;
  if (missing.length) {
    const prefix = answer ? `${answer.slice(0,-1)}。` : '';
    answer = `${prefix}${playerName}の${label}${domainLabel}${missingText}は、正本XLSMから確認できませんでした。数値は作りません。`;
  }

  return resultBase({
    routed, season, source, answer, evidence,
    refusedToInvent: missing.length > 0,
    limitation: missing.length ? `${domainLabel === '投手' ? 'PITCHING' : 'BATTING'}_METRIC_MISSING_${missing.map(x=>x.key).join('_')}` : null
  });
}

function teamMetricAnswer({ routed, season, source, label, team, metrics }) {
  const found = [];
  const missing = [];
  for (const metric of metrics) {
    const value = team?.[metric.key];
    if (value === undefined || value === '') missing.push(metric);
    else found.push({metric,value});
  }
  const parts = found.map(({metric,value}) => `${metric.label}は${value}`);
  let answer = parts.length ? `${label}の${parts.join('、')}です。` : '';
  if (missing.length) {
    const msg = `${missing.map(x=>x.label).join('・')}を正本XLSMから確認できませんでした。数値は作りません。`;
    answer = answer ? `${answer} ${msg}` : msg;
  }
  return resultBase({
    routed, season, source, answer,
    evidence: found.map(({metric,value})=>`${metric.key}=${value}`),
    refusedToInvent: missing.length > 0,
    limitation: missing.length ? `TEAM_METRIC_MISSING_${missing.map(x=>x.key).join('_')}` : null
  });
}

function teamRecordAnswer({ routed, season, source, label, team, question }) {
  const q = text(question);
  const wantsGames = /試合数|何試合/.test(q);
  const wantsDraws = /引き分け|分け|全部|すべて/.test(q);
  const asksRecord = /何勝何敗|勝敗|成績|戦績|勝ち|負け|敗/.test(q);
  const requested = [];
  if (wantsGames) requested.push(['games','試合数','試合']);
  if (asksRecord || !wantsGames) {
    requested.push(['wins','勝','勝'],['losses','敗','敗']);
    if (wantsDraws) requested.push(['draws','分','分']);
  }
  const missing = requested.filter(([key]) => team?.[key] === null || team?.[key] === undefined);
  const found = requested.filter(([key]) => team?.[key] !== null && team?.[key] !== undefined);
  let answer = `${label}のチーム成績は${found.map(([key,,suffix])=>`${team[key]}${suffix}`).join('')}です。`;
  if (missing.length) {
    answer += ` ${missing.map(([,name])=>name).join('・')}は正本XLSMから確認できませんでした。数値は作りません。`;
  }
  return resultBase({
    routed, season, source, answer,
    evidence: found.map(([key])=>`${key}=${team[key]}`),
    refusedToInvent: missing.length > 0,
    limitation: missing.length ? `TEAM_RECORD_MISSING_${missing.map(([key])=>key).join('_')}` : null
  });
}

function overviewRequestedMetrics(question) {
  const q = text(question);
  let batting = detectMetrics(q, BATTING_METRICS);
  let pitching = detectMetrics(q, PITCHING_METRICS);
  if (/奪三振/.test(q)) batting = batting.filter(x => x.key !== 'SO');
  if (/与四球/.test(q)) batting = batting.filter(x => x.key !== 'BB');
  if (/被安打/.test(q)) batting = batting.filter(x => x.key !== 'H');
  if (/被本塁打|被本塁/.test(q)) batting = batting.filter(x => x.key !== 'HR');
  if (/投球回|イニング|登板|防御率|ERA|WHIP|自責点|失点|暴投|被打率/.test(q) && !/打撃|打率|OPS|出塁率|長打率|打点|安打|本塁打/.test(q)) batting = [];
  return { batting, pitching };
}

export async function buildLiveAnswer({ question, routed, auditProvider = runDriveLiveAudit }) {
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
      answer:'通算成績は現チームと旧チームを合算・再計算する必要があります。現在のライブ回答では誤集計防止のため、通算値はまだ出しません。',
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
    const live = await auditProvider({ season, players:[] });
    const source = sourceFromLive(live);
    const label = periodLabel(season, live);
    const team = live?.extracted?.team || {};
    const metrics = detectMetrics(q, TEAM_METRICS);
    if (metrics.length) return teamMetricAnswer({ routed, season, source, label, team, metrics });
    return teamRecordAnswer({ routed, season, source, label, team, question:q });
  }

  const players = Array.isArray(routed?.players) ? routed.players : [];
  if (players.length !== 1) {
    return resultBase({ routed, season, answer:'対象選手を一人に特定できませんでした。', refusedToInvent:true, limitation:'PLAYER_NOT_UNIQUE' });
  }

  const playerName = players[0];
  const live = await auditProvider({ season, players:[playerName] });
  const source = sourceFromLive(live);
  const label = periodLabel(season, live);
  const player = live?.extracted?.playersByName?.[playerName] || null;
  if (!player) {
    return resultBase({ routed, season, source, answer:`${playerName}の${label}成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'PLAYER_NOT_IN_LIVE_EXTRACT' });
  }

  if (routed.route === 'BATTING_LOOKUP') {
    const stats = player.batting;
    if (!stats) return resultBase({ routed, season, source, answer:`${playerName}の${label}打撃成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'BATTING_NOT_FOUND' });
    const metrics = detectMetrics(q, BATTING_METRICS);
    if (metrics.length) return answerMetricSet({ routed, season, source, playerName, label, stats, metrics, domainLabel:'打撃' });
    const parts = availableSummary(stats, [['AVG','打率'],['OPS','OPS'],['H','安打'],['RBI','打点'],['HR','本塁打']]);
    return resultBase({ routed, season, source, answer:`${playerName}の${label}打撃成績は、${parts.join('、')}です。`, evidence:parts });
  }

  if (routed.route === 'PITCHING_LOOKUP') {
    const stats = player.pitching;
    if (!stats) return resultBase({ routed, season, source, answer:`${playerName}の${label}投手成績を正本XLSMから確認できませんでした。数値は作りません。`, refusedToInvent:true, limitation:'PITCHING_NOT_FOUND' });
    const metrics = detectMetrics(q, PITCHING_METRICS);
    if (metrics.length) return answerMetricSet({ routed, season, source, playerName, label, stats, metrics, domainLabel:'投手' });
    const parts = availableSummary(stats, [['ERA','防御率'],['IP','投球回'],['SO','奪三振'],['BB','与四球'],['WHIP','WHIP']]);
    return resultBase({ routed, season, source, answer:`${playerName}の${label}投手成績は、${parts.join('、')}です。`, evidence:parts });
  }

  const batting = player.batting;
  const pitching = player.pitching;
  const requested = overviewRequestedMetrics(q);
  if (requested.batting.length || requested.pitching.length) {
    const found = [];
    const missing = [];
    for (const metric of requested.batting) {
      const value = batting?.[metric.key];
      if (value === undefined || value === '') missing.push(`打撃${metric.label}`); else found.push({domain:'B',metric,value});
    }
    for (const metric of requested.pitching) {
      const value = pitching?.[metric.key];
      if (value === undefined || value === '') missing.push(`投手${metric.label}`); else found.push({domain:'P',metric,value});
    }
    let answer = found.length ? `${playerName}の${label}${found.map(x=>`${x.metric.label}は${x.value}`).join('、')}です。` : '';
    if (missing.length) answer += `${answer?' ':''}${missing.join('・')}は正本XLSMから確認できませんでした。数値は作りません。`;
    return resultBase({
      routed, season, source, answer,
      evidence: found.map(x=>`${x.domain}:${x.metric.key}=${x.value}`),
      refusedToInvent: missing.length > 0,
      limitation: missing.length ? `PLAYER_OVERVIEW_METRIC_MISSING_${missing.join('_')}` : null
    });
  }

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
