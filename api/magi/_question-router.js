import { callGemini } from './_gemini.js';
import { OFFICIAL_PLAYER_REGISTRY, canonicalPlayerNameStrict, canonicalizeKnownNameText } from './_roster.js';

const ROUTER_VERSION = 'v2-accuracy-first';
const ROUTES = Object.freeze([
  'BATTING_LOOKUP',
  'PITCHING_LOOKUP',
  'PLAYER_COMPARISON',
  'TEAM_LOOKUP',
  'DOCUMENT_SEARCH',
  'DELIBERATION',
  'GENERAL_QUESTION',
  'CLARIFY',
  'UNSUPPORTED'
]);
const ROUTE_SET = new Set(ROUTES);
const CONFIDENCE_SET = new Set(['HIGH','MEDIUM','LOW']);
const DOMAIN_SET = new Set(['BATTING','PITCHING','FIELDING','RUNNING','LINEUP','TACTICS','DEVELOPMENT','TEAM','DOCUMENTS','OTHER']);
const TIME_SCOPE_SET = new Set(['CAREER','CURRENT_SEASON','PREVIOUS_SEASON','SPECIFIC_SEASON','RECENT_6','RECENT','UNSPECIFIED']);
const EXECUTION_ROUTES = new Set(['BATTING_LOOKUP','PITCHING_LOOKUP','PLAYER_COMPARISON','TEAM_LOOKUP','DOCUMENT_SEARCH','DELIBERATION']);

