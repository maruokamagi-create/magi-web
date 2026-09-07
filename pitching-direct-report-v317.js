(()=>{
'use strict';
if(window.MAGI_PITCHING_DIRECT_REPORT_V317)return;
window.MAGI_PITCHING_DIRECT_REPORT_V317=true;

const VERSION='v317';
const FALLBACK=[
 {season:'2025-2026',id:'1thxQXAdswckPVdmXdvRXPeuVAfDtskUB',name:'投手詳細2025-2026.csv',path:''},
 {season:'2026-2027',id:'12Lw2EfQFktx57z_AEVcteFdO4ayD197C',name:'投手詳細2026-2027.csv',path:''}
];
const cache=new Map();
const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return 0;const x=Number(s);return Number.isFinite(x)?x:0};

function queryType(q){
 q=String(q||'');
 const pitch=/投手|ピッチャー|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ|投球回|投球数|勝敗|勝利|敗北/i.test(q);
 const request=/通算|成績|直近|最近|出して|教えて|見せて|表示|知りたい|一覧|何|データ|記録|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|適性|候補|固定|起用|継投|先発させ|先発に|クローザー|抑え|ローテ|戦術|采配|任せる|推薦|提案/i.test(q);
 return {pitch,request,decision,direct:pitch&&request&&!decision};
}
function isPitchLookup(q){return queryType(q).direct}
function seasonText(s){const m=String(s||'').match(/(20\d{2})\s*[-–—_. /]\s*(20\d{2})/);return m?`${m[1]}-${m[2]}`:''}
function explicitSeason(q){
 const y=seasonText(q);if(y)return y;
 if(/旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';
 if(/新チーム|現チーム|今季|今年/i.test(q))return'2026-2027';
 return'';
}
function driveFiles(){try{return Array.isArray(driveIndex)?driveIndex:[]}catch(_){return[]}}
function sources(){
 const map=new Map(FALLBACK.map(x=>[x.season,{...x}]));
 for(const f of driveFiles()){
  if(!f?.id)continue;
  const name=String(f.name||''),path=String(f.path||'');
  if(!/投手詳細/i.test(name)||!/\.csv$/i.test(name))continue;
  const season=seasonText(`${name} ${path}`);if(season)map.set(season,{season,id:f.id,name,path});
 }
 return[...map.values()].sort((a,b)=>a.season.localeCompare(b.season));
}
function parseCsv(text){
 const out=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;continue}
   if(c==='"'){quoted=false;continue}
   cell+=c;continue;
  }
  if(c==='"'){quoted=true;continue}
  if(c===','){row.push(cell);cell='';continue}
  if(c==='\n'){row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);row=[];cell='';continue}
  cell+=c;
 }
 row.push(cell.replace(/\r$/,''));if(row.some(v=>String(v).trim()))out.push(row);
 return out;
}
function decodeSmart(buffer){
 try{if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer)}catch(_){}
 const score=s=>(String(s).match(/[ぁ-んァ-ヶ一-龯々]/g)||[]).length-(String(s).match(/�/g)||[]).length*30;
 let u='',sj='';
 try{u=new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){}
 try{sj=new TextDecoder('shift_jis',{fatal:false}).decode(buffer)}catch(_){}
 return score(sj)>score(u)?sj:u;
}
async function fetchTable(src){
 if(cache.has(src.id))return cache.get(src.id);
 const p=(async()=>{
  const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
  try{
   const r=await fetch(`/api/drive/file?id=${encodeURIComponent(src.id)}`,{cache:'no-store',credentials:'same-origin',signal:c.signal});
   if(!r.ok)throw new Error(`Drive file ${r.status}`);
   return parseCsv(decodeSmart(await r.arrayBuffer()));
  }finally{clearTimeout(t)}
 })().catch(e=>{cache.delete(src.id);throw e});
 cache.set(src.id,p);return p;
}
function colIndex(cols,aliases){
 const want=aliases.map(norm);
 for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;
 for(let i=0;i<cols.length;i++){const c=norm(cols[i]);if(want.some(x=>x&&x.length>=2&&c.includes(x)))return i}
 return-1;
}
function dateRank(v){
 const s=String(v??'').trim(),m=s.match(/(20\d{2})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})/);
 if(m)return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const x=Number(s);return Number.isFinite(x)?x:0;
}
function inningsToOuts(v){
 const s=String(v??'').trim().replace(/回$/,'');
 const m=s.match(/^(\d+)(?:\.(\d))?$/);if(!m)return 0;
 const r=Number(m[2]||0);return r<=2?Number(m[1])*3+r:0;
}
function fmtInn(o){return`${Math.floor(o/3)}.${o%3}`}
function fmt(v,kind){
 if(v===''||v===null||v===undefined)return'—';
 if(kind==='ip')return String(v);
 const x=Number(v);if(!Number.isFinite(x))return String(v);
 if(kind==='rate2')return x.toFixed(2);
 if(kind==='rate3')return x.toFixed(3).replace(/^0(?=\.)/,'');
 return String(Math.round(x));
}

