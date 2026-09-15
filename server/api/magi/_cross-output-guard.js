import { validatePersonaOutput } from './_persona-output-guard.js';
import { validatePitchingPlanCrossOutput } from './_pitching-plan-output-guard.js';
import { CURRENT_ROSTER } from './_roster.js';
import { isFullLineupQuestion } from './_full-lineup.js';
import { isPitchingPlanQuestion } from './_pitching-plan.js';

function list(value){
  return Array.isArray(value) ? value.map(v=>String(v||'').trim()).filter(Boolean) : [];
}
function crossTexts(cross){
  const challenges=cross?.challenges||{};
  return [
    ...list(cross?.agreement),
    ...list(cross?.disagreement),
    ...list(cross?.domainConflicts),
    ...list(cross?.warnings),
    ...list(cross?.informationGaps),
    ...list(challenges?.melchior),
    ...list(challenges?.balthasar),
    ...list(challenges?.casper)
  ];
}

function falseMissingDataIssues(caseData,cross){
  if(!isFullLineupQuestion(caseData))return[];
  const contract=caseData?.evidence?.numericEvidenceContract||{};
  const issues=[];
  const rows=crossTexts(cross);
  const currentMissing=/(?:2026-2027|今季通算|今季|数値データ|打撃成績).{0,80}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている|十分に揃っていない)/s;
  const historicalMissing=/(?:2025-2026|過去実績).{0,80}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|欠損している|欠けている|十分に揃っていない)/s;
  const recentMissing=/(?:直近6試合|直近六試合|打撃詳細CSV).{0,80}(?:提供されていない|供給されていない|含まれていない|未記載|未集計|集計不能|確認できない|確認できません|抽出できず|欠損している|欠けている|十分に揃っていない)/s;
  for(const row of rows){
    const s=String(row||'');
    if(contract.currentBattingNumbersProvided===true&&currentMissing.test(s))issues.push(`提供済みの2026-2027今季通算数値を未提供扱いしている: ${s.slice(0,100)}`);
    if(contract.historicalNumbersProvided===true&&historicalMissing.test(s))issues.push(`提供済みの2025-2026過去実績を未提供扱いしている: ${s.slice(0,100)}`);
    if(contract.recentSixNumbersProvided===true&&recentMissing.test(s))issues.push(`提供済みの直近6試合データを未提供扱いしている: ${s.slice(0,100)}`);
  }
  return [...new Set(issues)];
}

// Protocol/persona/stat names are intentionally written in Latin characters in otherwise
// natural Japanese MAGI dialogue. Exclude only these known tokens from the language ratio
// so valid text such as "CASPERはGREEN、MELCHIORはBLUE" is not rejected.
const ALLOWED_LATIN_TOKENS=/\b(?:MELCHIOR(?:-1)?|BALTHASAR(?:-2)?|CASPER(?:-3)?|MAGI|GREEN|BLUE|YELLOW|RED|DATA|EVIDENCE|Evidence|AVG|OPS|OBP|SLG|ERA|WHIP|BB|HBP|SO|IP|RBI|CSV|XLSM)\b/gi;
function japaneseEnough(value){
  const original=String(value||'');
  const s=original.replace(ALLOWED_LATIN_TOKENS,'');
  const jp=(s.match(/[ぁ-んァ-ヶ一-龯々ー]/g)||[]).length;
  const latin=(s.match(/[A-Za-z]/g)||[]).length;
  if(!jp)return false;
  return latin<=Math.max(12,jp*0.9);
}

export function crossToGuardResult(cross){
  const challenges=cross?.challenges||{};
  return {
    facts:list(cross?.agreement),
    analysis:[
      ...list(cross?.disagreement),
      ...list(cross?.domainConflicts),
      ...list(cross?.informationGaps),
      ...list(challenges?.melchior),
      ...list(challenges?.balthasar),
      ...list(challenges?.casper)
    ],
    prediction:[],
    primaryReason:'',
    publicStatement:'',
    warnings:list(cross?.warnings),
    reviewReason:'',
    changeReason:''
  };
}

export function validateDialoguePresence(cross){
  const challenges=cross?.challenges||{};
  const issues=[];
  const m=list(challenges.melchior), b=list(challenges.balthasar), c=list(challenges.casper);
  if(!m.length)issues.push('MELCHIOR-1へのクロス審議がありません');
  if(!b.length)issues.push('BALTHASAR-2へのクロス審議がありません');
  if(!c.length)issues.push('CASPER-3へのクロス審議がありません');
  const first=[m[0],b[0],c[0]].filter(Boolean);
  if(first.length===3&&new Set(first).size<2)issues.push('3賢人のクロス審議が同一文に偏っています');
  return issues;
}

