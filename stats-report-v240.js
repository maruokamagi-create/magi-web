(()=>{
'use strict';
if(window.MAGI_STATS_REPORT_V240)return;
const VERSION='v240';
const NAME_ALIASES=['選手名','氏名','名前','選手'];
const METRICS=[
 {key:'games',label:'試合',aliases:['試合数','出場試合','試合'],kind:'int'},
 {key:'pa',label:'打席',aliases:['打席数','打席','pa'],kind:'int'},
 {key:'ab',label:'打数',aliases:['打数','ab'],kind:'int'},
 {key:'runs',label:'得点',aliases:['得点'],kind:'int'},
 {key:'h',label:'安打',aliases:['安打','h'],kind:'int'},
 {key:'single',label:'単打',aliases:['単打'],kind:'int'},
 {key:'double',label:'二塁打',aliases:['二塁打','2b'],kind:'int'},
 {key:'triple',label:'三塁打',aliases:['三塁打','3b'],kind:'int'},
 {key:'hr',label:'本塁打',aliases:['本塁打','hr'],kind:'int'},
 {key:'rbi',label:'打点',aliases:['打点','rbi'],kind:'int'},
 {key:'sb',label:'盗塁',aliases:['盗塁','sb'],kind:'int'},
 {key:'bb',label:'四球',aliases:['四球','bb'],kind:'int'},
 {key:'hbp',label:'死球',aliases:['死球','hbp'],kind:'int'},
 {key:'so',label:'三振',aliases:['三振','so','k'],kind:'int'},
 {key:'avg',label:'打率',aliases:['打率','avg'],kind:'rate'},
 {key:'obp',label:'出塁率',aliases:['出塁率','obp'],kind:'rate'},
 {key:'slg',label:'長打率',aliases:['長打率','slg'],kind:'rate'},
 {key:'ops',label:'OPS',aliases:['ops'],kind:'rate'}
];
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const rows=()=>((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
function idx(r,aliases){
 const cs=r?.columns||[],want=aliases.map(n);
 for(let i=0;i<cs.length;i++)if(want.includes(n(cs[i])))return i;
 for(let i=0;i<cs.length;i++)if(want.some(x=>x&&n(cs[i])===x))return i;
 return-1;
}
function raw(r,aliases){const i=idx(r,aliases);return i<0?'':String((r?.values||[])[i]??'').trim()}
function player(r){return raw(r,NAME_ALIASES)}
function season(r){
 const s=String(`${r?.fileName||''} ${r?.sheetName||''}`);
 if(/2025\s*[-–—_. /]?\s*2026|旧チーム/i.test(s))return'2025-2026';
 if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(s))return'2026-2027';
 return'';
}
function explicitSeason(q){
 if(/2025\s*[-–—_. /]?\s*2026|旧チーム/i.test(q))return'2025-2026';
 if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(q))return'2026-2027';
 return'';
}
function isLookup(q){
 q=String(q||'');
 const stat=/通算|打撃成績|成績|打率|出塁率|長打率|OPS|安打|本塁打|打点|盗塁|三振/i.test(q);
 const request=/出して|教えて|見せて|知りたい|表示|一覧|何|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return stat&&request&&!decision;
}
function findTarget(q,all){
 const z=n(q),names=[];
 for(const r of all){const p=player(r),k=n(p);if(p&&k.length>=2&&z.includes(k)&&!names.some(x=>n(x)===k))names.push(p)}
 return names.sort((a,b)=>n(b).length-n(a).length)[0]||'';
}
function statRecord(r){
 const values={};
 for(const m of METRICS)values[m.key]=raw(r,m.aliases);
 return values;
}
function completeness(r){return METRICS.reduce((s,m)=>s+(raw(r,m.aliases)!==''?1:0),0)}
function candidateScore(r,y){
 const f=String(r?.fileName||''),s=String(r?.sheetName||''),all=`${f} ${s}`;
 let score=completeness(r)*2;
 if(/通算成績一覧/i.test(f))score+=100;
 if(/丸岡中.*軟式野球部/i.test(f))score+=20;
 if(/個人成績|打撃成績|打者成績|打撃/i.test(s))score+=18;
 if(/打撃詳細|投手詳細|試合別/i.test(all))score-=180;
 if(season(r)===y)score+=15;
 return score;
}
function collect(q){
 const all=rows(),target=findTarget(q,all);
 if(!target)return{error:'対象選手をDrive資料から特定できませんでした。選手名をフルネームで入力してください。'};
 const wanted=explicitSeason(q),np=n(target);
 let mine=all.filter(r=>n(player(r))===np&&season(r)&&raw(r,['打率','avg'])!==''&&!/打撃詳細|投手詳細/i.test(`${r.fileName||''} ${r.sheetName||''}`));
 if(wanted)mine=mine.filter(r=>season(r)===wanted);
 if(!mine.length)return{error:`${target}の${wanted||'通算'}打撃成績をDrive正本から取得できませんでした。`};
 const ys=[...new Set(mine.map(season))].sort();
 const records=ys.map(y=>{
  const ranked=mine.filter(r=>season(r)===y).map(r=>({r,score:candidateScore(r,y)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0]?.r;
  return{season:y,source:best?.fileName||'',sheet:best?.sheetName||'',values:statRecord(best),row:best};
 }).filter(x=>x.row);
 return{target,records};
}
function fmt(v,kind){
 const s=String(v??'').trim();
 if(!s||s==='-'||s==='—')return'—';
 const x=Number(s.replace(/,/g,''));
 if(!Number.isFinite(x))return s;
 if(kind==='rate')return x>=0&&x<10?x.toFixed(3).replace(/^0(?=\.)/,''):String(x);
 return Number.isInteger(x)?String(x):String(x);
}
function reportMarkup(result){
 const generated=new Date(),date=`${generated.getFullYear()}年${generated.getMonth()+1}月${generated.getDate()}日`;
 const sections=result.records.map(rec=>{
  const featured=['avg','obp','slg','ops'].map(k=>{const m=METRICS.find(x=>x.key===k);return`<div class="statsFeature"><span>${esc(m.label)}</span><b>${esc(fmt(rec.values[k],m.kind))}</b></div>`}).join('');
  const cells=METRICS.map(m=>`<div class="statsMetric"><span>${esc(m.label)}</span><b>${esc(fmt(rec.values[m.key],m.kind))}</b></div>`).join('');
  const source=rec.source+(rec.sheet?` / ${rec.sheet}`:'');
  return`<section class="statsSeason"><div class="statsSeasonHead"><div><span>SEASON</span><b>${esc(rec.season)}</b></div><div class="statsVerified">DRIVE正本参照</div></div><div class="statsFeatured">${featured}</div><div class="statsMetrics">${cells}</div><div class="statsSource"><b>参照元</b> ${esc(source)}</div></section>`;
 }).join('');
 return`<article id="statsPdfSource" class="statsPaper"><header class="statsHeader"><div class="statsBrand"><img src="/magi-official-symbol-v125.svg?v=140" alt=""><div><b>MAGI DATA REPORT</b><span>Maruoka Advanced Game Intelligence</span></div></div><div class="statsIssue">発行 ${esc(date)}</div></header><div class="statsTitle"><span>PLAYER BATTING RECORD</span><h2>${esc(result.target)}</h2><p>通算打撃成績</p></div>${sections}<footer class="statsFooter"><b>《MAGI》</b><span>丸岡中学校軟式野球部 データ資料</span><small>本資料はGoogle Drive正本の記録を表示しています。推測値は使用していません。</small></footer></article>`;
}
function ensureUi(){
 let panel=document.getElementById('statsLookupPanel');
 if(panel)return panel;
 const response=document.getElementById('response'),card=document.querySelector('#judge .card');
 panel=document.createElement('div');panel.id='statsLookupPanel';panel.className='statsLookupPanel';
 if(response)response.parentNode.insertBefore(panel,response);else card?.parentNode.appendChild(panel);
 return panel;
}
function setRouter(){
 const q=document.getElementById('q')?.value||'';
 if(!isLookup(q))return;
 const v=document.getElementById('routeValue'),h=document.getElementById('routeHelp'),b=document.getElementById('routeBadge');
 if(v)v.textContent='成績照会＋配布用PDF';
 if(h)h.textContent='Drive正本から対象選手の成績を直接表示し、同じ内容のA4配布資料を作成します。3賢人審議は行いません。';
 if(b)b.textContent='DIRECT';
}
function loadPdfLib(){
 if(window.html2pdf)return Promise.resolve(window.html2pdf);
 if(window.MAGI_PDF_LIB_PROMISE)return window.MAGI_PDF_LIB_PROMISE;
 window.MAGI_PDF_LIB_PROMISE=new Promise((resolve,reject)=>{
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
  s.onload=()=>window.html2pdf?resolve(window.html2pdf):reject(new Error('PDFライブラリを開始できません'));
  s.onerror=()=>reject(new Error('PDFライブラリを読み込めません'));
  document.head.appendChild(s);
 });
 return window.MAGI_PDF_LIB_PROMISE;
}
function safeFileName(result){
 const y=result.records.map(x=>x.season).join('_');
 return`MAGI_${result.target.replace(/[\\/:*?"<>|\s　]/g,'')}_通算打撃成績_${y}.pdf`;
}
async function createPdf(result){
 const state=document.getElementById('statsPdfState'),link=document.getElementById('statsPdfLink'),source=document.getElementById('statsPdfSource');
 if(!state||!link||!source)return;
 state.textContent='配布用PDFを作成しています…';
 link.classList.add('hidden');
 try{
  const html2pdf=await loadPdfLib();
  const worker=html2pdf().set({
   margin:[7,7,7,7],filename:safeFileName(result),
   image:{type:'jpeg',quality:.98},
   html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false},
   jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
   pagebreak:{mode:['avoid-all','css','legacy']}
  }).from(source);
  const blob=await worker.outputPdf('blob');
  if(window.MAGI_STATS_PDF_URL)URL.revokeObjectURL(window.MAGI_STATS_PDF_URL);
  window.MAGI_STATS_PDF_URL=URL.createObjectURL(blob);
  link.href=window.MAGI_STATS_PDF_URL;link.download=safeFileName(result);link.target='_blank';
  link.classList.remove('hidden');state.textContent='PDFの準備ができました。iPhoneでは開いた後、共有ボタンから保存・送信できます。';
 }catch(e){
  state.textContent='自動PDFを作成できませんでした。「印刷・PDF保存」を使用してください。';
  console.warn('[MAGI stats PDF]',e);
 }
}
function printReport(){
 const source=document.getElementById('statsPdfSource');if(!source)return;
 const w=window.open('','_blank');if(!w)return;
 w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MAGI DATA REPORT</title><style>body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#07172d}.statsPaper{padding:12mm}.statsHeader,.statsBrand,.statsSeasonHead{display:flex;align-items:center;justify-content:space-between}.statsBrand img{width:18mm;height:18mm}.statsBrand div{margin-left:4mm}.statsBrand b{display:block;font-size:18px}.statsBrand span,.statsIssue,.statsTitle span,.statsSource,.statsFooter small{font-size:10px;color:#617086}.statsTitle{margin:10mm 0 5mm;border-bottom:4px solid #8d1420}.statsTitle h2{font-size:32px;margin:2mm 0}.statsTitle p{font-weight:800}.statsSeason{margin-top:6mm}.statsSeasonHead{background:#071b36;color:#fff;padding:3mm}.statsSeasonHead span{font-size:9px;display:block}.statsSeasonHead b{font-size:18px}.statsVerified{font-size:10px}.statsFeatured,.statsMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-top:3mm}.statsFeature,.statsMetric{border:1px solid #d6dfe8;padding:3mm}.statsFeature{background:#edf3f8}.statsFeature span,.statsMetric span{font-size:9px;color:#617086;display:block}.statsFeature b{font-size:24px}.statsMetric b{font-size:16px}.statsSource{margin-top:3mm}.statsFooter{border-top:1px solid #bcc8d4;margin-top:8mm;padding-top:3mm}.statsFooter b,.statsFooter span,.statsFooter small{display:block}@media print{@page{size:A4;margin:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${source.outerHTML}<script>setTimeout(()=>window.print(),300)<\/script></body></html>`);
 w.document.close();
}
function renderError(msg){
 const panel=ensureUi();panel.innerHTML=`<div class="statsError"><b>成績照会を完了できませんでした</b><p>${esc(msg)}</p></div>`;panel.classList.add('show');
 document.getElementById('response')?.classList.remove('show');
 const status=document.getElementById('status');if(status)status.textContent='成績照会：資料を確認してください。';
}
function render(result){
 const panel=ensureUi();
 panel.innerHTML=reportMarkup(result)+`<div class="statsPdfActions"><a id="statsPdfLink" class="statsPdfButton hidden" href="#">PDFを開く・共有</a><button id="statsPrintButton" class="secondary" type="button">印刷・PDF保存</button><div id="statsPdfState" class="statsPdfState">配布用PDFを準備しています…</div></div>`;
 panel.classList.add('show');document.getElementById('response')?.classList.remove('show');
 document.getElementById('statsPrintButton')?.addEventListener('click',printReport);
 const status=document.getElementById('status');if(status)status.textContent=`${result.target}の通算打撃成績をDrive正本から表示しました。配布用PDFも同時に作成しています。`;
 panel.scrollIntoView({behavior:'smooth',block:'start'});
 createPdf(result);
}
function installStyles(){
 if(document.getElementById('magi-stats-report-v240-style'))return;
 const s=document.createElement('style');s.id='magi-stats-report-v240-style';s.textContent=`
 .statsLookupPanel{display:none;margin-top:14px}.statsLookupPanel.show{display:block}.statsPaper{background:#f8fafc;color:#07172d;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.statsHeader{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;background:#071b36;color:#fff;border-bottom:6px solid #8d1420}.statsBrand{display:flex;align-items:center;gap:11px}.statsBrand img{width:54px;height:54px;object-fit:contain}.statsBrand b{display:block;font-size:19px;letter-spacing:.08em}.statsBrand span{display:block;margin-top:3px;color:#b8caDC;font-size:10px}.statsIssue{color:#d3deea;font-size:11px}.statsTitle{padding:22px 20px 14px}.statsTitle span{font-size:10px;letter-spacing:.18em;color:#8d1420;font-weight:900}.statsTitle h2{margin:5px 0 0;font-size:34px;letter-spacing:.06em}.statsTitle p{margin:2px 0 0;font-size:15px;font-weight:900;color:#42566e}.statsSeason{margin:0 20px 18px;border:1px solid #cad6e1;border-radius:13px;overflow:hidden;background:#fff;break-inside:avoid}.statsSeasonHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;background:#0a2748;color:#fff}.statsSeasonHead span{display:block;font-size:9px;letter-spacing:.16em;color:#9fc1df}.statsSeasonHead b{display:block;font-size:19px}.statsVerified{font-size:10px;padding:6px 8px;border:1px solid #477395;border-radius:999px}.statsFeatured{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 12px 4px}.statsFeature{padding:12px 10px;background:#edf3f8;border-left:4px solid #8d1420;border-radius:8px}.statsFeature span,.statsMetric span{display:block;color:#607188;font-size:10px;font-weight:800}.statsFeature b{display:block;margin-top:4px;font-size:24px}.statsMetrics{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px 12px 12px}.statsMetric{padding:9px 7px;border:1px solid #d5dee7;border-radius:7px;background:#fafcfe}.statsMetric b{display:block;margin-top:3px;font-size:15px}.statsSource{padding:9px 12px;border-top:1px solid #dce4eb;color:#5b6d82;font-size:9px;line-height:1.5}.statsSource b{color:#253a52}.statsFooter{padding:14px 20px 18px;background:#eef3f7;border-top:1px solid #ccd7e1}.statsFooter b,.statsFooter span,.statsFooter small{display:block}.statsFooter b{font-size:15px}.statsFooter span{font-size:11px;font-weight:800;margin-top:2px}.statsFooter small{font-size:9px;color:#65758a;margin-top:5px}.statsPdfActions{margin-top:10px;padding:13px;border:1px solid #294868;border-radius:13px;background:#0a1b2e;display:flex;align-items:center;gap:9px;flex-wrap:wrap}.statsPdfButton{display:inline-block;padding:12px 15px;border-radius:11px;background:#f3f7fb;color:#07111f;text-decoration:none;font-size:13px;font-weight:900;min-height:44px}.statsPdfState{flex:1 1 260px;color:#a9bdd0;font-size:11px;line-height:1.55}.statsError{padding:16px;border:1px solid #71313b;border-left:5px solid #cf1f2e;border-radius:13px;background:#32151b;color:#ffdbe0}.statsError p{font-size:13px;line-height:1.6}.statsPdfButton.hidden{display:none}
 @media(max-width:640px){.statsHeader{padding:14px}.statsBrand img{width:44px;height:44px}.statsBrand b{font-size:15px}.statsBrand span{font-size:8px}.statsIssue{font-size:9px}.statsTitle{padding:17px 14px 10px}.statsTitle h2{font-size:29px}.statsSeason{margin:0 12px 14px}.statsFeatured{grid-template-columns:repeat(2,1fr)}.statsMetrics{grid-template-columns:repeat(3,1fr)}.statsPdfActions>a,.statsPdfActions>button{flex:1 1 140px;text-align:center}}
 `;document.head.appendChild(s);
}
function install(){
 installStyles();
 const q=document.getElementById('q');if(q&&!q.__magiStatsRoute){q.__magiStatsRoute=true;q.addEventListener('input',()=>setTimeout(setRouter,0))}
 if(typeof window.runMagi!=='function'||window.MAGI_STATS_REPORT_FN===window.runMagi)return false;
 const original=window.runMagi;
 const wrapped=function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(!isLookup(query)){document.getElementById('statsLookupPanel')?.classList.remove('show');return original.apply(this,args)}
  setRouter();
  const result=collect(query);if(result.error){renderError(result.error);return}
  render(result);
 };
 window.runMagi=wrapped;window.MAGI_STATS_REPORT_FN=wrapped;window.MAGI_STATS_REPORT_WRAPPED=VERSION;return true;
}
window.MAGI_PRINT_STATS_REPORT=printReport;
window.MAGI_STATS_REPORT_V240=true;
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>300)clearInterval(timer)},100);
install();
})();