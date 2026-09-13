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
  const slotRe=/(?:^|[^0-9])([1-9])番(?:打者)?/;
  for(const [key,label] of targets){
    const rows=list(challenges[key]);
    if(!rows.length)continue;
    const concrete=rows.some(line=>slotRe.test(line)&&CURRENT_ROSTER.some(name=>line.includes(name)));
    if(!concrete){
      issues.push(`${label}への打順クロス審議に、具体的な打順番号と選手名の組み合わせがありません`);
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

export function validateCrossOutput(caseData,cross,{focused=false}={}){
  return [
    ...validateDialoguePresence(cross),
    ...validateCrossLanguage(cross),
    ...validateFullLineupDialogueSpecificity(caseData,cross),
    ...validatePitchingPlanDialogueSpecificity(caseData,cross),
    ...validatePitchingPlanCrossOutput(caseData,cross),
    ...validatePersonaOutput(caseData,crossToGuardResult(cross),{focused})
  ];
}

export function failClosedCross(issues){
  const reason=`クロス審議の内容をEvidenceと照合した結果、不整合を検出しました。${(issues||[]).slice(0,3).join('／')}`;
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
