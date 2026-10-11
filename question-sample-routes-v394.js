(()=>{
'use strict';
if(window.MAGI_QUESTION_SAMPLE_ROUTES_V394)return;
window.MAGI_QUESTION_SAMPLE_ROUTES_V394=true;

// Guided sample UI only; never writes Google Drive or auto-runs deliberation.
const ROSTER=['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'];
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
 {id:'STARTER_EVAL',label:'選手のスタメン起用を審議して'}
];
const compact=s=>String(s||'').normalize('NFKC').replace(/[\s　]+/g,'');
const playerOptions=()=>'<option value="">▼ 選手を選ぶ</option>'+ROSTER.map(p=>'<option value="'+p+'">'+p+'</option>').join('');
const periods='<option value="通算">通算（全年度）</option><option value="現チーム">現チーム（2026-2027）</option><option value="旧チーム">旧チーム（2025-2026）</option><option value="直近6試合">直近6試合</option>';
let writing=false,generated='';
function dispatch(q){writing=true;q.dispatchEvent(new Event('input',{bubbles:true}));q.dispatchEvent(new Event('change',{bubbles:true}));writing=false}
function fill(q,s){q.value=s;generated=s;dispatch(q);q.focus();q.setSelectionRange?.(s.length,s.length)}
function starterQuestion(p){return p+'選手を現在のスタメンとして起用すべきか、今季成績・守備位置・起用実績をもとに審議してください。'}
function playerName(input,selected){const v=String(input||'').trim()||String(selected||'').trim();return ROSTER.find(p=>compact(p)===compact(v))||''}
function day(s){return s.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日')}
function build(id,f){
 if(id==='TEAM_RECORD'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(f.start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(f.end||''))throw Error('開始日と終了日を選んでください。');
   if(f.start>f.end)throw Error('終了日は開始日以降にしてください。');
   return '丸岡中の'+day(f.start)+'から'+day(f.end)+'までのチームの試合成績を教えてください。記録を確認できる各試合の日付・相手・得点・失点・勝敗を一覧表にし、勝敗数も集計してください。確認できない試合・結果は推測で補わないでください。';
 }
 if(id==='BATTING_SLOT'){
   const slot=Number(f.slot);
   if(!Number.isInteger(slot)||slot<1||slot>9)throw Error('1〜9番を選んでください。');
   return '現チームの'+slot+'番打者は誰が適任か、打撃成績・出場実績・守備位置を確認して審議してください。';
 }
 if(id==='PLAYER_COMPARE'){
   const a=playerName(f.playerText,f.player),b=playerName(f.playerText2,f.player2);
   if(!a||!b)throw Error('比較する2人を名簿から選ぶか、正式名で入力してください。');
   if(a===b)throw Error('異なる選手を2人選んでください。');
   const axis=['打撃','投手','守備'].includes(f.axis)?f.axis:'打撃';
   return a+'と'+b+'の現チームの'+axis+'成績を比較してください。確認できた記録を一覧表にし、データ不足を明記してください。';
 }
 if(['PLAYER_BATTING','PLAYER_PITCHING','PLAYER_FIELDING'].includes(id)){
   const p=playerName(f.playerText,f.player);
   if(!p)throw Error('選手名簿から選ぶか、正式名で入力してください。');
   if(id==='PLAYER_FIELDING')return p+'の現チームの守備成績一覧を見せてください。守備位置・刺殺・捕殺・失策・守備機会など、原本で確認できる項目を示してください。';
   const scope=['通算','現チーム','旧チーム','直近6試合'].includes(f.period)?f.period:'通算';
   return p+'の'+scope+(id==='PLAYER_BATTING'?'打撃':'投手')+'成績一覧を見せてください。原本で確認できる数値のみ表にしてください。';
 }
 throw Error('質問を選び直してください。');
}
function addCss(){
 if(document.getElementById('magiGuidedSamplesCssV394'))return;
 const s=document.createElement('style');s.id='magiGuidedSamplesCssV394';
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
function playerFields(label,suffix){
 return '<label class="magiGuideField">'+label+'<select name="player'+suffix+'">'+playerOptions()+'</select></label>'+
        '<label class="magiGuideField">または正式名を入力<input name="playerText'+suffix+'" type="text" autocomplete="off" placeholder="例：大野 竜暉"></label>';
}
function formFields(id){
 if(id==='TEAM_RECORD')return '<label class="magiGuideField">開始日<input name="start" type="date" required></label><label class="magiGuideField">終了日<input name="end" type="date" required></label><p class="magiGuideNote">記録がない日や試合の勝敗は補いません。指定期間の集計は原本の対応状況に依存します。</p>';
 if(id==='BATTING_SLOT')return '<label class="magiGuideField">打順<select name="slot">'+Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'番</option>').join('')+'</select></label>';
 if(id==='PLAYER_COMPARE')return playerFields('1人目','')+playerFields('2人目','2')+'<label class="magiGuideField">比較する分野<select name="axis"><option value="打撃">打撃</option><option value="投手">投手</option><option value="守備">守備</option></select></label>';
 if(id==='PLAYER_FIELDING')return playerFields('誰の守備成績ですか？','')+'<p class="magiGuideNote">現チームの守備記録を照会します。</p>';
 return playerFields('誰の成績ですか？','')+'<label class="magiGuideField">集計期間<select name="period">'+periods+'</select></label>';
}
function prompt(id){
 if(id==='TEAM_RECORD')return 'いつからいつまでですか？';
 if(id==='PLAYER_COMPARE')return '誰と誰を比較しますか？';
 if(id==='BATTING_SLOT')return '何番打者ですか？';
 return '誰の成績ですか？';
}
function openGuide(id,q,select){
 let d=document.getElementById('magiGuidedSampleDialogV394');
 if(!d){d=document.createElement('dialog');d.id='magiGuidedSampleDialogV394';d.className='magiGuideDialog';document.body.appendChild(d)}
 d.innerHTML='<form id="magiGuideFormV394" novalidate><div class="magiGuideTitle">MAGIから確認</div><h3 class="magiGuidePrompt">'+prompt(id)+'</h3>'+formFields(id)+'<div id="magiGuideErrorV394" class="magiGuideError" aria-live="polite"></div><div class="magiGuideActions"><button type="button" class="magiGuideCancel">閉じる</button><button type="submit" class="magiGuideApply">質問を入力する</button></div></form>';
 const form=d.querySelector('form'),error=d.querySelector('#magiGuideErrorV394');
 let applied=false;
 const close=()=>{if(typeof d.close==='function'&&d.open)d.close();else d.removeAttribute('open')};
 d.querySelector('.magiGuideCancel').addEventListener('click',()=>{close();select.value=''});
 form.addEventListener('submit',e=>{
  e.preventDefault();
  try{const f=Object.fromEntries(new FormData(form).entries());const s=build(id,f);applied=true;close();fill(q,s)}
  catch(err){error.textContent=String(err.message||err);}
 });
 d.addEventListener('cancel',()=>{if(!applied)select.value=''}, {once:true});
 if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
 d.querySelector('input,select')?.focus();
}
function install(){
 const q=document.getElementById('q'),old=document.getElementById('magiQuestionSampleSelect');
 if(!q||!old)return false;
 if(old.dataset.magiSampleRoutes==='v394')return true;
 addCss();
 const s=old.cloneNode(false);s.id='magiQuestionSampleSelect';s.className=old.className||'magiQuestionSamplesSelect';s.dataset.magiSampleRoutes='v394';
 s.setAttribute('aria-label','質問サンプルを選ぶ');
 s.innerHTML='<option value="">▼ 質問サンプルを選ぶ</option>'+SAMPLES.map(x=>'<option value="'+x.id+'">'+x.label+'</option>').join('');
 old.replaceWith(s);
 const wrap=s.closest('.magiQuestionSamples')||s.parentElement;
 let playerWrap=document.getElementById('magiSamplePlayerWrap');
 if(!playerWrap){
  playerWrap=document.createElement('div');playerWrap.id='magiSamplePlayerWrap';playerWrap.className='magiSamplePlayerWrap';
  playerWrap.innerHTML='<label class="magiSamplePlayerLabel" for="magiSamplePlayerSelect">スタメン起用を審議する選手</label><select id="magiSamplePlayerSelect" class="magiSamplePlayerSelect">'+playerOptions()+'</select>';
  const hint=wrap?.querySelector('.magiQuestionSamplesHint');
  if(hint)wrap.insertBefore(playerWrap,hint);else wrap?.appendChild(playerWrap);
 }
 const player=document.getElementById('magiSamplePlayerSelect');
 s.addEventListener('change',()=>{
  const x=SAMPLES.find(v=>v.id===s.value);
  playerWrap.classList.toggle('show',s.value==='STARTER_EVAL');
  if(!x)return;
  if(x.guided){openGuide(x.id,q,s);return}
  if(x.id==='STARTER_EVAL'){if(player?.value)fill(q,starterQuestion(player.value));else player?.focus();return}
  fill(q,x.value);
 });
 player?.addEventListener('change',()=>{if(s.value==='STARTER_EVAL'&&player.value)fill(q,starterQuestion(player.value))});
 q.addEventListener('input',()=>{
  if(writing||generated&&q.value===generated)return;
  const exact=SAMPLES.find(x=>x.value&&x.value===q.value),starter=ROSTER.find(p=>starterQuestion(p)===q.value);
  if(exact){s.value=exact.id;playerWrap.classList.remove('show');return}
  if(starter){s.value='STARTER_EVAL';player.value=starter;playerWrap.classList.add('show');return}
  generated='';s.value='';playerWrap.classList.remove('show');
 });
 return true;
}
if(!install()){
 const obs=new MutationObserver(()=>{if(install())obs.disconnect()});
 obs.observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('load',install,{once:true});
}
window.MAGI_QUESTION_SAMPLE_ROUTES_META=Object.freeze({version:'v394',sampleCount:SAMPLES.length,guidedCount:SAMPLES.filter(x=>x.guided).length,officialRosterOnly:true,autoRun:false,sourceWrites:false});
})();