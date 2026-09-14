(()=>{
'use strict';
if(window.MAGI_LINEUP_STATS_V366)return;
window.MAGI_LINEUP_STATS_V366=true;

const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const A={
  name:['選手名','氏名','名前','選手'],
  ab:['打数','AB'],h:['安打','H'],rbi:['打点','RBI'],bb:['四球','BB'],hbp:['死球','HBP'],sf:['犠飛','犠牲フライ'],
  d2:['二塁打','2塁打'],d3:['三塁打','3塁打'],hr:['本塁打','HR'],
  date:['開催日','試合日','日付'],event:['大会名','大会','区分'],game:['試合順','試合','試合番号'],opp:['相手校','対戦相手','相手']
};
function allRecords(){
  try{if(typeof dataRecords!=='undefined'&&Array.isArray(dataRecords))return dataRecords}catch(_){}
  return Array.isArray(window.dataRecords)?window.dataRecords:[];
}
function idx(r,a){const c=Array.isArray(r?.columns)?r.columns:[],w=a.map(norm);for(let i=0;i<c.length;i++)if(w.includes(norm(c[i])))return i;return-1}
function val(r,a){const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()}
function num(v){const n=Number(String(v??'').replace(/[%％,]/g,''));return Number.isFinite(n)?n:0}
function gameKey(r){const key=[val(r,A.date),val(r,A.event),val(r,A.game),val(r,A.opp)].join('|');return key==='||| '?String(r?.rowNumber??''):key}
function detailRows(){
  return allRecords().filter(r=>r&&/打撃詳細2026-2027(?:\s*[（(]\d+[）)])?\.csv/i.test(String(r.fileName||''))&&val(r,A.name));
}
function fmtRate(v){return Number.isFinite(v)?v.toFixed(3).replace(/^0/,'.'):'—'}
function aggregate(rows,name){
  const own=rows.filter(r=>norm(val(r,A.name))===norm(name));
  if(!own.length)return null;
  let ab=0,h=0,rbi=0,bb=0,hbp=0,sf=0,d2=0,d3=0,hr=0;
  const games=new Set();
  for(const r of own){
    const k=gameKey(r);if(k)games.add(k);
    ab+=num(val(r,A.ab));h+=num(val(r,A.h));rbi+=num(val(r,A.rbi));bb+=num(val(r,A.bb));hbp+=num(val(r,A.hbp));sf+=num(val(r,A.sf));d2+=num(val(r,A.d2));d3+=num(val(r,A.d3));hr+=num(val(r,A.hr));
  }
  const avg=ab?h/ab:0;
  const obpDen=ab+bb+hbp+sf;
  const obp=obpDen?(h+bb+hbp)/obpDen:0;
  const tb=h+d2+(2*d3)+(3*hr);
  const slg=ab?tb/ab:0;
  return {games:games.size,ab,h,avg,obp,ops:obp+slg,rbi};
}
function injectStyle(){
  if(document.getElementById('magi-lineup-stats-v366-style'))return;
  const s=document.createElement('style');s.id='magi-lineup-stats-v366-style';s.textContent=`
  .magiFinalDecisionNameWrap{display:block;min-width:0}
  .magiFinalDecisionRequestedStats{margin-top:4px;font-size:10.5px;line-height:1.5;color:#3e617d;font-weight:800;letter-spacing:.005em}
  .magiFinalDecisionRequestedStats b{color:#123d61;font-weight:950}
  @media(max-width:430px){.magiFinalDecisionRequestedStats{font-size:9.5px;line-height:1.45}}
  `;document.head.appendChild(s);
}
function nameFromRow(row){return row.querySelector('.magiFinalDecisionName')?.textContent?.trim()||''}
function ensureWrap(row){
  let wrap=row.querySelector('.magiFinalDecisionNameWrap');
  if(wrap)return wrap;
  const nameEl=row.querySelector('.magiFinalDecisionName');if(!nameEl)return null;
  wrap=document.createElement('span');wrap.className='magiFinalDecisionNameWrap';nameEl.replaceWith(wrap);wrap.appendChild(nameEl);return wrap;
}
function apply(){
  injectStyle();
  const hero=document.querySelector('.magiFinalDecisionHero');if(!hero)return false;
  const rows=[...hero.querySelectorAll('.magiFinalDecisionRow')];if(rows.length!==9)return false;
  const details=detailRows();if(!details.length)return false;
  let done=0;
  for(const row of rows){
    const name=nameFromRow(row);if(!name)continue;
    const st=aggregate(details,name);if(!st)continue;
    const wrap=ensureWrap(row);if(!wrap)continue;
    wrap.querySelectorAll('.magiFinalDecisionEvidence,.magiFinalDecisionRequestedStats').forEach(n=>n.remove());
    const el=document.createElement('div');el.className='magiFinalDecisionRequestedStats';
    el.innerHTML=`<b>今季</b> ${st.games}試合｜${st.ab}打数 ${st.h}安打｜打率${fmtRate(st.avg)}｜出塁率${fmtRate(st.obp)}｜OPS ${fmtRate(st.ops)}｜${st.rbi}打点`;
    wrap.appendChild(el);done++;
  }
  if(done===9){hero.dataset.magiBatEvidence='1';hero.dataset.magiRequestedStats='1';return true}
  return false;
}
function run(){requestAnimationFrame(apply)}
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
let tries=0;const timer=setInterval(()=>{tries++;if(apply()||tries>=300)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
