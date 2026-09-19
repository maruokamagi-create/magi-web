(()=>{
'use strict';
if(window.MAGI_ACE_RECONSIDERATION_FIX_V410)return;
window.MAGI_ACE_RECONSIDERATION_FIX_V410=true;
const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const txt=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
function isAce(result){return !!result&&ACE_RE.test(txt(result?.case?.question||document.getElementById('q')?.value).normalize('NFKC'));}
function clean(result){
 const raw=list(result?.final?.reDeliberationConditions).map(x=>txt(x).replace(/^[①-⑳\d\s、,./／・･()（）]+/,'').trim()).filter(Boolean);
 const out=[];
 for(let s of raw){
   if(!s||s.includes('…'))continue;
   if(/好成績.*継続.*再現.*確認できた/.test(s)||/継続・再現できるか確認できた/.test(s))s='現在の好成績を継続・再現できない兆候が出た場合';
   if(/好成績.*継続.*確認できた/.test(s))s='現在の好成績を継続できない兆候が出た場合';
   if(!out.includes(s))out.push(s);
 }
 const fallback=[
  '現在の好成績を継続・再現できない兆候が出た場合',
  '他候補の現チームでの投球実績が増え、現在の候補順位を見直すだけの材料が揃った場合',
  '先発としての投球回・四死球・失点内容に明確な変化が出た場合'
 ];
 for(const s of fallback)if(!out.includes(s))out.push(s);
 return out.slice(0,3);
}
function patch(result){
 if(!isAce(result))return;
 const cond=clean(result);
 const next=document.getElementById('next');
 if(next)next.textContent='再検討条件：'+cond.map((x,i)=>`${i+1}. ${x}`).join('　');
 const card=document.getElementById('magiFinalSummaryCard');
 const section=[...(card?.querySelectorAll?.('.magiSummarySection')||[])].find(el=>/再審議条件/.test(el.textContent||''));
 if(section){
   const b=section.querySelector('b');
   section.innerHTML='';
   const title=document.createElement('b');title.textContent='再審議条件';section.appendChild(title);
   const ul=document.createElement('ul');for(const c of cond){const li=document.createElement('li');li.textContent=c;ul.appendChild(li)}section.appendChild(ul);
 }
}
function schedule(result){[80,220,500,1000,1800,3000,5000,7500].forEach(ms=>setTimeout(()=>patch(result),ms));}
document.addEventListener('magi:deliberation-result',e=>{if(isAce(e?.detail))schedule(e.detail)});
if(isAce(window.MAGI_LAST_DELIBERATION_RESULT))schedule(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_ACE_RECONSIDERATION_FIX_V410_META=Object.freeze({version:'v410',semanticFix:true,observer:false});
})();