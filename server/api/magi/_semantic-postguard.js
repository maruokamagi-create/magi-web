function clean(v,max=1000){return String(v??'').trim().slice(0,max)}

function gradeBestPlayerQuestion(q){
  const m=q.match(/^([1-3１-３一二三])年(?:生)?で一番(?:いい|良い)選手(?:は|って)?[？?]?$/);
  if(!m)return null;
  const map={'1':'1','１':'1','一':'1','2':'2','２':'2','二':'2','3':'3','３':'3','三':'3'};
  return map[m[1]]||'';
}

export function applySemanticGuard(questionValue,contextValue=[],semanticValue={}){
  const question=clean(questionValue,4000);
  const semantic=semanticValue&&typeof semanticValue==='object'?semanticValue:{};
  const grade=gradeBestPlayerQuestion(question);
  if(grade){
    const clarificationQuestion='「一番いい」は、打撃・投手・守備・走塁・総合のどの基準で比べますか？';
    return {
      ...semantic,
      semanticVersion:`${semantic.semanticVersion||'semantic-request'}+postguard-v1`,
      mode:'CLARIFY',
      confidence:'LOW',
      understoodRequest:`${grade}年生の中で一番いい選手を選ぶため、評価基準を確認する`,
      routeReason:'学年内の「一番いい」は評価軸が複数あるため、基準を確認する。',
      players:[],
      domains:['TEAM','DEVELOPMENT'],
      timeScope:'CURRENT_SEASON',
      specificSeason:'',
      metric:'',
      opponent:'',
      breakdowns:[],
      clarificationQuestion,
      needsData:false,
      groundedPlayers:[],
      preflightApplied:true,
      postguardApplied:true
    };
  }
  return semantic;
}
