(()=>{
'use strict';
if(window.MAGI_LINEUP_STATS_V367)return;
window.MAGI_LINEUP_STATS_V367=true;

let cache=null,pending=null;
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function injectStyle(){
  if(document.getElementById('magi-lineup-stats-v367-style'))return;
  const s=document.createElement('style');
  s.id='magi-lineup-stats-v367-style';
  s.textContent=`
  .magiFinalDecisionNameWrap{display:block;min-width:0}
  .magiFinalDecisionRequestedStats{margin-top:5px;font-size:10.5px;line-height:1.55;color:#3e617d;font-weight:850;letter-spacing:.005em}
  .magiFinalDecisionRequestedStats b{color:#123d61;font-weight:950}
  @media(max-width:430px){.magiFinalDecisionRequestedStats{font-size:9.5px;line-height:1.5}}
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

function fmt(v,prefix=''){return v===null||v===undefined||v===''?'—':`${prefix}${v}`;}
function rowText(st){
  return `<b>今季</b> ${fmt(st.games)}試合｜${fmt(st.AB)}打数｜${fmt(st.H)}安打｜打率${fmt(st.AVG)}｜出塁率${fmt(st.OBP)}｜OPS ${fmt(st.OPS)}｜${fmt(st.RBI)}打点`;
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
    const wrap=ensureWrap(row);if(!wrap)continue;
    wrap.querySelectorAll('.magiFinalDecisionEvidence,.magiFinalDecisionRequestedStats').forEach(n=>n.remove());
    const el=document.createElement('div');el.className='magiFinalDecisionRequestedStats';el.innerHTML=rowText(st);
    wrap.appendChild(el);done++;
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
