(()=>{
'use strict';
if(window.MAGI_ACE_SELECTION_INTEGRITY_V394)return;
window.MAGI_ACE_SELECTION_INTEGRITY_V394=true;

const VERSION='v394';
const nativeFetch=window.fetch.bind(window);
const text=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const PITCH_ROLE='PITCHING_ROLE';
let lastAceResult=null;

function compactName(v){return text(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'');}
function deepClone(v){try{return JSON.parse(JSON.stringify(v));}catch(_){return v;}}
function caseDataFrom(body){return body?.case&&typeof body.case==='object'?body.case:body||{};}
function caseQuestion(body){const c=caseDataFrom(body);return text(c?.question||body?.question||document.getElementById('q')?.value);}
function caseSelectionKind(body){const c=caseDataFrom(body);return text(c?.evidence?.selectionKind||c?.selectionKind||body?.selectionKind).toUpperCase();}
function isAceCase(body){
  const q=caseQuestion(body).normalize('NFKC');
  const kind=caseSelectionKind(body);
  return kind===PITCH_ROLE&&ACE_RE.test(q) || ACE_RE.test(q);
}
function parseJsonBody(init){
  const raw=init?.body;
  if(typeof raw!=='string')return null;
  try{return JSON.parse(raw);}catch(_){return null;}
}
function urlText(input){return typeof input==='string'?input:text(input?.url);}
function firstOnlyPersona(data){
  if(!data||typeof data!=='object')return data;
  if(Array.isArray(data.candidatePlayers)){
    const first=data.candidatePlayers.map(text).find(Boolean);
    data.candidatePlayers=first?[first]:[];
    if(first){
      data.candidateBasis=text(data.candidateBasis)||`${first}を第一候補として選定。`;
    }
  }
  return data;
}
function cleanCondition(value){
  let s=text(value).normalize('NFKC');
  if(!s)return'';
  s=s.replace(/^[\s・･\-–—]*(?:[①-⑳]|\(?\d{1,2}\)?)[\s.)）:：、・･\-–—]*/,'').trim();
  s=s.replace(/^(?:①\s*)+/,'').trim();
  if(!s||/^(?:[①-⑳\d\s、,./／・･()（）]+)$/.test(s))return'';
  return s;
}
function cleanConditions(values){
  const out=[],seen=new Set();
  for(const v of list(values)){
    const s=cleanCondition(v);
    const k=s.replace(/\s+/g,'');
    if(!s||seen.has(k))continue;
    seen.add(k);out.push(s);
    if(out.length>=5)break;
  }
  return out;
}
function normalizeAceFinal(data,requestBody){
  if(!data||typeof data!=='object')return data;
  const final=data?.final&&typeof data.final==='object'?data.final:data;
  if(final?.mode!=='SELECTION'&&data?.mode!=='SELECTION')return data;
  const source=final;
  source.selectionKind=PITCH_ROLE;
  source.roleLabel='エース';
  source.reDeliberationConditions=cleanConditions(source.reDeliberationConditions);
  source.warnings=cleanConditions(source.warnings);

  const second=requestBody?.second||data?.second||null;
  if(second&&typeof second==='object'){
    const entries=Array.isArray(second)?second.map((v,i)=>[String(i),v]):Object.entries(second);
    const support=new Map();
    const personaSelections={};
    for(const [persona,p] of entries){
      const first=list(p?.candidatePlayers).map(text).find(Boolean)||'';
      personaSelections[persona]=first?[first]:[];
      if(!first)continue;
      const key=compactName(first);
      const row=support.get(key)||{name:first,firstPlaceCount:0,support:0,personas:[]};
      row.firstPlaceCount+=1;row.support+=1;row.personas.push(persona);support.set(key,row);
    }
    const ranked=[...support.values()].sort((a,b)=>b.firstPlaceCount-a.firstPlaceCount||a.name.localeCompare(b.name,'ja'));
    if(ranked.length){
      const top=ranked[0],runner=ranked[1];
      const hasLead=top.firstPlaceCount>=2 || !runner || top.firstPlaceCount>runner.firstPlaceCount;
      source.centerCandidates=hasLead?[top.name]:[];
      source.recommendedCandidates=ranked.map(x=>x.name);
      source.alternateCandidates=ranked.slice(hasLead?1:0).map(x=>x.name);
      source.candidateSupport=ranked.map((x,i)=>({...x,overallRank:i+1,rankScore:x.firstPlaceCount,rankTotal:x.firstPlaceCount,averageRank:1}));
      source.personaSelections=personaSelections;
      if(hasLead){
        const voteText=top.firstPlaceCount===3?'3賢人の二次判断が一致。':`3賢人中${top.firstPlaceCount}名が第一候補に選定。`;
        source.status='SELECTION_RESULT';
        source.recommendation=`エース第一候補：${top.name}。${voteText}`;
      }else{
        source.status='SELECTION_SPLIT';
        source.recommendation=`エース第一候補は一本化せず。各賢人の第一候補：${ranked.map(x=>x.name).join('・')}。`;
      }
    }
  }else{
    const centers=list(source.centerCandidates).map(text).filter(Boolean);
    if(centers.length===1)source.recommendation=`エース第一候補：${centers[0]}。${text(source.recommendation).replace(/^中心候補：[^。]*。?/,'')}`.trim();
  }
  return data;
}
function responseWithJson(original,data){
  const headers=new Headers(original.headers||{});
  headers.set('content-type','application/json; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(data),{status:original.status,statusText:original.statusText,headers});
}

window.fetch=async function(input,init){
  const url=urlText(input);
  const body=parseJsonBody(init);
  const ace=body&&isAceCase(body);
  const response=await nativeFetch(input,init);
  if(!ace||!response.ok)return response;
  if(!/\/api\/magi\/(?:persona|orchestrate)(?:\?|$)/.test(url))return response;
  let data;
  try{data=await response.clone().json();}catch(_){return response;}
  if(/\/api\/magi\/persona(?:\?|$)/.test(url)){
    firstOnlyPersona(data);
  }else if(/\/api\/magi\/orchestrate(?:\?|$)/.test(url)&&String(body?.phase||'').toUpperCase()==='FINAL'){
    normalizeAceFinal(data,body);
  }
  return responseWithJson(response,data);
};

function resultQuestion(result){return text(result?.case?.question||document.getElementById('q')?.value);}
function isAceResult(result){
  if(!result||typeof result!=='object')return false;
  const kind=text(result?.case?.evidence?.selectionKind||result?.final?.selectionKind).toUpperCase();
  return kind===PITCH_ROLE&&ACE_RE.test(resultQuestion(result).normalize('NFKC')) || ACE_RE.test(resultQuestion(result).normalize('NFKC'));
}
function normalizeResult(result){
  if(!isAceResult(result))return result;
  ['primary','second'].forEach(key=>{
    const group=result?.[key];
    if(!group||typeof group!=='object')return;
    Object.values(group).forEach(firstOnlyPersona);
  });
  normalizeAceFinal(result,{second:result?.second});
  return result;
}
function firstChoices(result){
  const group=result?.second||{};
  return Object.entries(group).map(([persona,p])=>({persona,name:list(p?.candidatePlayers).map(text).find(Boolean)||''})).filter(x=>x.name);
}
function aceWinner(result){
  const center=list(result?.final?.centerCandidates).map(text).filter(Boolean);
  if(center.length===1)return center[0];
  const choices=firstChoices(result),m=new Map();
  choices.forEach(x=>{const k=compactName(x.name),row=m.get(k)||{name:x.name,n:0};row.n++;m.set(k,row);});
  return [...m.values()].sort((a,b)=>b.n-a.n)[0]?.name||'';
}
function setText(id,value){const el=document.getElementById(id);if(el&&value)el.textContent=value;}
function replaceDataHubCount(count){
  if(!Number.isFinite(count)||count<1)return;
  const all=document.querySelectorAll('span,div,p');
  for(const el of all){
    if(el.children.length)continue;
    const s=text(el.textContent).normalize('NFKC');
    if(/^DATA HUB\s*[:：]\s*\d+\s*件$/.test(s))el.textContent=`DATA HUB：${count}件`;
  }
}
function fixChat(result,winner,choices,conditions){
  const nodes=[...document.querySelectorAll('#magiChatView .magiMsg.system .magiSpeechText,#magiChatView .magiMsg.system .magiSpeech')];
  if(!nodes.length)return;
  const node=nodes[nodes.length-1];
  const current=text(node.textContent);
  if(!/(?:中心候補|エース|有力候補|再検討条件|最終結果)/.test(current))return;
  const unique=[...new Map(choices.map(x=>[compactName(x.name),x.name])).values()];
  const agree=winner&&unique.length===1?`3賢人の第一候補は「${winner}」で一致しました。`:winner?`MAGIのエース第一候補は「${winner}」です。各賢人の第一候補は ${choices.map(x=>x.name).join('・')}。`:`第一候補は一本化していません。各賢人の第一候補は ${choices.map(x=>x.name).join('・')}。`;
  const cond=conditions.length?` 再検討条件：${conditions.join('／')}。`:'';
  node.textContent=`3賢人の一次判断、相互検証、二次判断を踏まえました。${agree}${cond}`;
}
function patchDom(result){
  if(!isAceResult(result))return;
  normalizeResult(result);
  const final=result.final||{};
  const winner=aceWinner(result);
  const choices=firstChoices(result);
  const uniqueChoices=[...new Map(choices.map(x=>[compactName(x.name),x.name])).values()];
  const conditions=cleanConditions(final.reDeliberationConditions);
  const count=Number(result?.case?.evidence?.count)||list(result?.case?.evidence?.allCurrentTeamCheck?.players).length||0;

  if(winner&&list(final.centerCandidates).length===1)setText('verdict',`エース候補：${winner}`);
  else setText('verdict','エース候補：審議継続');

  if(winner){
    const votes=choices.filter(x=>compactName(x.name)===compactName(winner)).length;
    setText('reason',votes===3?`3賢人の二次判断が一致し、${winner}をエース第一候補としました。`:`3賢人の第一候補を比較し、${winner}をエース第一候補としました（${votes}/3）。`);
  }
  const alts=uniqueChoices.filter(name=>compactName(name)!==compactName(winner));
  const bits=[];
  if(alts.length)bits.push(`別の第一候補：${alts.join('・')}`);
  if(conditions.length)bits.push(`再検討条件：${conditions.join('／')}`);
  setText('next',bits.join('　')||'追加データが入った時点で再審議します。');

  const personaIds=[['mVote',choices[0]?.name],['v1',choices[0]?.name],['bVote',choices[1]?.name],['v2',choices[1]?.name],['cVote',choices[2]?.name],['v3',choices[2]?.name]];
  for(const [id,name] of personaIds){
    if(!name)continue;
    const el=document.getElementById(id);if(!el)continue;
    if(/Vote$/.test(id))el.textContent=`第一候補：${name}`;
    else el.textContent=`${id==='v1'?'MELCHIOR':id==='v2'?'BALTHASAR':'CASPER'} ${name}`;
  }
  replaceDataHubCount(count);
  fixChat(result,winner,choices,conditions);
}
function schedulePatch(result){
  lastAceResult=normalizeResult(deepClone(result));
  [0,60,180,450,900,1600,2600].forEach(ms=>setTimeout(()=>patchDom(lastAceResult),ms));
}

document.addEventListener('magi:deliberation-result',event=>{
  const result=event?.detail;
  if(isAceResult(result))schedulePatch(result);
});

const observer=new MutationObserver(()=>{if(lastAceResult)patchDom(lastAceResult);});
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});

window.MAGI_ACE_SELECTION_INTEGRITY_META=Object.freeze({version:VERSION,singleRole:true,bestOrderUntouched:true,personaFirstChoiceOnly:true,conditionSanitizer:true,dataHubSync:true});
})();
