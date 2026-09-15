import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { PERSONA_PROMPTS } from './_prompts.js';
import { canonicalizePlayerData } from './_roster.js';
import { isFullLineupQuestion, validateFullLineupOrder } from './_full-lineup.js';

const TURN_ORDER = [
  { key: 'melchior', label: 'MELCHIOR-1', jp: 'メルキオール' },
  { key: 'balthasar', label: 'BALTHASAR-2', jp: 'バルタザール' },
  { key: 'casper', label: 'CASPER-3', jp: 'カスパー' }
];

const turnSchema = {
  type: 'OBJECT',
  properties: {
    speaker: { type: 'STRING' },
    target: { type: 'STRING' },
    sourcePersona: { type: 'STRING' },
    sourceClaim: { type: 'STRING' },
    statement: { type: 'STRING' }
  },
  required: ['speaker','target','sourcePersona','sourceClaim','statement']
};

const text = value => String(value ?? '').trim();
const norm = value => text(value).normalize('NFKC').replace(/[\s　]+/g, '');
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

function validCase(body) {
  const q = text(body?.case?.question);
  return q.length >= 2 && q.length <= 12000;
}

function primaryFor(primary, key) {
  if (primary?.[key]) return primary[key];
  const values = Object.values(primary || {});
  return values.find(v => text(v?.persona).toLowerCase().includes(key)) || null;
}

function primaryMaterial(value) {
  return [
    value?.candidateBasis,
    value?.primaryReason,
    value?.publicStatement,
    ...(Array.isArray(value?.facts) ? value.facts : []),
    ...(Array.isArray(value?.analysis) ? value.analysis : [])
  ].map(text).filter(Boolean).join('。');
}

function dialogueMaterial(turns, label) {
  return turns
    .filter(turn => text(turn?.speaker).toUpperCase() === label)
    .map(turn => text(turn?.statement))
    .filter(Boolean)
    .join('。');
}

function sourceMap(primary, previousDialogue, ownLabel) {
  const out = {};
  for (const persona of TURN_ORDER) {
    if (persona.label === ownLabel) continue;
    const parts = [
      primaryMaterial(primaryFor(primary, persona.key)),
      dialogueMaterial(previousDialogue, persona.label)
    ].filter(Boolean);
    if (parts.length) out[persona.label] = parts.join('。');
  }
  return out;
}

function exactSourceClaim(sourceText, claim) {
  const source = norm(sourceText);
  const needle = norm(claim);
  return needle.length >= 4 && source.includes(needle);
}

function normalizeTarget(value, ownLabel, sources) {
  const raw = text(value).toUpperCase();
  const match = TURN_ORDER.find(p => raw.includes(p.label.split('-')[0]));
  if (match && match.label !== ownLabel && sources[match.label]) return match.label;
  return Object.keys(sources)[0] || '';
}

function statementLooksGrounded(statement, target, sourceClaim) {
  const s = text(statement);
  if (s.length < 12 || s.length > 260) return false;
  const targetPersona = TURN_ORDER.find(p => p.label === target);
  const addressesTarget = !targetPersona || s.includes(targetPersona.jp) || s.includes(targetPersona.label.split('-')[0]);
  if (!addressesTarget) return false;
  if (/Evidence|EVIDENCE|照合|正式ロスター|構造化|プロトコル/.test(s)) return false;
  if (/固定(?:起用|する|で)/.test(s) && !/固定/.test(text(sourceClaim))) return false;
  return true;
}

function lineupOf(primary, key) {
  const value = primaryFor(primary, key);
  const check = validateFullLineupOrder(value?.candidatePlayers);
  return check.ok ? check.order : [];
}

function primaryLineupSummary(primary) {
  const orders = TURN_ORDER.map(p => ({ ...p, order: lineupOf(primary, p.key) }));
  if (orders.some(row => row.order.length !== 9)) return { agreement: [], disagreement: [] };
  const allSame = orders.slice(1).every(row => row.order.every((name, i) => norm(name) === norm(orders[0].order[i])));
  if (allSame) {
    return {
      agreement: ['3賢人の一次打順案は1番から9番まで一致しています。'],
      disagreement: ['打順そのものではなく、その並びを支持する理由と変更条件を互いに確認します。']
    };
  }
  const disagreements = [];
  for (let i = 0; i < 9; i++) {
    const names = orders.map(row => row.order[i]);
    if (new Set(names.map(norm)).size <= 1) continue;
    disagreements.push(`${i + 1}番：${orders.map((row, j) => `${row.jp} ${names[j]}`).join('／')}`);
    if (disagreements.length >= 3) break;
  }
  return {
    agreement: ['一次判断を固定したまま、3案の違いを直接話し合います。'],
    disagreement: disagreements
  };
}

