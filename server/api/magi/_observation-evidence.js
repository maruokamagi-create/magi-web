import * as XLSX from 'xlsx';
import { googleDriveFetch } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';

export const OBSERVATION_SHEET_ID = '1Cs5cQUJYEC1Ta7OQXi5hUWnKkQHVOHByRiWtwKsC0uE';
const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${OBSERVATION_SHEET_ID}/edit`;
const CACHE_MS = 5 * 60 * 1000;
let cached = null;
const INITIAL_CURRENT_EVIDENCE = [
  ['チーム全体', '守備連携は改善傾向'], ['チーム全体', '声掛けは増加傾向'],
  ['橋向 結都', '先発としての安定が報告されている'], ['坂田 暉馬', '投手と内野手の役割を再検討する'],
  ['上村 蓮', '第2捕手として育成を検討する'], ['吉田 真翔', '三塁守備の安定が報告されている'],
  ['ベンチ', 'ベンチワークは継続課題'], ['チーム全体', '一部主力への依存を監視する']
].map(([target, claim]) => ({ target, claim, asOf: '2026-09-21', source: 'USER_CURRENT_ASSESSMENT', kind: 'CURRENT_EVIDENCE' }));

const text = value => String(value ?? '').trim();
const norm = value => text(value).normalize('NFKC').replace(/[\s　]/g, '');
const clauses = value => text(value).split(/(?<=[。！？!?])|\n/).map(text).filter(Boolean);

export function classifyObservationClause(value) {
  const s = text(value);
  if (/(?:した方が|すべき|必要(?:だ|です|ある|と思)|育てるべき|専念する方|コンバート|起用|練習.*(?:必要|した方)|でしょうか|してほしい)/.test(s)) return 'PROPOSAL';
  if (/(?:と思う|思います|感じる|感じます|気がする|ように見える|かもしれない|可能性|推測|考えられる|多分|はず)/.test(s)) return 'INFERENCE';
  if (/(?:\d|登板|送球|捕球|失点|出場|捕手デビュー|声かけ|声掛け|会話して|カバー|バックアップ|追いかけ|守備位置|話をしていた)/.test(s)) return 'OBSERVATION';
  return 'OPINION';
}

function eventDate(row) {
  const recorded = text(row[0]);
  const period = text(row[5]);
  const year = recorded.slice(0, 4);
  const monthDay = period.match(/(?:\d{4}[-/年])?\s*(\d{1,2})(?:月|[-/])(\d{1,2})日?/);
  if (monthDay) return `${year}-${monthDay[1].padStart(2, '0')}-${monthDay[2].padStart(2, '0')}`;
  return recorded.slice(0, 10);
}

function trendKey(item) {
  const s = item.text;
  const topics = [
    ['defense-coordination', /連携|カットプレー|挟殺|バント処理|ベースに.*入る/],
    ['communication', /声かけ|声掛け|会話|話し合/],
    ['pitch-control', /制球|コントロール/],
    ['catcher-development', /捕手|キャッチャー/],
    ['third-base-defense', /サード|三塁守備|打球処理/],
    ['bench-work', /ベンチ|ベースコーチ/],
    ['backup', /カバー|バックアップ/]
  ];
  const topic = topics.find(([, re]) => re.test(s))?.[0] || `other:${norm(s).slice(0, 20)}`;
  const direction = /ミス|遅|不安|課題|安定しない|出来ない|できない|必要|負担|やる気が見え/.test(s) ? 'CONCERN'
    : /改善|成長|安定|増え|積極|素晴らし|成功|良かっ|力強|自信/.test(s) ? 'IMPROVEMENT' : 'NEUTRAL';
  return `${norm(item.target)}|${topic}|${direction}|${item.kind}`;
}

export function parseObservationRows(rows) {
  if (!Array.isArray(rows) || !rows.length || text(rows[0]?.[0]) !== '記録日時') throw new Error('observation_sheet_header_changed');
  return rows.slice(1).filter(row => text(row?.[7]) || text(row?.[5])).flatMap((row, rowIndex) => {
    const source = text(row[1]) === '指導者' ? 'COACH_OBSERVATION' : text(row[1]) === '保護者' ? 'PARENT_OBSERVATION' : '';
    if (!source) return [];
    // One legacy response has its long original in the period column and a short
    // tag in the original column. Preserve that original instead of the tag.
    const original = text(row[5]).length > 80 && text(row[7]).length < 40 ? text(row[5]) : text(row[7]);
    return clauses(original).map((clause, clauseIndex) => ({
      id: `${rowIndex + 2}-${clauseIndex + 1}`,
      source, recordedAt: text(row[0]), observedAt: eventDate(row),
      observer: text(row[2]) || null, target: text(row[4]) || 'チーム全体',
      period: text(row[5]), context: text(row[6]),
      kind: classifyObservationClause(clause), text: clause,
      sourceRow: rowIndex + 2
    }));
  });
}

async function loadObservations() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const url = `https://www.googleapis.com/drive/v3/files/${OBSERVATION_SHEET_ID}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`;
  const response = await googleDriveFetch(url);
  if (!response.ok) throw new Error(`observation_sheet_export_${response.status}`);
  const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
  const sheet = workbook.Sheets['統合台帳'];
  if (!sheet) throw new Error('observation_sheet_tab_missing');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  const value = parseObservationRows(rows);
  cached = { at: Date.now(), value };
  return value;
}

