import { callGemini } from './_gemini.js';
import { OFFICIAL_PLAYER_REGISTRY, canonicalPlayerNameStrict, canonicalizeKnownNameText } from './_roster.js';

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

const ROUTER_SYSTEM = `
あなたは《MAGI》質問理解ルーター。役割は回答ではなく、ユーザーの自然言語質問の意味を理解し、次に実行すべき処理を1つだけ決めること。

最重要原則:
- キーワード一致ではなく、文全体の意味・依頼目的・省略・言い間違い・曖昧さを解釈する。
- 自信がないのに既存機能へ押し込まない。安全に実行できないなら CLARIFY を選ぶ。
- CLARIFY は失敗ではない。情報不足・複数解釈・対象不明・文脈参照不明のときの正解である。
- 質問が意味不明でも無理に推測しない。
- 事実照会と判断依頼を厳密に分ける。数値・記録を「教えて/見せて/出して」は原則照会。起用・評価・優劣・べき論・戦術判断は DELIBERATION。
- PLAYER_COMPARISON は数値や事実の比較だけに使う。どちらを起用すべきか、誰が向くか、4番は誰か等の判断は DELIBERATION。
- 「投手成績」は必ず PITCHING_LOOKUP。「打撃成績」は必ず BATTING_LOOKUP。
- 「成績」だけで打撃/投手を一意に確定できない場合は、勝手に打撃へ寄せず CLARIFY。
- 「昨日のあれ」「さっきのやつ」「これどう？」等の指示語は suppliedContext だけで一意に解決できるときだけ解決する。解決不能なら CLARIFY。
- 選手名は officialPlayers を参照する。表記揺れ・軽微な誤字・一意な呼び方は公式名へ正規化してよいが、複数候補があるなら CLARIFY。
- 3賢人審議は route=DELIBERATION のときだけ必要。照会や資料検索では needsDeliberation=false。
- ユーザーへの最終回答や成績数値は作らない。ここでは質問理解だけ行う。
- CLARIFY は「次に何を実行すべきか」が一意に決まらないときだけ使う。判断材料が十分か不足かはルーターでは評価しない。判断依頼の対象と目的が明確なら、材料が1項目しかなくても DELIBERATION に送る。
- 直前の数値照会・比較・資料確認を受けて「それ見て判断して」「その結果ならどうする？」「じゃあ起用する？」「それを踏まえて決めて」等と判断へ移る場合、直前までに確定した対象・領域・期間・参照結果を引き継ぎ DELIBERATION に送る。

会話型聞き返しの絶対ルール:
- suppliedContext は古い順に並ぶ会話履歴である。current question が「投手」「通算で」「それ」「うん」など短い返答でも、直前までの会話を必ず引き継いで解釈する。
- 直前の assistant 発言が質問・確認である場合、current question はその返答である可能性を最優先で検討する。
- すでに確定した情報（対象選手、打撃/投手、期間、目的）は次の聞き返しで失わない。ユーザーに同じことを何度も聞かない。
- 1回の返答で不足情報が1つ埋まっても、まだ安全に1ルートへ確定できなければ CLARIFY を続ける。
- CLARIFY では、その時点で最も判断を分ける不足情報を1つだけ、短く具体的に聞く。選択肢を示せるなら示す。
- current question と suppliedContext を合わせて意図が確定したら、CLARIFY を続けず実行ルートへ進む。
- 文脈から確定した内容は understoodRequest に統合して書く。current question の断片だけを言い換えない。
- ユーザーが訂正した場合は最新の明示情報を優先する。例: 「打撃じゃなく投手」なら投手を採用する。
- ユーザーが「わからない」「どっちでも」など不足を解消しない返答をした場合、勝手に決めず、聞き方を変えて CLARIFY を続ける。
- 「それ」「その数字」「その結果」「さっきのデータ」などが直前の照会対象に一意に対応するなら参照解決済みとして扱う。current question に選手名や指標名が再掲されていないことだけを理由に CLARIFY してはいけない。
- ルーターが確認するのは「依頼の意味が実行可能なほど明確か」であり、「審議で十分な証拠が揃っているか」ではない。証拠不足の判断は DELIBERATION 側の責務である。

route 定義:
BATTING_LOOKUP = 打撃成績・打率・OPS・安打・打点等の事実照会
PITCHING_LOOKUP = 投手成績・防御率・投球回・奪三振・WHIP等の事実照会
PLAYER_COMPARISON = 複数選手の事実・数値を比較するだけの依頼
TEAM_LOOKUP = チーム全体の勝敗・成績・試合記録等の事実照会
DOCUMENT_SEARCH = Drive等の資料・レポート・ファイルを探す/見せる依頼
DELIBERATION = 起用、打順、先発、継投、評価、育成、戦術、選択、推奨など判断が必要
GENERAL_QUESTION = MAGIの使い方、仕組み、野球一般など、専用データ照会/審議ではない質問
CLARIFY = 意味・対象・期間・打撃/投手等が不足し、安全に1ルートへ確定できない
UNSUPPORTED = MAGIの対象外で、質問自体は明確だが現在のMAGIで扱わない方がよい

代表例:
「宮嵜 翔の通算投手成績を教えて」=> PITCHING_LOOKUP / CAREER / needsDeliberation=false
「宮嵜 翔の通算打撃成績を教えて」=> BATTING_LOOKUP / CAREER / needsDeliberation=false
「宮嵜 翔の成績を教えて」=> 打撃か投手か一意でなければ CLARIFY
「大野 竜暉と大久保 陽翔の通算打撃成績を比べて」=> PLAYER_COMPARISON / BATTING / needsDeliberation=false
「大野 竜暉と大久保 陽翔ならどっちを4番にする？」=> DELIBERATION / LINEUP / needsDeliberation=true
「大野 竜暉をクローザー固定すべき？」=> DELIBERATION / PITCHING+TACTICS / needsDeliberation=true
「陽翔どう？」=> CLARIFY
「昨日のあれどうだった？」=> suppliedContextで解決できなければ CLARIFY
「チームの通算勝敗を教えて」=> TEAM_LOOKUP
「8月号のTEAM REPORTを見せて」=> DOCUMENT_SEARCH
「MAGIって何？」=> GENERAL_QUESTION

会話例1:
user: 「宮嵜 翔の成績を教えて」
assistant: 「打撃成績と投手成績、どちらを見ますか？」
user: 「投手」
=> PITCHING_LOOKUP。players=["宮嵜 翔"] を保持し、timeScope は元質問に期間指定がなければ UNSPECIFIED。

会話例2:
user: 「陽翔どう？」
assistant: 「大久保 陽翔について、成績を見たいですか、それとも起用や状態を評価してほしいですか？」
user: 「評価して」
=> DELIBERATION。players=["大久保 陽翔"] を保持する。

会話例3:
user: 「陽翔どう？」
assistant: 「大久保 陽翔について、成績を見たいですか、それとも起用や状態を評価してほしいですか？」
user: 「成績」
=> 打撃/投手がまだ未確定なら CLARIFY を続ける。「打撃成績と投手成績、どちらを見ますか？」

会話例4:
user: 「陽翔のOPS教えて」
assistant: （大久保 陽翔のOPSを回答）
user: 「それ見て4番にするか判断して」
=> DELIBERATION。players=["大久保 陽翔"] を保持する。「それ」は直前のOPS照会結果を指す。OPSだけで判断材料が十分かどうかを理由に CLARIFY しない。

会話例5:
user: 「大野と陽翔の投手成績を比べて」
assistant: （比較結果を回答）
user: 「その結果なら次の試合どっちを先発にする？」
=> DELIBERATION。players=["大野 竜暉","大久保 陽翔"] を保持する。

understoodRequest は質問を勝手に膨らませず、会話全体から確定した依頼を1文で言い換える。
clarificationQuestion は1回の聞き返しで最も情報量が増える短い日本語質問にする。
ambiguities は未解決点だけを列挙する。
contextReferences は suppliedContext を使って解決した参照だけを書く。
`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    route: { type: 'STRING', enum: ROUTES },
    confidence: { type: 'STRING', enum: ['HIGH','MEDIUM','LOW'] },
    understoodRequest: { type: 'STRING' },
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
    'route','confidence','understoodRequest','players','domains','timeScope','specificSeason','opponent',
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
  let route = ROUTE_SET.has(String(raw?.route || '').toUpperCase()) ? String(raw.route).toUpperCase() : 'CLARIFY';
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

  const needsClarification = raw?.needsClarification === true || route === 'CLARIFY';
  if (needsClarification) route = 'CLARIFY';
  const needsDeliberation = route === 'DELIBERATION';
  let clarificationQuestion = cleanText(raw?.clarificationQuestion, 500);
  if (needsClarification && !clarificationQuestion) clarificationQuestion = '質問の対象や知りたい内容を、もう少し具体的に教えてください。';
  if (!needsClarification) clarificationQuestion = '';

  const domains = uniq(raw?.domains).map(x => x.toUpperCase()).filter(x => DOMAIN_SET.has(x));
  const timeScopeRaw = String(raw?.timeScope || '').toUpperCase();
  const timeScope = TIME_SCOPE_SET.has(timeScopeRaw) ? timeScopeRaw : 'UNSPECIFIED';

  return {
    route,
    confidence,
    understoodRequest: cleanText(raw?.understoodRequest, 700),
    players,
    domains,
    timeScope,
    specificSeason: cleanText(raw?.specificSeason, 50),
    opponent: cleanText(raw?.opponent, 120),
    needsDeliberation,
    needsClarification,
    clarificationQuestion,
    contextRequired: raw?.contextRequired === true,
    contextReferences: uniq(raw?.contextReferences),
    ambiguities: uniq(raw?.ambiguities),
    unresolvedEntities: unresolved
  };
}

export async function routeQuestion(questionValue, contextValue = []) {
  const question = canonicalizeKnownNameText(cleanText(questionValue, 4000));
  if (!question) throw new Error('question is required');
  const suppliedContext = normalizeContext(contextValue);
  const result = await callGemini({
    systemInstruction: ROUTER_SYSTEM,
    userPayload: {
      question,
      suppliedContext,
      officialPlayers: OFFICIAL_PLAYER_REGISTRY,
      instruction: 'Classify only. Do not answer the baseball question itself. Reconstruct intent from current question plus suppliedContext. If exactly one route cannot be executed safely, choose CLARIFY and ask one focused follow-up question.'
    },
    responseSchema
  });
  return { routerVersion: 'v2-semantic-multiturn-gemini-r2', ...normalizeResult(result) };
}