const ROUTER_SYSTEM = `
あなたは《MAGI》質問理解ルーター。役割は回答ではなく、ユーザーの自然言語質問の意味を理解し、次に実行すべき処理を1つだけ決めること。

現在は ACCURACY FIRST（正確性最優先）モードである。速さや会話の短さより、誤った処理を起動しないことを優先する。

最重要原則:
- キーワード一致ではなく、文全体の意味・依頼目的・省略・言い間違い・曖昧さ・直前の会話を解釈する。
- 実行ルートを選ぶのは、その意味が十分に確定している場合だけ。迷うなら CLARIFY を選ぶ。
- CLARIFY は失敗ではない。情報不足・複数解釈・対象不明・文脈参照不明のときの正解である。
- 質問が意味不明でも無理に推測しない。
- 一度の聞き返しで解消できる曖昧さは、できるだけまとめて確認する。ただし正確性を犠牲にしてはいけない。
- 前のターンですでに確定した選手名・領域・期間・対象は保持する。同じことを何度も聞き直さない。
- ユーザーの短い返答（例:「投手」「今季」「それ」「うん」）は、直前のMAGIの確認質問への回答として suppliedContext と合わせて解釈する。
- suppliedContext に複数の候補があり一意に結びつかない場合は推測せず CLARIFY。
- 事実照会と判断依頼を厳密に分ける。数値・記録を「教えて/見せて/出して」は原則照会。起用・評価・優劣・べき論・戦術判断は DELIBERATION。
- PLAYER_COMPARISON は数値や事実の比較だけに使う。どちらを起用すべきか、誰が向くか、4番は誰か等の判断は DELIBERATION。
- 「投手成績」は PITCHING_LOOKUP。「打撃成績」は BATTING_LOOKUP。
- 「成績」だけで打撃/投手を一意に確定できない場合は、勝手に打撃へ寄せず CLARIFY。
- 「昨日のあれ」「さっきのやつ」「これどう？」等の指示語は suppliedContext だけで一意に解決できるときだけ解決する。解決不能なら CLARIFY。
- 選手名は officialPlayers を参照する。表記揺れ・軽微な誤字・一意な呼び方は公式名へ正規化してよいが、複数候補があるなら CLARIFY。
- 3賢人審議は route=DELIBERATION のときだけ必要。照会や資料検索では needsDeliberation=false。
- ユーザーへの最終回答や成績数値は作らない。ここでは質問理解だけ行う。

confidence の基準:
HIGH = 対象・依頼内容・必要な処理が一意に確定しており、そのまま実行してよい。
MEDIUM = 有力な解釈はあるが、別解釈も現実的にあり得る。ACCURACY FIRSTでは原則 CLARIFY。
LOW = 情報不足・意味不明・文脈不足・対象不明。必ず CLARIFY または UNSUPPORTED。

route 定義:
BATTING_LOOKUP = 選手の打撃成績・打率・OPS・安打・打点等の事実照会
PITCHING_LOOKUP = 選手の投手成績・防御率・投球回・奪三振・WHIP等の事実照会
PLAYER_COMPARISON = 複数選手の事実・数値を比較するだけの依頼
TEAM_LOOKUP = チーム全体の勝敗・成績・試合記録等の事実照会
DOCUMENT_SEARCH = Drive等の資料・レポート・ファイルを探す/見せる依頼
DELIBERATION = 起用、打順、先発、継投、評価、育成、戦術、選択、推奨など判断が必要
GENERAL_QUESTION = MAGIの使い方、仕組み、野球一般など、専用データ照会/審議ではない質問
CLARIFY = 意味・対象・期間・打撃/投手等が不足し、安全に1ルートへ確定できない
UNSUPPORTED = MAGIの対象外で、質問自体は明確だが現在のMAGIで扱わない方がよい

代表例:
「宮嵜 翔の通算投手成績を教えて」=> PITCHING_LOOKUP / CAREER / HIGH / needsDeliberation=false
「宮嵜 翔の通算打撃成績を教えて」=> BATTING_LOOKUP / CAREER / HIGH / needsDeliberation=false
「宮嵜 翔の成績を教えて」=> CLARIFY（打撃か投手か確認）
前ターン「宮嵜 翔の成績を教えて」→MAGI「打撃と投手どちら？」→ユーザー「投手」=> PITCHING_LOOKUP / 宮嵜 翔 / HIGH
「大野 竜暉と大久保 陽翔の通算打撃成績を比べて」=> PLAYER_COMPARISON / BATTING / HIGH / needsDeliberation=false
「大野 竜暉と大久保 陽翔ならどっちを4番にする？」=> DELIBERATION / LINEUP / HIGH / needsDeliberation=true
「大野 竜暉をクローザー固定すべき？」=> DELIBERATION / PITCHING+TACTICS / HIGH / needsDeliberation=true
「陽翔どう？」=> CLARIFY
「昨日のあれどうだった？」=> suppliedContextで一意に解決できなければ CLARIFY
「チームの通算勝敗を教えて」=> TEAM_LOOKUP / HIGH
「8月号のTEAM REPORTを見せて」=> DOCUMENT_SEARCH / HIGH
「MAGIって何？」=> GENERAL_QUESTION / HIGH

出力規則:
- understoodRequest は質問を勝手に膨らませず1文で言い換える。
- routeReason は、なぜそのルートまたはCLARIFYなのかを短い1文で書く。回答や評価は書かない。
- clarificationQuestion は1回の聞き返しで最も情報量が増える短い日本語質問にする。
- ambiguities は未解決点だけを列挙する。実行可能なら空配列にする。
- unresolvedEntities は公式名などへ解決できない固有名詞だけを列挙する。
- contextReferences は suppliedContext を使って解決した参照だけを書く。
- contextRequired=true は、現在の質問単体では意味が足りず suppliedContext を使って初めて解決した場合だけ。
`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    route: { type: 'STRING', enum: ROUTES },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    understoodRequest: { type: 'STRING' },
    routeReason: { type: 'STRING' },
    players: { type: 'ARRAY', items: { type: 'STRING' } },
    domains: { type: 'ARRAY', items: { type: 'STRING', enum: [...DOMAIN_SET] } },
    timeScope: { type: 'STRING', enum: [...TIME_SCOPE_SET] },
    specificSeason: { type: 'STRING' },
    opponent: { type: 'STRING' },
    needsDeliberation: { type: 'BOOLEAN' },
    needsClarification: { type: 'BOOLEAN' },
    clarificationQuestion: { type: 'STRING' },
    contextRequired: { type: 'BOOLEAN' },
    contextReferences: { type: 'ARRAY', items: { type: 'STRING' } },
    ambiguities: { type: 'ARRAY', items: { type: 'STRING' } },
    unresolvedEntities: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: [
    'route','confidence','understoodRequest','routeReason','players','domains','timeScope','specificSeason','opponent',
    'needsDeliberation','needsClarification','clarificationQuestion','contextRequired','contextReferences',
    'ambiguities','unresolvedEntities'
  ]
};

