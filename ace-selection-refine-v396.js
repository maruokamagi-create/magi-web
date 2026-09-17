(()=>{
'use strict';
if(window.MAGI_ACE_SELECTION_REFINE_V396)return;
window.MAGI_ACE_SELECTION_REFINE_V396=true;

const VERSION='v396';
const previousFetch=window.fetch.bind(window);
const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED_NAME='大野 竜暉';
const EXCLUDED_KEY=key(EXCLUDED_NAME);
let lastResult=null;

function key(v){return text(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'');}
function clone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function urlOf(input){return typeof input==='string'?input:text(input?.url);}
function parseBody(init){if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body);}catch(_){return null;}}
function caseData(body){return body?.case&&typeof body.case==='object'?body.case:body||{};}
function question(body){const c=caseData(body);return text(c?.question||body?.question||document.getElementById('q')?.value).normalize('NFKC');}
function isAce(body){return ACE_RE.test(question(body));}
function excluded(v){return key(v)===EXCLUDED_KEY;}
function responseJson(original,data){
  const headers=new Headers(original.headers||{});
  headers.set('content-type','application/json; charset=utf-8');
  headers.delete('content-length');headers.delete('content-encoding');
  return new Response(JSON.stringify(data),{status:original.status,statusText:original.statusText,headers});
}
function injectPolicy(body,strong=false){
  const out=clone(body)||{};
  const c=out.case&&typeof out.case==='object'?out.case:null;
  if(!c)return out;
  const fixed='【エース選定の固定条件】大野 竜暉は現チームの正捕手として運用するため、エース候補から除外する。投手成績は比較資料として参照してよいが、candidatePlayers・第一候補・中心候補には含めない。現チームの他の投手から第一候補を1名選ぶ。';
  const retry='【再選定指示】大野 竜暉を候補に出してはいけない。必ず大野 竜暉以外の現チーム投手から第一候補を1名だけ返す。';
  const q=text(c.question);
  if(!q.includes('エース選定の固定条件'))c.question=`${q}\n${fixed}${strong?`\n${retry}`:''}`;
  else if(strong&&!q.includes('再選定指示'))c.question=`${q}\n${retry}`;
  c.evidence=c.evidence&&typeof c.evidence==='object'?c.evidence:{};
  c.evidence.aceSelectionPolicy={
    excludedPlayers:[EXCLUDED_NAME],
    reason:'正捕手として運用するためエース候補から除外',
    candidateCount:1,
    applyTo:['PRIMARY','CROSS_EXAMINATION','SECOND','FINAL']
  };
  return out;
}
function filterNames(values){return list(values).map(text).filter(v=>v&&!excluded(v));}
function personaHasExcluded(data){return list(data?.candidatePlayers).some(excluded);}
function sanitizePersona(data){
  if(!data||typeof data!=='object')return data;
  data.candidatePlayers=filterNames(data.candidatePlayers).slice(0,1);
  if(excluded(data?.candidateBasis))data.candidateBasis='';
  if(!data.candidatePlayers.length){
    data.reviewRequested=true;
    data.reviewReason='正捕手の大野 竜暉をエース候補から除外したうえで、別候補の再選定が必要。';
    data.publicStatement='大野 竜暉は正捕手として運用するため対象外。別の投手から第一候補を再選定します。';
  }
  return data;
}
function firstChoice(group,persona){
  const p=group?.[persona];
  return filterNames(p?.candidatePlayers)[0]||'';
}
function cleanGap(values){
  const src=[...list(values)].map(text).filter(Boolean);
  const out=[];
  if(src.some(s=>/投球回|母数|サンプル/.test(s)))out.push('現チームは投球回の母数がまだ小さい投手が多く、次戦以降の先発内容で再確認が必要。');
  if(src.some(s=>/連投|連戦/.test(s)))out.push('連投・連戦時のデータは十分でなく、連戦での運用適性は未確定。');
  return out.slice(0,2);
}
function sanitizeCross(data,body){
  if(!data||typeof data!=='object')return data;
  const primary=body?.primary||{};
  const m=firstChoice(primary,'melchior');
  const b=firstChoice(primary,'balthasar');
  const c=firstChoice(primary,'casper');
  const label=name=>name||'第一候補';
  data.challenges={
    melchior:[`${label(m)}を第一候補とした判断を、投球回・先発回数・四死球・奪三振・失点内容を同じ基準で比較しても維持できるか。`],
    balthasar:[`${label(b)}を第一候補とした場合、7回制で先発として試合を作る役割と継投の組みやすさを両立できるか。`],
    casper:[`${label(c)}について、現在の守備役割との両立と継続起用のしやすさまで含めても、エースを任せる判断に無理がないか。`]
  };
  const choices=[m,b,c].filter(Boolean);
  const unique=[...new Map(choices.map(n=>[key(n),n])).values()];
  data.agreement=unique.length===1?[`3賢人とも${unique[0]}を第一候補に選定。`]:['3賢人とも、現チームの投手成績と起用実績を基準に比較。'];
  data.disagreement=unique.length===1?['第一候補に相違なし。']:[`第一候補が分かれている：${choices.join('・')}。`];
  data.informationGaps=cleanGap([...(list(data.informationGaps)),...(list(data.warnings))]);
  data.warnings=[];
  return data;
}
function sanitizeFinal(data,body){
  if(!data||typeof data!=='object')return data;
  const target=data?.final&&typeof data.final==='object'?data.final:data;
  if(text(target?.mode).toUpperCase()!=='SELECTION')return data;
  target.centerCandidates=filterNames(target.centerCandidates).slice(0,1);
  target.recommendedCandidates=filterNames(target.recommendedCandidates);
  target.alternateCandidates=filterNames(target.alternateCandidates);
  if(Array.isArray(target.candidateSupport))target.candidateSupport=target.candidateSupport.filter(x=>!excluded(x?.name));
  if(target.personaSelections&&typeof target.personaSelections==='object'){
    Object.keys(target.personaSelections).forEach(k=>{target.personaSelections[k]=filterNames(target.personaSelections[k]).slice(0,1);});
  }
  const second=body?.second||{};
  const choices=['melchior','balthasar','casper'].map(p=>firstChoice(second,p)).filter(Boolean);
  const counts=new Map();
  choices.forEach(name=>{const k=key(name);const row=counts.get(k)||{name,n:0};row.n++;counts.set(k,row);});
  const ranked=[...counts.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,'ja'));
  const winner=ranked[0]?.name||target.centerCandidates[0]||'';
  const votes=winner?choices.filter(n=>key(n)===key(winner)).length:0;
  if(winner&&votes>=2){
    target.status='SELECTION_RESULT';
    target.centerCandidates=[winner];
    target.recommendation=`エース第一候補：${winner}。${votes===3?'3賢人の二次判断が一致。':`3賢人中${votes}名が第一候補に選定。`}`;
  }else if(!winner){
    target.status='SELECTION_REVIEW_REQUIRED';
    target.centerCandidates=[];
    target.recommendation='正捕手を除外した条件で、エース第一候補を再選定する。';
  }
  if(target.status==='SELECTION_RESULT'){
    target.reDeliberationConditions=[];
    target.warnings=[];
  }
  return data;
}

