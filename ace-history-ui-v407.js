(()=>{
'use strict';
if(window.MAGI_ACE_HISTORY_UI_V407)return;
window.MAGI_ACE_HISTORY_UI_V407=true;
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const txt=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>txt(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PERSONAS={melchior:'v1',balthasar:'v2',casper:'v3'};
function isAce(result){return !!result&&ACE_RE.test(txt(result?.case?.question||document.getElementById('q')?.value).normalize('NFKC'));}
function firstChoice(group,key){return list(group?.[key]?.candidatePlayers).map(txt).find(v=>v&&norm(v)!==norm(EXCLUDED))||'';}
function statsMap(result){return result?.case?.evidence?.canonicalPitchingTotals||{};}
function seasonStats(result,name,season){const map=statsMap(result);const row=map?.[name]||Object.entries(map).find(([k])=>norm(k)===norm(name))?.[1];return row?.[season]||null;}
function statText(s,label){if(!s)return`${label}：投手記録なし`;const bb=s.walksHbp!==undefined?s.walksHbp:Number(s.walks||0)+Number(s.hbp||0);return`${label}：登板${s.games??'-'}・投球回${s.innings??'-'}・防御率${Number.isFinite(Number(s.era))?Number(s.era).toFixed(2):s.era??'-'}・奪三振${s.strikeouts??'-'}・四死球${bb??'-'}`;}
function patchPersonaHistory(result,key){const card=document.getElementById(PERSONAS[key]),name=firstChoice(result?.second,key)||firstChoice(result?.primary,key);if(!card||!name)return;const detail=card.querySelector('.aceDetailV400');if(!detail)return;let old=detail.querySelector('.aceHistoryV407');if(!old){old=document.createElement('div');old.className='aceHistoryV407';detail.appendChild(old)}const h=seasonStats(result,name,'2025-2026');old.innerHTML=`<b>前チーム参考</b>：${esc(statText(h,'2025-2026'))}`;}
function winnerOf(result){return list(result?.final?.centerCandidates).map(txt).find(v=>v&&norm(v)!==norm(EXCLUDED))||firstChoice(result?.second,'melchior')||'';}
function cleanConditions(result){const raw=list(result?.final?.reDeliberationConditions).map(x=>txt(x).replace(/^[①-⑳\d\s、,./／・･()（）]+/,'').trim()).filter(Boolean).filter(x=>!/^[①-⑳\d\s、,./／・･()（）]+$/.test(x));const good=[];for(const s of raw){if(s.includes('…'))continue;if(!good.includes(s))good.push(s)}if(good.length)return good.slice(0,3);return['今後の登板で投球回・四死球・失点内容・先発としての再現性に明確な変化が出た場合','現チームでの投球実績が増え、現在の候補順位を見直すだけの新しい材料が揃った場合'];}
function patchNext(result){const next=document.getElementById('next');if(!next)return;next.textContent=`再検討条件：${cleanConditions(result).map((x,i)=>`${i+1}. ${x}`).join('　')}`;}
function patchFinalSummary(result){const card=document.getElementById('magiFinalSummaryCard');if(!card)return;const bubble=card.querySelector('.magiBubble');if(!bubble)return;const winner=winnerOf(result);if(!winner)return;const current=seasonStats(result,winner,'2026-2027'),history=seasonStats(result,winner,'2025-2026');const second=['melchior','balthasar','casper'].map(k=>firstChoice(result?.second,k)).filter(Boolean);const votes=second.filter(n=>norm(n)===norm(winner)).length;const lead=votes===3?`3賢人の二次判断が一致し、${winner}を現時点のエース第一候補としました。`:`3賢人の二次判断を集約し、${winner}を現時点のエース第一候補としました。`;
 const histLine=history?`前チーム2025-2026の二重照合済実績も経験・再現性の参考として確認しています。${statText(history,'前チーム')}`:'前チーム2025-2026は二重照合済Evidenceに投手記録がないため、現チーム実績を主評価としています。';
 const currentLine=statText(current,'現チーム');
 const cond=cleanConditions(result);
 bubble.innerHTML=`<div class="magiSummaryLead">${esc(lead)}</div><div class="magiSummarySection"><b>主評価</b><p>${esc(currentLine)}</p></div><div class="magiSummarySection"><b>前チーム参考</b><p>${esc(histLine)}</p></div><div class="magiSummarySection"><b>評価の扱い</b><p>現チーム2026-2027を主評価とし、前チーム2025-2026は経験・再現性の参考として加味しています。旧実績だけで現在評価は上書きしません。</p></div><div class="magiSummarySection"><b>再審議条件</b><ul>${cond.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
}
function ensureStyle(){if(document.getElementById('ace-history-ui-v407-style'))return;const s=document.createElement('style');s.id='ace-history-ui-v407-style';s.textContent='.aceHistoryV407{margin-top:5px;color:#d7e7f4}.aceHistoryV407 b{color:#fff}.magiMsg.finalSummary .magiBubble{overflow:visible!important;max-height:none!important}.magiMsg.finalSummary .magiSpeechText{max-height:none!important;overflow:visible!important;text-overflow:clip!important}';document.head.appendChild(s)}
function patch(result){if(!isAce(result))return;ensureStyle();for(const k of Object.keys(PERSONAS))patchPersonaHistory(result,k);patchNext(result);patchFinalSummary(result);}
function schedule(result){[120,350,800,1500,2600,4200,6500].forEach(ms=>setTimeout(()=>patch(result),ms));}
document.addEventListener('magi:deliberation-result',e=>{if(isAce(e?.detail))schedule(e.detail)});
if(isAce(window.MAGI_LAST_DELIBERATION_RESULT))schedule(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_ACE_HISTORY_UI_V407_META=Object.freeze({version:'v407',historyVisible:true,fullFinalSummary:true,noEllipsis:true,observer:false});
})();