function cleanText(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeContext(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).map((item, index) => {
    if (typeof item === 'string') return { role: 'user', text: canonicalizeKnownNameText(cleanText(item, 3000)), index };
    const role = ['user','assistant','system'].includes(String(item?.role || '').toLowerCase())
      ? String(item.role).toLowerCase()
      : 'user';
    return { role, text: canonicalizeKnownNameText(cleanText(item?.text ?? item?.content, 3000)), index };
  }).filter(x => x.text);
}

function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => cleanText(v, 300)).filter(Boolean))];
}

function normalizeResult(raw) {
  const modelRoute = ROUTE_SET.has(String(raw?.route || '').toUpperCase()) ? String(raw.route).toUpperCase() : 'CLARIFY';
  const confidence = CONFIDENCE_SET.has(String(raw?.confidence || '').toUpperCase()) ? String(raw.confidence).toUpperCase() : 'LOW';
  const unresolved = uniq(raw?.unresolvedEntities);
  const players = [];
  for (const value of Array.isArray(raw?.players) ? raw.players : []) {
    const text = cleanText(value, 100);
    if (!text) continue;
    const official = canonicalPlayerNameStrict(text);
    if (official) {
      if (!players.includes(official)) players.push(official);
    } else if (!unresolved.includes(text)) unresolved.push(text);
  }

  const domains = uniq(raw?.domains).map(x => x.toUpperCase()).filter(x => DOMAIN_SET.has(x));
  const timeScopeRaw = String(raw?.timeScope || '').toUpperCase();
  const timeScope = TIME_SCOPE_SET.has(timeScopeRaw) ? timeScopeRaw : 'UNSPECIFIED';

  return {
    modelRoute,
    route: modelRoute,
    confidence,
    understoodRequest: cleanText(raw?.understoodRequest, 700),
    routeReason: cleanText(raw?.routeReason, 700),
    players,
    domains,
    timeScope,
    specificSeason: cleanText(raw?.specificSeason, 50),
    opponent: cleanText(raw?.opponent, 120),
    needsDeliberation: modelRoute === 'DELIBERATION',
    needsClarification: raw?.needsClarification === true || modelRoute === 'CLARIFY',
    clarificationQuestion: cleanText(raw?.clarificationQuestion, 500),
    contextRequired: raw?.contextRequired === true,
    contextReferences: uniq(raw?.contextReferences),
    ambiguities: uniq(raw?.ambiguities),
    unresolvedEntities: unresolved
  };
}

function firstOfficialPlayerInText(text) {
  const source = canonicalizeKnownNameText(String(text || ''));
  const found = OFFICIAL_PLAYER_REGISTRY.filter(name => source.includes(name));
  return found.length === 1 ? found[0] : null;
}

function maybeCarryUniquePlayerFromContext(result, suppliedContext) {
  if (result.players.length || !['BATTING_LOOKUP','PITCHING_LOOKUP'].includes(result.modelRoute)) return result;
  const recent = [...suppliedContext].reverse();
  const candidates = [];
  for (const item of recent) {
    const p = firstOfficialPlayerInText(item?.text);
    if (p && !candidates.includes(p)) candidates.push(p);
    if (candidates.length > 1) break;
  }
  if (candidates.length === 1) {
    result.players = [candidates[0]];
    if (!result.contextReferences.includes(`player:${candidates[0]}`)) result.contextReferences.push(`player:${candidates[0]}`);
    result.contextRequired = true;
  }
  return result;
}

