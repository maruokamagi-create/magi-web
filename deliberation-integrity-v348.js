(()=>{
'use strict';
if(window.MAGI_DELIBERATION_INTEGRITY_V348)return;
window.MAGI_DELIBERATION_INTEGRITY_V348=true;

const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={
  melchior:{jp:'メルキオール',en:'MELCHIOR-1'},
  balthasar:{jp:'バルタザール',en:'BALTHASAR-2'},
  casper:{jp:'カスパー',en:'CASPER-3'}
};
const CONTROL_ICON='/magi-official-symbol-v125.svg?v=348';
const clone=value=>JSON.parse(JSON.stringify(value??null));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deepFreeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(deepFreeze);return value};
const emit=(options,name,payload)=>{const fn=options&&options[name];if(typeof fn==='function'){try{fn(clone(payload))}catch(_){}}};

function isFullLineup(caseData){
  if(String(caseData?.evidence?.selectionKind||'').toUpperCase()==='FULL_LINEUP')return true;
  const q=String(caseData?.question||'').normalize('NFKC');
  return /ベストオーダー|ベスト打順/.test(q)||/(?:打順|オーダー|打線).{0,18}(?:どうする|どう組|組んで|組む|考えて|決めて|作って|審議)/.test(q)||/1番.{0,50}9番/.test(q);
}

function prepareEvidence(evidence,caseData){
  const e=clone(evidence);
  if(!e||!isFullLineup(caseData))return e;
  const policy='現場で共有されている標準オーダー案は、3賢人への正解指定ではなく、指導・運用上の作業仮説である。MELCHIORは再現性と母数、BALTHASARは得点へのつながりと試合運用、CASPERは役割・育成・負担の観点から、それぞれ独立に検証すること。作業仮説と異なる案をEvidenceが支持するなら遠慮なく変更してよい。逆に3者が同じ並びになること自体は禁止しないが、他者への同調や多数派形成を理由にしてはならず、それぞれ自分の専門領域の根拠で同じ結論に到達した場合だけ一致を認める。';
  if(typeof e.text==='string'){
    e.text=e.text.replace(/【標準オーダーの基準線】[^\n]*/g,'【現場の運用仮説】相手投手の左右が事前に不明な通常時は右投手対応を出発点とする。現在、現場で検討している上位5人の作業仮説は 1番 大野 竜暉、2番 坂田 暉馬、3番 嶋田 栄志、4番 大久保 陽翔、5番 中嶋 玲月。ただしこれは審議結果の指定ではない。3賢人は全14名と過去実績・今季通算・直近状態・守備運用を照合し、自分の専門領域からこの仮説を支持するか、修正するかを独立に決める。');
    e.text+=`\n【3賢人独立性ルール】${policy}`;
  }
  e.deliberationPolicy=policy;
  if(typeof e.summary==='string')e.summary+=` 作業仮説は回答指定ではなく、3賢人が独立検証する。`;
  return e;
}

async function postJSON(url,payload,options={}){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    if(attempt){const wait=900*Math.pow(2,attempt-1)+Math.floor(Math.random()*350);emit(options,'onRetry',{url,attempt:attempt+1,waitMs:wait});await sleep(wait)}
    try{
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const body=await res.json().catch(()=>({}));
      if(res.ok)return body;
      const err=new Error(body?.error||`MAGI API error ${res.status}`);err.status=res.status;lastError=err;
      if(!(res.status===408||res.status===429||res.status>=500))throw err;
    }catch(error){lastError=error;if(error?.status&&!(error.status===408||error.status===429||error.status>=500))throw error}
  }
  throw lastError||new Error('MAGI API request failed');
}

