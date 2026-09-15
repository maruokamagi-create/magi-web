(()=>{
'use strict';
if(window.MAGI_DELIBERATION_INTEGRITY_V349)return;
window.MAGI_DELIBERATION_INTEGRITY_V349=true;
window.MAGI_DELIBERATION_SERIAL_V374=true;

const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={
  melchior:{jp:'メルキオール',en:'MELCHIOR-1',first:'私'},
  balthasar:{jp:'バルタザール',en:'BALTHASAR-2',first:'俺'},
  casper:{jp:'カスパー',en:'CASPER-3',first:'僕'}
};
const CURRENT_ROSTER=['大久保 陽翔','大野 竜暉','嶋田 栄志','井坂 悠聖','橋向 結都','坂田 暉馬','武澤 大翔','大久保 夢翔','吉田 真翔','武田 晴琉翔','鰐渕 将太','上村 蓮','中嶋 玲月','長侶 穹'];
const CONTROL_ICON='/magi-official-symbol-v125.svg?v=349';
const clone=value=>JSON.parse(JSON.stringify(value??null));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const deepFreeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(deepFreeze);return value};
const emit=(options,name,payload)=>{const fn=options&&options[name];if(typeof fn==='function'){try{fn(clone(payload))}catch(_){}}};
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s　]/g,'');
const ROSTER_KEYS=new Set(CURRENT_ROSTER.map(norm));

function isFullLineup(caseData){
  if(String(caseData?.evidence?.selectionKind||'').toUpperCase()==='FULL_LINEUP')return true;
  const q=String(caseData?.question||'').normalize('NFKC');
  return /ベストオーダー|ベスト打順/.test(q)||/(?:打順|オーダー|打線).{0,18}(?:どうする|どう組|組んで|組む|考えて|決めて|作って|審議)/.test(q)||/1番.{0,50}9番/.test(q);
}
function isOpponentSpecific(caseData){
  const q=String(caseData?.question||'').normalize('NFKC');
  return /(?:対戦相手|相手投手|相手先発|右投手|左投手|右腕|左腕|対右|対左|左右の相性|相手別|対戦データ|対戦成績)/.test(q);
}

function prepareEvidence(evidence,caseData){
  const e=clone(evidence);
  if(!e||!isFullLineup(caseData))return e;
  const policy='現場の起用案や打順案は回答の正解指定ではなく、審議材料の一つとして扱う。MELCHIORは再現性と母数、BALTHASARは得点へのつながりと試合運用、CASPERは役割・育成・負担から全14名を独立に比較する。3人とも、まずデータから自分の案を作り、その後で現場案と照合する。他人格の案や多数派に合わせない。違いを作るためだけの変更もしない。';
  if(typeof e.text==='string'){
    e.text=e.text
      .replace(/【標準オーダーの基準線】[^\n]*/g,'【現場案の扱い】通常は相手投手の左右が事前に不明なため、右投手対応を標準条件とする。現場では大野 竜暉、坂田 暉馬、嶋田 栄志、大久保 陽翔、中嶋 玲月を上位候補として重く見ている。ただし、この5人の順番を含めて審議結果の指定ではない。3賢人は全14名の過去実績・今季通算・直近状態・守備運用から、自分の専門領域で順番を組み直してよい。')
      .replace(/【大野竜暉の上位評価】[^\n]*/g,'【大野竜暉の確認点】出塁率と母数、過去実績を上位適性の重要材料として見る。ただし「1番固定」という正解指定ではなく、他の上位候補と比較して各賢人が打順を決める。')
      .replace(/【2〜3番の扱い】[^\n]*/g,'【坂田・嶋田の確認点】現在の好成績は評価するが、少ない母数の高率を過大評価しない。過去実績・今季母数・直近状態を必ず併記し、2番・3番を自動固定しない。');
    e.text+=`\n【3賢人独立性ルール】${policy}`;
  }
  e.deliberationPolicy=policy;
  if(typeof e.summary==='string')e.summary+=` 現場案は回答指定ではなく、3賢人が全14名から独立検証する。`;
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
  const draft={id:input?.id||`MAGI-${Date.now()}`,question,mode:String(input?.mode||'proposal').toLowerCase(),objective:String(input?.objective||'').trim(),options:Array.isArray(input?.options)?clone(input.options):[],urgency:input?.urgency||'normal',evidence:null,createdAt:new Date().toISOString()};
  draft.evidence=prepareEvidence(input?.evidence||null,draft);
  return deepFreeze(draft);
}
function lockPrimary(primary){const locked={};for(const name of PERSONAS)locked[name]=deepFreeze(clone(primary[name]));return deepFreeze(locked)}
function reveal(primaryLocked){return deepFreeze({melchior:clone(primaryLocked.melchior),balthasar:clone(primaryLocked.balthasar),casper:clone(primaryLocked.casper)})}
function sequence(v){return (Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]).map(norm).filter(Boolean)}
function validNine(v){const s=sequence(v);return s.length===9&&new Set(s).size===9&&s.every(x=>ROSTER_KEYS.has(x))}
function softGuardFailure(v){
  if(!v?.reviewRequested||!validNine(v))return false;
  const reason=String(v?.reviewReason||'');
  if(!/回答文の数値・選手参照をEvidenceと照合した結果、不整合/.test(reason))return false;
  const fatal=/(?:FULL_LINEUP|正式ロスター|ロスター完全一致|対象外|9人の打順構成|candidatePlayers|打順構成エラー|数値.{0,30}(?:一致しない|存在しない)|選手名.{0,30}(?:存在しない|対象外)|supplied CASE\/EVIDENCE.{0,50}(?:値と一致しない|選手.*存在しない))/i.test(reason);
  return !fatal;
}
function recoverSoftLineup(v,persona,caseData){
  if(!isFullLineup(caseData)||isOpponentSpecific(caseData)||!softGuardFailure(v))return v;
  const out=clone(v),names=Array.isArray(out.candidatePlayers)?out.candidatePlayers.slice(0,9):[];
  const first=TARGETS[persona]?.first||'私';
  out.judgment='BLUE';out.confidence='LOW';out.reviewRequested=false;out.reviewReason='';out.dataConflict=false;
  out.facts=[];out.analysis=[];out.prediction=[];
  out.candidateBasis='説明文のうちEvidence照合に通らなかった表現を除外し、正式ロスター内の9人の打順案だけを保持して再審議を継続。';
  out.primaryReason='打順構成自体は正式14名の範囲で成立しているため、説明文の不適切な表現だけを除外し、標準案の比較を続けます。';
  out.publicStatement=`${first}の標準案は ${names.map((name,i)=>`${i+1}番${name}`).join('、')} です。説明文の一部がEvidence照合に通らなかったため、その表現は採用せず、打順案だけを残して比較します。`;
  out.warnings=['説明文の一部をEvidence照合で除外。打順そのものは正式ロスター内で成立。'];
  return out;
}
function recoverSet(set,caseData){const out={};for(const p of PERSONAS)out[p]=recoverSoftLineup(set?.[p],p,caseData);return out}

