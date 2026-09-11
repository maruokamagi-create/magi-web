import { validatePersonaOutput } from './_persona-output-guard.js';
import { CURRENT_ROSTER } from './_roster.js';
import { isFullLineupQuestion } from './_full-lineup.js';

function list(value){
  return Array.isArray(value) ? value.map(v=>String(v||'').trim()).filter(Boolean) : [];
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

export function validateCrossOutput(caseData,cross,{focused=false}={}){
  return [
    ...validateDialoguePresence(cross),
    ...validateFullLineupDialogueSpecificity(caseData,cross),
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
