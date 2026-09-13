(()=>{
'use strict';
if(window.MAGI_FINAL_DECISION_FIELDING_V341)return;
window.MAGI_FINAL_DECISION_FIELDING_V341=true;
const STANDARD=['投','捕','一','二','三','遊','左','中','右'];
const LABEL={投:'投手',捕:'捕手',一:'一塁',二:'二塁',三:'三塁',遊:'遊撃',左:'左翼',中:'中堅',右:'右翼'};
let running=false;

function injectStyle(){
 if(document.getElementById('magi-final-fielding-v341-style'))return;
 const s=document.createElement('style');
 s.id='magi-final-fielding-v341-style';
 s.textContent=`
 .magiFinalDecisionRow{grid-template-columns:38px minmax(0,1fr) auto!important}
 .magiFinalDecisionPos{display:inline-flex;align-items:center;justify-content:center;min-width:66px;padding:6px 9px;border-radius:999px;background:#e7f3fb;border:1px solid #b8d3e7;color:#16476c;font-size:12px;font-weight:900;white-space:nowrap}
 .magiFinalFieldingNote{margin-top:12px;padding:10px 12px;border-radius:10px;background:#dff3ff;color:#16476c;font-size:11px;line-height:1.65;font-weight:700}
 .magiFinalFieldingError{background:#fff0f1;color:#8b1f2b;border:1px solid #efb6bd}
 @media(max-width:430px){.magiFinalDecisionRow{grid-template-columns:38px minmax(0,1fr) auto!important}.magiFinalDecisionPos{min-width:58px;padding:5px 7px;font-size:11px}}
 `;
 document.head.appendChild(s);
}
function parseCsv(text){
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(q){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;continue}if(ch==='"'){q=false;continue}cell+=ch;continue}
  if(ch==='"'){q=true;continue}
  if(ch===','){row.push(cell.trim());cell='';continue}
  if(ch==='\n'){row.push(cell.replace(/\r$/,'').trim());if(row.some(v=>String(v).trim()!==''))rows.push(row);row=[];cell='';continue}
  cell+=ch;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,'').trim());if(row.some(v=>String(v).trim()!==''))rows.push(row)}
 return rows;
}
function decode(buf){
 try{if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buf)}catch(_){}
 for(const enc of ['shift_jis','utf-8']){try{const t=new TextDecoder(enc).decode(buf);if(t.includes('選手名')&&t.includes('守備位置'))return t}catch(_){}}
 return new TextDecoder('utf-8').decode(buf);
}
function normName(v){return String(v||'').normalize('NFKC').replace(/[\s　]+/g,' ').trim()}
function collect(rows,names){
 const h=rows[0]||[];const ni=h.findIndex(x=>String(x).replace(/\s/g,'')==='選手名'),pi=h.findIndex(x=>String(x).replace(/\s/g,'')==='守備位置');
 if(ni<0||pi<0)throw new Error('守備CSVの選手名/守備位置列を確認できません');
 const wanted=new Set(names.map(normName)),counts=new Map(names.map(n=>[normName(n),new Map()]));
 for(const r of rows.slice(1)){
  const name=normName(r[ni]);if(!wanted.has(name))continue;
  const map=counts.get(name);const value=String(r[pi]||'');
  for(const raw of value.split('>')){const p=raw.trim();if(!STANDARD.includes(p))continue;map.set(p,(map.get(p)||0)+1)}
 }
 return counts;
}
function solve(names,counts){
 const order=names.map(normName);let best=null,bestScore=-1;
 function walk(i,used,assign,score){
  if(i===order.length){if(used.size===9&&score>bestScore){bestScore=score;best={...assign}}return}
  const name=order[i],options=[...(counts.get(name)||new Map()).entries()].filter(([p])=>STANDARD.includes(p)&&!used.has(p)).sort((a,b)=>b[1]-a[1]);
  for(const [p,c] of options){used.add(p);assign[name]=p;walk(i+1,used,assign,score+c);delete assign[name];used.delete(p)}
 }
 walk(0,new Set(),{},0);return best;
}
async function fieldingFile(){
 try{
  const files=Array.isArray(driveIndex)?driveIndex:[];
  return files.find(f=>f&&/^守備詳細2026-2027\.csv$/i.test(String(f.name||'')))||null;
 }catch(_){return null}
}
async function apply(){
 injectStyle();if(running)return false;
 const hero=document.querySelector('.magiFinalDecisionHero');if(!hero||hero.dataset.magiFieldingDone==='1')return false;
 const rows=[...hero.querySelectorAll('.magiFinalDecisionRow')];if(rows.length!==9)return false;
 const names=rows.map(r=>r.querySelector('.magiFinalDecisionName')?.textContent?.trim()).filter(Boolean);if(names.length!==9)return false;
 running=true;
 try{
  let f=await fieldingFile();
  if(!f&&typeof window.MAGI_SERVER_DRIVE_RELOAD==='function'){try{await window.MAGI_SERVER_DRIVE_RELOAD()}catch(_){}f=await fieldingFile()}
  if(!f)throw new Error('守備詳細2026-2027.csv を確認できません');
  const res=await fetch(`/api/drive/file?id=${encodeURIComponent(f.id)}`,{cache:'no-store',credentials:'same-origin'});if(!res.ok)throw new Error(`守備CSV ${res.status}`);
  const text=decode(await res.arrayBuffer()),counts=collect(parseCsv(text),names),assignment=solve(names,counts);
  let note=hero.querySelector('.magiFinalFieldingNote');if(!note){note=document.createElement('div');note.className='magiFinalFieldingNote';hero.appendChild(note)}
  if(!assignment){
   rows.forEach(r=>{let p=r.querySelector('.magiFinalDecisionPos');if(!p){p=document.createElement('span');p.className='magiFinalDecisionPos';r.appendChild(p)}p.textContent='守備未成立'});
   note.classList.add('magiFinalFieldingError');note.textContent='この9人では、現チームの守備詳細CSVに記録された守備位置だけで9ポジションを重複なく成立させられません。最終ベストオーダーとしては再審議が必要です。';
  }else{
   rows.forEach((r,i)=>{const name=normName(names[i]),code=assignment[name];let p=r.querySelector('.magiFinalDecisionPos');if(!p){p=document.createElement('span');p.className='magiFinalDecisionPos';r.appendChild(p)}p.textContent=LABEL[code]||code});
   note.classList.remove('magiFinalFieldingError');note.textContent='守備位置は「守備詳細2026-2027.csv」で実際に記録された位置だけを使い、投・捕・一・二・三・遊・左・中・右が重複しない組み合わせで表示しています。打順は3賢人の最終判断です。';
  }
  hero.dataset.magiFieldingDone='1';return true;
 }catch(e){
  let note=hero.querySelector('.magiFinalFieldingNote');if(!note){note=document.createElement('div');note.className='magiFinalFieldingNote magiFinalFieldingError';hero.appendChild(note)}
  note.classList.add('magiFinalFieldingError');note.textContent=`守備位置の確認に失敗しました：${e?.message||e}`;hero.dataset.magiFieldingDone='1';return false;
 }finally{running=false}
}
function run(){apply().catch(()=>{})}
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