export function validateCrossLanguage(cross){
  const issues=[];
  for(const row of crossTexts(cross)){
    if(!japaneseEnough(row)){
      issues.push(`公開クロス審議が自然な日本語になっていません: ${row.slice(0,80)}`);
    }
  }
  return issues;
}

export function validateFullLineupDialogueSpecificity(caseData,cross){
  if(!isFullLineupQuestion(caseData))return[];
  const challenges=cross?.challenges||{};
  const issues=[];
  const targets=[
    ['melchior','MELCHIOR-1'],
    ['balthasar','BALTHASAR-2'],
    ['casper','CASPER-3']
  ];
  const lineupCue=/(?:[1-9]番|一番|二番|三番|四番|五番|六番|七番|八番|九番|打順|並び|上位|中軸|下位|クリーンナップ|得点経路|つながり|起用|打線|オーダー)/;
  for(const [key,label] of targets){
    const rows=list(challenges[key]);
    if(!rows.length)continue;
    // Full 1-9 completeness is validated in the primary/second lineup outputs.
    // Cross-examination only needs to challenge a concrete current player in a lineup/tactical context.
    // Requiring an explicit "N番 + 選手名" pair in every challenge produced false review holds.
    const concrete=rows.some(line=>CURRENT_ROSTER.some(name=>line.includes(name))&&lineupCue.test(line));
    if(!concrete){
      issues.push(`${label}への打順クロス審議に、現チーム選手を特定した打順・戦術上の具体的な問いがありません`);
    }
  }
  return issues;
}

export function validatePitchingPlanDialogueSpecificity(caseData,cross){
  if(!isPitchingPlanQuestion(caseData))return[];
  const challenges=cross?.challenges||{};
  const issues=[];
  const targets=[
    ['melchior','MELCHIOR-1'],
    ['balthasar','BALTHASAR-2'],
    ['casper','CASPER-3']
  ];
  const roleRe=/(?:先発|第?2投手|第二投手|二番手|2番手|終盤|つなぎ|ブリッジ|クローザー|抑え|守護神)/;
  for(const [key,label] of targets){
    const rows=list(challenges[key]);
    if(!rows.length)continue;
    const concrete=rows.some(line=>roleRe.test(line)&&CURRENT_ROSTER.some(name=>line.includes(name)));
    if(!concrete){
      issues.push(`${label}への投手運用クロス審議に、具体的な役割名と選手名の組み合わせがありません`);
    }
  }
  return issues;
}

function fullLineupCrossIssueIsFalsePositive(issue){
  const s=String(issue||'');
  // Cross-examination is allowed to ask about future risk/benefit. The persona guard treats
  // those questions as if they were final predictive assertions, which can incorrectly turn
  // a valid standard lineup into LINEUP_REVIEW_REQUIRED. Keep all factual/numeric guards,
  // but do not fail the whole cross round on these prediction-wording-only issues.
  return /(?:分析・回答で将来結果|将来予測を不確実性|Evidenceから保証できない結果)/.test(s);
}

export function validateCrossOutput(caseData,cross,{focused=false}={}){
  const personaIssues=validatePersonaOutput(caseData,crossToGuardResult(cross),{focused});
  const guardedPersonaIssues=isFullLineupQuestion(caseData)
    ? personaIssues.filter(issue=>!fullLineupCrossIssueIsFalsePositive(issue))
    : personaIssues;

  // Specificity is a presentation/quality concern, not a safety failure.
  // A challenge that is slightly too broad must not erase MAGI CONTROL from the public debate.
  // Presence, language, factual integrity, unsupported claims and numeric contradictions remain fatal.
  return [
    ...validateDialoguePresence(cross),
    ...validateCrossLanguage(cross),
    ...validatePitchingPlanCrossOutput(caseData,cross),
    ...falseMissingDataIssues(caseData,cross),
    ...guardedPersonaIssues
  ];
}

export function failClosedCross(){
  const reason='相互検証の内容に確認できない点があったため、追加確認が必要です。';
  return {
    agreement:[],
    disagreement:[],
    domainConflicts:[],
    warnings:[reason],
    informationGaps:[reason],
    challenges:{melchior:[],balthasar:[],casper:[]},
    reviewRequired:true,
    reviewReason:reason
  };
}
