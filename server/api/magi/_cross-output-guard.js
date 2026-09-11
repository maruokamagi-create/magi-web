import { validatePersonaOutput } from './_persona-output-guard.js';

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
  if(!m.length)issues.push('MELCHIOR-1から他賢人へのクロス審議がありません');
  if(!b.length)issues.push('BALTHASAR-2から他賢人へのクロス審議がありません');
  if(!c.length)issues.push('CASPER-3から他賢人へのクロス審議がありません');
  const first=[m[0],b[0],c[0]].filter(Boolean);
  if(first.length===3&&new Set(first).size<2)issues.push('3賢人のクロス審議が同一文に偏っています');
  return issues;
}

export function validateCrossOutput(caseData,cross,{focused=false}={}){
  return [
    ...validateDialoguePresence(cross),
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
