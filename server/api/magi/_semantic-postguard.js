function clean(v,max=1000){return String(v??'').trim().slice(0,max)}

function gradeBestPlayerQuestion(q){
  const m=q.match(/^([1-3１-３一二三])年(?:生)?で一番(?:いい|良い)選手(?:は|って)?[？?]?$/);
  if(!m)return null;
  const map={'1':'1','１':'1','一':'1','2':'2','２':'2','二':'2','3':'3','３':'3','三':'3'};
  return map[m[1]]||'';
}

function genericFullLineupQuestion(q){
  const n=String(q||'').normalize('NFKC');
  if(/(?:今日|この試合|3年生|三年生|旧チーム|前のチーム)/.test(n))return false;
  if(/(?:ベストオーダー|ベスト打順)/.test(n))return true;
  if(/(?:打順|オーダー|打線).{0,16}(?:どうする|どう組|組んで|組む|考えて|考える|決めて|決める|作って|作る)/.test(n))return true;
  if(/(?:組んで|組む|作って|作る|考えて|考える).{0,12}(?:打順|オーダー|打線)/.test(n))return true;
  return false;
}

export function applySemanticGuard(questionValue,contextValue=[],semanticValue={}){
  const question=clean(questionValue,4000);
  const semantic=semanticValue&&typeof semanticValue==='object'?semanticValue:{};
  const grade=gradeBestPlayerQuestion(question);
  if(grade){
    const clarificationQuestion='「一番いい」は、打撃・投手・守備・走塁・総合のどの基準で比べますか？';
    return {
      ...semantic,
      semanticVersion:`${semantic.semanticVersion||'semantic-request'}+postguard-v2`,
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

  if(genericFullLineupQuestion(question)){
    return {
      ...semantic,
      semanticVersion:`${semantic.semanticVersion||'semantic-request'}+postguard-v2`,
      mode:'DELIBERATION',
      confidence:'HIGH',
      understoodRequest:'現チームを基本に、1番から9番までのベストオーダーを3賢人で審議する',
      routeReason:'全打順を組む要求は単独候補選定ではなく、現チーム全体を使う打順審議。',
      domains:['LINEUP','BATTING','TACTICS'],
      timeScope:'CURRENT_SEASON',
      specificSeason:'',
      metric:'',
      opponent:semantic?.opponent||'',
      breakdowns:[],
      clarificationQuestion:'',
      needsData:true,
      preflightApplied:true,
      postguardApplied:true
    };
  }
  return semantic;
}
