(()=>{
'use strict';
if(window.MAGI_PITCH_REPORT_V252)return;
const VERSION='v252';
const NAME=['選手名','氏名','名前','選手'];
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const rows=()=>((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
function idx(r,aliases){
 const cs=r?.columns||[],want=aliases.map(n);
 for(let i=0;i<cs.length;i++)if(want.includes(n(cs[i])))return i;
 return-1;
}
function raw(r,aliases){const i=idx(r,aliases);return i<0?'':String((r?.values||[])[i]??'').trim()}
function player(r){return raw(r,NAME)}
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
function isPitchLookup(q){
 q=String(q||'');
 const pitch=/投手|投球|登板|防御率|奪三振|与四死球|与四球|WHIP|被安打|自責点|セーブ/i.test(q);
 const request=/通算|成績|直近|最近|出して|教えて|見せて|表示|知りたい|何/i.test(q);
 const decision=/審議|べき|どう思う|評価して|比較して|候補|固定|起用|継投|先発させ|クローザーに/i.test(q);
 return pitch&&request&&!decision;
}
function findTarget(q,all){
 const z=n(q),names=[];
 for(const r of all){const p=player(r),k=n(p);if(p&&k.length>=2&&z.includes(k)&&!names.some(x=>n(x)===k))names.push(p)}
 return names.sort((a,b)=>n(b).length-n(a).length)[0]||'';
}
const nv=v=>{const x=Number(String(v??'').replace(/,/g,''));return Number.isFinite(x)?x:0};
function toOuts(v){const x=nv(v),whole=Math.trunc(x),digit=Math.round((x-whole)*10);return whole*3+Math.max(0,Math.min(2,digit))}
function ipText(outs){return `${Math.floor(outs/3)}.${outs%3}`}
const sums=[
 ['w',['勝利']],['l',['敗北','敗戦']],['sv',['セーブ']],['bf',['対打者']],['pitches',['投球数']],['balls',['ボール']],['strikes',['ストライク']],['h',['被安打']],['runs',['失点']],['er',['自責点']],['bb',['与四球','四球']],['k',['奪三振','三振']],['hbp',['与死球','死球']],['hr',['被本塁','被本塁打']],['wp',['暴投']],['balk',['ボーク']]
];
function isPractice(r){const s=raw(r,['大会名','大会','試合種別']);return /練習試合/.test(s)&&!/公式戦/.test(s)}
function dateRank(v){
 const s=String(v??'').trim(),x=Number(s);if(Number.isFinite(x)&&s!=='')return x;
 const t=Date.parse(s.replace(/[年月]/g,'/').replace(/日/g,''));return Number.isFinite(t)?t:0;
}
function latestPracticeDates(all,sheetName){
 const dates=[...new Set(all.filter(r=>/\.xlsm$/i.test(String(r.fileName||''))&&String(r.sheetName||'').trim()===sheetName&&isPractice(r)).map(r=>raw(r,['開催日','日付'])).filter(Boolean))];
 return dates.sort((a,b)=>dateRank(b)-dateRank(a)).slice(0,3);
}
function calculate(detail){
 const g={games:new Set(),starts:new Set(),relief:new Set(),w:0,l:0,sv:0,outs:0,bf:0,pitches:0,balls:0,strikes:0,h:0,runs:0,er:0,bb:0,k:0,hbp:0,hr:0,wp:0,balk:0};
 for(const r of detail){
  const key=[r.fileName||'',raw(r,['開催日','日付']),raw(r,['大会名']),raw(r,['試合順','試合']),raw(r,['相手校','対戦相手'])].join('|');
  g.games.add(key);
  if(/先発/.test(raw(r,['起用法'])))g.starts.add(key);else g.relief.add(key);
  g.outs+=toOuts(raw(r,['投球回']));
  for(const [k,a] of sums)g[k]+=nv(raw(r,a));
 }
 const innings=g.outs/3;
 return{
  games:g.games.size,starts:g.starts.size,relief:g.relief.size,w:g.w,l:g.l,sv:g.sv,ip:ipText(g.outs),outs:g.outs,bf:g.bf,pitches:g.pitches,balls:g.balls,strikes:g.strikes,h:g.h,runs:g.runs,er:g.er,bb:g.bb,hbp:g.hbp,k:g.k,hr:g.hr,wp:g.wp,balk:g.balk,
  era:g.outs?g.er*21/g.outs:'',whip:g.outs?(g.h+g.bb)/innings:'',k7:g.outs?g.k*7/innings:'',bb7:g.outs?g.bb*7/innings:'',strikePct:g.pitches?g.strikes/g.pitches:''
 };
}
function aggregate(all,target,y,selectedDates){
 const np=n(target),detail=all.filter(r=>/\.xlsm$/i.test(String(r.fileName||''))&&(!y||season(r)===y)&&/^投手詳細$/i.test(String(r.sheetName||'').trim())&&n(player(r))===np&&(!selectedDates||(isPractice(r)&&selectedDates.includes(raw(r,['開催日','日付'])))));
 if(!detail.length)return null;
 const groups=new Map();
 for(const r of detail){
  const opponent=raw(r,['相手校','対戦相手'])||'相手校不明';
  if(!groups.has(opponent))groups.set(opponent,[]);
  groups.get(opponent).push(r);
 }
 const opponentRows=[...groups].map(([label,rs])=>({label,values:calculate(rs)})).sort((a,b)=>b.values.games-a.values.games||a.label.localeCompare(b.label,'ja'));
 return{values:calculate(detail),opponentRows,files:[...new Set(detail.map(r=>r.fileName).filter(Boolean))],row:detail[0]};
}
function collect(q){
 const all=rows(),target=findTarget(q,all);
 const recentOnly=/直近|最近/.test(String(q||''));
 if(!target)return{error:'対象選手をDrive資料から特定できませんでした。選手名をフルネームで入力してください。'};
 const recentDates=latestPracticeDates(all,'投手詳細');
 const recent=aggregate(all,target,null,recentDates);
 if(recentOnly){
  if(!recent)return{error:`${target}の直近6試合（練習試合のみ）の投手記録はありません。`};
  return{target,mode:'recent',wanted:'直近6試合',records:[{label:'直近6試合',isRecent:true,recentDates,...recent}]};
 }
 const wanted=explicitSeason(q),detail=all.filter(r=>/\.xlsm$/i.test(String(r.fileName||''))&&/^投手詳細$/i.test(String(r.sheetName||'').trim())&&n(player(r))===n(target)&&season(r));
 const ys=[...new Set(detail.map(season).filter(Boolean))].sort();
 if(!ys.length)return{error:`${target}の投手詳細をDrive正本のxlsmから取得できませんでした。`};
 if(wanted){const one=aggregate(all,target,wanted);if(!one)return{error:`${target}の${wanted}年度投手成績はありません。`};return{target,mode:'season',wanted,records:[{label:wanted,isCareer:false,...one}]}}
 const career=aggregate(all,target,null),yearRecords=ys.map(y=>({label:y,isCareer:false,...aggregate(all,target,y)}));
 return{target,mode:'career',records:[{label:'全年度通算',isCareer:true,...career},...(recent?[{label:'直近6試合',isRecent:true,recentDates,...recent}]:[]),...yearRecords]};
}
const METRICS=[
 ['games','登板','int'],['starts','先発','int'],['relief','救援','int'],['w','勝利','int'],['l','敗戦','int'],['sv','セーブ','int'],['ip','投球回','ip'],['bf','対打者','int'],['pitches','投球数','int'],['h','被安打','int'],['runs','失点','int'],['er','自責点','int'],['bb','与四球','int'],['hbp','与死球','int'],['k','奪三振','int'],['hr','被本塁打','int'],['wp','暴投','int'],['era','防御率','rate2'],['whip','WHIP','rate2'],['k7','奪三振率','rate2'],['bb7','与四球率','rate2'],['strikePct','ストライク率','rate3']
];
function fmt(v,kind){
 if(v===''||v===null||v===undefined)return'—';
 if(kind==='ip')return String(v);
 const x=Number(v);if(!Number.isFinite(x))return String(v);
 if(kind==='rate2')return x.toFixed(2);
 if(kind==='rate3')return x.toFixed(3).replace(/^0(?=\.)/,'');
 return String(Math.round(x));
}
const PITCH_BREAKDOWN_METRICS=[
 ['games','登板','int'],['starts','先発','int'],['w','勝','int'],['l','敗','int'],['sv','S','int'],['ip','投球回','ip'],['h','被安打','int'],['er','自責点','int'],['bb','与四球','int'],['k','奪三振','int'],['era','防御率','rate2'],['whip','WHIP','rate2']
];
function opponentMarkup(list){
 if(!list?.length)return'';
 const head=PITCH_BREAKDOWN_METRICS.map(([,l])=>`<th>${esc(l)}</th>`).join('');
 const body=list.map(row=>`<tr><th>${esc(row.label)}</th>${PITCH_BREAKDOWN_METRICS.map(([k,,t])=>`<td>${esc(fmt(row.values[k],t))}</td>`).join('')}</tr>`).join('');
 return`<section class="statsBreakdown"><div class="statsBreakdownHead"><b>相手校別投手成績</b><span>投手詳細から再集計</span></div><div class="statsTableWrap"><table class="statsBreakdownTable"><thead><tr><th>相手校</th>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}
function reportMarkup(result){
 const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
 const sections=result.records.map((rec,i)=>{
  const v=rec.values,featured=[['era','防御率','rate2'],['ip','投球回','ip'],['k','奪三振','int'],['whip','WHIP','rate2']].map(([k,l,t])=>`<div class="statsFeature"><span>${l}</span><b>${esc(fmt(v[k],t))}</b></div>`).join('');
  const cells=METRICS.map(([k,l,t])=>`<div class="statsMetric"><span>${l}</span><b>${esc(fmt(v[k],t))}</b></div>`).join('');
  const type=rec.isCareer?'CAREER':rec.isRecent?'RECENT':'SEASON',badge=rec.isCareer?'全年度再集計':rec.isRecent?'練習試合のみ':'年度別';
  const opponent=(rec.isCareer||result.mode==='season')?opponentMarkup(rec.opponentRows):'';
  return`<section class="statsSeason"><div class="statsSeasonHead"><div><span>${type}</span><b>${esc(rec.label)}</b></div><div class="statsVerified">${badge}</div></div><div class="statsSectionLabel">${rec.isCareer?'選手通算投手成績':rec.isRecent?'直近6試合投手成績（練習試合のみ）':'年度投手成績'}</div><div class="statsFeatured">${featured}</div><div class="statsMetrics">${cells}</div><div class="statsSource"><b>参照元</b> ${esc((rec.files||[]).join('・'))} / 投手詳細から再集計</div>${opponent}</section>`;
 }).join('');
 const sub=result.mode==='career'?'選手通算・直近6試合・年度別・相手校別 投手成績':result.mode==='recent'?'直近6試合投手成績（練習試合のみ）':`${result.wanted}年度・相手校別 投手成績`;
 return`<article id="statsPdfSource" class="statsPaper"><header class="statsHeader"><div class="statsBrand"><img src="/magi-official-symbol-v125.svg?v=140" alt=""><div><b>MAGI DATA REPORT</b><span>Maruoka Advanced Game Intelligence</span></div></div><div class="statsIssue">発行 ${date}</div></header><div class="statsTitle"><span>PLAYER PITCHING RECORD</span><h2>${esc(result.target)}</h2><p>${esc(sub)}</p></div>${sections}<footer class="statsFooter"><b>《MAGI》</b><span>丸岡中学校軟式野球部 データ資料</span><small>投球回はアウト数へ変換して合算し、防御率・WHIP・奪三振率・与四球率を再計算しています。防御率は7回制です。相手校別成績も各校の投手詳細から同じ方式で再計算しています。直近6試合は最新の練習試合日3日分を対象とし、公式戦を除外しています。</small></footer></article>`;
}
function panel(){
 let p=document.getElementById('statsLookupPanel');if(p)return p;
 const response=document.getElementById('response'),card=document.querySelector('#judge .card');p=document.createElement('div');p.id='statsLookupPanel';p.className='statsLookupPanel';
 if(response)response.parentNode.insertBefore(p,response);else card?.parentNode.appendChild(p);return p;
}
function router(){
 const v=document.getElementById('routeValue'),h=document.getElementById('routeHelp'),b=document.getElementById('routeBadge');
 if(v)v.textContent='投手成績照会＋配布用PDF';
 if(h)h.textContent='質問内容から投手成績を判定し、通算・指定年度・直近6試合（練習試合のみ）を再集計します。';
 if(b)b.textContent='PITCH';
}
function directDone(){
 const root=document.querySelector('#judge .card')||document.body,w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let x;
 while(x=w.nextNode()){
  if(x.nodeValue.includes('審議完了'))x.nodeValue=x.nodeValue.replace(/審議完了/g,'照会完了');
  if(x.nodeValue.includes('FINAL DECISION'))x.nodeValue=x.nodeValue.replace(/FINAL DECISION/g,'DATA RESULT');
 }
}
function render(result){
 const p=panel();p.innerHTML=reportMarkup(result)+`<div class="statsPdfActions"><button id="pitchPreview" class="statsPdfButton" type="button">A4プレビュー</button><button id="pitchPdf" class="secondary" type="button">PDF保存プレビュー</button><div class="statsPdfState">質問内容に合わせた投手成績を表示しています。</div></div>`;p.classList.add('show');document.getElementById('response')?.classList.remove('show');
 document.getElementById('pitchPreview')?.addEventListener('click',()=>window.MAGI_PREVIEW_STATS_REPORT?.());
 document.getElementById('pitchPdf')?.addEventListener('click',()=>window.MAGI_PRINT_STATS_REPORT?.());
 const status=document.getElementById('status');if(status)status.textContent=`${result.target}の${result.mode==='career'?'通算':result.mode==='recent'?'直近6試合':'年度別'}投手成績を表示しました。`;
 directDone();setTimeout(directDone,200);p.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderError(msg){const p=panel();p.innerHTML=`<div class="statsError"><b>投手成績照会を完了できませんでした</b><p>${esc(msg)}</p></div>`;p.classList.add('show')}
function install(){
 const q=document.getElementById('q');if(q&&!q.__magiPitchRoute){q.__magiPitchRoute=true;q.addEventListener('input',()=>{if(isPitchLookup(q.value))router()})}
 if(typeof window.runMagi!=='function'||window.MAGI_PITCH_REPORT_FN===window.runMagi)return false;
 const original=window.runMagi;
 const wrapped=function(...args){
  const query=(document.getElementById('q')?.value||'').trim();
  if(!isPitchLookup(query))return original.apply(this,args);
  router();const result=collect(query);if(result.error){renderError(result.error);return}render(result);
 };
 window.runMagi=wrapped;window.MAGI_PITCH_REPORT_FN=wrapped;window.MAGI_PITCH_REPORT_WRAPPED=VERSION;return true;
}
window.MAGI_PITCH_REPORT_V252=true;
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>300)clearInterval(timer)},100);install();
})();