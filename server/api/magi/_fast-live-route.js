import { OFFICIAL_PLAYER_REGISTRY, canonicalizeKnownNameText } from './_roster.js';

export const FAST_LIVE_ROUTER_VERSION = 'fast-live-v1-obvious-single-player-lookup';

function text(value) {
  return String(value || '').normalize('NFKC').trim();
}

function compact(value) {
  return text(value).replace(/[\s　]/g, '');
}

function hasDecisionIntent(q) {
  return /判断|審議|すべき|した方が|どう思う|評価して|どう評価|起用|打順|4番|四番|スタメン|レギュラー|先発させ|クローザー|エース|候補|比較して|比べて|どっち|どちら/.test(q);
}

function resolveUniquePlayer(question) {
  const normalized = canonicalizeKnownNameText(text(question));
  const qCompact = compact(normalized);

  const full = OFFICIAL_PLAYER_REGISTRY.filter(name => {
    const n = text(name);
    return normalized.includes(n) || qCompact.includes(compact(n));
  });
  if (full.length === 1) return full[0];
  if (full.length > 1) return null;

  const candidates = new Set();
  for (const official of OFFICIAL_PLAYER_REGISTRY) {
    const [surname, given] = official.split(' ');
    for (const part of [surname, given]) {
      if (!part || part.length < 2 || !normalized.includes(part)) continue;
      const owners = OFFICIAL_PLAYER_REGISTRY.filter(name => name.split(' ').includes(part));
      if (owners.length === 1) candidates.add(official);
    }
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

function detectDomain(q) {
  const pitching = /防御率|ERA|WHIP|奪三振|与四球|投球回|イニング|登板|被打率|自責点|被安打|被本塁打|暴投|投手成績|ピッチャー成績/.test(q);
  const batting = /OPS|打率|AVG|出塁率|OBP|長打率|SLG|打撃成績|安打|ヒット|本塁打|ホームラン|打点|RBI|二塁打|三塁打|死球|犠打|送りバント|犠飛|打数|盗塁刺|盗塁/.test(q)
    || (/四球/.test(q) && !/与四球/.test(q))
    || (/三振/.test(q) && !/奪三振/.test(q));
  if (pitching === batting) return '';
  return pitching ? 'PITCHING' : 'BATTING';
}

function detectTime(q) {
  if (/2025\s*[-–—〜~]\s*2026|旧チーム|前チーム|昨季|去年|前年度|前シーズン/.test(q)) {
    return { timeScope:'PREVIOUS_SEASON', specificSeason:/2025\s*[-–—〜~]\s*2026/.test(q) ? '2025-2026' : '' };
  }
  if (/通算|全期間/.test(q)) return { timeScope:'CAREER', specificSeason:'' };
  const specific = q.match(/20\d{2}\s*[-–—〜~]\s*20\d{2}/)?.[0]?.replace(/\s+/g,'') || '';
  if (specific) return { timeScope:'SPECIFIC_SEASON', specificSeason:specific };
  if (/今季|今シーズン|今年度|今年|現チーム/.test(q)) return { timeScope:'CURRENT_SEASON', specificSeason:'' };
  return { timeScope:'UNSPECIFIED', specificSeason:'' };
}

export function buildFastLiveRoute(questionValue, contextValue = []) {
  const q = text(questionValue);
  if (!q || q.length > 200) return null;
  if (Array.isArray(contextValue) && contextValue.length) return null;
  if (/PDF|ＰＤＦ/.test(q) || hasDecisionIntent(q)) return null;

  const player = resolveUniquePlayer(q);
  const domain = detectDomain(q);
  if (!player || !domain) return null;

  const timing = detectTime(q);
  const route = domain === 'PITCHING' ? 'PITCHING_LOOKUP' : 'BATTING_LOOKUP';
  return {
    route,
    modelRoute: route,
    confidence:'HIGH',
    understoodRequest:`${player}の${domain === 'PITCHING' ? '投手' : '打撃'}成績を確認する`,
    routeReason:'選手と照会指標が一意に確定したため、モデル判定を省略する。',
    players:[player],
    domains:[domain],
    timeScope:timing.timeScope,
    specificSeason:timing.specificSeason,
    opponent:'',
    needsDeliberation:false,
    needsClarification:false,
    clarificationQuestion:'',
    contextRequired:false,
    contextReferences:[],
    ambiguities:[],
    unresolvedEntities:[],
    safeToExecute:true,
    safetyStatus:'READY',
    validationIssues:[],
    routerVersion:FAST_LIVE_ROUTER_VERSION,
    baseRouterVersion:null,
    guardApplied:true,
    guardReason:'DETERMINISTIC_OBVIOUS_SINGLE_PLAYER_LOOKUP',
    fastPath:true
  };
}
