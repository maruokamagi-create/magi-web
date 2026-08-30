export const THIRD_YEAR_ROSTER = Object.freeze([
  '北 淳志','坂本 陸','櫻川 莉大','佐々木 悠成','下田 涼歩','前川 夢斗','増田 晃大','宮嵜 翔','宮村 龍'
]);

export const SECOND_YEAR_ROSTER = Object.freeze([
  '井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都'
]);

export const FIRST_YEAR_ROSTER = Object.freeze([
  '上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'
]);

// Canonical registry for every player name MAGI may encounter across the old and current teams.
// Every entry uses exactly one ASCII half-width space between surname and given name.
export const OFFICIAL_PLAYER_REGISTRY = Object.freeze([
  ...THIRD_YEAR_ROSTER,
  ...SECOND_YEAR_ROSTER,
  ...FIRST_YEAR_ROSTER
]);

// 2026-2027 current team only. Keep this separate from the 23-player name registry:
// full-team review and candidate selection MUST remain exactly these 14 players.
export const CURRENT_ROSTER = Object.freeze([
  ...SECOND_YEAR_ROSTER,
  ...FIRST_YEAR_ROSTER
]);

export const WISE_MEN = Object.freeze({
  melchior: { ja: 'メルキオール', en: 'MELCHIOR-1' },
  balthasar: { ja: 'バルタザール', en: 'BALTHASAR-2' },
  casper: { ja: 'カスパー', en: 'CASPER-3' }
});

const compact = s => String(s || '').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'');
const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

const PLAYER_ALIASES = new Map();
for (const official of OFFICIAL_PLAYER_REGISTRY) {
  PLAYER_ALIASES.set(official, official);
  PLAYER_ALIASES.set(official.replace(' ','　'), official);
  PLAYER_ALIASES.set(compact(official), official);
}

// Explicit production/likely kanji variants. Output is always the official registered spelling.
[
  ['坂田 曜馬','坂田 暉馬'],['坂田曜馬','坂田 暉馬'],
  ['大野 竜輝','大野 竜暉'],['大野竜輝','大野 竜暉'],
  ['島田 栄志','嶋田 栄志'],['島田栄志','嶋田 栄志'],
  ['中島 玲月','中嶋 玲月'],['中島玲月','中嶋 玲月'],
  ['武沢 大翔','武澤 大翔'],['武沢大翔','武澤 大翔'],
  ['橋向 結斗','橋向 結都'],['橋向結斗','橋向 結都'],
  ['鰐淵 将太','鰐渕 将太'],['鰐淵将太','鰐渕 将太'],
  ['宮崎 翔','宮嵜 翔'],['宮崎翔','宮嵜 翔'],
  ['桜川 莉大','櫻川 莉大'],['桜川莉大','櫻川 莉大']
].forEach(([alias, official]) => {
  PLAYER_ALIASES.set(alias, official);
  PLAYER_ALIASES.set(compact(alias), official);
});

const WISE_ALIASES = new Map([
  ['メルヒオール','メルキオール'],
  ['メルキオル','メルキオール'],
  ['メルキオール-1','メルキオール'],
  ['メルキオール１','メルキオール'],
  ['バルタサール','バルタザール'],
  ['バルタザル','バルタザール'],
  ['バルサザール','バルタザール'],
  ['バルサザル','バルタザール'],
  ['バルタザール-2','バルタザール'],
  ['バルタザール２','バルタザール'],
  ['カスパール','カスパー'],
  ['キャスパー','カスパー'],
  ['カスパー-3','カスパー'],
  ['カスパー３','カスパー'],
  ['MELCHIOR-1','MELCHIOR-1'],
  ['MELCHIOR','MELCHIOR'],
  ['BALTHAZAR-2','BALTHASAR-2'],
  ['BALTHAZAR','BALTHASAR'],
  ['BALTHASAR-2','BALTHASAR-2'],
  ['BALTHASAR','BALTHASAR'],
  ['CASPAR-3','CASPER-3'],
  ['CASPAR','CASPER'],
  ['CASPER-3','CASPER-3'],
  ['CASPER','CASPER']
]);

export const playerKey = s => compact(s).toLowerCase();

function editDistanceAtMostOne(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return 2;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1 ? edits : 2;
}

// Strict lookup across all 23 registered players. Used for name integrity in prose/history.
export function canonicalPlayerNameStrict(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const direct = PLAYER_ALIASES.get(raw) || PLAYER_ALIASES.get(compact(raw));
  if (direct) return direct;
  const key = compact(raw);
  const near = OFFICIAL_PLAYER_REGISTRY.filter(name => editDistanceAtMostOne(key, compact(name)) <= 1);
  return near.length === 1 ? near[0] : null;
}

