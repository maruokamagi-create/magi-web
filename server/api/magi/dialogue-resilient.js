import magiDialogue, { debateKind, primaryDecisionSummary } from './dialogue.js';
import { canonicalizePlayerData } from './_roster.js';
import { validateFullLineupOrder } from './_full-lineup.js';

const PERSONAS = [
  { key: 'melchior', label: 'MELCHIOR-1', jp: 'メルキオール', first: '私' },
  { key: 'balthasar', label: 'BALTHASAR-2', jp: 'バルタザール', first: '俺' },
  { key: 'casper', label: 'CASPER-3', jp: 'カスパー', first: '僕' }
];
const PLAN = [
  { speaker: 'melchior', target: 'balthasar' },
  { speaker: 'balthasar', target: 'casper' },
  { speaker: 'casper', target: 'melchior' }
];
const DIALOGUE_BUDGET_MS = 26_000;
const text = v => String(v ?? '').trim();
const norm = v => text(v).normalize('NFKC').replace(/[\s　]+/g, '');

function createCaptureResponse() {
  const headers = new Map();
  return {
    statusCode: 200, headersSent: false, body: '',
    setHeader(name, value) { headers.set(String(name).toLowerCase(), { name: String(name), value }); return this; },
    getHeader(name) { return headers.get(String(name).toLowerCase())?.value; },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    end(chunk = '') { if (chunk !== undefined && chunk !== null) this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); this.headersSent = true; return this; },
    headerEntries() { return [...headers.values()]; }
  };
}
function replay(res, capture) {
  res.statusCode = Number(capture.statusCode || 200);
  for (const { name, value } of capture.headerEntries()) { try { res.setHeader(name, value); } catch {} }
  return res.end(capture.body || '');
}
function personaValue(primary, key) {
  if (primary?.[key]) return primary[key];
  return Object.values(primary || {}).find(v => text(v?.persona).toLowerCase().includes(key)) || null;
}
function orderOf(primary, key) {
  const check = validateFullLineupOrder(personaValue(primary, key)?.candidatePlayers);
  return check.ok ? check.order : [];
}
function candidatesOf(primary, key) {
  return Array.isArray(personaValue(primary, key)?.candidatePlayers)
    ? personaValue(primary, key).candidatePlayers.map(text).filter(Boolean)
    : [];
}
function sourceClaim(value) {
  const candidates = [value?.publicStatement, value?.primaryReason, value?.candidateBasis, ...(Array.isArray(value?.facts) ? value.facts : [])];
  for (const raw of candidates) {
    const s = text(raw);
    if (s.length >= 4) return s.split('。').map(x => x.trim()).find(x => x.length >= 4) || s.slice(0, 120);
  }
  return '';
}
function lineupSummary(primary) {
  const rows = PERSONAS.map(p => ({ ...p, order: orderOf(primary, p.key) }));
  if (rows.some(r => r.order.length !== 9)) return null;
  const agreement = [], disagreement = [];
  for (let i = 0; i < 9; i++) {
    const values = rows.map(r => r.order[i]);
    if (new Set(values.map(norm)).size === 1) agreement.push(`${i + 1}番は3賢人とも${values[0]}で一致しています。`);
    else disagreement.push(`${i + 1}番：${rows.map((r, j) => `${r.jp} ${values[j]}`).join('／')}`);
  }
  return { rows, agreement: agreement.slice(0, 4), disagreement: disagreement.slice(0, 4) };
}
function fallbackStatement(speaker, target, ownOrder, targetOrder) {
  let slot = ownOrder.findIndex((name, i) => norm(name) !== norm(targetOrder[i]));
  if (slot < 0) slot = 3;
  const own = ownOrder[slot], other = targetOrder[slot];
  if (norm(own) === norm(other)) {
    if (speaker.key === 'melchior') return `${target.jp}、${slot + 1}番${own}で私たちは一致しています。今の記録が変わったとき、どの条件ならこの配置を見直すのか確認したいです。`;
    if (speaker.key === 'balthasar') return `${target.jp}、${slot + 1}番${own}は俺も同じだ。だからこそ、どんな変化が出たらこの並びを変えるのか、今の材料で確認しておこう。`;
    return `${target.jp}、${slot + 1}番${own}は僕も同じです。この並びを続ける条件と、見直す条件を今の記録に沿って確認したいです。`;
  }
  if (speaker.key === 'melchior') return `${target.jp}、あなたは${slot + 1}番に${other}、私は${own}を置いています。この違いを、確認できた記録と前後の打者とのつながりから比べたいです。`;
  if (speaker.key === 'balthasar') return `${target.jp}、あなたは${slot + 1}番に${other}、俺は${own}だ。今の打線でどちらを置くか、記録と前後の打者とのつながりで比べたい。`;
  return `${target.jp}、あなたは${slot + 1}番に${other}、僕は${own}を置いています。今の役割と打線のつながりを見ながら、この違いを確認したいです。`;
}


