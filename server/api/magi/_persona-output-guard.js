import { CURRENT_ROSTER } from './_roster.js';

function text(value){return String(value ?? '').trim();}
function numberValue(value){
  if(typeof value==='number' && Number.isFinite(value)) return value;
  const s=text(value).replace(/,/g,'');
  if(!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return null;
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function sameNumber(a,b){return Math.abs(a-b)<1e-9;}
function pushMetric(map,key,value){
  const n=numberValue(value);if(n===null)return;
  if(!map[key])map[key]=[];
  if(!map[key].some(x=>sameNumber(x,n)))map[key].push(n);
}
function sentenceParts(value){
  return String(value||'').split(/[。！？!?\n]+/).map(s=>s.trim()).filter(Boolean);
}
function isEvidenceGapStatement(sentence){
  const s=String(sentence||'');
  return /(?:確認でき(?:ない|ません)|裏付け(?:られない|られません)|証明でき(?:ない|ません)|断定でき(?:ない|ません)|とは言え(?:ない|ません)|根拠(?:が|は)?(?:ない|ありません)|記録(?:が|は)?(?:ない|ありません|含まれていない|含まれていません)|Evidence(?:に|上に)?(?:ない|ありません)|未確認|不明|示されていない|示されていません|前提にでき(?:ない|ません)|直接.{0,12}でき(?:ない|ません))/.test(s);
}

const KEY_MAP=new Map([
  ['appearances','APP'],['appearance','APP'],['app','APP'],['登板数','APP'],
  ['innings','IP'],['inning','IP'],['ip','IP'],['投球回','IP'],['投球回数','IP'],
  ['strikeouts','SO'],['strikeout','SO'],['so','SO'],['奪三振','SO'],
  ['walks','BB'],['walk','BB'],['bb','BB'],['与四球','BB'],
  ['hbp','HBP'],['hitbypitch','HBP'],['hit_by_pitch','HBP'],['与死球','HBP'],
  ['era','ERA'],['防御率','ERA'],['whip','WHIP'],
  ['saves','SV'],['save','SV'],['sv','SV'],['セーブ','SV']
]);

function collectMetrics(value,map={}){
  if(Array.isArray(value)){for(const x of value)collectMetrics(x,map);return map;}
  if(!value||typeof value!=='object')return map;
  for(const [rawKey,v] of Object.entries(value)){
    const normalized=String(rawKey).replace(/[\s_-]/g,'').toLowerCase();
    let metric=null;
    for(const [key,mapped] of KEY_MAP){
      if(normalized===String(key).replace(/[\s_-]/g,'').toLowerCase()){metric=mapped;break;}
    }
    if(metric)pushMetric(map,metric,v);
    if(v&&typeof v==='object')collectMetrics(v,map);
  }
  return map;
}

function outputText(result){
  return [
    ...(Array.isArray(result?.facts)?result.facts:[]),
    ...(Array.isArray(result?.analysis)?result.analysis:[]),
    ...(Array.isArray(result?.prediction)?result.prediction:[]),
    result?.primaryReason,
    result?.publicStatement,
    ...(Array.isArray(result?.warnings)?result.warnings:[]),
    result?.reviewReason,
    result?.changeReason
  ].map(text).filter(Boolean).join('。');
}

function validatePattern({all,metric,label,re,metrics,issues}){
  const expected=metrics[metric]||[];
  const rx=new RegExp(re.source,re.flags.includes('g')?re.flags:`${re.flags}g`);
  let m;
  while((m=rx.exec(all))){
    const n=numberValue(m[1]);
    if(n===null)continue;
    if(!expected.length){issues.push(`${label}${m[1]} は supplied CASE/EVIDENCE に存在しない`);continue;}
    if(!expected.some(x=>sameNumber(x,n))){issues.push(`${label}${m[1]} は supplied CASE/EVIDENCE の ${label} 値と一致しない`);}
  }
}

export function validatePersonaOutput(caseData,result,{focused=false}={}){
  const issues=[];
  const all=outputText(result);
  const parts=sentenceParts(all);
  const caseText=JSON.stringify(caseData||{});
  const evidenceText=JSON.stringify(caseData?.evidence||{});
  const metrics=collectMetrics(caseData||{});

  if(/四死球/.test(all) && !/四死球/.test(caseText)){
    issues.push('四死球という合算値は supplied CASE/EVIDENCE に存在しない');
  }

  const patterns=[
    {metric:'APP',label:'登板数',re:/登板(?:数)?(?:は|が|：|:|=|\s|まだ){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'APP',label:'登板数',re:/([0-9]+(?:\.[0-9]+)?)\s*試合(?:に)?登板/g},
    {metric:'IP',label:'投球回',re:/投球回(?:数)?(?:は|が|：|:|=|\s|まだ){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'IP',label:'投球回',re:/([0-9]+(?:\.[0-9]+)?)\s*イニング/g},
    {metric:'SO',label:'奪三振',re:/奪三振(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'BB',label:'与四球',re:/与四球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'BB',label:'与四球',re:/四球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'HBP',label:'与死球',re:/与死球(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'ERA',label:'防御率',re:/防御率(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g},
    {metric:'WHIP',label:'WHIP',re:/WHIP(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/gi},
    {metric:'SV',label:'セーブ',re:/セーブ(?:数)?(?:は|が|：|:|=|\s){0,6}([0-9]+(?:\.[0-9]+)?)/g}
  ];
  for(const p of patterns)validatePattern({all,...p,metrics,issues});

  const hasComparisonBaseline=/(?:比較|平均|基準|順位|上位|下位|チーム内|リーグ|相手別|平均との差|多い|少ない|高い|低い|良い|悪い)/.test(evidenceText);
  if(!hasComparisonBaseline){
    const unsupportedQuality=[
      /(?:与四球|四球)(?:数)?(?:の|が|は)?(?:少な|多い|多く|少なく)/,
      /奪三振(?:数)?(?:の|が|は)?(?:多い|少ない|高い|低い)/,
      /(?:奪三振|三振|与四球|四球).{0,24}(?:割合|比率|率).{0,12}(?:良い|悪い|悪くない|良くない|高い|低い)/,
      /(?:奪三振|三振).{0,14}(?:取れる力|奪える力|奪三振力|三振力)/,
      /防御率(?:の|が|は)?(?:低い|高い|良い|悪い|優秀)/,
      /(?:打率|OPS|出塁率|長打率)(?:の|が|は)?(?:高い|低い|良い|悪い|優秀)/i,
      /(?:圧倒的|抜群|非常に優秀|極めて優秀)(?:な|の)?(?:投球|成績|数字|実績|防御率|奪三振|制球)?/
    ];
    const unsupportedSentence=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&unsupportedQuality.some(re=>re.test(sentence)));
    if(unsupportedSentence)issues.push('比較基準のない統計値を定性的な強弱・優劣へ変換している');
  }

  const hasHistoricalCloserEvidence=/(?:セーブ|クローザー|抑え|守護神|終盤|締め(?:た|る|くく)|プレッシャー|勝負どころ|重要な場面|高レバレッジ)/.test(evidenceText);
  if(!hasHistoricalCloserEvidence && /クローザー|抑え/.test(String(caseData?.question||''))){
    const unsupportedRole=[
      /旧チーム(?:同様|でも|で).{0,40}(?:締め|クローザー|抑え|守護神|セーブ)/,
      /旧チーム.{0,40}(?:プレッシャー|勝負どころ|重要な場面|高レバレッジ).{0,24}(?:経験|実績|対応|強い|慣れ)/,
      /(?:54(?:\.0)?回|投球回).{0,40}(?:プレッシャー|勝負どころ|重要な場面|終盤).{0,24}(?:経験|実績|対応|強い|慣れ)/
    ];
    const unsupportedSentence=parts.find(sentence=>!isEvidenceGapStatement(sentence)&&unsupportedRole.some(re=>re.test(sentence)));
    if(unsupportedSentence)issues.push('旧チームのクローザー・終盤・高圧場面の実績がEvidenceにないのに、その役割経験を前提にしている');
  }

  if(focused){
    for(const player of CURRENT_ROSTER){
      if(caseText.includes(player))continue;
      if(all.includes(player))issues.push(`CASE外の選手 ${player} を focused proposal に持ち込んでいる`);
    }
  }

  return [...new Set(issues)];
}
