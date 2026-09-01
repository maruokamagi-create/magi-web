(()=>{
'use strict';
const VERSION='v239';
const CURRENT_ROSTER=['大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'];
const A={name:['選手名','氏名','名前','選手'],date:['開催日','試合日','日付'],opp:['相手校','対戦相手','相手'],game:['試合順','試合'],pa:['打席数','打席','pa'],ab:['打数','ab'],h:['安打','h'],avg:['打率','avg'],obp:['出塁率','obp'],slg:['長打率','slg'],ops:['ops'],single:['単打'],double:['二塁打'],triple:['三塁打'],hr:['本塁打','hr'],rbi:['打点','rbi'],bb:['四球','bb'],hbp:['死球'],sf:['犠飛'],so:['三振','so','k']};
const relevant=q=>/クリーンナップ|中軸|主軸|打線|打順|打撃|打率|OPS|安打|三振|本塁打|打点/i.test(String(q||''));
const selectionQuery=q=>/クリーンナップ|中軸|主軸|打線|打順|ベストオーダー|スタメン|レギュラー/i.test(String(q||''));
function currentTargets(q){
 const z=norm(q),out=[];
 for(const p of CURRENT_ROSTER)if(z.includes(norm(p)))out.push(p);
 return out;
}
function strictScope(q){
 const z=norm(q),players=currentTargets(q);
 const explicitCurrent=/2026\s*[-–—_. /]?\s*2027|現チーム|新チーム/i.test(String(q||''))||z.includes('20262027');
 if(selectionQuery(q))return{required:true,players:CURRENT_ROSTER.slice(),kind:'current-team-selection'};
 if(explicitCurrent)return{required:true,players:players.length?players:CURRENT_ROSTER.slice(),kind:'explicit-current-season'};
 if(players.length)return{required:true,players,kind:'named-current-player'};
 return{required:false,players:[],kind:'historical-or-non-roster-player'};
}
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const canonical=Object.fromEntries(CURRENT_ROSTER.map(x=>[norm(x),x]));
const cname=s=>canonical[norm(s)]||String(s||'').trim();
const idx=(r,a)=>{const cs=r?.columns||[],w=a.map(norm);for(let i=0;i<cs.length;i++)if(w.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++)if(w.some(x=>x&&norm(cs[i]).includes(x)))return i;return-1};
const val=(r,a)=>{const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()};
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?x:null};
const rate=x=>Number.isFinite(x)?x.toFixed(3).replace(/^0(?=\.)/,''):'';
const fileNorm=r=>norm(r?.fileName||'');
const isCurrent=r=>norm(`${r?.fileName||''} ${r?.sheetName||''}`).includes('20262027');
const isBatting=r=>/打撃|成績一覧|通算成績|打撃詳細|打率|OPS/i.test(`${r?.fileName||''} ${r?.sheetName||''} ${(r?.columns||[]).join(' ')}`);
const isAuthoritativeAggregate=r=>isCurrent(r)&&isBatting(r)&&!/打撃詳細/i.test(`${r?.fileName||''} ${r?.sheetName||''}`)&&fileNorm(r).includes('通算成績一覧20262027');
const isOfficialDetailCsv=r=>isCurrent(r)&&isBatting(r)&&fileNorm(r).includes('打撃詳細20262027.csv');
const aggregateSignature=r=>JSON.stringify((r?.values||[]).map(v=>norm(v)));
function dedupeAggregate(rows){const m=new Map();for(const r of rows||[]){const k=aggregateSignature(r);if(!m.has(k))m.set(k,r)}return[...m.values()]}
function playerAggregateRows(rows,p){const np=norm(p);return dedupeAggregate((rows||[]).filter(r=>isAuthoritativeAggregate(r)&&norm(cname(val(r,A.name)))===np));}
function aggregateRecord(rows,p){
 const rr=playerAggregateRows(rows,p);
 if(!rr.length)return{record:null,conflicts:[`${p}：正本「丸岡中軟式野球部_通算成績一覧2026-2027」の打撃行を取得できない`]};
 const out={},conflicts=[];
 for(const k of ['pa','ab','h','avg','obp','slg','ops','hr','rbi','so']){
  const values=[...new Set(rr.map(r=>num(val(r,A[k]))).filter(x=>x!==null).map(String))];
  if(values.length>1)conflicts.push(`${p} ${k}：正本内で ${values.join(' / ')} が併存`);
  if(values.length)out[k]=Number(values[0]);
 }
 for(const k of ['pa','ab','h','avg','obp','slg','ops','rbi','so'])if(out[k]===undefined)conflicts.push(`${p} ${k}：正本の必須数値を取得できない`);
 return{record:Object.keys(out).length?out:null,conflicts};
}
function detailNumericSignature(r){return JSON.stringify(['pa','ab','h','single','double','triple','hr','rbi','bb','hbp','sf','so'].map(k=>num(val(r,A[k]))));}
function gameKey(r){
 const parts=[val(r,A.date),val(r,A.opp),val(r,A.game)].map(norm);
 if(parts.some(Boolean))return parts.join('|');
 return `row:${r?.rowNumber||''}|${detailNumericSignature(r)}`;
}
function officialDetailRows(rows,p){
 const np=norm(p),raw=(rows||[]).filter(r=>isOfficialDetailCsv(r)&&norm(cname(val(r,A.name)))===np),groups=new Map(),conflicts=[];
 for(const r of raw){const k=gameKey(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 const out=[];
 for(const [k,grp] of groups){
  const sigs=[...new Set(grp.map(detailNumericSignature))];
  if(sigs.length>1){conflicts.push(`${p}：打撃詳細CSVの同一試合キー ${k} に異なる数値行が併存`);continue;}
  out.push(grp[0]);
 }
 return{rows:out,conflicts,rawCount:raw.length};
}
function detailRecord(rows,p){
 const picked=officialDetailRows(rows,p),rr=picked.rows,conflicts=[...picked.conflicts];
 if(!rr.length)return{record:null,conflicts:[...conflicts,`${p}：検算用「打撃詳細2026-2027.csv」の行を取得できない`]};
 const s={pa:0,ab:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,so:0},seen={};
 for(const r of rr)for(const k of Object.keys(s)){const x=num(val(r,A[k]));if(x!==null){s[k]+=x;seen[k]=true}}
 let H=seen.h?s.h:null;if(H===null&&(seen.single||seen.double||seen.triple||seen.hr))H=s.single+s.double+s.triple+s.hr;
 const AB=seen.ab?s.ab:null,PA=seen.pa?s.pa:null,BB=seen.bb?s.bb:0,HBP=seen.hbp?s.hbp:0,SF=seen.sf?s.sf:0;
 const avg=AB>0&&H!==null?H/AB:null,obpd=(AB||0)+BB+HBP+SF,obp=obpd>0&&H!==null?(H+BB+HBP)/obpd:null;
 let singles=seen.single?s.single:(H!==null?Math.max(0,H-(seen.double?s.double:0)-(seen.triple?s.triple:0)-(seen.hr?s.hr:0)):null);
 const tb=AB>0&&singles!==null?singles+2*(seen.double?s.double:0)+3*(seen.triple?s.triple:0)+4*(seen.hr?s.hr:0):null,slg=AB>0&&tb!==null?tb/AB:null,ops=obp!==null&&slg!==null?obp+slg:null;
 return{record:{pa:PA,ab:AB,h:H,avg,obp,slg,ops,hr:seen.hr?s.hr:null,rbi:seen.rbi?s.rbi:null,so:seen.so?s.so:null},conflicts,rawCount:picked.rawCount,dedupedCount:rr.length};
}
function compare(p,a,d){
 const issues=[];if(!a||!d)return issues;
 for(const k of ['pa','ab','h','hr','rbi','so'])if(a[k]!=null&&d[k]!=null&&Number(a[k])!==Number(d[k]))issues.push(`${p} ${k}：正本 ${a[k]} / 打撃詳細CSV再集計 ${d[k]}`);
 for(const k of ['avg','obp','slg','ops'])if(a[k]!=null&&d[k]!=null&&Math.abs(Number(a[k])-Number(d[k]))>0.0015)issues.push(`${p} ${k}：正本 ${rate(Number(a[k]))} / 打撃詳細CSV再集計 ${rate(Number(d[k]))}`);
 if(a.ab&&d.ab&&Number(d.ab)===Number(a.ab)*2)issues.push(`${p}：打数が正本のちょうど2倍。二重集計の疑い`);
 return issues;
}
function publicFact(m){return{season:'2026-2027',pa:m.pa??'',ab:m.ab??'',h:m.h??'',avg:rate(Number(m.avg)),obp:rate(Number(m.obp)),slg:rate(Number(m.slg)),ops:rate(Number(m.ops)),hr:m.hr??'',rbi:m.rbi??'',so:m.so??''}}
function build(rows,scopePlayers=CURRENT_ROSTER){
 const facts={},conflicts=[],sources={},aggregateRows=(rows||[]).filter(isAuthoritativeAggregate),detailRows=(rows||[]).filter(isOfficialDetailCsv);
 if(!aggregateRows.length)conflicts.push('正本「丸岡中軟式野球部_通算成績一覧2026-2027」を取得できない');
 if(!detailRows.length)conflicts.push('検算用「打撃詳細2026-2027.csv」を取得できない');
 for(const p of scopePlayers){
  const ar=aggregateRecord(rows,p);conflicts.push(...ar.conflicts);
  const dr=detailRecord(rows,p);conflicts.push(...dr.conflicts);
  if(ar.record&&dr.record)conflicts.push(...compare(p,ar.record,dr.record));
  if(ar.record){facts[p]=publicFact(ar.record);sources[p]='正本：通算成績一覧2026-2027／検算：打撃詳細2026-2027.csv';}
 }
 if(Object.keys(facts).length!==scopePlayers.length)conflicts.push(`正本から取得できた対象選手数が${Object.keys(facts).length}名。照合対象${scopePlayers.length}名と一致しない`);
 return{ok:conflicts.length===0,version:VERSION,conflicts:[...new Set(conflicts)],facts,sources,aggregateRows:aggregateRows.length,detailRows:detailRows.length};
}
function stripOldSnapshot(text){let s=String(text||''),marks=['【NUMERIC SOURCE OF TRUTH / VERIFIED】','【NUMERIC DATA CONFLICT — 審議停止】','【クリーンナップ候補・現チーム優先スナップショット】'];for(const mark of marks){const i=s.indexOf(mark);if(i<0)continue;const before=s.slice(0,i),after=s.slice(i+mark.length),j=after.indexOf('\n\n【');s=(before+(j>=0?after.slice(j+2):'')).trim()}return s;}
function trustedBlock(integ){const entries=Object.entries(integ.facts).sort((a,b)=>Number(b[1].ops||0)-Number(a[1].ops||0));return`【NUMERIC SOURCE OF TRUTH / VERIFIED】\n正本：丸岡中軟式野球部_通算成績一覧2026-2027。検算：打撃詳細2026-2027.csvのみ。Excel内の打撃詳細シート等は検算に混在させない。両者が一致した場合だけ審議を開始する。\n${entries.map(([p,m])=>`・${p}：${m.pa}打席 / ${m.ab}打数 / ${m.h}安打 / 打率${m.avg} / 出塁率${m.obp} / 長打率${m.slg} / OPS${m.ops} / 本塁打${m.hr} / 打点${m.rbi} / 三振${m.so}`).join('\n')}\n数値利用ルール：ここに明示された値だけを2026-2027現チームの数値事実として使用する。`;}
function conflictBlock(integ){return`【NUMERIC DATA CONFLICT — 審議停止】\n${integ.conflicts.map(x=>'・'+x).join('\n')}\n数値不一致が解消するまで候補選定・選手評価・最終判定を行わない。`;}
function installEvidence(){
 if(typeof window.searchDataEvidence!=='function'||window.MAGI_STRICT_EVIDENCE_FN===window.searchDataEvidence)return false;
 const prev=window.searchDataEvidence;
 const wrapped=function(q){const e=prev(q);if(!e||!relevant(q))return e;const scope=strictScope(q);if(!scope.required){window.MAGI_NUMERIC_INTEGRITY={ok:true,skipped:true,version:VERSION,scope:scope.kind,conflicts:[]};window.MAGI_NUMERIC_FACTS={};e.numericIntegrity=window.MAGI_NUMERIC_INTEGRITY;e.summary=String(e.summary||'')+' 対象選手・年度に限定して検索（現チーム14名の一括照合は適用外）。';return e;}const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const integ=build(rows,scope.players);integ.scope=scope.kind;integ.scopePlayers=scope.players.slice();window.MAGI_NUMERIC_INTEGRITY=integ;window.MAGI_NUMERIC_FACTS=integ.ok?integ.facts:{};const clean=stripOldSnapshot(e.text),block=integ.ok?trustedBlock(integ):conflictBlock(integ);e.text=block+'\n\n'+clean;e.numericIntegrity=integ;e.candidatePriority=block;e.summary=String(e.summary||'')+(integ.ok?' 数値整合性検証済み。':' 数値不一致のため審議停止。');return e;};
 window.searchDataEvidence=wrapped;window.MAGI_STRICT_EVIDENCE_FN=wrapped;window.MAGI_STRICT_EVIDENCE_WRAPPED=VERSION;return true;
}
function stopCard(q,integ){const status=document.getElementById('status');if(status)status.textContent='数値不一致を検出したため審議を停止しました。DATA CONFLICT';const question=document.getElementById('caseQuestion');if(question)question.textContent=q;const response=document.getElementById('response');if(response)response.classList.add('show');const title=document.querySelector('.final .title');if(title)title.textContent='《MAGI》数値検証停止';const verdict=document.getElementById('verdict');if(verdict)verdict.textContent='DATA CONFLICT';const reason=document.getElementById('reason');if(reason)reason.textContent=(integ?.conflicts||[]).join('／')||'正本と検算値の整合性を確認できません。';const next=document.getElementById('next');if(next)next.textContent='正本または打撃詳細CSVを確認し、数値が一致してから再審議してください。';const protocol=document.getElementById('engineProtocol');if(protocol)protocol.innerHTML='';}
function installRunGate(){
 if(typeof window.runMagi!=='function'||window.MAGI_STRICT_RUN_FN===window.runMagi)return false;
 const original=window.runMagi;
 const wrapped=async function(...args){const q=(document.getElementById('q')?.value||'').trim(),scope=strictScope(q);if(relevant(q)&&scope.required){let e=null;try{e=window.searchDataEvidence(q)}catch(_){e=null}const integ=window.MAGI_NUMERIC_INTEGRITY;if(!e||!integ||!integ.ok){stopCard(q,integ||{conflicts:['数値検証処理を完了できない']});return;}}return original.apply(this,args)};
 window.runMagi=wrapped;window.MAGI_STRICT_RUN_FN=wrapped;window.MAGI_STRICT_RUN_WRAPPED=VERSION;return true;
}
function install(){installEvidence();installRunGate();window.MAGI_NUMERIC_STRICT_GATE=VERSION;}
install();
let checks=0;const watchdog=setInterval(()=>{checks++;if(window.MAGI_STRICT_EVIDENCE_FN!==window.searchDataEvidence||window.MAGI_STRICT_RUN_FN!==window.runMagi)install();if(checks>=30)clearInterval(watchdog)},500);
})();
