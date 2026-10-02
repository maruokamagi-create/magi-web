(()=>{
'use strict';
if(window.MAGI_FINAL_DECISION_FIELDING_V346)return;
window.MAGI_FINAL_DECISION_FIELDING_V346=true;

const STANDARD=['投','捕','一','二','三','遊','左','中','右'];
const LABEL={投:'投手',捕:'捕手',一:'一塁',二:'二塁',三:'三塁',遊:'遊撃',左:'左翼',中:'中堅',右:'右翼'};

function norm(v){return String(v||'').normalize('NFKC').replace(/[\s　]+/g,' ').trim()}
function injectStyle(){
 if(document.getElementById('magi-final-fielding-v346-style'))return;
 const s=document.createElement('style');
 s.id='magi-final-fielding-v346-style';
 s.textContent=`
 .magiFinalDecisionRow{grid-template-columns:38px minmax(0,1fr) auto!important}
 .magiFinalDecisionPos{display:inline-flex;align-items:center;justify-content:center;min-width:66px;padding:6px 9px;border-radius:999px;background:#e7f3fb;border:1px solid #b8d3e7;color:#16476c;font-size:12px;font-weight:900;white-space:nowrap}
 .magiFinalFieldingNote{margin-top:12px;padding:10px 12px;border-radius:10px;background:#dff3ff;color:#16476c;font-size:11px;line-height:1.65;font-weight:700}
 .magiFinalFieldingError{background:#fff0f1;color:#8b1f2b;border:1px solid #efb6bd}
 @media(max-width:430px){.magiFinalDecisionPos{min-width:58px;padding:5px 7px;font-size:11px}}
 `;
 document.head.appendChild(s);
}
function finalPayload(){
 const root=window.MAGI_LAST_DELIBERATION_RESULT||{};
 return root?.final&&typeof root.final==='object'?root.final:root;
}
function structuredLineup(){
 const final=finalPayload();
 if(final?.status!=='LINEUP_RESULT'||final?.fieldingStatus!=='COMPLETE')return null;
 const rows=Array.isArray(final?.lineup)?final.lineup.slice():[];
 if(rows.length!==9)return null;
 rows.sort((a,b)=>Number(a?.slot)-Number(b?.slot));
 const names=rows.map(r=>norm(r?.name)),positions=rows.map(r=>String(r?.position||'').trim());
 if(names.some(n=>!n)||new Set(names).size!==9)return null;
 if(positions.some(p=>!STANDARD.includes(p))||new Set(positions).size!==9)return null;
 if(!STANDARD.every(p=>positions.includes(p)))return null;
 return rows;
}
function noteNode(hero){
 let note=hero.querySelector('.magiFinalFieldingNote');
 if(!note){note=document.createElement('div');note.className='magiFinalFieldingNote';hero.appendChild(note)}
 return note;
}
function renderServerAssignment(hero,visualRows,lineup){
 visualRows.forEach((row,i)=>{
  const item=lineup[i];
  const shown=norm(row.querySelector('.magiFinalDecisionName')?.textContent);
  if(shown&&shown!==norm(item?.name))throw new Error(`LINEUP_NAME_MISMATCH slot=${i+1}`);
  let pos=row.querySelector('.magiFinalDecisionPos');
  if(!pos){pos=document.createElement('span');pos.className='magiFinalDecisionPos';row.appendChild(pos)}
  pos.textContent=item?.positionLabel||LABEL[item?.position]||item?.position||'';
 });
 const note=noteNode(hero);
 note.classList.remove('magiFinalFieldingError');
 note.textContent='守備位置はMAGIサーバーの最終判断です。出場詳細・守備詳細の実記録から9人9位置が一意に成立した場合だけ表示し、ブラウザ側では再計算・固定ポジション補正を行いません。';
 hero.dataset.magiFieldingDone='1';
 return true;
}
function renderUnresolved(hero,visualRows){
 visualRows.forEach(row=>{
  let pos=row.querySelector('.magiFinalDecisionPos');
  if(!pos){pos=document.createElement('span');pos.className='magiFinalDecisionPos';row.appendChild(pos)}
  pos.textContent='守備未確定';
 });
 const note=noteNode(hero);
 note.classList.add('magiFinalFieldingError');
 note.textContent='サーバーで守備位置まで確定した最終結果を確認できません。守備位置をブラウザ側で推測・補完しないため、再審議またはEvidence確認が必要です。';
 hero.dataset.magiFieldingDone='1';
 return false;
}
function apply(){
 injectStyle();
 const hero=document.querySelector('.magiFinalDecisionHero');
 if(!hero||hero.dataset.magiFieldingDone==='1')return false;
 const rows=[...hero.querySelectorAll('.magiFinalDecisionRow')];
 if(rows.length!==9)return false;
 const lineup=structuredLineup();
 return lineup?renderServerAssignment(hero,rows,lineup):renderUnresolved(hero,rows);
}
function run(){try{apply()}catch(e){console.warn('[MAGI final fielding v346]',e?.message||e)}}
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
