(()=>{
'use strict';
if(window.MAGI_QUESTION_SAMPLE_ROUTES_V393)return;
window.MAGI_QUESTION_SAMPLE_ROUTES_V393=true;

const ROSTER=[
  '井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都',
  '上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'
];
const SAMPLES=[
  {id:'BEST_ORDER',label:'ベストオーダーを審議して',value:'現在の選手データと起用実績をもとに、現時点のベストオーダーを審議してください。'},
  {id:'ACE_SELECTION',label:'現在のエース候補を審議して',value:'現在のエース候補は誰が適任か、現チーム14名の投手成績と起用実績を比較して審議してください。'},
  {id:'PITCHING_PLAN_7',label:'次の試合の先発・継投案を考えて',value:'7回制の投手運用を、先発→第2投手→終盤→クローザーの4役で組んで審議してください。'},
  {id:'TEAM_REVIEW',label:'今のチームの改善課題を審議して',value:'現チーム14名の現在データをもとに、今のチームで最優先に改善すべき課題を審議してください。'},
  {id:'STARTER_EVAL',label:'選手のスタメン起用を審議して',value:''}
];
let writing=false;

function dispatch(q){
  writing=true;
  q.dispatchEvent(new Event('input',{bubbles:true}));
  q.dispatchEvent(new Event('change',{bubbles:true}));
  writing=false;
}
function starterQuestion(name){
  return `${name}選手を現在のスタメンとして起用すべきか、今季成績・守備位置・起用実績をもとに審議してください。`;
}
function ensureStyle(){
  if(document.getElementById('magi-question-sample-routes-v393-style'))return;
  const s=document.createElement('style');
  s.id='magi-question-sample-routes-v393-style';
  s.textContent=`
  .magiSamplePlayerWrap{display:none;margin:8px 0 0;padding:10px;border:1px solid #294f70;border-radius:11px;background:#081c2f}
  .magiSamplePlayerWrap.show{display:block}
  .magiSamplePlayerLabel{display:block;margin:0 0 6px;color:#aac0d5;font-size:11px;font-weight:850}
  .magiSamplePlayerSelect{width:100%;min-height:44px;border-radius:10px;border:1px solid #426887;background:#0b2135;color:#fff;padding:9px 34px 9px 10px;font:inherit;font-size:14px;font-weight:750}
  `;
  document.head.appendChild(s);
}
function install(){
  const q=document.getElementById('q');
  const old=document.getElementById('magiQuestionSampleSelect');
  if(!q||!old)return false;
  if(old.dataset.magiSampleRoutes==='v393')return true;
  ensureStyle();

  const select=old.cloneNode(false);
  select.id='magiQuestionSampleSelect';
  select.className=old.className||'magiQuestionSamplesSelect';
  select.dataset.magiSampleRoutes='v393';
  select.setAttribute('aria-label','質問サンプルを選ぶ');
  select.innerHTML='<option value="">▼ 質問サンプルを選ぶ</option>'+SAMPLES.map(x=>`<option value="${x.id}">${x.label}</option>`).join('');
  old.replaceWith(select);

  const wrap=select.closest('.magiQuestionSamples')||select.parentElement;
  let playerWrap=document.getElementById('magiSamplePlayerWrap');
  if(!playerWrap){
    playerWrap=document.createElement('div');
    playerWrap.id='magiSamplePlayerWrap';
    playerWrap.className='magiSamplePlayerWrap';
    playerWrap.innerHTML=`<label class="magiSamplePlayerLabel" for="magiSamplePlayerSelect">スタメン起用を審議する選手</label><select id="magiSamplePlayerSelect" class="magiSamplePlayerSelect"><option value="">▼ 選手を選ぶ</option>${ROSTER.map(name=>`<option value="${name}">${name}</option>`).join('')}</select>`;
    const hint=wrap?.querySelector('.magiQuestionSamplesHint');
    if(hint)wrap.insertBefore(playerWrap,hint);else wrap?.appendChild(playerWrap);
  }
  const player=document.getElementById('magiSamplePlayerSelect');

  function chooseSample(id){
    const sample=SAMPLES.find(x=>x.id===id);
    playerWrap.classList.toggle('show',id==='STARTER_EVAL');
    if(!sample)return;
    if(id==='STARTER_EVAL'){
      if(player?.value){q.value=starterQuestion(player.value);dispatch(q);q.focus();}
      else{q.value='';dispatch(q);player?.focus();}
      return;
    }
    q.value=sample.value;
    dispatch(q);
    q.focus();
    q.setSelectionRange?.(q.value.length,q.value.length);
  }

  select.addEventListener('change',()=>chooseSample(select.value));
  player?.addEventListener('change',()=>{
    if(select.value!=='STARTER_EVAL'||!player.value)return;
    q.value=starterQuestion(player.value);
    dispatch(q);
    q.focus();
    q.setSelectionRange?.(q.value.length,q.value.length);
  });
  q.addEventListener('input',()=>{
    if(writing)return;
    const exact=SAMPLES.find(x=>x.value&&x.value===q.value);
    const starter=ROSTER.find(name=>starterQuestion(name)===q.value);
    if(exact){select.value=exact.id;playerWrap.classList.remove('show');return;}
    if(starter){select.value='STARTER_EVAL';player.value=starter;playerWrap.classList.add('show');return;}
    select.value='';
    playerWrap.classList.remove('show');
  });
  return true;
}

if(!install()){
  const obs=new MutationObserver(()=>{if(install())obs.disconnect();});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',install,{once:true});
}
window.MAGI_QUESTION_SAMPLE_ROUTES_META=Object.freeze({version:'v393',bestOrderUntouched:true,aceRoute:true,pitchingPlanRoute:true,teamReviewRoute:true,starterPlayerSelect:true});
})();