function meta(src,table){
 const cols=(table[0]||[]).map(v=>String(v??'').trim());
 const ix={
  date:colIndex(cols,['開催日','日付']),
  tournament:colIndex(cols,['大会名','大会','試合種別']),
  order:colIndex(cols,['試合順','試合']),
  opponent:colIndex(cols,['相手校','対戦相手','対戦校']),
  usage:colIndex(cols,['起用法','起用']),
  player:colIndex(cols,['選手名','投手名','氏名','名前','選手']),
  innings:colIndex(cols,['投球回','投球回数']),
  win:colIndex(cols,['勝利','勝']),
  loss:colIndex(cols,['敗北','敗戦','敗']),
  save:colIndex(cols,['セーブ']),
  batters:colIndex(cols,['対打者']),
  pitches:colIndex(cols,['投球数']),
  balls:colIndex(cols,['ボール']),
  strikes:colIndex(cols,['ストライク']),
  hits:colIndex(cols,['被安打']),
  runs:colIndex(cols,['失点']),
  earned:colIndex(cols,['自責点']),
  walks:colIndex(cols,['与四球','四球']),
  so:colIndex(cols,['奪三振','三振']),
  hbp:colIndex(cols,['与死球','死球']),
  hr:colIndex(cols,['被本塁打','被本塁']),
  wp:colIndex(cols,['暴投']),
  balk:colIndex(cols,['ボーク'])
 };
 const rowGame=new Map(),games=[];
 let seq=0,lastDate='',lastIdentity='',seenPlayers=new Set();
 for(let i=1;i<table.length;i++){
  const r=table[i]||[];
  const date=ix.date>=0?String(r[ix.date]??'').trim():'';
  if(!date)continue;
  const tour=ix.tournament>=0?String(r[ix.tournament]??'').trim():'';
  const ord=ix.order>=0?String(r[ix.order]??'').trim():'';
  const opp=ix.opponent>=0?String(r[ix.opponent]??'').trim():'';
  const p=ix.player>=0?norm(r[ix.player]):'';
  const identity=`${date}|${ord}|${opp}`;
  const repeated=p&&seenPlayers.has(p);
  if(date!==lastDate||identity!==lastIdentity||repeated){
   seq++;lastDate=date;lastIdentity=identity;seenPlayers=new Set();
   games.push({key:`${src.season}|${seq}`,season:src.season,date,rank:dateRank(date),seq,tournament:tour,order:ord,opponent:opp,practice:/練習試合/.test(tour)&&!/公式戦/.test(tour)});
  }
  if(p)seenPlayers.add(p);
  rowGame.set(i,`${src.season}|${seq}`);
 }
 return{src,table,cols,ix,rowGame,games};
}
function findTargets(q,metas){
 const nq=norm(q),names=[];
 for(const m of metas){
  if(m.ix.player<0)continue;
  for(let i=1;i<m.table.length;i++){
   const p=String(m.table[i]?.[m.ix.player]??'').trim(),k=norm(p);
   if(p&&k.length>=2&&nq.includes(k)&&!names.some(x=>norm(x)===k))names.push(p);
  }
 }
 return names.sort((a,b)=>norm(b).length-norm(a).length);
}
function playerRows(m,target){
 if(m.ix.player<0)return[];
 const np=norm(target),out=[];
 for(let i=1;i<m.table.length;i++)if(norm(m.table[i]?.[m.ix.player])===np)out.push({m,row:m.table[i]||[],rowIndex:i,gameKey:m.rowGame.get(i)||`${m.src.season}|row${i}`});
 return out;
}
function aggregate(items,withOpp=true){
 if(!items.length)return null;
 const t={games:new Set(),starts:new Set(),relief:new Set(),win:0,loss:0,save:0,outs:0,batters:0,pitches:0,balls:0,strikes:0,hits:0,runs:0,earned:0,walks:0,so:0,hbp:0,hr:0,wp:0,balk:0};
 const files=new Set(),opponents=new Map();
 for(const x of items){
  const {m,row,gameKey}=x,ix=m.ix;
  t.games.add(gameKey);files.add(m.src.name);
  const usage=ix.usage>=0?String(row[ix.usage]??''):'';
  if(/先発/.test(usage))t.starts.add(gameKey);else t.relief.add(gameKey);
  t.outs+=ix.innings>=0?inningsToOuts(row[ix.innings]):0;
  for(const [k,key] of [['win','win'],['loss','loss'],['save','save'],['batters','batters'],['pitches','pitches'],['balls','balls'],['strikes','strikes'],['hits','hits'],['runs','runs'],['earned','earned'],['walks','walks'],['so','so'],['hbp','hbp'],['hr','hr'],['wp','wp'],['balk','balk']]){
   const ci=ix[key];if(ci>=0)t[k]+=num(row[ci]);
  }
  const opp=ix.opponent>=0?String(row[ix.opponent]??'').trim():'';
  if(opp){
   if(!opponents.has(opp))opponents.set(opp,[]);
   opponents.get(opp).push(x);
  }
 }
 const innings=t.outs/3;
 const values={
  games:t.games.size,starts:t.starts.size,relief:t.relief.size,w:t.win,l:t.loss,sv:t.save,
  ip:fmtInn(t.outs),outs:t.outs,bf:t.batters,pitches:t.pitches,balls:t.balls,strikes:t.strikes,
  h:t.hits,runs:t.runs,er:t.earned,bb:t.walks,hbp:t.hbp,k:t.so,hr:t.hr,wp:t.wp,balk:t.balk,
  era:t.outs?t.earned*21/t.outs:'',whip:t.outs?(t.hits+t.walks)/innings:'',
  k7:t.outs?t.so*7/innings:'',bb7:t.outs?t.walks*7/innings:'',
  strikePct:t.pitches?t.strikes/t.pitches:''
 };
 const opponentRows=withOpp?[...opponents].map(([label,rows])=>({label,values:aggregate(rows,false)?.values||{}})).sort((a,b)=>(b.values.games||0)-(a.values.games||0)||a.label.localeCompare(b.label,'ja')):[];
 return{values,files:[...files],opponentRows};
}
function latestSix(metas){
 const all=[];
 for(const m of metas)for(const g of m.games)if(g.practice)all.push(g);
 const seen=new Map();
 for(const g of all)if(!seen.has(g.key))seen.set(g.key,g);
 return[...seen.values()].sort((a,b)=>b.rank-a.rank||b.seq-a.seq||b.season.localeCompare(a.season)).slice(0,6);
}
function collect(q,metas){
 const targets=findTargets(q,metas);
 if(!targets.length)return{error:'対象選手を投手詳細から特定できませんでした。選手名をフルネームで入力してください。'};
 if(targets.length>1&&/比較|比べ/.test(q))return{error:'複数投手の比較は「審議」ではなく比較表として扱う必要があります。現在は1名ずつの投手成績照会に対応しています。'};
 const target=targets[0],wanted=explicitSeason(q),recentOnly=/直近|最近/.test(q),bySeason=new Map();let all=[];
 for(const m of metas){const rr=playerRows(m,target);if(rr.length){bySeason.set(m.src.season,rr);all=all.concat(rr)}}
 if(wanted){
  const rows=(bySeason.get(wanted)||[]).slice();
  if(!rows.length)return{error:`${target}の${wanted}年度投手成績はありません。`};
  const agg=aggregate(rows);return{target,mode:'season',wanted,records:[{label:wanted,isCareer:false,...agg}]};
 }
 const six=latestSix(metas),sixKeys=new Set(six.map(g=>g.key)),recentRows=all.filter(x=>sixKeys.has(x.gameKey)),recent=aggregate(recentRows);
 if(recentOnly){
  if(!recent)return{error:`${target}はチーム直近6試合（練習試合）に登板していません。`};
  return{target,mode:'recent',wanted:'直近6試合',records:[{label:'直近6試合',isRecent:true,recentGames:six,...recent}]};
 }
 if(!all.length)return{error:`${target}の投手成績は投手詳細にありません。`};
 const ys=[...bySeason.keys()].sort(),career=aggregate(all);
 const records=[{label:'全年度通算',isCareer:true,...career}];
 if(recent)records.push({label:'直近6試合',isRecent:true,recentGames:six,...recent});
 for(const y of ys)records.push({label:y,isCareer:false,...aggregate(bySeason.get(y))});
 return{target,mode:'career',records};
}