function genericFallbackStatement(kind, speaker, target, ownCandidates, targetCandidates) {
  const ownTop = ownCandidates[0] || '未提示';
  const targetTop = targetCandidates[0] || '未提示';

  if (kind === 'PITCHING_PLAN') {
    const roles = ['先発','第2投手','終盤','クローザー'];
    let idx = roles.findIndex((_, i) => norm(ownCandidates[i]) !== norm(targetCandidates[i]));
    if (idx < 0) idx = 0;
    const own = ownCandidates[idx] || '未提示';
    const other = targetCandidates[idx] || '未提示';
    if (norm(own) === norm(other)) {
      return `${target.jp}、${roles[idx]}の${own}は${speaker.first}も同じです。今ある投手記録で、この役割を維持する条件と見直す条件を確認したいです。`;
    }
    return `${target.jp}、あなたは${roles[idx]}に${other}、${speaker.first}は${own}を置いています。今ある投手記録だけで、どちらをこの役割に置くか比べたいです。`;
  }

  const role = kind === 'PITCHING_ROLE' ? 'クローザー' : 'この打順';
  if (norm(ownTop) === norm(targetTop)) {
    return `${target.jp}、${role}の第一候補${ownTop}は${speaker.first}も同じです。今ある記録で、この判断を維持する条件と見直す条件を確認したいです。`;
  }
  return `${target.jp}、あなたは${targetTop}、${speaker.first}は${ownTop}を${role}の第一候補にしています。今ある記録だけで、どちらを優先するか比べたいです。`;
}

function captureFailureReason(capture, settled) {
  if (!settled) return 'DIALOGUE_BUDGET_EXCEEDED';
  try {
    const parsed = JSON.parse(String(capture?.body || '{}'));
    return text(parsed?.detail || parsed?.code || parsed?.error || 'DIALOGUE_GENERATION_FAILED');
  } catch {
    return text(capture?.body) || 'DIALOGUE_GENERATION_FAILED';
  }
}

export function buildFallbackDialogue(body) {
  const primary = canonicalizePlayerData(body?.primary || {});
  const kind = debateKind(body?.case || {});
  if (!kind) return null;

  const fullLineup = kind === 'FULL_LINEUP';
  const lineup = fullLineup ? lineupSummary(primary) : null;
  const genericSummary = fullLineup ? null : primaryDecisionSummary(primary, kind, body?.case || {});
  const summary = fullLineup ? lineup : genericSummary;
  if (!summary) return null;

  const dialogue = [];
  for (const step of PLAN) {
    const speaker = PERSONAS.find(p => p.key === step.speaker);
    const target = PERSONAS.find(p => p.key === step.target);
    const claim = sourceClaim(personaValue(primary, target?.key));
    if (!speaker || !target || !claim) return null;

    let statement = '';
    if (fullLineup) {
      const ownOrder = orderOf(primary, speaker.key);
      const targetOrder = orderOf(primary, target.key);
      if (ownOrder.length !== 9 || targetOrder.length !== 9) return null;
      statement = fallbackStatement(speaker, target, ownOrder, targetOrder);
    } else {
      const ownCandidates = candidatesOf(primary, speaker.key);
      const targetCandidates = candidatesOf(primary, target.key);
      if (!ownCandidates.length || !targetCandidates.length) return null;
      statement = genericFallbackStatement(kind, speaker, target, ownCandidates, targetCandidates);
    }

    dialogue.push({
      speaker: speaker.label,
      target: target.label,
      sourcePersona: target.label,
      sourceClaim: claim,
      statement,
      fallbackUsed: true
    });
  }

  const challenges = { melchior: [], balthasar: [], casper: [] };
  for (const turn of dialogue) {
    const target = PERSONAS.find(p => p.label === turn.target);
    if (target && turn.statement) challenges[target.key].push(turn.statement);
  }
  return canonicalizePlayerData({
    agreement: Array.isArray(summary.agreement) ? summary.agreement : [],
    disagreement: Array.isArray(summary.disagreement) ? summary.disagreement : [],
    domainConflicts: [],
    warnings: ['3賢人の直接対話を取得できなかったため、二次判定には一次案から作った確認質問だけを渡しています。'],
    informationGaps: [],
    challenges,
    dialogue,
    reviewRequired: false,
    reviewReason: '',
    dialogueFallbackUsed: true
  });
}

export default async function handler(req, res) {
  const capture = createCaptureResponse();
  let settled = false;
  const original = Promise.resolve(magiDialogue(req, capture)).then(() => { settled = true; }).catch(error => {
    settled = true;
    capture.statusCode = 500;
    capture.body = JSON.stringify({ error: String(error?.message || error || 'Wise Men dialogue failed') });
  });
  await Promise.race([original, new Promise(resolve => setTimeout(resolve, DIALOGUE_BUDGET_MS))]);

  if (!settled || Number(capture.statusCode) >= 500) {
    const fallback = buildFallbackDialogue(req?.body);
    if (fallback) {
      fallback.dialogueFallbackReason = captureFailureReason(capture, settled);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-MAGI-Dialogue-Fallback', !settled ? 'budget-grounded-lineup-dialogue' : 'grounded-lineup-dialogue');
      return res.end(JSON.stringify(fallback));
    }
  }
  return replay(res, capture);
}
