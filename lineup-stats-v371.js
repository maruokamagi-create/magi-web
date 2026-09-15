(()=>{
'use strict';
if(window.MAGI_LINEUP_STATS_V371)return;
window.MAGI_LINEUP_STATS_V371=true;

let cache=null,pending=null;
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function injectStyle(){
  if(document.getElementById('magi-lineup-stats-v371-style'))return;
  const s=document.createElement('style');
  s.id='magi-lineup-stats-v371-style';
  s.textContent=`
  .magiFinalDecisionRow{
    grid-template-columns:38px minmax(0,1fr) auto!important;
    column-gap:9px!important;
    row-gap:5px!important;
  }
  .magiFinalDecisionNo{
    grid-column:1!important;
    grid-row:1 / span 2!important;
    align-self:center!important;
  }
  .magiFinalDecisionNameWrap{
    display:block!important;
    min-width:0!important;
    grid-column:2!important;
    grid-row:1!important;
  }
  .magiFinalDecisionPos{
    grid-column:3!important;
    grid-row:1!important;
    align-self:center!important;
  }
  .magiFinalDecisionRequestedStats{
    grid-column:2 / 4!important;
    grid-row:2!important;
    margin:0!important;
    display:flex!important;
    flex-direction:column!important;
    gap:2px!important;
    min-width:0!important;
    color:#3e617d!important;
    font-size:10.5px!important;
    line-height:1.34!important;
    font-weight:800!important;
    letter-spacing:0!important;
  }
  .magiLineupStatsLine{
    display:flex!important;
    align-items:center!important;
    gap:7px!important;
    flex-wrap:nowrap!important;
    min-width:0!important;
  }
  .magiLineupStat{white-space:nowrap!important}
  .magiLineupSeason{color:#123d61!important;font-weight:950!important}
  .magiLineupRate b{color:#123d61!important;font-weight:950!important}
  @media(max-width:430px){
    .magiFinalDecisionRequestedStats{font-size:10.2px!important}
    .magiLineupStatsLine{gap:5px!important}
  }
  @media(max-width:360px){
    .magiFinalDecisionRequestedStats{font-size:9.7px!important}
    .magiLineupStatsLine{gap:4px!important}
  }
  `;
  document.head.appendChild(s);
}

async function loadStats(){
  if(cache)return cache;
  if(pending)return pending;
  pending=fetch('/api/lineup-batting-stats',{method:'GET',credentials:'same-origin',cache:'no-store'})
    .then(async r=>{const j=await r.json().catch(()=>null);if(!r.ok||!j?.ok)throw new Error(j?.error||`HTTP ${r.status}`);return j;})
    .then(j=>{cache=j;return j;})
    .catch(error=>{console.warn('[MAGI lineup stats]',error?.message||error);return null;})
    .finally(()=>{pending=null;});
  return pending;
}

function ensureWrap(row){
  let wrap=row.querySelector('.magiFinalDecisionNameWrap');
  if(wrap)return wrap;
  const nameEl=row.querySelector('.magiFinalDecisionName');
  if(!nameEl)return null;
  wrap=document.createElement('span');wrap.className='magiFinalDecisionNameWrap';
  nameEl.replaceWith(wrap);wrap.appendChild(nameEl);
  return wrap;
}

function fmt(v){return v===null||v===undefined||v===''?'—':String(v);}
function rowText(st){
  return `<div class="magiLineupStatsLine"><span class="magiLineupStat magiLineupSeason">今季</span><span class="magiLineupStat">${fmt(st.games)}試合</span><span class="magiLineupStat">${fmt(st.PA)}打席</span><span class="magiLineupStat">${fmt(st.AB)}打数</span><span class="magiLineupStat">${fmt(st.H)}安打</span></div><div class="magiLineupStatsLine magiLineupRate"><span class="magiLineupStat">打率 <b>${fmt(st.AVG)}</b></span><span class="magiLineupStat">出塁率 <b>${fmt(st.OBP)}</b></span><span class="magiLineupStat">長打率 <b>${fmt(st.SLG)}</b></span><span class="magiLineupStat">OPS <b>${fmt(st.OPS)}</b></span></div><div class="magiLineupStatsLine magiLineupRate"><span class="magiLineupStat">得点圏打率 <b>${fmt(st.RISP)}</b></span><span class="magiLineupStat">${fmt(st.RBI)}打点</span><span class="magiLineupStat">四球 ${fmt(st.BB)}</span><span class="magiLineupStat">死球 ${fmt(st.HBP)}</span><span class="magiLineupStat">盗塁 ${fmt(st.SB)}</span></div>`;
}

async function apply(){
  injectStyle();
  const hero=document.querySelector('.magiFinalDecisionHero');
  if(!hero)return false;
  const rows=[...hero.querySelectorAll('.magiFinalDecisionRow')];
  if(rows.length!==9)return false;
  const data=await loadStats();
  if(!data?.players?.length)return false;
  const map=new Map(data.players.map(p=>[norm(p.name),p]));
  let done=0;
  for(const row of rows){
    const nameEl=row.querySelector('.magiFinalDecisionName');
    const name=nameEl?.textContent?.trim()||'';
    const st=map.get(norm(name));
    if(!st)continue;
    if(!ensureWrap(row))continue;
    row.querySelectorAll('.magiFinalDecisionEvidence,.magiFinalDecisionRequestedStats').forEach(n=>n.remove());
    const el=document.createElement('div');
    el.className='magiFinalDecisionRequestedStats';
    el.innerHTML=rowText(st);
    row.appendChild(el);
    done++;
  }
  if(done===9){hero.dataset.magiRequestedStats='1';return true;}
  return false;
}

let scheduled=false;
function run(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;apply();});
}
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
let tries=0;const timer=setInterval(async()=>{tries++;if(await apply()||tries>=300)clearInterval(timer)},150);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();