function defaultClarification(result, issues) {
  if (issues.includes('PLAYER_REQUIRED')) {
    return result.modelRoute === 'PITCHING_LOOKUP' ? '誰の投手成績を確認しますか？' : '誰の打撃成績を確認しますか？';
  }
  if (issues.includes('COMPARISON_PLAYERS_REQUIRED')) return '比較する選手を2人以上教えてください。';
  if (issues.includes('SPECIFIC_SEASON_REQUIRED')) return '対象にしたい年度を教えてください。';
  if (issues.includes('CONTEXT_NOT_RESOLVED')) return '「それ」「あれ」が何を指しているか、もう少し具体的に教えてください。';
  if (issues.includes('DOMAIN_ROUTE_MISMATCH')) return '打撃と投手など、どの領域について確認したいか教えてください。';
  if (issues.includes('UNRESOLVED_ENTITY')) return '対象名を正確に確認したいので、選手名や資料名をもう少し具体的に教えてください。';
  if (issues.includes('AMBIGUITY_REMAINS')) return '解釈が複数残っています。何について知りたいか、もう少し具体的に教えてください。';
  if (issues.includes('CONFIDENCE_NOT_HIGH')) return 'この解釈で実行するにはまだ確信が足りません。対象や知りたい内容をもう少し具体的に教えてください。';
  return '質問の対象や知りたい内容を、もう少し具体的に教えてください。';
}

function validateAndGate(result, suppliedContext) {
  const issues = [];

  if (EXECUTION_ROUTES.has(result.modelRoute) && result.confidence !== 'HIGH') issues.push('CONFIDENCE_NOT_HIGH');
  if (result.unresolvedEntities.length) issues.push('UNRESOLVED_ENTITY');
  if (result.ambiguities.length) issues.push('AMBIGUITY_REMAINS');
  if (result.contextRequired && !result.contextReferences.length) issues.push('CONTEXT_NOT_RESOLVED');
  if (result.timeScope === 'SPECIFIC_SEASON' && !result.specificSeason) issues.push('SPECIFIC_SEASON_REQUIRED');

  if (result.modelRoute === 'BATTING_LOOKUP') {
    if (!result.players.length) issues.push('PLAYER_REQUIRED');
    if (result.domains.length && !result.domains.includes('BATTING')) issues.push('DOMAIN_ROUTE_MISMATCH');
  }
  if (result.modelRoute === 'PITCHING_LOOKUP') {
    if (!result.players.length) issues.push('PLAYER_REQUIRED');
    if (result.domains.length && !result.domains.includes('PITCHING')) issues.push('DOMAIN_ROUTE_MISMATCH');
  }
  if (result.modelRoute === 'PLAYER_COMPARISON' && result.players.length < 2) issues.push('COMPARISON_PLAYERS_REQUIRED');

  const uniqueIssues = [...new Set(issues)];
  const modelRequestedClarify = result.modelRoute === 'CLARIFY' || result.needsClarification;
  const mustClarify = modelRequestedClarify || uniqueIssues.length > 0;

  if (mustClarify) {
    result.route = 'CLARIFY';
    result.needsClarification = true;
    result.needsDeliberation = false;
    if (!result.clarificationQuestion) result.clarificationQuestion = defaultClarification(result, uniqueIssues);
  } else {
    result.route = result.modelRoute;
    result.needsClarification = false;
    result.clarificationQuestion = '';
    result.needsDeliberation = result.route === 'DELIBERATION';
  }

  result.validationIssues = uniqueIssues;
  result.safetyStatus = result.route === 'CLARIFY' ? 'NEEDS_CLARIFICATION' : result.route === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'READY';
  result.safeToExecute = result.safetyStatus === 'READY';
  result.contextTurnCount = suppliedContext.length;
  return result;
}

export async function routeQuestion(questionValue, contextValue = []) {
  const question = canonicalizeKnownNameText(cleanText(questionValue, 4000));
  if (!question) throw new Error('question is required');
  const suppliedContext = normalizeContext(contextValue);
  const raw = await callGemini({
    systemInstruction: ROUTER_SYSTEM,
    userPayload: {
      question,
      suppliedContext,
      officialPlayers: OFFICIAL_PLAYER_REGISTRY,
      mode: 'ACCURACY_FIRST',
      instruction: 'Classify only. Do not answer the baseball question itself. Only choose an executable route when confidence is HIGH and ambiguity is resolved. Otherwise choose CLARIFY.'
    },
    responseSchema
  });
  const normalized = maybeCarryUniquePlayerFromContext(normalizeResult(raw), suppliedContext);
  const gated = validateAndGate(normalized, suppliedContext);
  return { routerVersion: ROUTER_VERSION, ...gated };
}
