import { readBody, requirePost, requireSameOrigin, rateLimit, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';
import { OFFICIAL_PLAYER_REGISTRY, canonicalizeKnownNameText } from './_roster.js';

const ROUTER_VERSION = 'fast-live-v1-deterministic-obvious-lookup';

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

  const partHits = new Map();
  for (const official of OFFICIAL_PLAYER_REGISTRY) {
    const [surname, given] = official.split(' ');
    for (const part of [surname, given]) {
      if (!part || part.length < 2) continue;
      if (!normalized.includes(part)) continue;
      if (!partHits.has(part)) partHits.set(part, []);
      partHits.get(part).push(official);
    }
  }

  const candidates = new Set();
  for (const names of partHits.values()) {
    if (names.length === 1) candidates.add(names[0]);
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

function detectTimeScope(q) {
  if (/2025\s*[-–—〜~]\s*2026|旧チーム|前チーム|昨季|去年|前年度|前シーズン/.test(q)) {
    return { timeScope:'PREVIOUS_SEASON', specificSeason:/2025\s*[-–—〜~]\s*2026/.test(q) ? '2025-2026' : '' };
  }
  if (/通算|全期間/.test(q)) return { timeScope:'CAREER', specificSeason:'' };
  const specific = q.match(/20\d{2}\s*[-–—〜~]\s*20\d{2}/)?.[0]?.replace(/\s+/g,'') || '';
  if (specific) return { timeScope:'SPECIFIC_SEASON', specificSeason:specific };
  if (/今季|今シーズン|今年度|今年|現チーム/.test(q)) return { timeScope:'CURRENT_SEASON', specificSeason:'' };
  return { timeScope:'UNSPECIFIED', specificSeason:'' };
}

function buildFastRoute(question) {
  const q = text(question);
  if (!q || q.length > 200 || /PDF|ＰＤＦ/.test(q) || hasDecisionIntent(q)) return null;
  const player = resolveUniquePlayer(q);
  const domain = detectDomain(q);
  if (!player || !domain) return null;
  const time = detectTimeScope(q);
  const route = domain === 'PITCHING' ? 'PITCHING_LOOKUP' : 'BATTING_LOOKUP';
  return {
    route,
    confidence:'HIGH',
    understoodRequest:`${player}の${domain === 'PITCHING' ? '投手' : '打撃'}成績を確認する`,
    routeReason:'選手と照会指標が文字列から一意に確定したため、モデル判定を省略する。',
    players:[player],
    domains:[domain],
    timeScope:time.timeScope,
    specificSeason:time.specificSeason,
    needsDeliberation:false,
    needsClarification:false,
    clarificationQuestion:'',
    safeToExecute:true,
    safetyStatus:'READY',
    routerVersion:ROUTER_VERSION,
    fastPath:true
  };
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  const member = await requireApprovedMember(req, res);
  if (!member) return;

  try {
    const body = await readBody(req);
    const question = text(body?.question).slice(0, 4000);
    if (!question) return sendJson(res, 400, { ok:false, error:'question is required' });

    const routed = buildFastRoute(question);
    if (!routed) return sendJson(res, 200, { ok:true, handled:false, fastPath:true });

    const started = Date.now();
    const result = routed.route === 'PITCHING_LOOKUP'
      ? await buildStrictPitchingAnswer({ question, routed })
      : await buildLiveAnswer({ question, routed });

    return sendJson(res, 200, {
      ...result,
      handled:true,
      fastPath:true,
      fastRouterVersion:ROUTER_VERSION,
      fastElapsedMs:Date.now() - started
    });
  } catch (error) {
    console.error('[MAGI fast live]', error?.message || error);
    return sendJson(res, 502, { ok:false, error:error?.message || 'Fast live lookup failed' });
  }
}
