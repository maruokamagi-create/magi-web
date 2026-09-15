(()=>{
'use strict';
if(window.MAGI_FINAL_DECISION_EMPHASIS_V340)return;
window.MAGI_FINAL_DECISION_EMPHASIS_V340=true;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function injectStyle(){
 if(document.getElementById('magi-final-decision-emphasis-v340-style'))return;
 const st=document.createElement('style');
 st.id='magi-final-decision-emphasis-v340-style';
 st.textContent=`
 .magiFinalDecisionHero{margin:14px 0 18px;padding:16px;border:2px solid #63d4ff;border-radius:16px;background:linear-gradient(135deg,#f7fbff 0%,#e8f5ff 100%);color:#07172d;box-shadow:0 10px 26px rgba(0,0,0,.22)}
 .magiFinalDecisionHero.magiDeadlockHero{border-color:#d9a321;background:linear-gradient(135deg,#fffdf5 0%,#fff4cf 100%)}
 .magiFinalDecisionKicker{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:11px;font-weight:900;letter-spacing:.13em;color:#24567c}
 .magiFinalDecisionBadge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#071b36;color:#fff;font-size:10px;letter-spacing:.09em;white-space:nowrap}
 .magiDeadlockHero .magiFinalDecisionBadge{background:#6f4b00;color:#fff4c7}
 .magiFinalDecisionTitle{font-size:25px;font-weight:950;line-height:1.25;margin:0 0 13px;color:#07172d}
 .magiDeadlockNotice{display:none;margin:-2px 0 12px;padding:9px 11px;border-radius:10px;background:#fff8dc;border:1px solid #d9b85f;color:#5d4300;font-size:12px;line-height:1.6;font-weight:800}
 .magiDeadlockHero .magiDeadlockNotice{display:block}
 .magiFinalDecisionGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 .magiFinalDecisionRow{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:8px;padding:10px 11px;border:1px solid #b8d3e7;border-radius:11px;background:#fff;min-width:0}
 .magiFinalDecisionNo{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#0b2444;color:#fff;font-size:16px;font-weight:950}
 .magiFinalDecisionName{font-size:16px;font-weight:950;line-height:1.35;color:#0b1830;min-width:0}
 .magiFinalDecisionHero + .votes{margin-top:12px!important}
 .magiFinalWiseLabel{margin:4px 0 8px;font-size:11px;font-weight:900;letter-spacing:.11em;color:#8fb0d1}
 .magiResultBundle .final .note.magiFinalDecisionRemainder{margin-top:16px!important;padding-top:14px!important;border-top:1px solid #34536f!important;color:#c7d7e6!important;font-size:12px!important;line-height:1.75!important}
 @media(max-width:720px){.magiFinalDecisionGrid{grid-template-columns:1fr}.magiFinalDecisionTitle{font-size:24px}.magiFinalDecisionName{font-size:17px}.magiFinalDecisionHero{padding:14px}}
 `;
 document.head.appendChild(st);
}

function parseLineup(text){
 const raw=String(text||'').replace(/\s+/g,' ').trim();
 if(!raw)return null;
 const marker=raw.search(/(?:再検討条件|再評価条件|見直し条件)\s*[:：]/);
 const head=(marker>=0?raw.slice(0,marker):raw).trim();
 const matches=[];
 const re=/([1-9])番\s*([^／/]+?)(?=\s*[／/]\s*[1-9]番|$)/g;
 let m;
 while((m=re.exec(head))){
   const no=Number(m[1]);
   const name=String(m[2]||'').trim().replace(/[。．]+$/,'');
   if(no>=1&&no<=9&&name)matches.push({no,name});
 }
 const unique=[];const seen=new Set();
 for(const x of matches){if(!seen.has(x.no)){seen.add(x.no);unique.push(x)}}
 unique.sort((a,b)=>a.no-b.no);
 if(unique.length!==9||unique[0]?.no!==1||unique[8]?.no!==9)return null;
 return {lineup:unique,remainder:marker>=0?raw.slice(marker).trim():''};
}

function findLineup(final){
 const note=final.querySelector('.note');
 if(note){const parsed=parseLineup(note.textContent);if(parsed)return {parsed,note}}
 const candidates=[...final.children].filter(el=>!el.classList.contains('votes')&&!el.classList.contains('magiFinalDecisionHero'));
 for(const el of candidates){const parsed=parseLineup(el.textContent);if(parsed)return {parsed,note:el}}
 return null;
}

function decisionPresentation(model){
 if(model?.decisionType==='DEADLOCK')return{
   deadlock:true,
   verdict:'結論未成立',
   kicker:'《MAGI》審議結果',
   badge:'1対1対1 DEADLOCK',
   title:'参考案（未確定）',
   aria:'MAGI審議未決・参考打順',
   notice:'3賢人の意見が1対1対1に分かれたため、この打順は最終決定ではありません。'
 };
 return{
   deadlock:false,
   verdict:'最終ベストオーダー',
   kicker:'《MAGI》最終判断',
   badge:model?.label||'FINAL DECISION',
   title:'公式戦想定 ベストオーダー',
   aria:'MAGI最終ベストオーダー',
   notice:''
 };
}

function applyDecisionState(final,hero){
 if(!final||!hero)return;
 const result=window.MAGI_LAST_DELIBERATION_RESULT;
 const model=window.MAGI_CONTROL_SUMMARY_V377?.build?.(result);
 const view=decisionPresentation(model);
 const verdict=final.querySelector('.verdict');
 if(verdict&&/打順案|ベストオーダー|1[〜～-]9番|最終ベストオーダー|結論未成立/.test(verdict.textContent||''))verdict.textContent=view.verdict;
 hero.classList.toggle('magiDeadlockHero',view.deadlock);
 hero.setAttribute('aria-label',view.aria);
 const kicker=hero.querySelector('.magiFinalDecisionKicker > span:first-child');if(kicker)kicker.textContent=view.kicker;
 const badge=hero.querySelector('.magiFinalDecisionBadge');if(badge)badge.textContent=view.badge;
 const title=hero.querySelector('.magiFinalDecisionTitle');if(title)title.textContent=view.title;
 const notice=hero.querySelector('.magiDeadlockNotice');if(notice)notice.textContent=view.notice;
}

function emphasize(){
 injectStyle();
 const response=document.getElementById('response');
 const final=response?.querySelector?.('.final');
 if(!final)return false;
 const existing=final.querySelector('.magiFinalDecisionHero');
 if(existing&&final.dataset.magiFinalDecisionEmphasis==='1'){
   applyDecisionState(final,existing);
   return true;
 }
 const found=findLineup(final);
 if(!found)return false;
 const {parsed,note}=found;
 const hero=document.createElement('section');
 hero.className='magiFinalDecisionHero';
 hero.setAttribute('aria-label','MAGI最終ベストオーダー');
 hero.innerHTML='<div class="magiFinalDecisionKicker"><span>《MAGI》最終判断</span><span class="magiFinalDecisionBadge">FINAL DECISION</span></div><h3 class="magiFinalDecisionTitle">公式戦想定 ベストオーダー</h3><div class="magiDeadlockNotice"></div><div class="magiFinalDecisionGrid">'+parsed.lineup.map(x=>`<div class="magiFinalDecisionRow"><span class="magiFinalDecisionNo">${x.no}</span><span class="magiFinalDecisionName">${esc(x.name)}</span></div>`).join('')+'</div>';
 const votes=final.querySelector('.votes');
 if(votes)final.insertBefore(hero,votes);else{const verdict=final.querySelector('.verdict');if(verdict)verdict.insertAdjacentElement('afterend',hero);else final.prepend(hero)}
 if(votes&&!final.querySelector('.magiFinalWiseLabel')){
   const label=document.createElement('div');label.className='magiFinalWiseLabel';label.textContent='3賢人それぞれの判断';votes.insertAdjacentElement('beforebegin',label);
 }
 if(note){
   if(parsed.remainder){note.textContent=parsed.remainder;note.classList.add('magiFinalDecisionRemainder')}
   else note.style.display='none';
 }
 final.dataset.magiFinalDecisionEmphasis='1';
 applyDecisionState(final,hero);
 return true;
}

function run(){if(emphasize())return;const status=document.getElementById('status');if(status&&/審議完了|正式審議完了|選択審議完了/.test(status.textContent||''))emphasize()}
const observer=new MutationObserver(()=>requestAnimationFrame(run));
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('magi:deliberation-result',()=>requestAnimationFrame(run));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
