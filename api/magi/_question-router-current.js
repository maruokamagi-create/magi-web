import { routeQuestion as baseRouteQuestion } from './_question-router.js';
import { OFFICIAL_PLAYER_REGISTRY } from './_roster.js';

const CURRENT_ROUTER_VERSION = 'v11-resolved-state-period-guard';

function text(value) {
  return String(value || '').trim();
}

function normalizedContext(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === 'string') return { role: 'user', text: item };
    return { role: String(item?.role || 'user').toLowerCase(), text: String(item?.text ?? item?.content ?? '') };
  }).filter(item => item.text.trim());
}

function hasExplicitComparisonOrDecisionAxis(question) {
  const q = text(question);
  return [
    /打撃|打率|出塁率|長打率|OPS|安打|打点|本塁打|三振|四球/,
    /投手|防御率|投球|奪三振|与四球|WHIP|先発|救援|クローザー|エース/,
    /守備|守備率|失策|エラー|捕球|送球|内野|外野|ポジション/,
    /走塁|盗塁|走力|脚/,
    /打順|4番|四番|起用|適性|評価|育成|戦術|スタメン|レギュラー/,
    /成績|数字|記録|データ|スタッツ/
  ].some(re => re.test(q));
}

function isBarePreferenceComparison(question) {
  const q = text(question);
  const preference = /(?:どっち|どちら).{0,12}(?:が|の方が)?(?:いい|良い|上|優れて)/.test(q);
  return preference && !hasExplicitComparisonOrDecisionAxis(q);
}

function isDomainSpecified(question) {
  return /打撃|打率|OPS|投手|防御率|投球|奪三振|守備|走塁|盗塁/.test(text(question));
}

function isExplicitDecisionRequest(question) {
  return /判断|審議|すべき|した方が|起用|4番|四番|先発|クローザー|エース|打順|スタメン|レギュラー|評価して|どう評価/.test(text(question));
}

function isSelectionOnlyReply(question) {
  const q = text(question).replace(/[。！？!?]/g, '');
  if (!q || q.length > 24) return false;
  if (isDomainSpecified(q) || isExplicitDecisionRequest(q)) return false;
  return /(?:の方|こっち|そっち|こちら|それ|この人|その人)$/.test(q) || /^[^\s]{2,12}(?:の方)?$/.test(q);
}

function latestGenericStatsRequest(context) {
  const users = [...normalizedContext(context)].reverse().filter(item => item.role === 'user');
  for (const item of users) {
    const q = item.text;
    if (/成績/.test(q)) {
      return !isDomainSpecified(q);
    }
    if (isExplicitDecisionRequest(q) || /比べ|比較/.test(q)) return false;
  }
  return false;
}

function periodIntent(question) {
  const q = text(question);
  const candidates = [];
  const add = (regex, scope) => {
    let match;
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    while ((match = re.exec(q))) candidates.push({ index: match.index, scope, value: match[0] });
  };
  add(/\d{4}\s*[-–—〜~]\s*\d{4}/, 'SPECIFIC_SEASON');
  add(/直近\s*6\s*試合/, 'RECENT_6');
  add(/通算|全期間|全部/, 'CAREER');
  add(/今季|今シーズン|今年度|今年/, 'CURRENT_SEASON');
  add(/昨季|去年|前年度|前シーズン/, 'PREVIOUS_SEASON');
  add(/最近|直近/, 'RECENT');
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.index - b.index);
  const chosen = candidates[candidates.length - 1];
  return {
    timeScope: chosen.scope,
    specificSeason: chosen.scope === 'SPECIFIC_SEASON' ? chosen.value.replace(/\s+/g, '') : ''
  };
}

function isPeriodOnlyFollowup(question) {
  const q = text(question).replace(/[。！？!?]/g, '');
  if (!q || q.length > 36 || !periodIntent(q)) return false;
  if (isDomainSpecified(q) || isExplicitDecisionRequest(q) || /比べ|比較|どっち|どちら|誰|何番/.test(q)) return false;
  return /通算|全期間|全部|今季|今シーズン|今年度|今年|昨季|去年|前年度|前シーズン|最近|直近|\d{4}\s*[-–—〜~]\s*\d{4}/.test(q);
}

function domainFromText(value) {
  const q = text(value);
  const pitching = /投手|防御率|投球|奪三振|与四球|WHIP/.test(q);
  const batting = /打撃|打率|OPS|出塁率|長打率|安打|打点|本塁打/.test(q);
  if (pitching === batting) return '';
  return pitching ? 'PITCHING' : 'BATTING';
}

function playersFromText(value) {
  const q = text(value);
  const compact = q.replace(/[\s　]/g, '');
  const matches = OFFICIAL_PLAYER_REGISTRY.filter(name => {
    const noSpace = name.replace(/[\s　]/g, '');
    return q.includes(name) || compact.includes(noSpace);
  });
  return [...new Set(matches)];
}

function latestResolvedLookupState(context) {
  const items = [...normalizedContext(context)].reverse();
  for (const item of items) {
    // In the test harness, a successful route is stored as the assistant's declarative
    // understoodRequest, while clarification text is a question. Only use a resolved,
    // one-player, one-domain state so a period word can never manufacture missing intent.
    if (item.role !== 'assistant') continue;
    const q = item.text;
    if (/[?？]/.test(q)) continue;
    const domain = domainFromText(q);
    if (!domain) continue;
    const players = playersFromText(q);
    if (players.length === 1) return { player: players[0], domain };
    if (players.length > 1) return null;
  }
  return null;
}

