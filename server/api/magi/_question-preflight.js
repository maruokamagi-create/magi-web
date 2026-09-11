import { OFFICIAL_PLAYER_REGISTRY } from './_roster.js';

export const QUESTION_PREFLIGHT_VERSION = 'question-preflight-v1.1';

const ROLE_WORDS = /(?:クローザ(?:ー)?|抑え|捕手|キャッチャー?|先発|中継ぎ|救援|投手|打順|[1-9１-９一二三四五六七八九]番|主将|副主将|キャプテン|一塁|二塁|三塁|遊撃|ショート|セカンド|サード|ファースト|レフト|ライト|センター|左翼|右翼|中堅|守備位置)/;
const AXIS_WORDS = /(?:打撃|打率|OPS|出塁|長打|投手|防御率|奪三振|制球|守備|守備率|走塁|脚|総合|成績|勝敗|育成|将来|リーダー|主将|キャプテン)/i;
const MATCH_WORDS = /(?:試合|公式戦|練習試合|大会|予選|新人戦|文科省杯|戦\b|vs\b|対戦)/i;

function clean(value, max = 4000) {
  return String(value ?? '').normalize('NFKC').trim().slice(0, max);
}
function compact(value) {
  return clean(value).replace(/[\s　・･_\-\/()（）\[\]【】「」『』“”"'。、，,：:;；!?！？]/g, '');
}
function normalizeContext(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-10).map(item => typeof item === 'string'
    ? { role: 'user', text: clean(item, 2500) }
    : { role: clean(item?.role || 'user', 20), text: clean(item?.text ?? item?.content, 2500) })
    .filter(item => item.text);
}
function jstDateString(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const PLAYERS = OFFICIAL_PLAYER_REGISTRY.map(name => {
  const [surname, given] = name.split(' ');
  return { name, surname, given, compactName: compact(name) };
});
const SURNAME_GROUPS = (() => {
  const map = new Map();
  for (const player of PLAYERS) {
    if (!map.has(player.surname)) map.set(player.surname, []);
    map.get(player.surname).push(player.name);
  }
  return map;
})();
const GIVEN_GROUPS = (() => {
  const map = new Map();
  for (const player of PLAYERS) {
    if (!map.has(player.given)) map.set(player.given, []);
    map.get(player.given).push(player.name);
  }
  return map;
})();

function fullPlayerMatches(value) {
  const c = compact(value);
  return PLAYERS.filter(player => c.includes(player.compactName)).map(player => player.name);
}
function playerReferences(value) {
  const text = clean(value);
  const matches = new Set(fullPlayerMatches(text));
  for (const [surname, names] of SURNAME_GROUPS) {
    if (surname.length < 2 || !text.includes(surname)) continue;
    if (names.length === 1) matches.add(names[0]);
  }
  for (const [given, names] of GIVEN_GROUPS) {
    if (given.length < 2 || !text.includes(given)) continue;
    if (names.length === 1) matches.add(names[0]);
  }
  return [...matches];
}
function contextPlayers(context) {
  const out = new Set();
  for (const item of context) for (const name of playerReferences(item.text)) out.add(name);
  return [...out];
}
function contextHasTopic(context) {
  return context.some(item => playerReferences(item.text).length || ROLE_WORDS.test(item.text) || AXIS_WORDS.test(item.text) || MATCH_WORDS.test(item.text));
}
function contextHasRole(context) {
  return context.some(item => ROLE_WORDS.test(item.text));
}
function contextHasAxis(context) {
  return context.some(item => AXIS_WORDS.test(item.text));
}
function contextHasMatch(context) {
  return context.some(item => MATCH_WORDS.test(item.text));
}
function clarify(question, reason, extra = {}) {
  return {
    action: 'CLARIFY',
    needsClarification: true,
    clarificationQuestion: question,
    reason,
    version: QUESTION_PREFLIGHT_VERSION,
    currentDateJst: jstDateString(),
    ...extra
  };
}

function ambiguousSurname(question) {
  const c = compact(question);
  for (const [surname, names] of SURNAME_GROUPS) {
    if (names.length < 2 || !question.includes(surname)) continue;
    const hasFull = names.some(name => c.includes(compact(name)));
    if (!hasFull) return { surname, names };
  }
  return null;
}

export function preflightQuestion(questionValue, contextValue = []) {
  const question = clean(questionValue);
  const context = normalizeContext(contextValue);
  const currentDateJst = jstDateString();
  if (!question) return clarify('相談内容を入力してください。', 'EMPTY');

  if (/^[?？!！…\s]+$/.test(question) || /^(?:🥺|😭|😢|😕|🤔|😥|😓|😞)+$/.test(question) || /^(.)\1{2,}$/.test(question)) {
    return clarify('何について相談したいですか？', 'MEANINGLESS_OR_EMOJI');
  }

  const amb = ambiguousSurname(question);
  if (amb) {
    return clarify(`${amb.surname}は、${amb.names.join('・')}のどちらですか？`, 'AMBIGUOUS_SURNAME', { candidates: amb.names });
  }

  const qPlayers = playerReferences(question);
  const cPlayers = contextPlayers(context);
  const hasContext = contextHasTopic(context);

  if (/^あいつ(?:最近)?どう(?:思う)?[?？]?$/.test(question)) {
    if (cPlayers.length !== 1) return clarify('誰についてですか？', 'AMBIGUOUS_PRONOUN');
  }
  if (/^(?:どう思う|どう思うの|どう)[?？]?$/.test(question) && !hasContext) {
    return clarify('何について聞きたいですか？', 'MISSING_TOPIC');
  }
  if (/^(?:これでいい|これどう|次どうする)[?？]?$/.test(question) && !hasContext) {
    return clarify('何についての相談か、もう少し教えてください。', 'MISSING_REFERENCE');
  }
  if (/^先発どっち[?？]?$/.test(question) && cPlayers.length < 2) {
    return clarify('先発候補は誰と誰ですか？', 'MISSING_STARTER_CANDIDATES');
  }
  if (/一番いいの誰/.test(question) && !AXIS_WORDS.test(question) && !contextHasAxis(context)) {
    return clarify('何を基準に「一番いい」を決めますか？ 打撃・投手・守備・総合などを教えてください。', 'MISSING_EVALUATION_AXIS');
  }
  if (/固定/.test(question) && (qPlayers.length || cPlayers.length) && !ROLE_WORDS.test(question) && !contextHasRole(context)) {
    const who = qPlayers[0] || (cPlayers.length === 1 ? cPlayers[0] : 'その選手');
    return clarify(`${who}の何を固定する案ですか？ 捕手・打順・クローザーなどを教えてください。`, 'MISSING_FIXED_ROLE');
  }
  if (/^固定した方がいい[?？]?$/.test(question) && !hasContext) {
    return clarify('誰を、何の役割で固定する案ですか？', 'MISSING_FIXED_TARGET');
  }
  if (/^使うならどこ[?？]?$/.test(question) && cPlayers.length !== 1) {
    return clarify('誰をどの守備位置で使う相談ですか？ 選手名を教えてください。', 'MISSING_POSITION_TARGET');
  }
  if (/最近ダメじゃない/.test(question) && qPlayers.length === 0 && cPlayers.length !== 1) {
    return clarify('誰についての評価ですか？', 'MISSING_EVALUATION_TARGET');
  }
  if (/絶対.*勝てる|絶対勝てる|勝てるよな/.test(question) && !MATCH_WORDS.test(question) && !contextHasMatch(context)) {
    return clarify('どの試合についてですか？', 'MISSING_MATCH_TARGET');
  }
  if (/\d+\s*打席.*評価|データ.*打席.*評価/.test(question) && qPlayers.length === 0 && cPlayers.length !== 1) {
    return clarify('誰の打席データについてですか？', 'MISSING_SAMPLE_TARGET');
  }

  return {
    action: 'CONTINUE',
    needsClarification: false,
    reason: 'PREFLIGHT_OK',
    version: QUESTION_PREFLIGHT_VERSION,
    currentDateJst,
    question,
    context,
    questionPlayers: qPlayers,
    contextPlayers: cPlayers
  };
}
