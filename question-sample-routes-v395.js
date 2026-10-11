(()=>{
'use strict';
if(window.MAGI_QUESTION_SAMPLE_ROUTES_V395)return;
window.MAGI_QUESTION_SAMPLE_ROUTES_V395=true;
// Season membership comes from server/api/magi/_roster.js, checked by a CI source-of-truth test.
const ROSTERS=Object.freeze({'2025-2026':Object.freeze(["北 淳志","坂本 陸","櫻川 莉大","佐々木 悠成","下田 涼歩","前川 夢斗","増田 晃大","宮嵜 翔","宮村 龍","井坂 悠聖","大久保 陽翔","大野 竜暉","坂田 暉馬","嶋田 栄志","武澤 大翔","橋向 結都","上村 蓮","大久保 夢翔","武田 晴琉翔","長侶 穹","中嶋 玲月","吉田 真翔","鰐渕 将太"]),'2026-2027':Object.freeze(["井坂 悠聖","大久保 陽翔","大野 竜暉","坂田 暉馬","嶋田 栄志","武澤 大翔","橋向 結都","上村 蓮","大久保 夢翔","武田 晴琉翔","長侶 穹","中嶋 玲月","吉田 真翔","鰐渕 将太"])});
const SAMPLES=[
 {id:'TEAM_RECORD',label:'チームの試合成績を教えて',guided:true},
 {id:'PLAYER_BATTING',label:'選手の通算打撃成績を教えて',guided:true},
 {id:'PLAYER_PITCHING',label:'選手の通算投手成績を教えて',guided:true},
 {id:'PLAYER_FIELDING',label:'選手の守備成績を教えて',guided:true},
 {id:'PLAYER_COMPARE',label:'2人の成績を比較して',guided:true},
 {id:'BATTING_SLOT',label:'打順の候補を審議して',guided:true},
 {id:'CLOSER_SELECT',label:'クローザー候補を審議して',value:'現チームの投手成績・登板実績を根拠に、クローザー候補を審議してください。'},
 {id:'BEST_ORDER',label:'ベストオーダーを審議して',value:'現在の選手データと起用実績をもとに、現時点のベストオーダーを審議してください。'},
 {id:'ACE_SELECTION',label:'現在のエース候補を審議して',value:'現在のエース候補は誰が適任か、現チーム14名の投手成績と起用実績を比較して審議してください。'},
 {id:'PITCHING_PLAN_7',label:'次の試合の先発・継投案を考えて',value:'7回制の投手運用を、先発→第2投手→終盤→クローザーの4役で組んで審議してください。'},
 {id:'TEAM_REVIEW',label:'今のチームの改善課題を審議して',value:'現チーム14名の現在データをもとに、今のチームで最優先に改善すべき課題を審議してください。'},
 {id:'STARTER_EVAL',label:'選手のスタメン起用を審議して',guided:true}
];

const DEFAULT_YEAR='2026-2027';
const validYear=year=>Object.hasOwn(ROSTERS,String(year||''));
const namesFor=year=>validYear(year)?ROSTERS[year]:[];
const playerOptions=year=>'<option value="">▼ 選手を選ぶ</option>'+namesFor(year).map(n=>'<option value="'+n+'">'+n+'</option>').join('');
const seasonLabel=year=>year==='2025-2026'?'2025-2026年（旧チーム）':'2026-2027年（現チーム）';
const seasonFields=()=>'<label class="magiGuideField">対象年度<select name="season" required><option value="2026-2027">2026-2027年（14名）</option><option value="2025-2026">2025-2026年（23名）</option></select></label>';
const playerFields=(label,suffix)=>'<label class="magiGuideField">'+label+'<select name="player'+suffix+'" required>'+playerOptions(DEFAULT_YEAR)+'</select></label>';
const compact=v=>String(v||'').normalize('NFKC').replace(/[\s　]+/g,'');
const playerName=(year,raw)=>namesFor(year).find(n=>compact(n)===compact(raw))||'';
let writing=false,generated='';
function fill(q,s){
 q.value=s;generated=s;writing=true;
 q.dispatchEvent(new Event('input',{bubbles:true}));
 q.dispatchEvent(new Event('change',{bubbles:true}));
 writing=false;
 q.focus();q.setSelectionRange?.(s.length,s.length);
}
function starterQuestion(name,year){
 if(year==='2026-2027')return name+'選手を現在のスタメンとして起用すべきか、今季成績・守備位置・起用実績をもとに審議してください。';
 return name+'選手の2025-2026年（旧チーム）当時のスタメン起用について、当時の成績・守備位置・出場実績を確認し、未確認事項を推測せずに審議してください。';
}
function build(id,form){
 if(id==='TEAM_RECORD'){
  const a=String(form.start||''),b=String(form.end||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b))throw Error('開始日と終了日を選んでください。');
  if(a>b)throw Error('終了日は開始日以降にしてください。');
  const day=s=>s.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日');
  return '丸岡中の'+day(a)+'から'+day(b)+'までのチームの試合成績を教えてください。記録を確認できる各試合の日付・相手・得点・失点・勝敗を一覧表にし、勝敗数も集計してください。確認できない試合・結果は推測で補わないでください。';
 }
 if(id==='BATTING_SLOT'){
  const slot=Number(form.slot);
  if(!Number.isInteger(slot)||slot<1||slot>9)throw Error('1〜9番を選んでください。');
  return '現チームの'+slot+'番打者は誰が適任か、打撃成績・出場実績・守備位置を確認して審議してください。';
 }
 const year=String(form.season||'');
 if(!validYear(year))throw Error('対象年度を選んでください。');
 const label=seasonLabel(year);
 if(id==='PLAYER_COMPARE'){
  const a=playerName(year,form.player),b=playerName(year,form.player2);
  if(!a||!b)throw Error('比較する2人を選手リストから選んでください。');
  if(a===b)throw Error('異なる選手を2人選んでください。');
  const axis=['打撃','投手','守備'].includes(form.axis)?form.axis:'打撃';
  return label+'の'+a+'と'+b+'の'+axis+'成績を比較してください。確認できた記録を一覧表にし、データ不足を明記してください。';
 }
 if(['PLAYER_BATTING','PLAYER_PITCHING','PLAYER_FIELDING','STARTER_EVAL'].includes(id)){
  const name=playerName(year,form.player);
  if(!name)throw Error('その年度の選手リストから選んでください。');
  if(id==='STARTER_EVAL')return starterQuestion(name,year);
  if(id==='PLAYER_FIELDING')return name+'の'+label+'の守備成績一覧を見せてください。守備位置・刺殺・捕殺・失策・守備機会など、原本で確認できる項目のみを示してください。';
  const kind=id==='PLAYER_BATTING'?'打撃':'投手';
  return name+'の'+label+'のシーズン全体の'+kind+'成績一覧を見せてください。原本で確認できる数値のみ表にしてください。';
 }
 throw Error('質問を選び直してください。');
}
function addCss(){
 if(document.getElementById('magiGuidedSamplesCssV395'))return;
 const s=document.createElement('style');s.id='magiGuidedSamplesCssV395';
 s.textContent=[
 '.magiSamplePlayerWrap{display:none;margin:8px 0 0;padding:10px;border:1px solid #294f70;border-radius:11px;background:#081c2f}.magiSamplePlayerWrap.show{display:block}',
 '.magiSamplePlayerLabel{display:block;margin-bottom:6px;color:#bbd1e5;font-size:13px;font-weight:800}.magiSamplePlayerSelect{box-sizing:border-box;width:100%;min-height:44px;border-radius:10px;border:1px solid #426887;background:#0b2135;color:#fff;padding:9px;font-size:15px}',
 '.magiGuideDialog{box-sizing:border-box;width:min(520px,calc(100% - 24px));max-height:85vh;overflow:auto;padding:20px;border:1px solid #476a89;border-radius:18px;background:#0b2034;color:#fff;box-shadow:0 24px 72px rgba(0,0,0,.6)}.magiGuideDialog::backdrop{background:rgba(0,8,18,.76)}',
 '.magiGuideTitle{font-size:12px;color:#aac9e0;font-weight:900;letter-spacing:.08em}.magiGuidePrompt{font-size:21px;font-weight:900;line-height:1.45;margin:10px 0 16px}',
 '.magiGuideField{display:block;margin:0 0 14px;color:#d6e5f1;font-size:14px;font-weight:800}.magiGuideField input,.magiGuideField select{display:block;box-sizing:border-box;width:100%;min-height:45px;margin-top:7px;padding:9px 11px;border:1px solid #6685a1;border-radius:10px;background:#071827;color:#fff;font:inherit;font-size:16px;color-scheme:dark}',
 '.magiGuideNote{font-size:12px;line-height:1.6;color:#b9ccdb;margin:6px 0 14px}.magiGuideError{min-height:1em;font-size:13px;color:#ffbbab;font-weight:750;margin-bottom:10px}',
 '.magiGuideActions{display:flex;gap:10px;justify-content:flex-end}.magiGuideActions button{min-height:44px;padding:10px 14px;border-radius:10px;font-size:15px;font-weight:850}',
 '.magiGuideCancel{border:1px solid #6584a0;background:transparent;color:#fff}.magiGuideApply{border:0;background:#f5f9fc;color:#102a40}'
 ].join('');
 document.head.appendChild(s);
}

function formFields(id){
 if(id==='TEAM_RECORD')return '<label class="magiGuideField">開始日<input name="start" type="date" required></label><label class="magiGuideField">終了日<input name="end" type="date" required></label><p class="magiGuideNote">確認できる登録済み試合原本を集計します。</p>';
 if(id==='BATTING_SLOT')return '<label class="magiGuideField">打順<select name="slot">'+Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'番</option>').join('')+'</select></label>';
 if(id==='PLAYER_COMPARE')return seasonFields()+playerFields('1人目','')+playerFields('2人目','2')+'<label class="magiGuideField">比較する分野<select name="axis"><option value="打撃">打撃</option><option value="投手">投手</option><option value="守備">守備</option></select></label>';
 if(id==='PLAYER_FIELDING')return seasonFields()+playerFields('誰の守備成績ですか？','');
 if(id==='STARTER_EVAL')return seasonFields()+playerFields('誰のスタメン起用ですか？','');
 return seasonFields()+playerFields('誰の成績ですか？','');
}
function questionPrompt(id){
 if(id==='TEAM_RECORD')return 'いつからいつまでですか？';
 if(id==='PLAYER_COMPARE')return '誰と誰を比較しますか？';
 if(id==='BATTING_SLOT')return '何番打者ですか？';
 if(id==='STARTER_EVAL')return '誰のスタメン起用ですか？';
 return '誰の成績ですか？';
}
function refreshPlayerOptions(form){
 const season=form.querySelector('select[name="season"]')?.value;
 if(!season)return;
 form.querySelectorAll('select[name="player"],select[name="player2"]').forEach(node=>{
  node.innerHTML=playerOptions(season);
  node.value='';
 });
}
function openGuide(id,q,select){
 let d=document.getElementById('magiGuidedSampleDialogV395');
 if(!d){d=document.createElement('dialog');d.id='magiGuidedSampleDialogV395';d.className='magiGuideDialog';document.body.appendChild(d)}
 d.innerHTML='<form id="magiGuideFormV395" novalidate><div class="magiGuideTitle">MAGIから確認</div><h3 class="magiGuidePrompt">'+questionPrompt(id)+'</h3>'+formFields(id)+'<div id="magiGuideErrorV395" class="magiGuideError" aria-live="polite"></div><div class="magiGuideActions"><button type="button" class="magiGuideCancel">閉じる</button><button type="submit" class="magiGuideApply">質問を入力する</button></div></form>';
 const form=d.querySelector('form'),error=d.querySelector('#magiGuideErrorV395');
 let applied=false;
 const close=()=>{if(typeof d.close==='function'&&d.open)d.close();else d.removeAttribute('open')};
 d.querySelector('.magiGuideCancel').addEventListener('click',()=>{close();select.value=''});
 form.querySelector('select[name="season"]')?.addEventListener('change',()=>refreshPlayerOptions(form));
 refreshPlayerOptions(form);
 form.addEventListener('submit',e=>{
  e.preventDefault();
  try{const data=Object.fromEntries(new FormData(form).entries()),s=build(id,data);applied=true;close();fill(q,s)}
  catch(err){error.textContent=String(err.message||err);}
 });
 d.addEventListener('cancel',()=>{if(!applied)select.value=''}, {once:true});
 if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
 d.querySelector('select[name="season"],input,select')?.focus();
}
function install(){
 const q=document.getElementById('q'),old=document.getElementById('magiQuestionSampleSelect');
 if(!q||!old)return false;
 if(old.dataset.magiSampleRoutes==='v395')return true;
 addCss();
 const select=old.cloneNode(false);select.id='magiQuestionSampleSelect';select.className=old.className||'magiQuestionSamplesSelect';select.dataset.magiSampleRoutes='v395';
 select.setAttribute('aria-label','質問サンプルを選ぶ');
 select.innerHTML='<option value="">▼ 質問サンプルを選ぶ</option>'+SAMPLES.map(x=>'<option value="'+x.id+'">'+x.label+'</option>').join('');
 old.replaceWith(select);
 select.addEventListener('change',()=>{
  const s=SAMPLES.find(x=>x.id===select.value);
  if(!s)return;
  if(s.guided){openGuide(s.id,q,select);return;}
  fill(q,s.value);
 });
 q.addEventListener('input',()=>{
  if(writing||generated&&q.value===generated)return;
  const exact=SAMPLES.find(x=>x.value&&x.value===q.value);
  generated='';select.value=exact?.id||'';
 });
 return true;
}
if(!install()){
 const obs=new MutationObserver(()=>{if(install())obs.disconnect()});
 obs.observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('load',install,{once:true});
}
window.MAGI_QUESTION_SAMPLE_ROUTES_META=Object.freeze({version:'v395',sampleCount:SAMPLES.length,guidedCount:SAMPLES.filter(x=>x.guided).length,rosterCounts:{old:ROSTERS['2025-2026'].length,current:ROSTERS['2026-2027'].length},autoRun:false,sourceWrites:false});
})();
