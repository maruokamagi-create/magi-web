(()=>{
'use strict';
if(window.MAGI_ACE_SELECTION_CORE_V397)return;
window.MAGI_ACE_SELECTION_CORE_V397=true;

const previousFetch=window.fetch.bind(window);
const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const key=v=>text(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'');
const excluded=v=>key(v)===key(EXCLUDED);
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}};
const urlOf=input=>typeof input==='string'?input:text(input?.url);
const parseBody=init=>{if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body);}catch(_){return null;}};
const caseOf=body=>body?.case&&typeof body.case==='object'?body.case:body||{};
const questionOf=body=>text(caseOf(body)?.question||body?.question).normalize('NFKC');
const isAce=body=>!!body&&ACE_RE.test(questionOf(body));
const filtered=values=>list(values).map(text).filter(v=>v&&!excluded(v));

function injectPolicy(body,strong=false){
  const out=clone(body)||{};
  const c=out.case&&typeof out.case==='object'?out.case:null;
  if(!c)return out;
  c.evidence=c.evidence&&typeof c.evidence==='object'?c.evidence:{};
  c.evidence.aceSelectionPolicy={
    excludedPlayers:[EXCLUDED],
    reason:'正捕手として運用するためエース候補から除外',
    candidateCount:1
  };
  const rule='【エース選定条件】大野 竜暉は正捕手として運用するためエース候補から除外する。投手成績は比較資料として参照してよいが、候補には含めない。現チームの他の投手から第一候補を1名だけ選ぶ。';
  const retry='【再選定】大野 竜暉以外の投手から第一候補を1名だけ返す。';
  if(!text(c.question).includes('【エース選定条件】'))c.question=`${text(c.question)}\n${rule}`;
  if(strong&&!text(c.question).includes('【再選定】'))c.question+=`\n${retry}`;
  return out;
}

function jsonResponse(original,data){
  const headers=new Headers(original.headers||{});
  headers.set('content-type','application/json; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(data),{status:original.status,statusText:original.statusText,headers});
}

function sanitizePersona(data){
  if(!data||typeof data!=='object')return data;
  data.candidatePlayers=filtered(data.candidatePlayers).slice(0,1);
  if(!data.candidatePlayers.length){
    data.reviewRequested=true;
    data.reviewReason='正捕手の大野 竜暉を除外した条件で、別の投手から第一候補を再選定する必要がある。';
    data.publicStatement='大野 竜暉は正捕手として運用するためエース候補の対象外です。別の投手から第一候補を再選定します。';
  }
  return data;
}

function firstChoice(group,persona){return filtered(group?.[persona]?.candidatePlayers)[0]||'';}

function sanitizeCross(data,body){
  if(!data||typeof data!=='object')return data;
  const p=body?.primary||{};
  const m=firstChoice(p,'melchior'),b=firstChoice(p,'balthasar'),c=firstChoice(p,'casper');
  const label=n=>n||'第一候補';
  data.challenges={
    melchior:[`${label(m)}を第一候補とする根拠を、投球回・先発回数・四死球・奪三振・失点内容を同じ基準で比較して再確認してください。`],
    balthasar:[`${label(b)}を第一候補とした場合、7回制で先発として試合を作る役割と継投の組みやすさを両立できるか確認してください。`],
    casper:[`${label(c)}について、現在の守備役割との両立と継続起用のしやすさまで含めて、エースを任せる判断に無理がないか確認してください。`]
  };
  const choices=[m,b,c].filter(Boolean);
  const unique=[...new Map(choices.map(n=>[key(n),n])).values()];
  data.agreement=unique.length===1?[`3賢人とも${unique[0]}を第一候補に選定。`]:['3賢人とも現チームの投手成績と起用実績を比較対象とする。'];
  data.disagreement=unique.length===1?['第一候補に相違なし。']:[`第一候補が分かれている：${choices.join('・')}。`];
  data.warnings=list(data.warnings).filter(x=>!/ルールに抵触|規約|ポリシー/.test(text(x))).slice(0,2);
  data.informationGaps=list(data.informationGaps).slice(0,2);
  return data;
}

function sanitizeFinal(data,body){
  if(!data||typeof data!=='object')return data;
  const target=data?.final&&typeof data.final==='object'?data.final:data;
  if(text(target?.mode).toUpperCase()!=='SELECTION')return data;
  target.centerCandidates=filtered(target.centerCandidates).slice(0,1);
  target.recommendedCandidates=filtered(target.recommendedCandidates);
  target.alternateCandidates=filtered(target.alternateCandidates);
  if(Array.isArray(target.candidateSupport))target.candidateSupport=target.candidateSupport.filter(x=>!excluded(x?.name));
  const second=body?.second||{};
  const choices=['melchior','balthasar','casper'].map(p=>firstChoice(second,p)).filter(Boolean);
  const counts=new Map();
  for(const name of choices){const k=key(name),r=counts.get(k)||{name,n:0};r.n++;counts.set(k,r);}
  const ranked=[...counts.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name,'ja'));
  const winner=ranked[0]?.name||target.centerCandidates[0]||'';
  const votes=winner?choices.filter(n=>key(n)===key(winner)).length:0;
  if(winner&&votes>=2){
    target.status='SELECTION_RESULT';
    target.centerCandidates=[winner];
    target.recommendation=`エース第一候補：${winner}。${votes===3?'3賢人の二次判断が一致。':`3賢人中${votes}名が第一候補に選定。`}`;
  }
  target.reDeliberationConditions=list(target.reDeliberationConditions).filter(x=>!/^(?:[①-⑳\d\s、,./／・･()（）]+)$/.test(text(x))).slice(0,3);
  target.warnings=list(target.warnings).slice(0,3);
  return data;
}

window.fetch=async function(input,init){
  const raw=parseBody(init);
  if(!isAce(raw))return previousFetch(input,init);
  const url=urlOf(input);
  const prepared=injectPolicy(raw,false);
  let response=await previousFetch(input,{...(init||{}),body:JSON.stringify(prepared)});
  if(!response.ok||!/\/api\/magi\/(?:persona|orchestrate)(?:\?|$)/.test(url))return response;
  let data;try{data=await response.clone().json();}catch(_){return response;}

  if(/\/api\/magi\/persona(?:\?|$)/.test(url)){
    if(list(data?.candidatePlayers).some(excluded)){
      const retryBody=injectPolicy(raw,true);
      const retry=await previousFetch(input,{...(init||{}),body:JSON.stringify(retryBody)});
      if(retry.ok){try{data=await retry.clone().json();response=retry;}catch(_){}}
    }
    sanitizePersona(data);
  }else{
    const phase=text(raw?.phase).toUpperCase();
    if(phase==='CROSS_EXAMINATION')sanitizeCross(data,prepared);
    if(phase==='FINAL')sanitizeFinal(data,prepared);
  }
  return jsonResponse(response,data);
};

window.MAGI_ACE_SELECTION_CORE_META=Object.freeze({version:'v397',observer:false,excludedCatcher:EXCLUDED,bestOrderUntouched:true});
})();
