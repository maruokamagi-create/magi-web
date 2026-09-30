import { callGemini, rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { canonicalizePlayerData } from './_roster.js';
import { isFullLineupQuestion, validateFullLineupOrder } from './_full-lineup.js';
import { isPitchingPlanQuestion } from './_pitching-plan.js';

const TURN_ORDER = [
  { key: 'melchior', label: 'MELCHIOR-1', jp: 'メルキオール' },
  { key: 'balthasar', label: 'BALTHASAR-2', jp: 'バルタザール' },
  { key: 'casper', label: 'CASPER-3', jp: 'カスパー' }
];

const DIRECT_DIALOGUE_VOICES = {
  melchior: 'メルキオール。日本語の一人称は「私」。確認できる記録・数値・母数・情報不足だけで相手案を検証する。',
  balthasar: 'バルタザール。日本語の一人称は「俺」。候補・打順・投手役割の具体的な違いを比較する。ただし勝利・得点・流れ・勢い等の効果は、入力に明記されている場合以外は作らない。',
  casper: 'カスパー。日本語の一人称は「僕」。役割・負担・機会・成長は入力に明記された事実だけを使う。心理・将来効果は作らない。'
};

const DIRECT_DIALOGUE_SYSTEM = [
  'あなたはMAGIの公開相互検証を生成する制御層です。MAGI CONTROLとして発言せず、指定された3賢人本人の短い直接対話だけをJSONで返します。',
  'turnRequestsを上から順に1件ずつ処理し、dialogueを必ず3件返してください。',
  '各turnのspeaker/target/sourcePersonaはturnRequestsの指定どおりにしてください。',
  'sourceClaimは、そのturnのtargetSourceMaterialに実在する短い原文をそのままコピーしてください。言い換えは禁止です。',
  'statementは相手の日本語名を呼び、sourceClaimへ直接答える1〜3文の自然な野球の会話にしてください。',
  '相手が言っていない動機・心理・方針・役割歴を作らないでください。入力にない数値を作らないでください。',
  '得点、勝利、流れ、勢い、プレッシャー、成長、疲労、将来効果は入力に明記されていない限り主張しないでください。',
  '材料が薄いときは、具体的な候補・打順・役割の違いを示し「どの確認済み記録でこちらを優先するか」を問い返すだけで構いません。',
  'Evidence、正式ロスター、構造化、プロトコル等の内部用語を利用者向け発言に出さないでください。',
  '隠れた思考過程は出さず、公開可能な発言だけ返してください。'
].join(' ');

const TURN_PLAN = [
  { persona: TURN_ORDER[0], target: 'BALTHASAR-2' },
  { persona: TURN_ORDER[1], target: 'CASPER-3' },
  { persona: TURN_ORDER[2], target: 'MELCHIOR-1' }
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

const dialogueBatchSchema = {
  type: 'OBJECT',
  properties: {
    dialogue: { type: 'ARRAY', items: turnSchema }
  },
  required: ['dialogue']
};

const text = value => String(value ?? '').trim();
const norm = value => text(value).normalize('NFKC').replace(/[\s　]+/g, '');

function validCase(body) {
  const q = text(body?.case?.question);
  return q.length >= 2 && q.length <= 12000;
}

export function debateKind(caseData) {
  if (isFullLineupQuestion(caseData)) return 'FULL_LINEUP';
  if (isPitchingPlanQuestion(caseData) || String(caseData?.selectionKind || caseData?.evidence?.selectionKind || '').toUpperCase() === 'PITCHING_PLAN') return 'PITCHING_PLAN';
  const kind = String(caseData?.selectionKind || caseData?.evidence?.selectionKind || '').toUpperCase();
  if (kind === 'PITCHING_ROLE') return 'PITCHING_ROLE';
  if (kind === 'BATTING_ORDER') return 'BATTING_ORDER';
  const q = text(caseData?.question).normalize('NFKC');
  if (/(?:クローザー|抑え).{0,20}(?:誰|だれ|候補|選ぶ|選んで|決めて|いい)/.test(q)) return 'PITCHING_ROLE';
  if (/[1-9１-９一二三四五六七八九]番(?:打者)?.{0,20}(?:誰|だれ|候補|選ぶ|選んで|決めて|いい)/.test(q)) return 'BATTING_ORDER';
  return '';
}
function requestedBattingSlot(caseData) {
  const q = text(caseData?.question).normalize('NFKC');
  const m = q.match(/([1-9１-９])番/);
  if (!m) return '打順';
  const map = {'１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9'};
  return `${map[m[1]] || m[1]}番`;
}
function candidateList(primary, key) {
  const value = primaryFor(primary, key);
  return Array.isArray(value?.candidatePlayers) ? value.candidatePlayers.map(text).filter(Boolean) : [];
}
export function primaryDecisionSummary(primary, kind, caseData) {
  if (kind === 'FULL_LINEUP') return primaryLineupSummary(primary);
  const rows = TURN_ORDER.map(p => ({ ...p, candidates: candidateList(primary, p.key) }));
  const first = rows.map(row => row.candidates[0] || '');
  const allSame = first.every(Boolean) && first.slice(1).every(name => norm(name) === norm(first[0]));
  if (kind === 'PITCHING_PLAN') {
    const roles = ['先発','第2投手','終盤','クローザー'];
    const disagreement = [];
    for (let i = 0; i < roles.length; i++) {
      const names = rows.map(row => row.candidates[i] || '未提示');
      if (new Set(names.map(norm)).size <= 1) continue;
      disagreement.push(`${roles[i]}：${rows.map((row,j)=>`${row.jp} ${names[j]}`).join('／')}`);
    }
    if (!disagreement.length) return {
      allSame: true,
      agreement: ['3賢人の一次投手プランは4役とも一致しています。'],
      disagreement: ['役割配置そのものではなく、各役割を支える根拠と見直し条件を直接確認します。']
    };
    return { allSame:false, agreement:['同じ役割配置は維持しつつ、違う役割について直接検証します。'], disagreement:disagreement.slice(0,3) };
  }
  const label = kind === 'PITCHING_ROLE' ? 'クローザー候補' : `${requestedBattingSlot(caseData)}候補`;
  if (allSame) return {
    allSame:true,
    agreement:[`3賢人の一次判断は第1候補 ${first[0]} で一致しています。`],
    disagreement:[`候補そのものではなく、${first[0]}を${label.replace('候補','')}に置く根拠の弱点と見直し条件を直接確認します。`]
  };
  return { allSame:false, agreement:[], disagreement:[`${label}：${rows.map((row,i)=>`${row.jp} ${first[i] || '未提示'}`).join('／')}`] };
}
function debateInstruction(kind, caseData) {
  if (kind === 'FULL_LINEUP') return [
    '現在のベストオーダー審議です。違う打順番号と選手を優先して直接議論してください。',
    '打順が違う場合は、少なくとも1つの具体的な打順番号と選手名を出し、自分の配置を優先する根拠を相手の主張へ直接ぶつけてください。',
    '3人の打順が同じなら、その並びで最も弱い根拠または見直し条件を具体的に突いてください。',
    '15打数以上は実用上十分な母数として扱い、15打数以上の選手を母数不足だけで批判しません。相手投手の左右は、ユーザーが明示的に求めない限り通常の論点にしません。'
  ].join(' ');
  if (kind === 'PITCHING_PLAN') return [
    '現在の投手運用審議です。先発、第2投手、終盤、クローザーのうち実際に違う役割を優先して直接議論してください。',
    '少なくとも1つの役割名と選手名を出し、ERA、投球回、奪三振、与四球、SVなどCASEに実際にある記録だけを根拠にしてください。',
    'セーブ歴、高圧場面、疲労、連投耐性、役割適性を記録なしに作らないでください。'
  ].join(' ');
  if (kind === 'PITCHING_ROLE') return [
    '質問で指定された1つの投手役割だけを審議します。',
    '第1候補が違うなら候補選手名を直接ぶつけ、ERA、投球回、奪三振、与四球、WHIP、SV、明示された指導者観察など実際にある材料を比較してください。',
    '先発能力や長いイニングを投げられることだけでクローザー適性を証明したことにしないでください。'
  ].join(' ');
  const slot = requestedBattingSlot(caseData);
  return [
    `現在の${slot}候補の審議です。第1候補が違うなら、その候補名を直接ぶつけてください。`,
    '打率、出塁率、長打率、OPS、得点圏、打数、打点、四球、盗塁などCASEに実際にある現在の打撃記録を使い、なぜその打順に置くのかを比較してください。',
    '将来の得点や勝利を確定的に語らず、現在の役割適合を議論してください。'
  ].join(' ');
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
    ...(Array.isArray(value?.analysis) ? value.analysis : []),
    ...(Array.isArray(value?.warnings) ? value.warnings : [])
  ].map(text).filter(Boolean).join('。');
}

function dialogueMaterial(turns, label) {
  return turns
    .filter(turn => text(turn?.speaker).toUpperCase() === label)
    .map(turn => text(turn?.statement))
    .filter(Boolean)
    .join('。');
}

function sourceMaterialFor(primary, previousDialogue, label) {
  const persona = TURN_ORDER.find(p => p.label === label);
  if (!persona) return '';
  return [
    primaryMaterial(primaryFor(primary, persona.key)),
    dialogueMaterial(previousDialogue, label)
  ].filter(Boolean).join('。');
}

export function challengesFromDialogue(dialogue) {
  const out = { melchior: [], balthasar: [], casper: [] };
  for (const turn of Array.isArray(dialogue) ? dialogue : []) {
    const target = TURN_ORDER.find(p => p.label === text(turn?.target).toUpperCase());
    if (!target) continue;
    const statement = text(turn?.statement);
    if (statement) out[target.key].push(statement);
  }
  return out;
}

function exactSourceClaim(sourceText, claim) {
  const source = norm(sourceText);
  const needle = norm(claim);
  return needle.length >= 4 && source.includes(needle);
}

function hasFutureCue(question) {
  return /半年後|来年|来季|将来|未来|長期|次の夏|数年後/.test(text(question).normalize('NFKC'));
}

function unsupportedPremise(statement, targetMaterial) {
  const s = text(statement);
  const target = text(targetMaterial);
  const premiseGroups = [
    { re:/急ぎ|焦り|焦って|急いで/, source:/急ぎ|焦り|焦って|急いで/ },
    { re:/待つ|待って|数字が揃う|数字がそろう/, source:/待つ|待って|数字が揃う|数字がそろう/ },
    { re:/固定起用|固定する|固定で/, source:/固定起用|固定する|固定で/ },
    { re:/育成を優先|育成重視|育成に寄せ/, source:/育成を優先|育成重視|育成に寄せ/ },
    { re:/負担を強調|負担を重く|負担が大き/, source:/負担を強調|負担を重く|負担が大き/ }
  ];
  return premiseGroups.some(group => group.re.test(s) && !group.source.test(target));
}

function unsupportedCertainty(statement, availableMaterial) {
  const s = text(statement);
  const material = text(availableMaterial);
  const phrases = ['一番得点を取れる','最も得点を取れる','圧倒的','絶対','必ず'];
  return phrases.some(phrase => s.includes(phrase) && !material.includes(phrase));
}

function unsupportedTacticalNarrative(statement, availableMaterial) {
  const s = text(statement);
  const material = text(availableMaterial);
  const phrases = ['試合の流れ','畳みかけ','勢いをつけ','流れを作','得点につなが','チャンスを広げ','プレッシャーをかけ','打線が回る','勝負をかけ','連動性として機能','打線の厚みが増す','得点圏の流れ','勝ちに行く','スムーズにつながる','途切れさせない'];
  if (phrases.some(phrase => s.includes(phrase) && !material.includes(phrase))) return true;
  const effectPatterns = [
    /流れ.{0,10}(?:良く|よく|スムーズ|作る|生む|変える|途切れ)/,
    /(?:得点|チャンス|勝利|勝ち).{0,14}(?:増える|増やす|生む|つながる|近づく|呼び込む)/,
    /(?:打線|攻撃).{0,14}(?:機能する|厚みが増す|活性化する|回る)/
  ];
  return effectPatterns.some(re => re.test(s) && !re.test(material));
}

function statementGroundIssue(statement, target, caseData, targetMaterial, ownMaterial, allSame) {
  const s = text(statement);
  if (s.length < 12 || s.length > 260) return 'STATEMENT_LENGTH';
  const targetPersona = TURN_ORDER.find(p => p.label === target);
  const addressesTarget = !targetPersona || s.includes(targetPersona.jp) || s.includes(targetPersona.label.split('-')[0]);
  if (!addressesTarget) return 'TARGET_NOT_ADDRESSED';
  if (/お前|てめえ/.test(s)) return 'DISRESPECTFUL_ADDRESS';
  if (/Evidence|EVIDENCE|照合|正式ロスター|構造化|プロトコル/.test(s)) return 'INTERNAL_LANGUAGE';
  if (/試合は待ってくれない|勝ちに行くぞ/.test(s)) return 'CANNED_RHETORIC';
  if (!hasFutureCue(caseData?.question) && /半年後|来年|来季|将来|未来|長期|数年後/.test(s)) return 'UNREQUESTED_FUTURE';
  if (unsupportedPremise(s, targetMaterial)) return 'UNSUPPORTED_PREMISE';
  if (unsupportedCertainty(s, `${targetMaterial}。${ownMaterial}`)) return 'UNSUPPORTED_CERTAINTY';
  if (unsupportedTacticalNarrative(s, `${targetMaterial}。${ownMaterial}`)) return 'UNSUPPORTED_TACTICAL_NARRATIVE';
  if (/固定(?:起用|する|で)/.test(s) && !/固定/.test(text(targetMaterial))) return 'INVENTED_FIXED_USAGE';
  if (allSame && !/(ただ|一方|確認|条件|見直|変え|どう|どこ|何|懸念|弱点)/.test(s)) return 'NO_REAL_CHALLENGE';
  return '';
}
function statementLooksGrounded(statement, target, sourceClaim, caseData, targetMaterial, ownMaterial, allSame) {
  return !statementGroundIssue(statement, target, caseData, targetMaterial, ownMaterial, allSame);
}

function lineupOf(primary, key) {
  const value = primaryFor(primary, key);
  const check = validateFullLineupOrder(value?.candidatePlayers);
  return check.ok ? check.order : [];
}

function primaryLineupSummary(primary) {
  const orders = TURN_ORDER.map(p => ({ ...p, order: lineupOf(primary, p.key) }));
  if (orders.some(row => row.order.length !== 9)) return { agreement: [], disagreement: [], allSame: false };
  const allSame = orders.slice(1).every(row => row.order.every((name, i) => norm(name) === norm(orders[0].order[i])));
  if (allSame) {
    return {
      allSame: true,
      agreement: ['3賢人の一次打順案は1番から9番まで一致しています。'],
      disagreement: ['打順そのものではなく、その並びを支持する理由と見直し条件を互いに確認します。']
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
    allSame: false,
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

function batchTurnRequests(primary) {
  return TURN_PLAN.map(step => {
    const targetSourceMaterial = sourceMaterialFor(primary, [], step.target);
    const ownPrimaryMaterial = primaryMaterial(primaryFor(primary, step.persona.key));
    if (!targetSourceMaterial) throw new Error(`Cross dialogue source material is empty for ${step.target}`);
    return {
      speaker: step.persona.label,
      speakerJapanese: step.persona.jp,
      speakerVoice: DIRECT_DIALOGUE_VOICES[step.persona.key],
      target: step.target,
      targetJapanese: TURN_ORDER.find(p=>p.label===step.target)?.jp || step.target,
      sourcePersona: step.target,
      ownPrimaryMaterial,
      targetSourceMaterial
    };
  });
}

function normalizeDirectStatement(statement, speakerLabel, targetJapanese) {
  let s = text(statement);
  // Keep the dialogue firm without allowing insulting second-person address.
  s = s.replace(/お前|てめえ/g, 'あなた');

  const speaker = TURN_ORDER.find(p => p.label === text(speakerLabel).toUpperCase());
  if (speaker?.key === 'melchior') {
    s = s.replace(/(?:俺|僕)(?=は|が|の|も|なら|では|として|、|。)/g, '私');
  } else if (speaker?.key === 'balthasar') {
    s = s.replace(/(?:私|僕)(?=は|が|の|も|なら|では|として|、|。)/g, '俺');
  } else if (speaker?.key === 'casper') {
    s = s.replace(/(?:私|俺)(?=は|が|の|も|なら|では|として|、|。)/g, '僕');
  }

  // If the model omitted the addressee but otherwise produced a usable reply,
  // prefix the required Wise Man instead of discarding the whole batch.
  const target = text(targetJapanese);
  if (target && !s.includes(target)) s = `${target}、${s}`;
  return s;
}

function validateBatchDialogue(rawDialogue, requests, caseData, summary) {
  const rows = Array.isArray(rawDialogue) ? rawDialogue : [];
  const issues = [];
  const normalized = [];
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const raw = canonicalizePlayerData(rows[i] || {});
    raw.statement = normalizeDirectStatement(raw?.statement, req.speaker, req.targetJapanese);
    const targetMaterial = req.targetSourceMaterial;
    const ownMaterial = req.ownPrimaryMaterial;
    if (!rows[i]) {
      issues.push(`turn ${i+1}: MISSING_TURN`);
      continue;
    }
    const speaker = text(raw?.speaker).toUpperCase();
    const target = text(raw?.target).toUpperCase();
    const sourcePersona = text(raw?.sourcePersona).toUpperCase();
    if (speaker !== req.speaker) issues.push(`turn ${i+1}: WRONG_SPEAKER`);
    if (target !== req.target || sourcePersona !== req.sourcePersona) issues.push(`turn ${i+1}: WRONG_TARGET`);
    if (!exactSourceClaim(targetMaterial, raw?.sourceClaim)) issues.push(`turn ${i+1}: SOURCE_CLAIM_NOT_EXACT`);
    const statementIssue = statementGroundIssue(raw?.statement, req.target, caseData, targetMaterial, ownMaterial, summary.allSame);
    if (statementIssue) issues.push(`turn ${i+1}: ${statementIssue}`);
    normalized.push({
      speaker: req.speaker,
      target: req.target,
      sourcePersona: req.sourcePersona,
      sourceClaim: text(raw?.sourceClaim),
      statement: text(raw?.statement)
    });
  }
  if (rows.length !== requests.length) issues.push(`DIALOGUE_COUNT_${rows.length}`);
  return { ok: issues.length === 0, issues, dialogue: normalized };
}

async function generateDialogueBatch({ caseData, primary, summary }) {
  const turnRequests = batchTurnRequests(primary);
  const basePayload = {
    phase: 'CROSS_DIALOGUE_BATCH',
    temporalContext: jstContext(),
    case: canonicalizePlayerData(caseData),
    primaryComparison: summary,
    debateRule: debateInstruction(summary.kind, caseData),
    turnRequests: canonicalizePlayerData(turnRequests),
    instruction: '3件を一度に生成してください。各発言は別人格の実際の一次判断へ直接返答し、候補・打順・役割の具体的な違いを扱ってください。'
  };

  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGemini({
      systemInstruction: DIRECT_DIALOGUE_SYSTEM,
      userPayload: attempt === 0 ? basePayload : {
        ...basePayload,
        invalidDraft: last?.raw || null,
        validationIssues: last?.issues || [],
        correction: 'validationIssuesをすべて直し、dialogueを3件すべて再生成してください。sourceClaimは各targetSourceMaterialの原文をそのままコピーしてください。入力にない得点・勝利・流れ・勢い・心理・将来効果を追加しないでください。'
      },
      responseSchema: dialogueBatchSchema
    });
    const checked = validateBatchDialogue(raw?.dialogue, turnRequests, caseData, summary);
    if (checked.ok) return checked.dialogue;
    last = { raw, issues: checked.issues };
  }
  throw new Error(`Grounded cross dialogue batch failed: ${(last?.issues || []).join(', ')}`);
}

export default async function handler(req, res) {
  if (!requirePost(req, res) || !requireSameOrigin(req, res) || !rateLimit(req, res)) return;
  try {
    const body = await readBody(req);
    if (!validCase(body)) return sendJson(res, 400, { error: 'CASE is missing or invalid' });
    const kind = debateKind(body.case);
    if (!body?.primary || !kind) return sendJson(res, 400, { error: 'Supported selection primary judgments are required' });

    const primary = canonicalizePlayerData(body.primary);
    const summary = { ...primaryDecisionSummary(primary, kind, body.case), kind };
    const dialogue = await generateDialogueBatch({ caseData: body.case, primary, summary });

    return sendJson(res, 200, canonicalizePlayerData({
      agreement: summary.agreement,
      disagreement: summary.disagreement,
      domainConflicts: [],
      warnings: [],
      informationGaps: [],
      challenges: challengesFromDialogue(dialogue),
      dialogue,
      reviewRequired: false,
      reviewReason: ''
    }));
  } catch (error) {
    const detail = text(error?.message || error);
    console.error('[MAGI dialogue]', detail);
    return sendJson(res, 500, { error: 'Wise Men dialogue failed', code: 'DIALOGUE_GENERATION_FAILED', detail });
  }
}
