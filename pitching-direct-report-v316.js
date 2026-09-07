(()=>{
'use strict';
if(window.MAGI_PITCHING_DIRECT_REPORT_V316)return;
window.MAGI_PITCHING_DIRECT_REPORT_V316=true;

const FALLBACK=[
 {season:'2025-2026',id:'1thxQXAdswckPVdmXdvRXPeuVAfDtskUB',name:'投手詳細2025-2026.csv',path:''},
 {season:'2026-2027',id:'12Lw2EfQFktx57z_AEVcteFdO4ayD197C',name:'投手詳細2026-2027.csv',path:''}
];
const cache=new Map();
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return 0;const x=Number(s);return Number.isFinite(x)?x:0};

function isPitchLookup(q){
 q=String(q||'');
 const pitch=/投手|ピッチャー|防御率|投球回|奪三振|WHIP|勝敗|勝利|敗北|セーブ|被安打|与四球|与死球|投球数/i.test(q);
 const request=/通算|成績|出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|起用|固定|先発に|抑え|クローザー|継投|ローテ/i.test(q);
 return pitch&&request&&!decision;
}
function seasonText(s){const m=String(s||'').match(/(20\d{2})\s*[-–—_. /]\s*(20\d{2})/);return m?`${m[1]}-${m[2]}`:''}
function explicitSeason(q){const y=seasonText(q);if(y)return y;if(/旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';if(/新チーム|現チーム/i.test(q))return'2026-2027';return''}
function sources(){
 const map=new Map(FALLBACK.map(x=>[x.season,{...x}]));
 let files=[];try{files=Array.isArray(driveIndex)?driveIndex:[]}catch(_){}
 for(const f of files){
  if(!f?.id)continue;const name=String(f.name||''),path=String(f.path||'');
  if(!/投手詳細/i.test(name)||!/\.csv$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);if(season)map.set(season,{season,id:f.id,name,path});
 }
 return [...map.values()].sort((a,b)=>a.season.localeCompare(b.season));
}
function parseCsv(text){
 const out=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;continue}if(c==='"'){quoted=false;continue}cell+=c;continue}
  if(c==='"'){quoted=true;continue}
  if(c===','){row.push(cell);cell='';continue}
  if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);row=[];cell='';continue}
  cell+=c;
 }
 row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);return out;
}
function decodeSmart(buffer){
 try{if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer)}catch(_){}
 const score=s=>(String(s).match(/[ぁ-んァ-ヶ一-龯々]/g)||[]).length-(String(s).match(/�/g)||[]).length*30;
 let u='',sj='';try{u=new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){}try{sj=new TextDecoder('shift_jis',{fatal:false}).decode(buffer)}catch(_){}return score(sj)>score(u)?sj:u;
}
async function fetchTable(src){
 if(cache.has(src.id))return cache.get(src.id);
 const p=(async()=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);try{const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:c.signal});if(!r.ok)throw new Error(`Drive file ${r.status}`);return parseCsv(decodeSmart(await r.arrayBuffer()))}finally{clearTimeout(t)}})().catch(e=>{cache.delete(src.id);throw e});
 cache.set(src.id,p);return p;
}
function colIndex(cols,aliases){const w=aliases.map(norm);for(let i=0;i<cols.length;i++)if(w.includes(norm(cols[i])))return i;for(let i=0;i<cols.length;i++){const c=norm(cols[i]);if(w.some(x=>x&&x.length>=2&&c.includes(x)))return i}return-1}
function dateRank(v){const s=String(v??'').trim(),m=s.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));const x=Number(s);return Number.isFinite(x)?x:0}
function inningsToOuts(v){const s=String(v??'').trim().replace(/回$/,'');const m=s.match(/^(\d+)(?:\.(\d))?$/);if(!m)return 0;const r=Number(m[2]||0);return r<=2?Number(m[1])*3+r:0}
function fmtInn(o){return`${Math.floor(o/3)}.${o%3}`}
function rate2(x){return Number.isFinite(x)?x.toFixed(2):'—'}

