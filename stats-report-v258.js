(()=>{
'use strict';
if(window.MAGI_STATS_REPORT_V258)return;
const VERSION='v258';
const NAME_ALIASES=['選手名','氏名','名前','選手'];
const METRICS=[
 {key:'games',label:'試合',aliases:['出場試合数','出場試合','試合数','出場数','games','game','試合'],kind:'int'},
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
 {key:'ops',label:'OPS',aliases:['ops'],kind:'rate'},
 {key:'rispAvg',label:'得点圏打率',aliases:['得点圏','得点圏打率'],kind:'rate'}
];
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const rows=()=>((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
function idx(r,aliases){
 const cs=r?.columns||[],want=aliases.map(n);
 for(let i=0;i<cs.length;i++)if(want.includes(n(cs[i])))return i;
 for(let i=0;i<cs.length;i++){const col=n(cs[i]);if(want.some(x=>x&&x.length>=2&&col.includes(x)))return i;}
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
 const request=/出して|教えて|見せて|知りたい|表示|一覧|何|直近|最近|は[？?]?$/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|打順|起用|固定|ベストオーダー|スタメン|クリーンナップ|中軸|主軸/i.test(q);
 return stat&&request&&!decision;
}
function findTarget(q,all){
 const z=n(q),names=[];
 for(const r of all){const p=player(r),k=n(p);if(p&&k.length>=2&&z.includes(k)&&!names.some(x=>n(x)===k))names.push(p)}
 return names.sort((a,b)=>n(b).length-n(a).length)[0]||'';
}
function completeness(r){return METRICS.reduce((s,m)=>s+(raw(r,m.aliases)!==''?1:0),0)}
function isRispSheet(r){return /得点圏打率一覧/i.test(String(r?.sheetName||''))}
function isSegmentedSheet(r){
 const s=String(r?.sheetName||'');
 return /得点圏|相手校別|対戦相手別|相手別|打順別|守備位置別|イニング別|月別|球場別|左右別|カウント別|試合別|ピボット|打球傾向|打撃方向|打球方向/i.test(s);
}
function baseScore(r,y){
 const f=String(r?.fileName||''),s=String(r?.sheetName||'').trim();
 let score=completeness(r);
 if(/^打撃一覧$/i.test(s))score+=1400;
 else if(/^打率一覧$/i.test(s))score+=1000;
 else if(/^(?:通算)?打撃成績一覧$/i.test(s))score+=900;
 else if(/通算|個人成績|打者成績|選手別成績|総合成績/i.test(s))score+=500;
 if(/通算成績一覧/i.test(f))score+=150;
 if(season(r)===y)score+=20;
 return score;
}
function compositeRecord(candidates,y){
 const normal=candidates.filter(r=>!isSegmentedSheet(r)&&!isRispSheet(r));
 const base=[...normal].sort((a,b)=>baseScore(b,y)-baseScore(a,y))[0]||null;
 const risp=candidates.filter(isRispSheet).filter(r=>raw(r,['得点圏','得点圏打率'])!=='').sort((a,b)=>completeness(b)-completeness(a))[0]||null;
 const values={},sources={};
 for(const m of METRICS){
  const picked=m.key==='rispAvg'?risp:base;
  values[m.key]=picked?raw(picked,m.aliases):'';
  if(picked&&values[m.key]!=='')sources[m.key]={file:picked.fileName||'',sheet:picked.sheetName||''};
 }
 const sourceFiles=[...new Set(Object.values(sources).map(x=>x.file).filter(Boolean))];
 const sourceSheets=[...new Set(Object.values(sources).map(x=>x.sheet).filter(Boolean))];
 return{values,sources,sourceFiles,sourceSheets,baseRow:base,rispRow:risp};
}
const BREAKDOWN_METRICS=[
 {key:'games',label:'試合'},{key:'pa',label:'打席'},{key:'ab',label:'打数'},{key:'h',label:'安打'},{key:'runs',label:'得点'},{key:'rbi',label:'打点'},{key:'bb',label:'四球'},{key:'hbp',label:'死球'},{key:'sb',label:'盗塁'},{key:'avg',label:'打率'},{key:'obp',label:'出塁率'},{key:'slg',label:'長打率'},{key:'ops',label:'OPS'}
];
function nval(v){const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0}
function calculatedRates(values){
 const ab=nval(values.ab),h=nval(values.h),bb=nval(values.bb),hbp=nval(values.hbp),sf=nval(values.sf);
 const single=nval(values.single),double=nval(values.double),triple=nval(values.triple),hr=nval(values.hr);
 if(ab>0){values.avg=h/ab;values.slg=(single+2*double+3*triple+4*hr)/ab}
 const obpDen=ab+bb+hbp+sf;if(obpDen>0)values.obp=(h+bb+hbp)/obpDen;
 if(values.obp!==''&&values.slg!=='')values.ops=nval(values.obp)+nval(values.slg);
 return values;
}
function isPractice(r){const s=raw(r,['大会名','大会','試合種別']);return /練習試合/.test(s)&&!/公式戦/.test(s)}
function dateRank(v){
 const s=String(v??'').trim(),x=Number(s);if(Number.isFinite(x)&&s!=='')return x;
 const t=Date.parse(s.replace(/[年月]/g,'/').replace(/日/g,''));return Number.isFinite(t)?t:0;
}
function latestPracticeDates(all,sheetName){
 const dates=[...new Set(all.filter(r=>/\.xlsm$/i.test(String(r.fileName||''))&&String(r.sheetName||'').trim()===sheetName&&isPractice(r)).map(r=>raw(r,['開催日','日付'])).filter(Boolean))];
 return dates.sort((a,b)=>dateRank(b)-dateRank(a)).slice(0,3);
}
function aggregateBreakdown(all,target,y,type,selectedDates){
 const np=n(target),dim=type==='order'?['打順']:type==='opponent'?['相手校','対戦相手','対戦校']:null;
 const detail=all.filter(r=>/\.xlsm$/i.test(String(r.fileName||''))&&(!y||season(r)===y)&&/^打撃詳細$/i.test(String(r.sheetName||'').trim())&&n(player(r))===np&&(!selectedDates||(isPractice(r)&&selectedDates.includes(raw(r,['開催日','日付'])))));
 const groups=new Map();
 for(const r of detail){
  const label=type==='total'?'通算':raw(r,dim);if(!label)continue;
  if(!groups.has(label))groups.set(label,{games:new Set(),pa:0,ab:0,runs:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,sb:0,bb:0,hbp:0,so:0,sh:0,sf:0});
  const g=groups.get(label);
  const gameKey=[r.fileName||'',raw(r,['開催日','日付']),raw(r,['大会名']),raw(r,['試合順','試合']),raw(r,['相手校','対戦相手'])].join('|');
  g.games.add(gameKey);
  for(const m of [
   ['pa',['打席','打席数']],['ab',['打数']],['runs',['得点']],['h',['安打']],['single',['単打']],['double',['二塁打']],['triple',['三塁打']],['hr',['本塁打']],['rbi',['打点']],['sb',['盗塁']],['bb',['四球']],['hbp',['死球']],['so',['三振']],['sh',['犠打']],['sf',['犠飛']]
  ])g[m[0]]+=nval(raw(r,m[1]));
 }
 const out=[];
 for(const [label,g] of groups){
  const values={...g,games:g.games.size,avg:'',obp:'',slg:'',ops:''};delete values.gamesSet;
  calculatedRates(values);
  out.push({label,values,file:detail[0]?.fileName||'',sheet:'打撃詳細から再集計'});
 }
 return out.sort((a,b)=>type==='order'?nval(a.label)-nval(b.label):String(a.label).localeCompare(String(b.label),'ja'));
}
function collect(q){
 const all=rows(),target=findTarget(q,all);
 const recentOnly=/直近|最近/.test(String(q||''));
 if(!target)return{error:'対象選手をDrive資料から特定できませんでした。選手名をフルネームで入力してください。'};
 const wanted=explicitSeason(q),np=n(target);
 let mine=all.filter(r=>n(player(r))===np&&season(r)&&METRICS.some(m=>raw(r,m.aliases)!=='')&&!/打撃詳細|投手詳細/i.test(`${r.fileName||''} ${r.sheetName||''}`));
 let detailMine=all.filter(r=>n(player(r))===np&&season(r)&&/\.xlsm$/i.test(String(r.fileName||''))&&/^打撃詳細$/i.test(String(r.sheetName||'').trim()));
 if(wanted){mine=mine.filter(r=>season(r)===wanted);detailMine=detailMine.filter(r=>season(r)===wanted)}
 const xlsmRows=mine.filter(r=>/\.xlsm$/i.test(String(r.fileName||'')));
 if(xlsmRows.length)mine=xlsmRows;
 if(!mine.length&&!detailMine.length)return{error:`${target}の${wanted||'全年度'}打撃成績をDrive正本のxlsmから取得できませんでした。`};
 const recentDates=latestPracticeDates(all,'打撃詳細');
 const recentTotal=aggregateBreakdown(all,target,null,'total',recentDates)[0]||null;
 const recentRecord=recentTotal?{season:'直近6試合',isRecent:true,values:{...recentTotal.values,rispAvg:''},sources:{},sourceFiles:[...new Set(detailMine.filter(r=>isPractice(r)&&recentDates.includes(raw(r,['開催日','日付']))).map(r=>r.fileName).filter(Boolean))],sourceSheets:['打撃詳細から再集計'],baseRow:recentTotal,rispRow:null,orderRows:[],opponentRows:[],row:recentTotal,suppressBreakdown:true,recentDates}:null;
 if(recentOnly){
  if(!recentRecord)return{error:`${target}の直近6試合（練習試合のみ）の打撃記録はありません。`};
  return{target,records:[recentRecord],mode:'recent',wanted:'直近6試合'};
 }
 const ys=[...new Set([...mine,...detailMine].map(season).filter(Boolean))].sort();
 const seasonRecords=ys.map(y=>{
  const candidates=mine.filter(r=>season(r)===y),total=aggregateBreakdown(all,target,y,'total')[0]||null;
  const risp=candidates.filter(isRispSheet).filter(r=>raw(r,['得点圏','得点圏打率'])!=='').sort((a,b)=>completeness(b)-completeness(a))[0]||null;
  const values=total?{...total.values}:{};values.rispAvg=risp?raw(risp,['得点圏','得点圏打率']):'';
  const sources={};
  for(const m of METRICS){
   if(m.key==='rispAvg'&&risp&&values[m.key]!=='')sources[m.key]={file:risp.fileName||'',sheet:risp.sheetName||''};
   else if(total&&values[m.key]!==''&&values[m.key]!==undefined)sources[m.key]={file:total.file||'',sheet:'打撃詳細から年度再集計'};
  }
  const sourceFiles=[...new Set(Object.values(sources).map(x=>x.file).filter(Boolean))],sourceSheets=[...new Set(Object.values(sources).map(x=>x.sheet).filter(Boolean))];
  return{season:y,values,sources,sourceFiles,sourceSheets,baseRow:total,rispRow:risp,orderRows:aggregateBreakdown(all,target,y,'order'),opponentRows:aggregateBreakdown(all,target,y,'opponent'),row:total||risp||candidates[0]||null};
 }).filter(x=>x.row);
 if(wanted)return{target,records:seasonRecords,mode:'season',wanted};
 const total=aggregateBreakdown(all,target,null,'total')[0]||null;
 if(!total)return{target,records:seasonRecords,mode:'season'};
 const values={...total.values,rispAvg:''},detailFiles=[...new Set(detailMine.map(r=>r.fileName).filter(Boolean))];
 const sources={};for(const m of METRICS)if(m.key!=='rispAvg')sources[m.key]={file:detailFiles.join('・'),sheet:'打撃詳細から全年度再集計'};
 const career={season:'全年度通算',isCareer:true,values,sources,sourceFiles:detailFiles,sourceSheets:['打撃詳細から全年度再集計'],baseRow:total,rispRow:null,orderRows:aggregateBreakdown(all,target,null,'order'),opponentRows:aggregateBreakdown(all,target,null,'opponent'),row:total};
 return{target,records:[career,...(recentRecord?[recentRecord]:[]),...seasonRecords.map(r=>({...r,suppressBreakdown:true}))],mode:'career',wanted:''};
}
function fmt(v,kind){
 const s=String(v??'').trim();
 if(!s||s==='-'||s==='—')return'—';
 const x=Number(s.replace(/,/g,''));
 if(!Number.isFinite(x))return s;
 if(kind==='rate')return x>=0&&x<10?x.toFixed(3).replace(/^0(?=\.)/,''):String(x);
 return Number.isInteger(x)?String(x):String(x);
}
function breakdownMarkup(title,labelTitle,list){
 if(!list||!list.length)return`<section class="statsBreakdown"><div class="statsBreakdownHead"><b>${esc(title)}</b><span>該当データなし</span></div></section>`;
 const head=BREAKDOWN_METRICS.map(m=>`<th>${esc(m.label)}</th>`).join('');
 const body=list.map(row=>`<tr><th>${esc(row.label)}</th>${BREAKDOWN_METRICS.map(m=>{const def=METRICS.find(x=>x.key===m.key);return`<td>${esc(fmt(row.values[m.key],def?.kind||'int'))}</td>`}).join('')}</tr>`).join('');
 const source=[...new Set(list.map(x=>x.sheet).filter(Boolean))].join('・');
 return`<section class="statsBreakdown"><div class="statsBreakdownHead"><b>${esc(title)}</b><span>${esc(source)}</span></div><div class="statsTableWrap"><table class="statsBreakdownTable"><thead><tr><th>${esc(labelTitle)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}
function reportMarkup(result){
 const generated=new Date(),date=`${generated.getFullYear()}年${generated.getMonth()+1}月${generated.getDate()}日`;
 const sections=result.records.map(rec=>{
  const featured=['avg','obp','slg','ops'].map(k=>{const m=METRICS.find(x=>x.key===k);return`<div class="statsFeature"><span>${esc(m.label)}</span><b>${esc(fmt(rec.values[k],m.kind))}</b></div>`}).join('');
  const cells=METRICS.map(m=>`<div class="statsMetric"><span>${esc(m.label)}</span><b>${esc(fmt(rec.values[m.key],m.kind))}</b></div>`).join('');
  const files=(rec.sourceFiles||[]).join('・')||'Drive正本',sheets=(rec.sourceSheets||[]).join('・');
  const source=files+(sheets?` / ${sheets}`:'');
  const order=rec.suppressBreakdown?'':breakdownMarkup('打順別成績','打順',rec.orderRows);
  const opponent=rec.suppressBreakdown?'':breakdownMarkup('相手校別成績','相手校',rec.opponentRows);
  const headType=rec.isCareer?'CAREER':rec.isRecent?'RECENT':'SEASON',headLabel=rec.isCareer?'全年度通算':rec.season,badge=rec.isCareer?'全年度再集計':rec.isRecent?'練習試合のみ':'年度別';
  const sectionLabel=rec.isCareer?'選手通算成績':rec.isRecent?'直近6試合成績（練習試合のみ）':'年度成績';
  return`<section class="statsSeason"><div class="statsSeasonHead"><div><span>${headType}</span><b>${esc(headLabel)}</b></div><div class="statsVerified">${badge}</div></div><div class="statsSectionLabel">${sectionLabel}</div><div class="statsFeatured">${featured}</div><div class="statsMetrics">${cells}</div><div class="statsSource"><b>参照元</b> ${esc(source)}</div>${order}${opponent}</section>`;
 }).join('');
 const subtitle=result.mode==='career'?'選手通算・直近6試合・年度別・打順別・相手校別 打撃成績':result.mode==='recent'?'直近6試合成績（練習試合のみ）':`${esc(result.wanted||'年度')} 年度成績・打順別・相手校別`;
 return`<article id="statsPdfSource" class="statsPaper"><header class="statsHeader"><div class="statsBrand"><img src="/magi-official-symbol-v125.svg?v=140" alt=""><div><b>MAGI DATA REPORT</b><span>Maruoka Advanced Game Intelligence</span></div></div><div class="statsIssue">発行 ${esc(date)}</div></header><div class="statsTitle"><span>PLAYER BATTING RECORD</span><h2>${esc(result.target)}</h2><p>${subtitle}</p></div>${sections}<footer class="statsFooter"><b>《MAGI》</b><span>丸岡中学校軟式野球部 データ資料</span><small>「通算」は読込済みの全年度を合算し、「年度成績」は各年度だけを集計しています。通算得点圏打率は分子・分母を正確に合算できない場合、推測せず「—」と表示します。直近6試合は最新の練習試合日3日分を対象とし、公式戦を除外しています。</small></footer></article>`;
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
 if(h)h.textContent='Drive正本から通算・年度別・直近6試合（練習試合のみ）の成績を直接表示し、同じ内容のA4配布資料を作成します。';
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
  await loadPdfLib();
  if(document.fonts&&document.fonts.ready)await document.fonts.ready;
  await Promise.all([...source.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})));
  const html2canvas=window.html2canvas,JsPDF=window.jspdf&&window.jspdf.jsPDF;
  if(typeof html2canvas!=='function'||typeof JsPDF!=='function')throw new Error('PDF変換機能を開始できません');
  const width=Math.max(720,source.scrollWidth||source.offsetWidth||720);
  const scale=Math.min(2,1500/width);
  const canvas=await html2canvas(source,{scale,useCORS:true,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:-window.scrollY,windowWidth:Math.max(document.documentElement.clientWidth,width)});
  if(!canvas.width||!canvas.height)throw new Error('PDF画像を作成できません');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(ctx){const data=ctx.getImageData(0,0,canvas.width,Math.min(canvas.height,Math.max(80,Math.floor(canvas.height*.25)))).data;let colored=0;for(let i=0;i<data.length;i+=Math.max(4,Math.floor(data.length/2000/4)*4)){if(data[i]<238||data[i+1]<238||data[i+2]<238){colored++;if(colored>12)break}}if(colored<=12)throw new Error('PDF画像が空白です')}
  const pdf=new JsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
  const pageW=210,pageH=297,margin=7,usableW=pageW-margin*2,usableH=pageH-margin*2;
  const imgH=canvas.height*usableW/canvas.width,img=canvas.toDataURL('image/jpeg',.94);
  let offset=0,page=0;
  do{
   if(page>0)pdf.addPage();
   pdf.addImage(img,'JPEG',margin,margin-offset,usableW,imgH,undefined,'FAST');
   offset+=usableH;page++;
  }while(offset<imgH-1&&page<12);
  const blob=pdf.output('blob');
  if(!blob||blob.size<50000)throw new Error('PDF内容を正しく生成できません');
  if(window.MAGI_STATS_PDF_URL)URL.revokeObjectURL(window.MAGI_STATS_PDF_URL);
  window.MAGI_STATS_PDF_URL=URL.createObjectURL(blob);
  link.href=window.MAGI_STATS_PDF_URL;link.download=safeFileName(result);link.target='_blank';
  link.classList.remove('hidden');state.textContent=`PDFの準備ができました（${Math.max(1,page)}ページ）。iPhoneでは開いた後、共有ボタンから保存・送信できます。`;
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
function closePreview(){
 const modal=document.getElementById('statsPreviewModal');
 if(modal)modal.remove();
 document.body.classList.remove('statsPreviewOpen');
}
function openPreview(){
 const source=document.getElementById('statsPdfSource');if(!source)return;
 closePreview();
 const copy=source.cloneNode(true);copy.removeAttribute('id');copy.classList.add('statsPreviewPaper');
 const modal=document.createElement('div');modal.id='statsPreviewModal';modal.className='statsPreviewModal';
 const bar=document.createElement('div');bar.className='statsPreviewBar';bar.innerHTML='<b>A4配布資料プレビュー</b><button type="button" id="statsPreviewClose">閉じる</button>';
 const stage=document.createElement('div');stage.className='statsPreviewStage';stage.appendChild(copy);
 modal.appendChild(bar);modal.appendChild(stage);document.body.appendChild(modal);document.body.classList.add('statsPreviewOpen');
 document.getElementById('statsPreviewClose')?.addEventListener('click',closePreview);
 modal.addEventListener('click',e=>{if(e.target===modal)closePreview()});
}
function renderError(msg){
 const panel=ensureUi();panel.innerHTML=`<div class="statsError"><b>成績照会を完了できませんでした</b><p>${esc(msg)}</p></div>`;panel.classList.add('show');
 document.getElementById('response')?.classList.remove('show');
 const status=document.getElementById('status');if(status)status.textContent='成績照会：資料を確認してください。';
}
function render(result){
 const panel=ensureUi();
 panel.innerHTML=reportMarkup(result)+`<div class="statsPdfActions"><button id="statsPreviewButton" class="statsPdfButton" type="button">A4プレビュー</button><button id="statsSaveButton" class="secondary" type="button">PDF保存プレビュー</button><div id="statsPdfState" class="statsPdfState">内容確認は「A4プレビュー」、PDF保存は「PDF保存プレビュー」を使用してください。</div></div>`;
 panel.classList.add('show');document.getElementById('response')?.classList.remove('show');
 document.getElementById('statsPreviewButton')?.addEventListener('click',openPreview);
 document.getElementById('statsSaveButton')?.addEventListener('click',printReport);
 const status=document.getElementById('status');if(status)status.textContent=`${result.target}の通算打撃成績を表示しました。PDF保存前に内容を確認できます。`;
 panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function installStyles(){
 if(document.getElementById('magi-stats-report-v249-style'))return;
 const s=document.createElement('style');s.id='magi-stats-report-v240-style';s.textContent=`
 .statsLookupPanel{display:none;margin-top:14px}.statsLookupPanel.show{display:block}.statsPaper{background:#f8fafc;color:#07172d;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}.statsHeader{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 20px;background:#071b36;color:#fff;border-bottom:6px solid #8d1420}.statsBrand{display:flex;align-items:center;gap:11px}.statsBrand img{width:54px;height:54px;object-fit:contain}.statsBrand b{display:block;font-size:19px;letter-spacing:.08em}.statsBrand span{display:block;margin-top:3px;color:#b8caDC;font-size:10px}.statsIssue{color:#d3deea;font-size:11px}.statsTitle{padding:22px 20px 14px}.statsTitle span{font-size:10px;letter-spacing:.18em;color:#8d1420;font-weight:900}.statsTitle h2{margin:5px 0 0;font-size:34px;letter-spacing:.06em}.statsTitle p{margin:2px 0 0;font-size:15px;font-weight:900;color:#42566e}.statsSeason{margin:0 20px 18px;border:1px solid #cad6e1;border-radius:13px;overflow:hidden;background:#fff;break-inside:avoid}.statsSeasonHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;background:#0a2748;color:#fff}.statsSeasonHead span{display:block;font-size:9px;letter-spacing:.16em;color:#9fc1df}.statsSeasonHead b{display:block;font-size:19px}.statsVerified{font-size:10px;padding:6px 8px;border:1px solid #477395;border-radius:999px}.statsFeatured{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 12px 4px}.statsFeature{padding:12px 10px;background:#edf3f8;border-left:4px solid #8d1420;border-radius:8px}.statsFeature span,.statsMetric span{display:block;color:#607188;font-size:10px;font-weight:800}.statsFeature b{display:block;margin-top:4px;font-size:24px}.statsMetrics{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:8px 12px 12px}.statsMetric{padding:9px 7px;border:1px solid #d5dee7;border-radius:7px;background:#fafcfe}.statsMetric b{display:block;margin-top:3px;font-size:15px}.statsSource{padding:9px 12px;border-top:1px solid #dce4eb;color:#5b6d82;font-size:9px;line-height:1.5}.statsSource b{color:#253a52}.statsSectionLabel{padding:12px 14px 0;font-size:12px;font-weight:900;color:#8d1420;letter-spacing:.06em}.statsBreakdown{margin:12px;border:1px solid #d5dee7;border-radius:9px;overflow:hidden;background:#fff;break-inside:avoid}.statsBreakdownHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#edf3f8}.statsBreakdownHead b{font-size:13px;color:#17314d}.statsBreakdownHead span{font-size:8px;color:#64768a;text-align:right}.statsTableWrap{overflow-x:auto;-webkit-overflow-scrolling:touch}.statsBreakdownTable{width:max-content;min-width:100%;table-layout:auto;border-collapse:collapse;font-size:10px}.statsBreakdownTable th,.statsBreakdownTable td{width:1%;padding:8px 5px;border-top:1px solid #dde5ec;text-align:right;white-space:nowrap}.statsBreakdownTable thead th{background:#f7fafc;color:#607188;font-size:9px}.statsBreakdownTable th:first-child,.statsBreakdownTable td:first-child{width:55px;min-width:55px;max-width:55px;box-sizing:border-box;text-align:left;position:sticky;left:0;background:#fff;font-weight:900}.statsBreakdownTable thead th:first-child{background:#f7fafc}.statsFooter{padding:14px 20px 18px;background:#eef3f7;border-top:1px solid #ccd7e1}.statsFooter b,.statsFooter span,.statsFooter small{display:block}.statsFooter b{font-size:15px}.statsFooter span{font-size:11px;font-weight:800;margin-top:2px}.statsFooter small{font-size:9px;color:#65758a;margin-top:5px}.statsPdfActions{margin-top:10px;padding:13px;border:1px solid #294868;border-radius:13px;background:#0a1b2e;display:flex;align-items:center;gap:9px;flex-wrap:wrap}.statsPdfButton{display:inline-block;padding:12px 15px;border-radius:11px;background:#f3f7fb;color:#07111f;text-decoration:none;font-size:13px;font-weight:900;min-height:44px}.statsPdfState{flex:1 1 260px;color:#a9bdd0;font-size:11px;line-height:1.55}.statsError{padding:16px;border:1px solid #71313b;border-left:5px solid #cf1f2e;border-radius:13px;background:#32151b;color:#ffdbe0}.statsError p{font-size:13px;line-height:1.6}.statsPdfButton.hidden{display:none}.statsPreviewOpen{overflow:hidden}.statsPreviewModal{position:fixed;inset:0;z-index:2147483000;background:rgba(2,9,18,.94);overflow:auto;padding:64px 10px 24px}.statsPreviewBar{position:fixed;z-index:2;left:0;right:0;top:0;height:54px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#071b36;color:#fff;border-bottom:3px solid #8d1420}.statsPreviewBar b{font-size:14px}.statsPreviewBar button{min-width:84px;min-height:40px;border:1px solid #6d849b;border-radius:10px;background:#f3f7fb;color:#07111f;font-weight:900}.statsPreviewStage{width:min(100%,794px);margin:0 auto}.statsPreviewPaper{width:100%;min-height:1123px;border-radius:0!important;box-shadow:0 10px 34px rgba(0,0,0,.5)!important}
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
window.MAGI_PREVIEW_STATS_REPORT=openPreview;
window.MAGI_STATS_REPORT_V258=true;
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>300)clearInterval(timer)},100);
install();
})();