function weightForGroup(entries) {
  const observers = new Set(entries.map(x => x.observer || `${x.source}:anonymous:${x.sourceRow}`));
  const days = new Set(entries.map(x => x.observedAt));
  return observers.size >= 2 && days.size >= 2 ? 'CORROBORATED' : 'SINGLE_OR_REPEATED_SOURCE';
}

export function summarizeObservationEvidence(all, { players = [], team = false } = {}) {
  const names = players.map(norm).filter(Boolean);
  const selected = all.filter(x => {
    if (team) return true;
    if (!names.length) return x.target === 'チーム全体' || x.target === 'ベンチ';
    if (!names.some(name => norm(x.target) === name)) return false;
    // A single-player case must not turn a coach's multi-player deployment
    // suggestion into a proposal about another player.
    return !CURRENT_ROSTER.some(name => !names.includes(norm(name)) && norm(x.text).includes(norm(name)));
  });
  const grouped = new Map();
  for (const item of selected) {
    const key = trendKey(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return selected.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id)).map(item => {
    const group = grouped.get(trendKey(item));
    return { ...item, corroboration: weightForGroup(group) };
  });
}

export async function buildObservationEvidence({ players = [], team = false } = {}) {
  const all = await loadObservations();
  const entries = summarizeObservationEvidence(all, { players, team });
  const names = players.map(norm);
  const currentEvidence = INITIAL_CURRENT_EVIDENCE.filter(x => team || !names.length || names.includes(norm(x.target))).map(x => ({
    ...x,
    status: Date.now() - Date.parse(`${x.asOf}T00:00:00+09:00`) > 30 * 86_400_000 ? 'REVIEW_REQUIRED' : 'PROVISIONAL'
  }));
  return {
    source: { id: OBSERVATION_SHEET_ID, name: '《MAGI》指導者・保護者 観察情報統合台帳', url: SOURCE_URL, type: 'OBSERVATION_LEDGER' },
    entries,
    currentEvidence,
    dataRule: 'COACH_OBSERVATIONとPARENT_OBSERVATIONは試合成績・出場詳細CSVと分離する。OBSERVATIONは報告された観察であり公式試合記録ではない。INFERENCE・OPINION・PROPOSALを事実として扱わない。単独・同一回答者の反復では評価を大きく変えず、異なる人と異なる日で同傾向が出た場合だけ裏付けを強める。賛否・変化を時系列で残し、新しい記録でCURRENT EVIDENCEを更新する。',
    text: [
      ...entries.map(x => `${x.observedAt} | ${x.source} | ${x.target} | ${x.kind} | ${x.corroboration} | ${x.text}`),
      ...currentEvidence.map(x => `${x.asOf} | ${x.source} | ${x.target} | ${x.kind} | ${x.status} | ${x.claim}`)
    ].join('\n')
  };
}