async function runPrimary(caseData,options){
  const rows=[];
  for(const persona of PERSONAS){
    const result=await postJSON('/api/magi/persona',{phase:'PRIMARY',persona,case:caseData},options);
    rows.push([persona,result]);
  }
  return recoverSet(Object.fromEntries(rows),caseData);
}
async function runCross(caseData,primaryLocked,options){return postJSON('/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary:reveal(primaryLocked)},options)}
function crossForPersona(cross,persona,independenceReview=''){
  const c=clone(cross||{}),all=clone(c?.challenges||{}),toSelf=Array.isArray(all?.[persona])?all[persona]:[];
  c.challengeToSelf=toSelf;
  c.challengeTarget=TARGETS[persona]?.en||persona;
  c.challengeSemantics=`challengeToSelf と challenges.${persona} は ${TARGETS[persona]?.en||persona} に向けられた質問であり、その人格自身が発言した文ではない。まずこの自分宛ての指摘に答え、その後に自分の専門領域だけで二次判断すること。`;
  c.independenceRule='他の2人格と同じ結論に合わせる必要はない。違いを作るためだけに変えてもいけない。一次案とEvidenceを自分の専門領域で再検証し、少なくとも1つの別案を比較したうえで、その案を採るか退けるかを自分で決めること。';
  if(independenceReview)c.independenceReview=independenceReview;
  return c;
}
async function runSecond(caseData,primaryLocked,cross,options,independenceReview=''){
  const revealed=reveal(primaryLocked);
  const rows=[];
  for(const persona of PERSONAS){
    const result=await postJSON('/api/magi/persona',{phase:'SECOND',persona,case:caseData,primarySelf:revealed[persona],crossExamination:crossForPersona(cross,persona,independenceReview)},options);
    rows.push([persona,result]);
  }
  return recoverSet(Object.fromEntries(rows),caseData);
}
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
    const note='3賢人の二次打順が完全一致した。多数派への同調を排除するため、もう一度だけ独立再検証する。自分の一次案と自分宛てのchallengeToSelf、過去実績・今季通算・直近状態・守備運用を照合し、特に上位1〜5番と6〜9番で少なくとも1つの代替配置を具体的に比較すること。違いを作るためだけの変更は禁止。同じ打順を維持するなら、比較した代替案を退けた理由を自分の専門領域から明示すること。';
    second=await runSecond(caseData,primaryLocked,cross,options,note);
  }
  emit(options,'onSecondComplete',second);
  emit(options,'onStage',{stage:'FINAL',message:caseData.mode==='selection'?'選択結果を集約':'最終決定を開始'});
  const final=await finalize(caseData,primaryLocked,cross,second,options);emit(options,'onFinalComplete',final);
  return deepFreeze({engineVersion:'1.1.2-serial-integrity',case:clone(caseData),primary:reveal(primaryLocked),crossExamination:clone(cross),second:clone(second),final:clone(final)});
}

function installEngine(){
  if(!window.MAGI_ENGINE_V1)return false;
  if(window.MAGI_ENGINE_V1?.version==='1.1.2-serial-integrity')return true;
  window.MAGI_ENGINE_V1=deepFreeze({version:'1.1.2-serial-integrity',personas:PERSONAS.slice(),deliberate});
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