function jstContext() {
  const formatted = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
  return { timeZone: 'Asia/Tokyo', currentDateTime: formatted };
}

async function generateTurn({ persona, caseData, primary, previousDialogue, summary }) {
  const sources = sourceMap(primary, previousDialogue, persona.label);
  if (!Object.keys(sources).length) throw new Error('Cross dialogue source material is empty');

  const baseInstruction = [
    'これは公開される3賢人同士の直接対話です。MAGI CONTROLとして話してはいけません。',
    'lockedPrimaryJudgments と previousDialogue を実際に読んで、別の賢人が本当に述べた内容だけに返答してください。人格設定から相手の主張を想像して攻撃してはいけません。',
    'sourcePersona は実際に返答する相手を1人選び、sourceClaim には sourceMaterial[sourcePersona] から短い原文をそのまま抜き出してください。言い換えは禁止です。',
    'statement はその sourceClaim への直接の返答にしてください。相手の日本語名を呼びかけ、1〜3文の自然な野球の会話にします。',
    '3人の打順が同じなら、無理に対立を作らず、実際に書かれている理由・打順のつながり・変更条件を検証してください。',
    '「固定する」と相手が言っていないのに固定起用を批判してはいけません。「数字が揃うまで待つ」と言っていないのに待つ姿勢を批判してはいけません。育成や負担を相手が理由にしていないのに、それを強調したと決めつけてはいけません。',
    '丸岡中の通常のベストオーダー審議では、15打数以上は実用上十分な母数として扱います。15打数以上の選手を母数不足だけで批判しません。',
    '相手投手の左右は、ユーザーが明示的に求めない限り通常の論点にしません。',
    '利用者向けに Evidence、照合、正式ロスター、構造化、プロトコル等のシステム用語を使いません。',
    '隠れた思考過程は出さず、公開してよい短い発言だけ返してください。'
  ].join(' ');

  const payload = {
    phase: 'CROSS_DIALOGUE',
    temporalContext: jstContext(),
    case: canonicalizePlayerData(caseData),
    lockedPrimaryJudgments: canonicalizePlayerData(primary),
    primaryComparison: summary,
    sourceMaterial: sources,
    previousDialogue: canonicalizePlayerData(previousDialogue),
    instruction: baseInstruction
  };

  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGemini({
      systemInstruction: `${PERSONA_PROMPTS[persona.key]}\n\nCROSS DIALOGUE RULE: You are speaking directly to another Wise Man in public. Reply only to a concrete statement that is present in sourceMaterial or previousDialogue. Never fabricate the other person's stance.`,
      userPayload: attempt === 0 ? payload : {
        ...payload,
        invalidDraft: last,
        correction: 'sourceClaim must be an exact copied substring of sourceMaterial[sourcePersona], target must be that actual persona, and statement must directly answer that exact claim without invented premises.'
      },
      responseSchema: turnSchema
    });
    const result = canonicalizePlayerData(raw || {});
    result.speaker = persona.label;
    result.sourcePersona = normalizeTarget(result.sourcePersona, persona.label, sources);
    result.target = result.sourcePersona;
    last = result;
    const sourceText = sources[result.sourcePersona] || '';
    if (!exactSourceClaim(sourceText, result.sourceClaim)) continue;
    if (!statementLooksGrounded(result.statement, result.target, result.sourceClaim)) continue;
    return {
      speaker: persona.label,
      target: result.target,
      sourcePersona: result.sourcePersona,
      sourceClaim: text(result.sourceClaim),
      statement: text(result.statement)
    };
  }
  throw new Error(`Grounded cross dialogue failed for ${persona.label}`);
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });
    if (!body?.primary || !isFullLineupQuestion(body.case)) return sendJson(res, 400, { error: 'Full-lineup primary judgments are required' });

    const primary = canonicalizePlayerData(body.primary);
    const summary = primaryLineupSummary(primary);
    const dialogue = [];
    for (const persona of TURN_ORDER) {
      dialogue.push(await generateTurn({ persona, caseData: body.case, primary, previousDialogue: dialogue, summary }));
    }

    return sendJson(res, 200, canonicalizePlayerData({
      agreement: summary.agreement,
      disagreement: summary.disagreement,
      domainConflicts: [],
      warnings: [],
      informationGaps: [],
      challenges: { melchior: [], balthasar: [], casper: [] },
      dialogue,
      reviewRequired: false,
      reviewReason: ''
    }));
  } catch (error) {
    console.error('[MAGI dialogue]', error?.message || error);
    return sendJson(res, 500, { error: 'Wise Men dialogue failed' });
  }
}