function normalizeCase(input){
  const question=String(input?.question||'').trim();
  if(!question)throw new Error('CASE question is required.');
  const draft={
    id:input?.id||`MAGI-${Date.now()}`,
    question,
    mode:String(input?.mode||'proposal').toLowerCase(),
    objective:String(input?.objective||'').trim(),
    options:Array.isArray(input?.options)?clone(input.options):[],
    urgency:input?.urgency||'normal',
    evidence:null,
    createdAt:new Date().toISOString()
  };
  draft.evidence=prepareEvidence(input?.evidence||null,draft);
  return deepFreeze(draft);
}
function lockPrimary(primary){const locked={};for(const name of PERSONAS)locked[name]=deepFreeze(clone(primary[name]));return deepFreeze(locked)}
function reveal(primaryLocked){return deepFreeze({melchior:clone(primaryLocked.melchior),balthasar:clone(primaryLocked.balthasar),casper:clone(primaryLocked.casper)})}
async function runPrimary(caseData,options){const jobs=PERSONAS.map(persona=>postJSON('/api/magi/persona',{phase:'PRIMARY',persona,case:caseData},options).then(result=>[persona,result]));return Object.fromEntries(await Promise.all(jobs))}
async function runCross(caseData,primaryLocked,options){return postJSON('/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary:reveal(primaryLocked)},options)}
function crossForPersona(cross,persona,independenceReview=''){
  const c=clone(cross||{}),all=clone(c?.challenges||{}),toSelf=Array.isArray(all?.[persona])?all[persona]:[];
  c.challengeToSelf=toSelf;
  c.challengeTarget=TARGETS[persona]?.en||persona;
  c.challengeSemantics=`challengeToSelf と challenges.${persona} は ${TARGETS[persona]?.en||persona} に向けられた質問であり、その人格自身が発言した文ではない。まずこの自分宛ての指摘に答え、その後に自分の専門領域だけで二次判断すること。`;
  c.independenceRule='他の2人格と同じ結論に合わせる必要はない。逆に、違いを作るためだけに変えてもいけない。一次案とEvidenceを自分の専門領域で再検証して決めること。';
  if(independenceReview)c.independenceReview=independenceReview;
  return c;
}
async function runSecond(caseData,primaryLocked,cross,options,independenceReview=''){
  const revealed=reveal(primaryLocked);
  const jobs=PERSONAS.map(persona=>postJSON('/api/magi/persona',{
    phase:'SECOND',persona,case:caseData,primarySelf:revealed[persona],crossExamination:crossForPersona(cross,persona,independenceReview)
  },options).then(result=>[persona,result]));
  return Object.fromEntries(await Promise.all(jobs));
}
function sequence(v){return (Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]).map(x=>String(x||'').normalize('NFKC').replace(/[\s　]/g,''))}
function allSameLineup(second,caseData){
  if(!isFullLineup(caseData))return false;
  const seq=PERSONAS.map(p=>sequence(second?.[p]));
  if(seq.some(x=>x.length!==9))return false;
  return seq.slice(1).every(x=>x.every((v,i)=>v===seq[0][i]));
}
async function finalize(caseData,primaryLocked,cross,second,options){return postJSON('/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary:reveal(primaryLocked),crossExamination:cross,second:clone(second)},options)}

async function deliberate(input,options={}){
  const caseData=normalizeCase(input);
  emit(options,'onStage',{stage:'PRIMARY',message:caseData.mode==='selection'?'一次候補抽出を開始':'一次独立判定を開始'});
  const primary=await runPrimary(caseData,options),primaryLocked=lockPrimary(primary);
  emit(options,'onPrimaryLocked',reveal(primaryLocked));
  emit(options,'onStage',{stage:'CROSS',message:'相互検証を開始'});
  const cross=await runCross(caseData,primaryLocked,options);emit(options,'onCrossComplete',cross);
  emit(options,'onStage',{stage:'SECOND',message:caseData.mode==='selection'?'二次候補選定を開始':'二次判定を開始'});
  let second=await runSecond(caseData,primaryLocked,cross,options);
  if(allSameLineup(second,caseData)){
    emit(options,'onStage',{stage:'INDEPENDENCE_RECHECK',message:'3案一致を検出。独立性を再検証'});
    const note='3賢人の最初の二次打順が完全一致した。これは誤りとは限らないが、同調で一致した可能性を排除するため独立再検証する。自分の一次案、自分宛てのchallengeToSelf、過去実績・今季通算・直近状態をもう一度照合すること。違いを作るためだけに変更してはいけない。同じ打順を維持するなら、自分の専門領域からなぜその9人・その順番なのかを他人格とは独立した理由で説明すること。Evidenceが別案を支持するなら遠慮なく修正すること。';
    second=await runSecond(caseData,primaryLocked,cross,options,note);
  }
  emit(options,'onSecondComplete',second);
  emit(options,'onStage',{stage:'FINAL',message:caseData.mode==='selection'?'選択結果を集約':'最終決定を開始'});
  const final=await finalize(caseData,primaryLocked,cross,second,options);emit(options,'onFinalComplete',final);
  return deepFreeze({engineVersion:'1.1.0-integrity',case:clone(caseData),primary:reveal(primaryLocked),crossExamination:clone(cross),second:clone(second),final:clone(final)});
}

function installEngine(){
  if(!window.MAGI_ENGINE_V1)return false;
  if(window.MAGI_ENGINE_V1?.version==='1.1.0-integrity')return true;
  window.MAGI_ENGINE_V1=deepFreeze({version:'1.1.0-integrity',personas:PERSONAS.slice(),deliberate});
  return true;
}
let engineTries=0;const engineTimer=setInterval(()=>{engineTries++;if(installEngine()||engineTries>400)clearInterval(engineTimer)},50);installEngine();

function targetFromRow(row){
  const text=String(row.querySelector('.magiSender')?.textContent||'').toUpperCase();
  if(text.includes('MELCHIOR'))return TARGETS.melchior;
  if(text.includes('BALTHASAR'))return TARGETS.balthasar;
  if(text.includes('CASPER'))return TARGETS.casper;
  const speech=String(row.querySelector('.magiSpeechText')?.textContent||'');
  if(/^メルキオール(?:さん)?[、,]/.test(speech))return TARGETS.melchior;
  if(/^バルタザール(?:さん)?[、,]/.test(speech))return TARGETS.balthasar;
  if(/^カスパー(?:さん)?[、,]/.test(speech))return TARGETS.casper;
  return null;
}
function fixCrossAttribution(){
  document.querySelectorAll('#magiChatView .magiMsg').forEach(row=>{
    if(row.dataset.magiCrossAttributionFixed==='1')return;
    const tag=row.querySelector('.magiJudgeTag');if(!tag||!String(tag.textContent||'').includes('相互検証'))return;
    const target=targetFromRow(row);if(!target)return;
    row.dataset.magiCrossAttributionFixed='1';
    row.classList.remove('mel','bal','cas');row.classList.add('system');
    const avatar=row.querySelector('.magiAvatar');if(avatar){avatar.src=CONTROL_ICON;avatar.alt='MAGI CONTROL'}
    const sender=row.querySelector('.magiSender');if(sender)sender.innerHTML=`MAGI CONTROL<span>→ ${target.jp}</span>`;
    const bubble=row.querySelector('.magiBubble');
    if(bubble&&!bubble.querySelector('.magiTarget')){const t=document.createElement('span');t.className='magiTarget';t.textContent=`→ ${target.jp} へ`;bubble.insertBefore(t,bubble.firstChild)}
  });
}
const uiObserver=new MutationObserver(()=>requestAnimationFrame(fixCrossAttribution));
uiObserver.observe(document.documentElement,{childList:true,subtree:true});
fixCrossAttribution();
})();