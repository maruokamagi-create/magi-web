(()=>{
'use strict';
if(window.MAGI_PITCHING_PRIORITY_V328)return;
window.MAGI_PITCHING_PRIORITY_V328=true;

const PITCH_RE=/投手|ピッチャー|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ|投球回|投球数|勝敗|勝利|敗北/i;
const REQUEST_RE=/通算|成績|直近|最近|出して|教えて|見せて|表示|知りたい|一覧|何|データ|記録|今期|今季|今年|年度|シーズン|は[？?]?$/i;
const DECISION_RE=/審議|べき|どう思う|評価して|適性|候補|固定|起用|継投|先発させ|先発に|クローザー|抑え|ローテ|戦術|采配|任せる|推薦|提案/i;
const isPitch=q=>{q=String(q||'').trim();return q&&PITCH_RE.test(q)&&REQUEST_RE.test(q)&&!DECISION_RE.test(q)};
const getButton=node=>node?.closest?.('button[onclick*="runMagi"]')||null;

function runPitch(e,btn){
 const q=(document.getElementById('q')?.value||'').trim();
 if(!isPitch(q))return false;
 const fn=window.MAGI_PITCH_DIRECT_FN;
 if(typeof fn!=='function')return false;
 e?.preventDefault?.();
 e?.stopPropagation?.();
 e?.stopImmediatePropagation?.();
 fn.call(window);
 return true;
}

window.addEventListener('click',e=>{
 const btn=getButton(e.target);if(btn)runPitch(e,btn);
},true);

window.addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.isComposing||e.target!==document.getElementById('q'))return;
 const btn=[...document.querySelectorAll('button')].find(b=>/MAGI実行/.test(String(b.textContent||'')))||null;
 runPitch(e,btn);
},true);
})();
