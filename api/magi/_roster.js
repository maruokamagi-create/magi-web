export const CURRENT_ROSTER = [
  '大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都',
  '中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'
];

const compact = s => String(s || '').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'');

const ALIASES = new Map();
for (const official of CURRENT_ROSTER) {
  ALIASES.set(compact(official), official);
  ALIASES.set(official, official);
}

// Known generated-name errors observed in production. Keep this list explicit and conservative.
[
  ['坂田 曜馬','坂田 暉馬'],
  ['坂田曜馬','坂田 暉馬']
].forEach(([alias, official]) => {
  ALIASES.set(alias, official);
  ALIASES.set(compact(alias), official);
});

export const playerKey = s => compact(s).toLowerCase();

export function canonicalPlayerName(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  return ALIASES.get(raw) || ALIASES.get(compact(raw)) || raw;
}

const textAliases = [...ALIASES.entries()]
  .filter(([alias]) => alias && alias.length >= 3)
  .sort((a,b) => b[0].length - a[0].length);

export function canonicalizePlayerText(value) {
  let text = String(value ?? '');
  for (const [alias, official] of textAliases) {
    if (alias === official) continue;
    text = text.split(alias).join(official);
  }
  // Also normalize compact official spellings embedded in prose.
  for (const official of CURRENT_ROSTER) {
    const noSpace = official.replace(/\s+/g,'');
    if (noSpace !== official) text = text.split(noSpace).join(official);
  }
  return text;
}

export function canonicalizePlayerData(value) {
  if (Array.isArray(value)) return value.map(canonicalizePlayerData);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k,v] of Object.entries(value)) out[k] = canonicalizePlayerData(v);
    return out;
  }
  if (typeof value === 'string') return canonicalizePlayerText(value);
  return value;
}