function latestLookupDomain(context) {
  const resolved = latestResolvedLookupState(context);
  if (resolved?.domain) return resolved.domain;
  const items = [...normalizedContext(context)].reverse();
  for (const item of items) {
    const domain = domainFromText(item.text);
    if (domain) return domain;
  }
  return '';
}

function latestLookupPlayer(context) {
  const resolved = latestResolvedLookupState(context);
  if (resolved?.player) return resolved.player;
  const items = [...normalizedContext(context)].reverse();
  for (const item of items) {
    const players = playersFromText(item.text);
    if (players.length === 1) return players[0];
    if (players.length > 1) return '';
  }
  return '';
}

function recoverPeriodOnlyLookup(base, question, context) {
  if (!isPeriodOnlyFollowup(question)) return null;
  const intent = periodIntent(question);
  const baseDomains = Array.isArray(base?.domains) ? base.domains : [];
  const basePlayers = Array.isArray(base?.players) ? base.players : [];
  const resolved = latestResolvedLookupState(context);

  const domain = baseDomains.includes('PITCHING') ? 'PITCHING'
    : baseDomains.includes('BATTING') ? 'BATTING'
      : resolved?.domain || latestLookupDomain(context);
  const player = basePlayers.length === 1 ? basePlayers[0]
    : resolved?.player || latestLookupPlayer(context);

  if (!intent || !player || !['PITCHING','BATTING'].includes(domain)) return null;

  const route = domain === 'PITCHING' ? 'PITCHING_LOOKUP' : 'BATTING_LOOKUP';
  return {
    ...base,
    routerVersion: CURRENT_ROUTER_VERSION,
    baseRouterVersion: base?.routerVersion || null,
    route,
    confidence: 'HIGH',
    players: [player],
    domains: [domain],
    timeScope: intent.timeScope,
    specificSeason: intent.specificSeason,
    needsClarification: false,
    clarificationQuestion: '',
    needsDeliberation: false,
    safeToExecute: true,
    safetyStatus: 'READY',
    validationIssues: [],
    guardApplied: true,
    guardReason: 'PERIOD_ONLY_LOOKUP_CONTINUATION_FROM_RESOLVED_STATE',
    understoodRequest: `${player}の${intent.timeScope === 'CAREER' ? '通算' : intent.timeScope === 'CURRENT_SEASON' ? '今季' : intent.timeScope === 'PREVIOUS_SEASON' ? '前シーズン' : intent.timeScope === 'RECENT_6' ? '直近6試合' : intent.timeScope === 'RECENT' ? '最近' : intent.specificSeason}の${domain === 'PITCHING' ? '投手' : '打撃'}成績を確認する`
  };
}

function clarification(base, question, reason) {
  const players = Array.isArray(base?.players) ? base.players : [];
  let clarificationQuestion = '何について知りたいか、もう少し具体的に教えてください。';

  if (reason === 'BARE_PREFERENCE_COMPARISON') {
    clarificationQuestion = '何について比べますか？ 打撃・投手・守備・走塁など、比較したい内容を教えてください。';
  } else if (reason === 'PLAYER_SELECTED_DOMAIN_STILL_MISSING') {
    const player = players.length === 1 ? `「${players[0]}」の` : '';
    clarificationQuestion = `${player}打撃成績と投手成績、どちらを見ますか？`;
  }

  return {
    ...base,
    routerVersion: CURRENT_ROUTER_VERSION,
    baseRouterVersion: base?.routerVersion || null,
    route: 'CLARIFY',
    modelRoute: base?.modelRoute || base?.route || 'CLARIFY',
    confidence: 'HIGH',
    needsClarification: true,
    needsDeliberation: false,
    safeToExecute: false,
    safetyStatus: 'NEEDS_CLARIFICATION',
    clarificationQuestion,
    guardApplied: true,
    guardReason: reason,
    understoodRequest: base?.understoodRequest || text(question)
  };
}

export async function routeQuestion(questionValue, contextValue = []) {
  const question = text(questionValue);
  const context = normalizedContext(contextValue);
  const base = await baseRouteQuestion(question, context);

  // 「AとBどっちがいい？」だけでは、比較軸も意思決定の目的も確定していない。
  // 「どっちを4番」「どっちが先発向き」のように軸が明示されている場合は対象外。
  if (isBarePreferenceComparison(question)) {
    return clarification(base, question, 'BARE_PREFERENCE_COMPARISON');
  }

  // 期間語（「今季」「通算」等）は短い選択返答にも見えるため、
  // 一般の selection-only guard より先に、直前の解決済みLOOKUP状態を使って判定する。
  // 選手＋領域が直前に確定していない場合は何も補完せず、後続の通常判定へ渡す。
  const periodRecovered = recoverPeriodOnlyLookup(base, question, context);
  if (periodRecovered) return periodRecovered;

  // 直前の曖昧な「成績」質問に対し、ユーザーが人物だけを選び直した場合、
  // 人物は確定しても打撃/投手の領域は未確定。勝手に判断・照会へ進まない。
  if (isSelectionOnlyReply(question) && latestGenericStatsRequest(context) && !isDomainSpecified(question) && !isExplicitDecisionRequest(question)) {
    return clarification(base, question, 'PLAYER_SELECTED_DOMAIN_STILL_MISSING');
  }

  return {
    ...base,
    routerVersion: CURRENT_ROUTER_VERSION,
    baseRouterVersion: base?.routerVersion || null,
    guardApplied: false,
    guardReason: ''
  };
}
