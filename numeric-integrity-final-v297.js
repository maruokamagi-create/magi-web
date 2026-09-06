(()=>{
'use strict';
const VERSION='v297-final';
const ROSTER=['大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'];
const A={name:['選手名','氏名','名前','選手'],pa:['打席数','打席','pa'],ab:['打数','ab'],h:['安打','h'],single:['単打'],double:['二塁打'],triple:['三塁打'],hr:['本塁打','hr'],rbi:['打点','rbi'],bb:['四球','bb'],hbp:['死球'],sf:['犠飛'],so:['三振','so','k']};
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const idx=(r,a)=>{const cs=r?.columns||[],w=a.map(norm);for(let i=0;i<cs.length;i++)if(w.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++)if(w.some(x=>x&&norm(cs[i]).includes(x)))return i;return-1};
const val=(r,a)=>{const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()};
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?x:null};
const rate=x=>Number.isFinite(x)?x.toFixed(3).replace(/^0(?=\.)/,''):'';
const relevant=q=>/打順|4番|四番|クリーンナップ|中軸|主軸|打線|打撃|打率|OPS|安打|打点/i.test(String(q||''));
function targets(q){const z=norm(q),out=[];for(const p of ROSTER)if(z.includes(norm(p)))out.push(p);return out}
function csvRow(r){return norm(r?.fileName||'').includes('打撃詳細20262027.csv')}
function player(r){return String(val(r,A.name)||'').trim()}
function detail(p){
 const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'&&csvRow(r)&&norm(player(r))===norm(p));
 const seen=new Set(),rr=[];
 for(const r of rows){const key=[String(r.rowNumber??''),JSON.stringify(r.values||[])].join('|');if(seen.has(key))continue;seen.add(key);rr.push(r)}
 if(!rr.length)return null;
 const s={pa:0,ab:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,so:0},has={};
 for(const r of rr)for(const k of Object.keys(s)){const x=num(val(r,A[k]));if(x!==null){s[k]+=x;has[k]=true}}
 let H=has.h?s.h:null;if(H===null&&(has.single||has.double||has.triple||has.hr))H=s.single+s.double+s.triple+s.hr;
 const AB=has.ab?s.ab:null,PA=has.pa?s.pa:null,BB=has.bb?s.bb:0,HBP=has.hbp?s.hbp:0,SF=has.sf?s.sf:0;
 const avg=AB>0&&H!==null?H/AB:null,obpd=(AB||0)+BB+HBP+SF,obp=obpd>0&&H!==null?(H+BB+HBP)/obpd:null;
 let singles=has.single?s.single:(H!==null?Math.max(0,H-(has.double?s.double:0)-(has.triple?s.triple:0)-(has.hr?s.hr:0)):null);
 const tb=AB>0&&singles!==null?singles+2*(has.double?s.double:0)+3*(has.triple?s.triple:0)+4*(has.hr?s.hr:0):null;
 const slg=AB>0&&tb!==null?tb/AB:null,ops=obp!==null&&slg!==null?obp+slg:null;
 return{season:'2026-2027',pa:PA??'',ab:AB??'',h:H??'',avg:rate(avg),obp:rate(obp),slg:rate(slg),ops:rate(ops),hr:has.hr?s.hr:'',rbi:has.rbi?s.rbi:'',so:has.so?s.so:'',rows:rr.length};
}
function verify(q){
 const ps=targets(q);if(!ps.length)return null;
 const facts={},missing=[];
 for(const p of ps){const m=detail(p);if(m)facts[p]=m;else missing.push(p)}
 return{ok:missing.length===0,version:VERSION,scope:'named-players-csv-authoritative',scopePlayers:ps,conflicts:missing.map(p=>`${p}：打撃詳細2026-2027.csvの行を取得できない`),warnings:[],facts,sources:Object.fromEntries(ps.filter(p=>facts[p]).map(p=>[p,'打撃詳細2026-2027.csv シーズン全行再集計']))};
}
function removeOldBlocks(text){
 let s=String(text||'');
 const marks=['【NUMERIC DATA CONFLICT — 審議停止 v296】','【NUMERIC DATA CONFLICT — 審議停止】','【NUMERIC SOURCE OF TRUTH / VERIFIED v296】','【NUMERIC SOURCE OF TRUTH / VERIFIED】'];
 for(const mark of marks){
  for(;;){const i=s.indexOf(mark);if(i<0)break;const rest=s.slice(i+mark.length),j=rest.indexOf('\n\n【');s=(s.slice(0,i)+(j>=0?rest.slice(j+2):'')).trim()}
 }
 return s;
}
function block(v){
 const lines=Object.entries(v.facts).map(([p,m])=>`・${p}：${m.pa}打席 / ${m.ab}打数 / ${m.h}安打 / 打率${m.avg} / 出塁率${m.obp} / 長打率${m.slg} / OPS${m.ops} / 本塁打${m.hr} / 打点${m.rbi} / 三振${m.so}`);
 return`【CURRENT BATTING VERIFIED v297】\n2026-2027は打撃詳細CSVの全行をシーズン合算。CSV内の「試合順」表記揺れは試合判定に使わず、実データ行をそのまま合算する。\n${lines.join('\n')}`;
}
function apply(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.MAGI_NUMERIC_FINAL_FN===window.searchDataEvidence)return true;
 const prev=window.searchDataEvidence;
 const wrapped=function(q){
  const e=prev(q);if(!e||!relevant(q))return e;
  const v=verify(q);if(!v)return e;
  window.MAGI_NUMERIC_INTEGRITY=v;window.MAGI_NUMERIC_FACTS=v.ok?v.facts:{};
  const clean=removeOldBlocks(e.text),b=v.ok?block(v):`【NUMERIC DATA CONFLICT — 審議停止 v297】\n${v.conflicts.map(x=>'・'+x).join('\n')}`;
  e.text=b+'\n\n'+clean;e.numericIntegrity=v;e.candidatePriority=b;e.summary=String(e.summary||'')+(v.ok?' v297 CSV数値確認済み。':' v297 CSV取得失敗。');
  return e;
 };
 window.searchDataEvidence=wrapped;
 window.MAGI_NUMERIC_FINAL_FN=wrapped;
 window.MAGI_STRICT_EVIDENCE_FN=wrapped;
 window.MAGI_STRICT_EVIDENCE_WRAPPED=VERSION;
 return true;
}
let count=0;
const timer=setInterval(()=>{count++;apply();if(count>=240)clearInterval(timer)},500);
apply();
window.MAGI_NUMERIC_FINALIZER=VERSION;
})();