(()=>{
'use strict';
const VERSION='v298';
if(window.MAGI_NUMERIC_V298_BOOTED)return;
window.MAGI_NUMERIC_V298_BOOTED=VERSION;

const ROSTER=['大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'];
const A={name:['選手名','氏名','名前','選手'],pa:['打席数','打席','pa'],ab:['打数','ab'],h:['安打','h'],avg:['打率','avg'],obp:['出塁率','obp'],slg:['長打率','slg'],ops:['ops'],single:['単打'],double:['二塁打'],triple:['三塁打'],hr:['本塁打','hr'],rbi:['打点','rbi'],bb:['四球','bb'],hbp:['死球'],sf:['犠飛'],so:['三振','so','k']};
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?x:null};
const rate=x=>Number.isFinite(x)?x.toFixed(3).replace(/^0(?=\.)/,''):'';
const idx=(r,a)=>{const cs=r?.columns||[],want=a.map(norm);for(let i=0;i<cs.length;i++)if(want.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++){const c=norm(cs[i]);if(want.some(x=>x&&x.length>=2&&c.includes(x)))return i;}return-1};
const val=(r,a)=>{const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()};
const player=r=>val(r,A.name);
const rows=()=>((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
const relevant=q=>/打順|4番|四番|クリーンナップ|中軸|主軸|打線|打撃|打率|OPS|安打|打点|出塁率|長打率/i.test(String(q||''));
function namedTargets(q){const z=norm(q),out=[];for(const p of ROSTER)if(z.includes(norm(p)))out.push(p);return out;}
function seasonOf(r){const s=String(`${r?.fileName||''} ${r?.sheetName||''}`);if(/2025\s*[-–—_. /]?\s*2026/.test(s))return'2025-2026';if(/2026\s*[-–—_. /]?\s*2027/.test(s))return'2026-2027';return'';}
function currentCsvRow(r){return norm(r?.fileName||'').includes('打撃詳細20262027.csv');}

function aggregateCurrentCsv(p){
 const rr=rows().filter(r=>currentCsvRow(r)&&norm(player(r))===norm(p));
 if(!rr.length)return null;
 const s={pa:0,ab:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,so:0},seen={};
 for(const r of rr){for(const k of Object.keys(s)){const x=num(val(r,A[k]));if(x!==null){s[k]+=x;seen[k]=true;}}}
 let H=seen.h?s.h:null;
 if(H===null&&(seen.single||seen.double||seen.triple||seen.hr))H=s.single+s.double+s.triple+s.hr;
 const AB=seen.ab?s.ab:null,PA=seen.pa?s.pa:null,BB=seen.bb?s.bb:0,HBP=seen.hbp?s.hbp:0,SF=seen.sf?s.sf:0;
 const avg=AB>0&&H!==null?H/AB:null;
 const obpd=(AB||0)+BB+HBP+SF;
 const obp=obpd>0&&H!==null?(H+BB+HBP)/obpd:null;
 const singles=seen.single?s.single:(H!==null?Math.max(0,H-(seen.double?s.double:0)-(seen.triple?s.triple:0)-(seen.hr?s.hr:0)):null);
 const tb=AB>0&&singles!==null?singles+2*(seen.double?s.double:0)+3*(seen.triple?s.triple:0)+4*(seen.hr?s.hr:0):null;
 const slg=AB>0&&tb!==null?tb/AB:null;
 const ops=obp!==null&&slg!==null?obp+slg:null;
 return{season:'2026-2027',pa:PA??'',ab:AB??'',h:H??'',avg:rate(avg),obp:rate(obp),slg:rate(slg),ops:rate(ops),hr:seen.hr?s.hr:'',rbi:seen.rbi?s.rbi:'',so:seen.so?s.so:'',source:'打撃詳細2026-2027.csv 全行再集計',rowCount:rr.length};
}

function workbookScore(r,y){
 if(seasonOf(r)!==y)return-9999;
 if(!/\.xlsm$/i.test(String(r?.fileName||'')))return-9999;
 if(!/通算成績一覧/i.test(String(r?.fileName||'')))return-9999;
 const sh=String(r?.sheetName||'').trim();
 if(/詳細|相手|打順|得点圏|ピボット|打球|投手|捕手|守備|月別|左右|球種|試合別/.test(sh))return-9999;
 let score=0;
 if(/^打撃一覧$/i.test(sh))score+=2000;
 else if(/^打率一覧$/i.test(sh))score+=1500;
 else if(/通算打撃|打撃成績一覧|打者成績|選手別成績|総合成績/.test(sh))score+=900;
 for(const k of ['name','pa','ab','h','avg','obp','slg','ops','rbi','so'])if(idx(r,A[k])>=0)score+=20;
 return score;
}
function aggregateWorkbook(p,y){
 const candidates=rows().filter(r=>norm(player(r))===norm(p)).map(r=>({r,score:workbookScore(r,y)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 if(!candidates.length)return null;
 const r=candidates[0].r,out={season:y,source:`${r.fileName||''} / ${r.sheetName||''}`};
 for(const k of ['pa','ab','h','avg','obp','slg','ops','hr','rbi','so']){const x=num(val(r,A[k]));out[k]=x===null?'':(['avg','obp','slg','ops'].includes(k)?rate(x):x);}
 return out;
}

function verify(q){
 const ps=namedTargets(q);
 if(!ps.length)return null;
 const currentFacts={},historical={},conflicts=[],warnings=[],sources={};
 for(const p of ps){
   const cur=aggregateCurrentCsv(p);
   if(!cur){conflicts.push(`${p}：打撃詳細2026-2027.csvから現チーム打撃行を取得できない`);continue;}
   currentFacts[p]=cur;sources[p]=cur.source;
   if(/2025\s*[-–—_. /]?\s*2026|過去|旧チーム|昨季/.test(String(q||''))){
     const old=aggregateWorkbook(p,'2025-2026');
     if(old)historical[p]=old;else warnings.push(`${p}：2025-2026の通算打撃行は今回の自動検証では特定できず`);
   }
 }
 return{ok:conflicts.length===0,version:VERSION,scope:'named-player-batting',scopePlayers:ps,currentFacts,historical,conflicts,warnings,sources,facts:currentFacts};
}

function stripOldBlocks(text){
 let s=String(text||'');
 const marks=['【NUMERIC DATA CONFLICT — 審議停止 v297】','【CURRENT BATTING VERIFIED v297】','【NUMERIC DATA CONFLICT — 審議停止 v296】','【NUMERIC SOURCE OF TRUTH / VERIFIED v296】','【NUMERIC DATA CONFLICT — 審議停止】','【NUMERIC SOURCE OF TRUTH / VERIFIED】'];
 for(const mark of marks){for(;;){const i=s.indexOf(mark);if(i<0)break;const rest=s.slice(i+mark.length),j=rest.indexOf('\n\n【');s=(s.slice(0,i)+(j>=0?rest.slice(j+2):'')).trim();}}
 return s;
}
function factLine(p,m){return`・${p}（${m.season}）：${m.pa}打席 / ${m.ab}打数 / ${m.h}安打 / 打率${m.avg} / 出塁率${m.obp} / 長打率${m.slg} / OPS${m.ops} / 本塁打${m.hr} / 打点${m.rbi} / 三振${m.so}`;}
function evidenceBlock(v){
 const lines=[];
 for(const p of v.scopePlayers){if(v.historical[p])lines.push(factLine(p,v.historical[p]));if(v.currentFacts[p])lines.push(factLine(p,v.currentFacts[p]));}
 return`【BATTING DATA VERIFIED v298】\n質問で名前が指定された選手だけを検証。2026-2027は「打撃詳細2026-2027.csv」の全行を合算し、CSVの試合順表記は重複判定に使わない。2025-2026は通算成績xlsmの非分割・通算打撃行を優先。\n${lines.join('\n')}${v.warnings.length?`\n注意：${v.warnings.join('／')}`:''}`;
}
function conflictBlock(v){return`【NUMERIC DATA CONFLICT — 審議停止 v298】\n${v.conflicts.map(x=>'・'+x).join('\n')}`;}

function installEvidence(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.MAGI_NUMERIC_V298_EVIDENCE===window.searchDataEvidence)return true;
 const prev=window.searchDataEvidence;
 const wrapped=function(q){
   const e=prev(q);if(!e||!relevant(q))return e;
   const v=verify(q);if(!v)return e;
   window.MAGI_NUMERIC_INTEGRITY=v;
   window.MAGI_NUMERIC_FACTS=v.ok?v.currentFacts:{};
   const b=v.ok?evidenceBlock(v):conflictBlock(v);
   e.text=b+'\n\n'+stripOldBlocks(e.text);
   e.numericIntegrity=v;e.candidatePriority=b;
   e.summary=String(e.summary||'')+(v.ok?' v298数値検証済み。':' v298データ取得失敗。');
   return e;
 };
 window.searchDataEvidence=wrapped;
 window.MAGI_NUMERIC_V298_EVIDENCE=wrapped;
 window.MAGI_STRICT_EVIDENCE_FN=wrapped;
 window.MAGI_STRICT_EVIDENCE_WRAPPED=VERSION;
 return true;
}

function showStop(q,v){
 const status=document.getElementById('status');if(status)status.textContent='必要な打撃データを取得できないため審議を停止しました。DATA MISSING';
 const question=document.getElementById('caseQuestion');if(question)question.textContent=q;
 const response=document.getElementById('response');if(response)response.classList.add('show');
 const title=document.querySelector('.final .title');if(title)title.textContent='《MAGI》データ取得停止';
 const verdict=document.getElementById('verdict');if(verdict)verdict.textContent='DATA MISSING';
 const reason=document.getElementById('reason');if(reason)reason.textContent=(v?.conflicts||[]).join('／')||'必要な打撃データを取得できません。';
 const next=document.getElementById('next');if(next)next.textContent='Driveの打撃詳細CSVを確認してから再審議してください。';
 const protocol=document.getElementById('engineProtocol');if(protocol)protocol.innerHTML='';
}
function installRunGate(){
 if(typeof window.runMagi!=='function')return false;
 if(window.MAGI_NUMERIC_V298_RUN===window.runMagi)return true;
 const original=window.runMagi;
 const wrapped=async function(...args){
   const q=(document.getElementById('q')?.value||'').trim();
   if(relevant(q)&&namedTargets(q).length){
     let e=null;try{e=window.searchDataEvidence(q)}catch(_){e=null;}
     const v=window.MAGI_NUMERIC_INTEGRITY;
     if(!e||!v||!v.ok){showStop(q,v||{conflicts:['数値検証処理を完了できない']});return;}
   }
   const status=document.getElementById('status');if(status&&/DATA CONFLICT|DATA MISSING/.test(status.textContent||''))status.textContent='審議を開始します…';
   return original.apply(this,args);
 };
 window.runMagi=wrapped;
 window.MAGI_NUMERIC_V298_RUN=wrapped;
 window.MAGI_STRICT_RUN_FN=wrapped;
 window.MAGI_STRICT_RUN_WRAPPED=VERSION;
 return true;
}
function install(){installEvidence();installRunGate();window.MAGI_NUMERIC_INTEGRITY_VERSION=VERSION;}
install();
let checks=0;const watchdog=setInterval(()=>{checks++;install();if(checks>=240)clearInterval(watchdog)},500);
})();
