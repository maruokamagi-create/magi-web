(()=>{
'use strict';
if(window.MAGI_ACE_RESULT_DETAIL_V399)return;
window.MAGI_ACE_RESULT_DETAIL_V399=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const txt=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const excluded=v=>norm(v)===norm(EXCLUDED);
const PERSONAS={
 melchior:{label:'メルキオール',vote:'mVote'},
 balthasar:{label:'バルタザール',vote:'bVote'},
 casper:{label:'カスパー',vote:'cVote'}
};

function isAce(result){return !!result&&ACE_RE.test(txt(result?.case?.question||document.getElementById('q')?.value).normalize('NFKC'));}
function firstChoice(group,key){return list(group?.[key]?.candidatePlayers).map(txt).find(v=>v&&!excluded(v))||'';}
function unique(values){const out=[],seen=new Set();for(const v of values.map(txt).filter(Boolean)){const k=norm(v);if(!seen.has(k)){seen.add(k);out.push(v)}}return out;}
function sentence(v){const s=txt(v).replace(/^[-・●\s]+/,'');return s&&!/^(?:賛成|反対|判断保留|条件付き)/.test(s)?s:'';}
function firstUseful(obj,keys){for(const k of keys){const v=obj?.[k];if(typeof v==='string'&&sentence(v))return sentence(v);if(Array.isArray(v)){const x=v.map(sentence).find(Boolean);if(x)return x}}return'';}
function statsMap(result){return result?.case?.evidence?.canonicalPitchingTotals||{};}
function currentStats(result,name){const map=statsMap(result),row=map?.[name]||Object.entries(map).find(([k])=>norm(k)===norm(name))?.[1];return row?.['2026-2027']||null;}
function historyStats(result,name){const map=statsMap(result),row=map?.[name]||Object.entries(map).find(([k])=>norm(k)===norm(name))?.[1];return row?.['2025-2026']||null;}
function statLine(s,label='今季'){if(!s)return'';const bits=[];if(s.games!==undefined)bits.push(`登板${s.games}`);if(s.innings!==undefined)bits.push(`投球回${s.innings}`);if(s.era!==undefined)bits.push(`防御率${s.era}`);if(s.strikeouts!==undefined)bits.push(`奪三振${s.strikeouts}`);if(s.walks!==undefined||s.hbp!==undefined)bits.push(`四死球${Number(s.walks||0)+Number(s.hbp||0)}`);return bits.length?`${label} ${bits.join('・')}`:'';}
function personaReason(result,key){const p=result?.second?.[key]||result?.primary?.[key]||{};return firstUseful(p,['candidateBasis','decisionBasis','changeReason','analysis','reason','reasons','publicStatement']);}
function personaFacts(result,key,name){const p=result?.second?.[key]||result?.primary?.[key]||{};const f=list(p?.facts).map(sentence).filter(Boolean).slice(0,2);const stat=statLine(currentStats(result,name));const hist=statLine(historyStats(result,name),'旧チーム');return unique([stat,...f,hist]).slice(0,3);}
function inningsOuts(v){const m=txt(v).match(/^(\d+)(?:\.(\d))?$/);if(!m)return 0;return Number(m[1])*3+Math.min(2,Number(m[2]||0));}
function eraNum(v){const n=Number(v);return Number.isFinite(n)?n:999;}
function supportCounts(result){const m=new Map();for(const stage of ['primary','second'])for(const key of Object.keys(PERSONAS)){const n=firstChoice(result?.[stage],key);if(!n)continue;const k=norm(n),r=m.get(k)||{name:n,n:0};r.n++;m.set(k,r)}return m;}
function alternates(result,winner){const evidencePlayers=list(result?.case?.evidence?.players).map(txt).filter(v=>v&&!excluded(v)&&norm(v)!==norm(winner));const finalAlt=[...list(result?.final?.alternateCandidates),...list(result?.final?.recommendedCandidates)].map(txt).filter(v=>v&&!excluded(v)&&norm(v)!==norm(winner));const names=unique([...finalAlt,...evidencePlayers]);const support=supportCounts(result);return names.map(name=>{const s=currentStats(result,name)||{};return{name,support:support.get(norm(name))?.n||0,outs:inningsOuts(s.innings),era:eraNum(s.era),k:Number(s.strikeouts||0),stats:s}}).sort((a,b)=>b.support-a.support||b.outs-a.outs||a.era-b.era||b.k-a.k||a.name.localeCompare(b.name,'ja')).slice(0,3);}
function detailHtml(reason,facts){const rs=reason?`<div class="aceDetailReason"><b>理由</b>：${escapeHtml(reason)}</div>`:'';const fs=facts.length?`<div class="aceDetailFacts"><b>根拠</b>：${facts.map(escapeHtml).join(' ／ ')}</div>`:'';return rs+fs;}
function escapeHtml(s){return txt(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ensureStyle(){if(document.getElementById('ace-result-detail-v399-style'))return;const s=document.createElement('style');s.id='ace-result-detail-v399-style';s.textContent=`
.aceDetailV399{margin-top:10px;padding:10px 12px;border-top:1px solid rgba(143,177,207,.28);font-size:14px;line-height:1.7;color:#c8d8e7}.aceDetailV399 b{color:#fff}.aceDetailReason+.aceDetailFacts{margin-top:5px}.aceAlternatesV399{margin-top:16px;padding-top:14px;border-top:1px solid rgba(143,177,207,.30);font-size:15px;line-height:1.7}.aceAlternatesV399 .aceAltTitle{font-weight:900;color:#fff;margin-bottom:8px}.aceAlternatesV399 .aceAltRow{padding:7px 0;border-top:1px solid rgba(143,177,207,.16)}.aceAlternatesV399 .aceAltRow:first-of-type{border-top:0}.aceAlternatesV399 .aceAltName{font-weight:850;color:#eef7ff}.aceAlternatesV399 .aceAltStats{font-size:13px;color:#a9bfd2;margin-top:2px}
`;document.head.appendChild(s)}
function patchPersona(result,key){const meta=PERSONAS[key],vote=document.getElementById(meta.vote),name=firstChoice(result?.second,key)||firstChoice(result?.primary,key);if(!vote||!name)return;vote.textContent=name;const host=vote.parentElement||vote;let d=host.querySelector?.(`.aceDetailV399[data-persona="${key}"]`);if(!d){d=document.createElement('div');d.className='aceDetailV399';d.dataset.persona=key;host.appendChild(d)}d.innerHTML=detailHtml(personaReason(result,key),personaFacts(result,key,name));}
function patchFinal(result){const winner=list(result?.final?.centerCandidates).map(txt).find(v=>v&&!excluded(v))||firstChoice(result?.second,'melchior')||'';if(!winner)return;const verdict=document.getElementById('verdict');if(verdict)verdict.textContent=`エース第一候補：${winner}`;const reason=document.getElementById('reason');if(reason){const same=['melchior','balthasar','casper'].filter(k=>norm(firstChoice(result?.second,k))===norm(winner)).length;reason.textContent=same===3?`3賢人の二次判断が一致し、${winner}を現時点のエース第一候補としました。`:`3賢人の二次判断を集約し、${winner}を現時点のエース第一候補としました。`}
 const next=document.getElementById('next');const parent=next?.parentElement||reason?.parentElement||verdict?.parentElement;if(!parent)return;let box=parent.querySelector('.aceAlternatesV399');if(!box){box=document.createElement('div');box.className='aceAlternatesV399';parent.appendChild(box)}const alts=alternates(result,winner);let html='<div class="aceAltTitle">次点・その他の有力候補</div>';if(alts.length){alts.forEach((a,i)=>{const label=i===0?'次点候補':`有力候補 ${i+1}`;html+=`<div class="aceAltRow"><div><span class="aceAltName">${label}：${escapeHtml(a.name)}</span></div><div class="aceAltStats">${escapeHtml(statLine(a.stats)||'現チーム投手記録を比較対象として評価')}</div></div>`})}else html+='<div class="aceAltRow">次点候補は審議データから確定できませんでした。</div>';box.innerHTML=html;}
function patch(result){if(!isAce(result))return;ensureStyle();for(const k of Object.keys(PERSONAS))patchPersona(result,k);patchFinal(result)}
function schedule(result){[0,80,220,500].forEach(ms=>setTimeout(()=>patch(result),ms));}
document.addEventListener('magi:deliberation-result',e=>{if(isAce(e?.detail))schedule(e.detail)});
if(isAce(window.MAGI_LAST_DELIBERATION_RESULT))schedule(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_ACE_RESULT_DETAIL_V399_META=Object.freeze({version:'v399',observer:false,bestOrderUntouched:true});
})();