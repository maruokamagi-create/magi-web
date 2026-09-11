import { validatePersonaOutput } from './_persona-output-guard.js';

function list(value){
  return Array.isArray(value) ? value.map(v=>String(v||'').trim()).filter(Boolean) : [];
}
function peerText(value){
  const out=[];
  for(const item of Array.isArray(value)?value:[]){
    for(const field of ['point','challenge','evidenceBasis']){
      const v=String(item?.[field]||'').trim();
      if(v)out.push(v);
    }
  }
  return out;
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
      ...list(challenges?.casper),
      ...peerText(cross?.peerExchanges)
    ],
    prediction:[],
    primaryReason:'',
    publicStatement:'',
    warnings:list(cross?.warnings),
    reviewReason:'',
    changeReason:''
  };
}

export function validateCrossOutput(caseData,cross,{focused=false}={}){
  return validatePersonaOutput(caseData,crossToGuardResult(cross),{focused});
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
    peerExchanges:[],
    reviewRequired:true,
    reviewReason:reason
  };
}