const METRICS=[
 ['games','登板','int'],['starts','先発','int'],['relief','救援','int'],['w','勝利','int'],['l','敗戦','int'],['sv','セーブ','int'],
 ['ip','投球回','ip'],['bf','対打者','int'],['pitches','投球数','int'],['h','被安打','int'],['runs','失点','int'],['er','自責点','int'],
 ['bb','与四球','int'],['hbp','与死球','int'],['k','奪三振','int'],['hr','被本塁打','int'],['wp','暴投','int'],['balk','ボーク','int'],
 ['era','防御率','rate2'],['whip','WHIP','rate2'],['k7','奪三振率','rate2'],['bb7','与四球率','rate2'],['strikePct','ストライク率','rate3']
];
const BREAKDOWN=[
 ['games','登板','int'],['starts','先発','int'],['w','勝','int'],['l','敗','int'],['sv','S','int'],['ip','投球回','ip'],
 ['h','被安打','int'],['er','自責点','int'],['bb','与四球','int'],['k','奪三振','int'],['era','防御率','rate2'],['whip','WHIP','rate2']
];
function opponentMarkup(list){
 if(!list?.length)return'';
 const head=BREAKDOWN.map(([,l])=>`<th>${esc(l)}</th>`).join('');
 const body=list.map(row=>`<tr><th>${esc(row.label)}</th>${BREAKDOWN.map(([k,,t])=>`<td>${esc(fmt(row.values[k],t))}</td>`).join('')}</tr>`).join('');
 return`<section class="statsBreakdown"><div class="statsBreakdownHead"><b>相手校別投手成績</b><span>投手詳細から再集計</span></div><div class="statsTableWrap"><table class="statsBreakdownTable"><thead><tr><th>相手校</th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}
function reportMarkup(result){
 const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
 const sections=result.records.map(rec=>{
  const v=rec.values;
  const featured=[['era','防御率','rate2'],['ip','投球回','ip'],['k','奪三振','int'],['whip','WHIP','rate2']].map(([k,l,t])=>`<div class="statsFeature"><span>${l}</span><b>${esc(fmt(v[k],t))}</b></div>`).join('');
  const cells=METRICS.map(([k,l,t])=>`<div class="statsMetric"><span>${l}</span><b>${esc(fmt(v[k],t))}</b></div>`).join('');
  const type=rec.isCareer?'CAREER':rec.isRecent?'RECENT':'SEASON';
  const badge=rec.isCareer?'全年度再集計':rec.isRecent?`チーム直近6試合中 ${v.games}登板`:'年度別';
  const opponent=(rec.isCareer||result.mode==='season')?opponentMarkup(rec.opponentRows):'';
  const label=rec.isCareer?'選手通算投手成績':rec.isRecent?'直近6試合投手成績（練習試合のみ）':'年度投手成績';
  return`<section class="statsSeason"><div class="statsSeasonHead"><div><span>${type}</span><b>${esc(rec.label)}</b></div><div class="statsVerified">${esc(badge)}</div></div><div class="statsSectionLabel">${label}</div><div class="statsFeatured">${featured}</div><div class="statsMetrics">${cells}</div><div class="statsSource"><b>参照元</b> ${esc((rec.files||[]).join('・'))} / 投手詳細から再集計</div>${opponent}</section>`;
 }).join('');
 const sub=result.mode==='career'?'選手通算・直近6試合・年度別・相手校別 投手成績':result.mode==='recent'?'チーム直近6試合 投手成績（練習試合のみ）':`${result.wanted}年度・相手校別 投手成績`;
 return`<article id="statsPdfSource" class="statsPaper"><header class="statsHeader"><div class="statsBrand"><img src="/magi-official-symbol-v125.svg?v=140" alt=""><div><b>MAGI DATA REPORT</b><span>Maruoka Advanced Game Intelligence</span></div></div><div class="statsIssue">発行 ${date}</div></header><div class="statsTitle"><span>PLAYER PITCHING RECORD</span><h2>${esc(result.target)}</h2><p>${esc(sub)}</p></div>${sections}<footer class="statsFooter"><b>《MAGI》</b><span>丸岡中学校軟式野球部 データ資料</span><small>投球回はアウト数へ変換して合算し、防御率・WHIP・奪三振率・与四球率を再計算しています。防御率は7回制です。直近6試合はチーム全体の最新6練習試合を基準とし、その中で対象投手が登板した試合だけを集計しています。</small></footer></article>`;
}
function panel(){
 let p=document.getElementById('statsLookupPanel');if(p)return p;
 const response=document.getElementById('response'),card=document.querySelector('#judge .card');
 p=document.createElement('div');p.id='statsLookupPanel';p.className='statsLookupPanel';
 if(response)response.parentNode.insertBefore(p,response);else card?.parentNode.appendChild(p);
 return p;
}
function router(){
 const v=document.getElementById('routeValue'),h=document.getElementById('routeHelp'),b=document.getElementById('routeBadge');
 if(v)v.textContent='投手成績照会＋配布用PDF';
 if(h)h.textContent='質問内容から投手成績の照会と判断依頼を分け、照会時は通算・年度別・チーム直近6試合・相手校別を表示します。';
 if(b)b.textContent='PITCH';
}
function directDone(){
 const judge=document.getElementById('judge');if(judge)judge.classList.remove('running');
 const btn=document.querySelector('button[onclick*="runMagi"]');if(btn){btn.disabled=false;if(/審議中|照会中/.test(btn.textContent||''))btn.textContent='MAGI実行'}
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let x;while(x=walker.nextNode()){
  if(x.nodeValue.includes('審議を開始しました'))x.nodeValue=x.nodeValue.replace(/審議を開始しました/g,'成績照会を開始しました');
  if(x.nodeValue.includes('審議完了'))x.nodeValue=x.nodeValue.replace(/審議完了/g,'照会完了');
  if(x.nodeValue.includes('FINAL DECISION'))x.nodeValue=x.nodeValue.replace(/FINAL DECISION/g,'DATA RESULT');
 }
}
function render(result){
 const p=panel();
 p.innerHTML=reportMarkup(result)+`<div class="statsPdfActions"><button id="pitchPreview" class="statsPdfButton" type="button">A4プレビュー</button><button id="pitchPdf" class="secondary" type="button">PDF保存プレビュー</button><div class="statsPdfState">質問内容に合わせた投手成績を表示しています。</div></div>`;
 p.classList.add('show');document.getElementById('response')?.classList.remove('show');
 document.getElementById('pitchPreview')?.addEventListener('click',()=>window.MAGI_PREVIEW_STATS_REPORT?.());
 document.getElementById('pitchPdf')?.addEventListener('click',()=>window.MAGI_PRINT_STATS_REPORT?.());
 const status=document.getElementById('status');if(status)status.textContent=`${result.target}の${result.mode==='career'?'通算':result.mode==='recent'?'直近6試合':'年度別'}投手成績を表示しました。`;
 const query=(document.getElementById('q')?.value||'').trim();
 try{if(typeof FINAL!=='undefined')FINAL.lookup='成績照会';if(query&&typeof saveHistory==='function')saveHistory(query,'lookup')}catch(_){}
 directDone();setTimeout(directDone,200);p.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderError(msg){
 const p=panel();p.innerHTML=`<div class="statsError"><b>投手成績照会を完了できませんでした</b><p>${esc(msg)}</p></div>`;p.classList.add('show');
 directDone();
}
async function runDirect(query){
 router();
 const status=document.getElementById('status');if(status)status.textContent='投手成績照会：投手詳細データを確認しています…';
 try{
  const metas=(await Promise.all(sources().map(async src=>meta(src,await fetchTable(src))))).filter(Boolean);
  const result=collect(query,metas);
  if(result.error){renderError(result.error);return}
  render(result);
 }catch(e){
  console.warn('[MAGI pitching direct v317]',e?.message||e);
  renderError('投手詳細データを取得できませんでした。もう一度実行してください。');
 }
}
function install(){
 const q=document.getElementById('q');
 if(q&&!q.__magiPitchRouteV317){
  q.__magiPitchRouteV317=true;
  q.addEventListener('input',()=>{if(isPitchLookup(q.value))router()});
 }
 if(typeof window.runMagi!=='function'||window.runMagi.__magiPitchingDirectV317)return false;
 const original=window.runMagi;
 const wrapped=function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(!isPitchLookup(query))return original.apply(this,args);
  return runDirect(query);
 };
 wrapped.__magiPitchingDirectV317=true;
 wrapped.__magiPitchOriginal=original;
 window.runMagi=wrapped;
 window.MAGI_PITCH_DIRECT_FN=wrapped;
 return true;
}
let tries=0;
const timer=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(timer)},100);
install();
setTimeout(()=>{Promise.allSettled(sources().map(fetchTable))},1200);
})();