// Strict lookup limited to the current 14-player team. Used for full-team checks/candidate arrays.
export function canonicalCurrentPlayerNameStrict(value) {
  const official = canonicalPlayerNameStrict(value);
  return official && CURRENT_ROSTER.includes(official) ? official : null;
}

export function canonicalPlayerName(value) {
  return canonicalPlayerNameStrict(value) || String(value || '').trim();
}

export function canonicalPlayerList(values) {
  const names = [], invalid = [], seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const official = canonicalPlayerNameStrict(raw);
    if (!official) { if (String(raw || '').trim()) invalid.push(String(raw).trim()); continue; }
    if (!seen.has(official)) { seen.add(official); names.push(official); }
  }
  return { names, invalid };
}

export function canonicalCurrentPlayerList(values) {
  const names = [], invalid = [], seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const official = canonicalCurrentPlayerNameStrict(raw);
    if (!official) { if (String(raw || '').trim()) invalid.push(String(raw).trim()); continue; }
    if (!seen.has(official)) { seen.add(official); names.push(official); }
  }
  return { names, invalid };
}

const playerTextAliases = [...PLAYER_ALIASES.entries()]
  .filter(([alias]) => alias && alias.length >= 3)
  .sort((a,b) => b[0].length - a[0].length);

const surnameMap = (() => {
  const m = new Map();
  for (const official of OFFICIAL_PLAYER_REGISTRY) {
    const [surname] = official.split(' ');
    if (!m.has(surname)) m.set(surname, []);
    m.get(surname).push(official);
  }
  return m;
})();

export function canonicalizeKnownNameText(value) {
  let text = String(value ?? '');

  // Wise Men names are canonicalized first.
  for (const [alias, official] of WISE_ALIASES.entries()) {
    if (alias !== official) text = text.split(alias).join(official);
  }

  // Full player-name variants and missing-space forms -> official name for all 23 players.
  for (const [alias, official] of playerTextAliases) {
    if (alias !== official) text = text.split(alias).join(official);
  }
  for (const official of OFFICIAL_PLAYER_REGISTRY) {
    const [surname, given] = official.split(' ');
    const noSpace = surname + given;
    text = text.split(noSpace).join(official);
    // Full-width space, tabs, line breaks or repeated spaces -> exactly one ASCII half-width space.
    const spaced = new RegExp(`${escapeRegExp(surname)}[\\s　]+${escapeRegExp(given)}`, 'g');
    text = text.replace(spaced, official);
  }

  // Expand a surname-only player reference only when the surname is unique AND at least two characters.
  // This avoids corrupting ordinary prose such as the one-character surname 「北」 used as a direction word.
  for (const [surname, officials] of surnameMap.entries()) {
    if (officials.length !== 1 || surname.length < 2) continue;
    const official = officials[0];
    const [, given] = official.split(' ');
    const re = new RegExp(`${escapeRegExp(surname)}(?![\\s　]*${escapeRegExp(given)})`, 'g');
    text = text.replace(re, official);
  }
  return text;
}

export function canonicalizePlayerText(value) {
  return canonicalizeKnownNameText(value);
}

const CURRENT_PLAYER_ARRAY_KEYS = new Set([
  'checkedPlayers','candidatePlayers','centerCandidates','recommendedCandidates','alternateCandidates'
]);

export function canonicalizeKnownNamesData(value) {
  if (Array.isArray(value)) return value.map(canonicalizeKnownNamesData);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(value)) {
      if (CURRENT_PLAYER_ARRAY_KEYS.has(k) && Array.isArray(v)) {
        // Candidate/full-team arrays are strictly current-team only even though the name registry has 23 players.
        out[k] = canonicalCurrentPlayerList(v).names;
      } else if (k === 'name' && typeof v === 'string') {
        // Generic name fields may refer to any registered player from either season.
        out[k] = canonicalPlayerNameStrict(v) || canonicalizeKnownNameText(v);
      } else {
        out[k] = canonicalizeKnownNamesData(v);
      }
    }
    return out;
  }
  if (typeof value === 'string') return canonicalizeKnownNameText(value);
  return value;
}

// Backward-compatible export used by existing modules.
export const canonicalizePlayerData = canonicalizeKnownNamesData;

export function hasCanonicalPlayerSpacing(name) {
  return OFFICIAL_PLAYER_REGISTRY.includes(String(name || '')) && /^[^\s　]+ [^\s　]+$/.test(String(name || ''));
}

export function isCurrentPlayer(name) {
  return CURRENT_ROSTER.includes(canonicalPlayerNameStrict(name));
}

export function officialWiseName(persona) {
  const p = WISE_MEN[String(persona || '').toLowerCase()];
  return p ? p : null;
}
