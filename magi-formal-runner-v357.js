(()=>{
'use strict';
if(window.MAGI_FORMAL_RUNNER_V357)return;
window.MAGI_FORMAL_RUNNER_V357=true;

const $=id=>document.getElementById(id);
const originalSearch=typeof window.searchDataEvidence==='function'?window.searchDataEvidence.bind(window):null;
const engineUiRunner=(window.MAGI_ENGINE_UI_V187===true&&typeof window.runMagi==='function')?window.runMagi.bind(window):null;
let activeEvidence=null;
let running=false;

function text(v){return String(v??'').trim()}
function hasStats(v){return !!(v&&typeof v==='object'&&Object.keys(v).length)}
function validateEvidence(evidence,selectionKind){
  const kind=String(selectionKind||'').toUpperCase();
  if(kind!=='FULL_LINEUP'&&kind!=='PITCHING_PLAN')return;
  if(!evidence||typeof evidence!=='object')throw new Error('正本Evidenceを取得できなかったため審議を停止しました');
  if(Number(evidence.count)!==14)throw new Error(`現チーム14名のEvidenceが揃っていません（${Number(evidence.count)||0}/14）`);
  if(!Array.isArray(evidence.files)||!evidence.files.length)throw new Error('参照した正本ファイルを確認できないため審議を停止しました');
  const players=evidence?.allCurrentTeamCheck?.players;
  if(!Array.isArray(players)||players.length!==14)throw new Error('現チーム14名の正本確認結果が不完全です');
  if(kind==='FULL_LINEUP'){
    const withBatting=players.filter(p=>hasStats(p?.batting)).length;
    if(withBatting!==14)throw new Error(`打撃正本データが全員分揃っていません（${withBatting}/14）`);
  }
  if(kind==='PITCHING_PLAN'){
    const withPitching=players.filter(p=>hasStats(p?.pitching)).length;
    if(withPitching<1)throw new Error('投手正本データを確認できないため投手運用審議を停止しました');
  }
}

if(!engineUiRunner)throw new Error('正式3賢人UIランナーを取得できません');

window.searchDataEvidence=function(question){
  if(activeEvidence)return activeEvidence;
  return originalSearch?originalSearch(question):null;
};

window.MAGI_FORMAL_UI_RUNNER_V2=async function({question,evidence=null,selectionKind='',semantic=null}={}){
  if(running)throw new Error('MAGI審議はすでに実行中です');
  const q=$('q');
  if(!q)throw new Error('MAGI入力欄を取得できません');
  const nextQuestion=text(question||q.value);
  if(!nextQuestion)throw new Error('相談内容を入力してください');
  validateEvidence(evidence,selectionKind);

  const oldQuestion=q.value;
  running=true;
  activeEvidence=evidence||null;
  q.value=nextQuestion;
  try{
    const result=await engineUiRunner();
    const kind=String(selectionKind||'').toUpperCase();
    if(kind==='FULL_LINEUP'||kind==='PITCHING_PLAN'){
      const meta=text($('caseMeta')?.textContent);
      if(!/DATA HUB\s*：\s*14件参照/.test(meta)){
        throw new Error('正本Evidenceが3賢人UIまで到達していないため審議結果を無効化しました');
      }
      if(/参照ファイル\s*：\s*(?:$|ENGINE)/.test(meta)){
        throw new Error('正本参照ファイルが表示されていないため審議結果を無効化しました');
      }
    }
    return result;
  }finally{
    activeEvidence=null;
    q.value=oldQuestion;
    running=false;
  }
};

window.MAGI_FORMAL_UI_RUNNER_V2.meta=Object.freeze({
  version:'formal-runner-v357',
  explicitEvidence:true,
  semanticFirst:true,
  localFallback:false
});
})();