window.fetch=async function(input,init){
  const raw=parseBody(init);
  if(!raw||!isAce(raw))return previousFetch(input,init);
  const url=urlOf(input);
  const prepared=injectPolicy(raw,false);
  let response=await previousFetch(input,{...(init||{}),body:JSON.stringify(prepared)});
  if(!response.ok||!/\/api\/magi\/(?:persona|orchestrate)(?:\?|$)/.test(url))return response;
  let data;try{data=await response.clone().json();}catch(_){return response;}

  if(/\/api\/magi\/persona(?:\?|$)/.test(url)){
    if(personaHasExcluded(data)){
      const retryBody=injectPolicy(raw,true);
      const retry=await previousFetch(input,{...(init||{}),body:JSON.stringify(retryBody)});
      if(retry.ok){try{const retryData=await retry.clone().json();response=retry;data=retryData;}catch(_){}}
    }
    sanitizePersona(data);
  }else{
    const phase=text(raw?.phase).toUpperCase();
    if(phase==='CROSS_EXAMINATION')sanitizeCross(data,prepared);
    if(phase==='FINAL')sanitizeFinal(data,prepared);
  }
  return responseJson(response,data);
};

function resultQuestion(result){return text(result?.case?.question||document.getElementById('q')?.value);}
function isAceResult(result){return !!result&&ACE_RE.test(resultQuestion(result).normalize('NFKC'));}
function secondChoices(result){
  const g=result?.second||{};
  return ['melchior','balthasar','casper'].map(persona=>({persona,name:filterNames(g?.[persona]?.candidatePlayers)[0]||''})).filter(x=>x.name);
}
function winnerOf(result){
  const center=filterNames(result?.final?.centerCandidates);
  if(center.length===1)return center[0];
  const m=new Map();secondChoices(result).forEach(x=>{const k=key(x.name),r=m.get(k)||{name:x.name,n:0};r.n++;m.set(k,r);});
  return [...m.values()].sort((a,b)=>b.n-a.n)[0]?.name||'';
}
function setText(id,value){const el=document.getElementById(id);if(el&&value&&el.textContent!==value)el.textContent=value;}
function installStyle(){
  if(document.getElementById('magi-ace-selection-refine-v396-style'))return;
  const s=document.createElement('style');s.id='magi-ace-selection-refine-v396-style';
  s.textContent=`
  html.magiAceRefined #mVote,html.magiAceRefined #bVote,html.magiAceRefined #cVote{display:block!important;width:auto!important;max-width:none!important;min-width:180px!important;white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important;line-height:1.35!important;font-size:18px!important;font-weight:850!important;letter-spacing:0!important}
  @media(max-width:430px){html.magiAceRefined #mVote,html.magiAceRefined #bVote,html.magiAceRefined #cVote{min-width:150px!important;font-size:17px!important}}
  `;
  document.head.appendChild(s);
}
function patchChat(result,winner,votes){
  const nodes=[...document.querySelectorAll('#magiChatView .magiMsg.system .magiSpeechText,#magiChatView .magiMsg.system .magiSpeech')];
  if(!nodes.length)return;
  const node=nodes[nodes.length-1];
  const current=text(node.textContent);
  if(!/(?:エース|第一候補|再検討条件|中心候補|最終)/.test(current))return;
  const desired=winner
    ? `3賢人の一次判断、相互検証、二次判断を確認しました。${votes===3?'3賢人の第一候補は一致しています。':`3賢人中${votes}名が同じ第一候補を選びました。`} 現時点のエース第一候補は「${winner}」です。今後の先発内容と投球回の蓄積に応じて再評価します。`
    : '正捕手をエース候補から除外した条件で、第一候補を再選定します。';
  if(node.textContent!==desired)node.textContent=desired;
}
function patchDom(result){
  if(!isAceResult(result))return;
  installStyle();document.documentElement.classList.add('magiAceRefined');
  const choices=secondChoices(result);
  const winner=winnerOf(result);
  const votes=winner?choices.filter(x=>key(x.name)===key(winner)).length:0;
  setText('verdict',winner?`エース第一候補：${winner}`:'エース第一候補：再選定');
  if(winner)setText('reason',votes===3?`3賢人の二次判断が一致。現時点では${winner}を第一候補とします。`:`3賢人の二次判断を比較し、現時点では${winner}を第一候補とします（${votes}/3）。`);
  setText('next','再評価ポイント：次戦以降の先発内容、投球回、四死球、奪三振、失点の安定性。');
  const ids=[['mVote','melchior'],['bVote','balthasar'],['cVote','casper'],['v1','melchior'],['v2','balthasar'],['v3','casper']];
  const map=Object.fromEntries(choices.map(x=>[x.persona,x.name]));
  ids.forEach(([id,p])=>{const name=map[p];if(!name)return;setText(id,id[0]==='v'?(p==='melchior'?'MELCHIOR':p==='balthasar'?'BALTHASAR':'CASPER')+`　${name}`:`第一候補：${name}`);});
  patchChat(result,winner,votes);
}
function schedule(result){lastResult=clone(result);[0,80,220,500,900,1500,2300,3200].forEach(ms=>setTimeout(()=>patchDom(lastResult),ms));}

document.addEventListener('magi:deliberation-result',e=>{if(isAceResult(e?.detail))schedule(e.detail);});
let queued=false;
new MutationObserver(()=>{if(!lastResult||queued)return;queued=true;setTimeout(()=>{queued=false;patchDom(lastResult);},55);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

window.MAGI_ACE_SELECTION_REFINE_META=Object.freeze({version:VERSION,excludedAceCandidate:EXCLUDED_NAME,crossCopyRefined:true,compactFinal:true,displayWrapFix:true});
})();