function meta(src,table){
 const cols=(table[0]||[]).map(v=>String(v??'').trim());
 const ix={
  date:colIndex(cols,['開催日','日付']),tournament:colIndex(cols,['大会名','大会','試合種別']),order:colIndex(cols,['試合順','試合']),opponent:colIndex(cols,['相手校','対戦相手','対戦校']),usage:colIndex(cols,['起用法','起用']),player:colIndex(cols,['選手名','投手名','氏名','名前','選手']),
  innings:colIndex(cols,['投球回','投球回数']),win:colIndex(cols,['勝利','勝']),loss:colIndex(cols,['敗北','敗']),save:colIndex(cols,['セーブ']),batters:colIndex(cols,['対打者']),pitches:colIndex(cols,['投球数']),hits:colIndex(cols,['被安打']),runs:colIndex(cols,['失点']),earned:colIndex(cols,['自責点']),walks:colIndex(cols,['与四球']),so:colIndex(cols,['奪三振']),hbp:colIndex(cols,['与死球']),wp:colIndex(cols,['暴投'])
 };
 const rowGame=new Map(),games=[];let seq=0,lastIdentity='';
 for(let i=1;i<table.length;i++){
  const r=table[i]||[],date=ix.date>=0?String(r[ix.date]??'').trim():'',tour=ix.tournament>=0?String(r[ix.tournament]??'').trim():'',ord=ix.order>=0?String(r[ix.order]??'').trim():'',opp=ix.opponent>=0?String(r[ix.opponent]??'').trim():'';
  if(!date)continue;const identity=`${date}|${ord}|${opp}`;
  if(identity!==lastIdentity){seq++;lastIdentity=identity;games.push({key:`${src.season}|${seq}`,season:src.season,date,rank:dateRank(date),seq,tournament:tour,order:ord,opponent:opp,practice:/練習試合/.test(tour)&&!/公式戦/.test(tour)})}
  rowGame.set(i,`${src.season}|${seq}`);
 }
 return{src,table,cols,ix,rowGame,games};
}
function findTarget(q,metas){
 const nq=norm(q),names=[];
 for(const m of metas){if(m.ix.player<0)continue;for(let i=1;i<m.table.length;i++){const p=String(m.table[i]?.[m.ix.player]??'').trim(),k=norm(p);if(p&&k.length>=2&&nq.includes(k)&&!names.some(x=>norm(x)===k))names.push(p)}}
 return names.sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
}
function playerRows(m,target){if(m.ix.player<0)return[];const np=norm(target),out=[];for(let i=1;i<m.table.length;i++)if(norm(m.table[i]?.[m.ix.player])===np)out.push({m,row:m.table[i]||[],rowIndex:i,gameKey:m.rowGame.get(i)||`${m.src.season}|row${i}`});return out}
function aggregate(items){
 if(!items.length)return null;
 const t={games:new Set(),starts:0,relief:0,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,hits:0,runs:0,earned:0,walks:0,so:0,hbp:0,wp:0};
 const files=new Set();
 for(const x of items){const {m,row,gameKey}=x,ix=m.ix;t.games.add(gameKey);files.add(m.src.name);const usage=ix.usage>=0?String(row[ix.usage]??''):'';if(/先発/.test(usage))t.starts++;else if(/リリーフ|救援|抑え|クローザー/.test(usage))t.relief++;
  t.outs+=ix.innings>=0?inningsToOuts(row[ix.innings]):0;
  for(const [k,key] of [['win','win'],['loss','loss'],['save','save'],['batters','batters'],['pitches','pitches'],['hits','hits'],['runs','runs'],['earned','earned'],['walks','walks'],['so','so'],['hbp','hbp'],['wp','wp']]){const ci=ix[key];if(ci>=0)t[k]+=num(row[ci])}
 }
 const ip=t.outs/3,era=t.outs>0?t.earned*21/t.outs:NaN,whip=t.outs>0?(t.hits+t.walks)*3/t.outs:NaN,k7=t.outs>0?t.so*21/t.outs:NaN,bb7=t.outs>0?t.walks*21/t.outs:NaN;
 return{games:t.games.size,starts:t.starts,relief:t.relief,innings:fmtInn(t.outs),outs:t.outs,win:t.win,loss:t.loss,save:t.save,batters:t.batters,pitches:t.pitches,hits:t.hits,runs:t.runs,earned:t.earned,walks:t.walks,so:t.so,hbp:t.hbp,wp:t.wp,era:rate2(era),whip:rate2(whip),k7:rate2(k7),bb7:rate2(bb7),files:[...files]};
}
function latestSix(metas){const all=[];for(const m of metas)for(const g of m.games)if(g.practice)all.push(g);return all.sort((a,b)=>b.rank-a.rank||b.seq-a.seq||b.season.localeCompare(a.season)).slice(0,6)}
function collect(q,metas){
 const target=findTarget(q,metas);if(!target)return{error:'対象投手を投手詳細CSVから特定できませんでした。選手名をフルネームで入力してください。'};
 const wanted=explicitSeason(q),recentOnly=/直近|最近/.test(q),bySeason=new Map();let all=[];
 for(const m of metas){const rr=playerRows(m,target);if(rr.length){bySeason.set(m.src.season,rr);all=all.concat(rr)}}
 if(wanted){all=(bySeason.get(wanted)||[]).slice();if(!all.length)return{error:`${target}の${wanted}投手成績はありません。`};return{target,mode:'season',records:[{label:wanted,kicker:'SEASON',badge:'年度別',stats:aggregate(all)}]}}
 const six=latestSix(metas),sixKeys=new Set(six.map(g=>g.key)),recentItems=all.filter(x=>sixKeys.has(x.gameKey)),recentStats=aggregate(recentItems);
 if(recentOnly){if(!recentStats)return{error:`${target}はチーム直近6試合（練習試合）に登板していません。`};return{target,mode:'recent',records:[{label:'直近6試合',kicker:'RECENT',badge:`チーム直近6試合中 ${recentStats.games}登板`,stats:recentStats}]}}
 if(!all.length)return{error:`${target}の投手成績は投手詳細CSVにありません。`};
 const records=[{label:'全年度通算',kicker:'CAREER',badge:'全年度再集計',stats:aggregate(all)}];
 if(recentStats)records.push({label:'直近6試合',kicker:'RECENT',badge:`チーム直近6試合中 ${recentStats.games}登板`,stats:recentStats});
 for(const y of [...bySeason.keys()].sort())records.push({label:y,kicker:'SEASON',badge:'年度別',stats:aggregate(bySeason.get(y))});
 return{target,mode:'career',records};
}
function metric(label,value,featured=false){return`<div class="${featured?'statsFeature':'statsMetric'}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}
function section(r){const s=r.stats;const featured=[['防御率',s.era],['WHIP',s.whip],['投球回',s.innings],['奪三振',s.so]].map(x=>metric(x[0],x[1],true)).join('');const detail=[['登板',s.games],['先発',s.starts],['救援',s.relief],['勝利',s.win],['敗北',s.loss],['セーブ',s.save],['投球回',s.innings],['対打者',s.batters],['投球数',s.pitches],['被安打',s.hits],['失点',s.runs],['自責点',s.earned],['与四球',s.walks],['与死球',s.hbp],['奪三振',s.so],['暴投',s.wp],['K/7',s.k7],['BB/7',s.bb7]].map(x=>metric(x[0],x[1])).join('');return`<section class="statsSeason"><div class="statsSeasonHead"><div><span>${esc(r.kicker)}</span><b>${esc(r.label)}</b></div><div class="statsVerified">${esc(r.badge)}</div></div><div class="statsSectionLabel">投手成績</div><div class="statsFeatured">${featured}</div><div class="statsMetrics">${detail}</div><div class="statsSource"><b>参照元</b> ${esc((s.files||[]).join(' / '))} から再集計</div></section>`}
function markup(result){const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`,subtitle=result.mode==='career'?'選手通算・直近6試合・年度別 投手成績':result.mode==='recent'?'チーム直近6試合（練習試合）投手成績':'年度別 投手成績';return`<article id="statsPdfSource" class="statsPaper"><header class="statsHeader"><div class="statsBrand"><img src="/magi-official-symbol-v125.svg?v=140" alt=""><div><b>MAGI DATA REPORT</b><span>Maruoka Advanced Game Intelligence</span></div></div><div class="statsIssue">発行 ${esc(date)}</div></header><div class="statsTitle"><span>PLAYER PITCHING RECORD</span><h2>${esc(result.target)}</h2><p>${esc(subtitle)}</p></div>${result.records.map(section).join('')}<footer class="statsFooter"><b>《MAGI》</b><span>丸岡中学校軟式野球部 データ資料</span><small>投手成績は投手詳細CSVの各登板をアウト数へ変換して再集計しています。防御率は7回制として「自責点×7÷投球回」、WHIPは「（被安打＋与四球）÷投球回」で算出。直近6試合はチーム全体の最新6練習試合を基準にし、対象投手が未登板の場合はRECENT欄を表示しません。</small></footer></article>`}
function ensurePanel(){let p=document.getElementById('statsLookupPanel');if(p)return p;const response=document.getElementById('response'),card=document.querySelector('#judge .card');p=document.createElement('div');p.id='statsLookupPanel';p.className='statsLookupPanel';if(response)response.parentNode.insertBefore(p,response);else card?.parentNode.appendChild(p);return p}
function renderError(text){const p=ensurePanel();p.innerHTML=`<div class="statsError"><b>投手成績を表示できませんでした</b><p>${esc(text)}</p></div>`;p.classList.add('show');document.getElementById('response')?.classList.remove('show');const st=document.getElementById('status');if(st)st.textContent='投手成績：資料を確認してください。';p.scrollIntoView({behavior:'smooth',block:'start'})}
function render(result){const p=ensurePanel();p.innerHTML=markup(result)+`<div class="statsPdfActions"><button id="statsPreviewButton" class="statsPdfButton" type="button">A4プレビュー</button><button id="statsSaveButton" class="secondary" type="button">PDF保存プレビュー</button><div class="statsPdfState">内容確認は「A4プレビュー」、PDF保存は「PDF保存プレビュー」を使用してください。</div></div>`;p.classList.add('show');document.getElementById('response')?.classList.remove('show');document.getElementById('statsPreviewButton')?.addEventListener('click',()=>window.MAGI_PREVIEW_STATS_REPORT?.());document.getElementById('statsSaveButton')?.addEventListener('click',()=>window.MAGI_PRINT_STATS_REPORT?.());const st=document.getElementById('status');if(st)st.textContent=`${result.target}の通算投手成績を表示しました。PDF保存前に内容を確認できます。`;const q=(document.getElementById('q')?.value||'').trim();try{if(typeof FINAL!=='undefined')FINAL.lookup='投手成績照会';if(q&&typeof saveHistory==='function')saveHistory(q,'lookup')}catch(_){}p.scrollIntoView({behavior:'smooth',block:'start'})}
async function execute(q){const ss=sources(),tables=await Promise.all(ss.map(async s=>({s,table:await fetchTable(s)}))),metas=tables.map(x=>meta(x.s,x.table)),result=collect(q,metas);if(result.error)renderError(result.error);else render(result)}

let busy=false;
document.addEventListener('click',async event=>{
 const btn=event.target?.closest?.('button[onclick*="runMagi"]');if(!btn)return;
 const q=(document.getElementById('q')?.value||'').trim();if(!isPitchLookup(q))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(busy)return;busy=true;
 const old=btn.textContent,st=document.getElementById('status');btn.disabled=true;btn.textContent='投手成績照会中…';if(st)st.textContent='投手成績照会：投手詳細データを確認しています…';
 try{await execute(q)}catch(e){console.warn('[MAGI pitching direct v316]',e?.message||e);renderError('投手詳細データの取得に失敗しました。もう一度実行してください。')}finally{btn.disabled=false;if(btn.textContent==='投手成績照会中…')btn.textContent=old||'MAGI実行';busy=false}
},true);

setTimeout(()=>{Promise.allSettled(sources().map(fetchTable)).then(()=>{window.MAGI_PITCHING_WARM_V316=true})},900);
})();
