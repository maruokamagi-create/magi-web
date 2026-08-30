(()=>{
'use strict';
const prev=window.searchDataEvidence;
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const aliases={name:['選手名','氏名','名前','選手'],date:['開催日','試合日','日付'],opp:['相手校','対戦相手','相手'],game:['試合順','試合'],games:['試合数','試合','出場試合'],pa:['打席数','打席','pa'],ab:['打数','ab'],h:['安打','h'],avg:['打率','avg'],obp:['出塁率','obp'],slg:['長打率','slg'],ops:['ops'],single:['単打'],double:['二塁打'],triple:['三塁打'],hr:['本塁打','hr'],rbi:['打点','rbi'],bb:['四球','bb'],hbp:['死球'],sf:['犠飛'],so:['三振','so','k']};
const canonical={
 '大久保陽翔':'大久保 陽翔','大野竜暉':'大野 竜暉','井坂悠聖':'井坂 悠聖','坂田暉馬':'坂田 暉馬','嶋田栄志':'嶋田 栄志','武澤大翔':'武澤 大翔','橋向結都':'橋向 結都','中嶋玲月':'中嶋 玲月','吉田真翔':'吉田 真翔'
};
const cname=p=>canonical[n(p)]||String(p||'').trim();
const idx=(r,a)=>{const c=r.columns||[],w=a.map(n);for(let i=0;i<c.length;i++)if(w.includes(n(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&n(c[i]).includes(x)))return i;return-1};
const val=(r,a)=>{const i=idx(r,a);return i<0?'':String((r.values||[])[i]??'').trim()};
const num=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?x:null};
const season=r=>{const s=n(`${r.fileName||''} ${r.sheetName||''}`);return s.includes('20252026')?'2025-2026':s.includes('20262027')?'2026-2027':''};
const valid=p=>p&&!/^(総計|合計|計|チーム|全体|選手名|氏名)$/u.test(p)&&p.length<=18;
const battingRow=r=>/打撃|通算成績|打撃詳細|成績一覧/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`);
function rowsFor(rows,p,y){const np=n(p);return rows.filter(r=>season(r)===y&&n(val(r,aliases.name))===np&&battingRow(r));}
function first(rows,a){for(const r of rows){const v=val(r,a);if(v!==''&&v!=='-'&&v!=='—')return v}return''}
const fmtRate=x=>Number.isFinite(x)?x.toFixed(3).replace(/^0(?=\.)/,''):'';
function aggregateCurrent(rr){const sums={pa:0,ab:0,h:0,single:0,double:0,triple:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,so:0};const seen={};let any=false;for(const r of rr){for(const k of Object.keys(sums)){const x=num(val(r,aliases[k]));if(x!==null){sums[k]+=x;seen[k]=true;any=true}}}if(!any)return null;const games=new Set();for(const r of rr){const pa=num(val(r,aliases.pa));if(pa!==null&&pa<=0)continue;const key=[val(r,aliases.date),val(r,aliases.opp),val(r,aliases.game)].join('|');if(key!=='||')games.add(key)}let H=seen.h?sums.h:null;if(H===null&&(seen.single||seen.double||seen.triple||seen.hr))H=sums.single+sums.double+sums.triple+sums.hr;const AB=seen.ab?sums.ab:null,PA=seen.pa?sums.pa:null,BB=seen.bb?sums.bb:0,HBP=seen.hbp?sums.hbp:0,SF=seen.sf?sums.sf:0;const avg=AB>0&&H!==null?H/AB:null;const obpDen=(AB||0)+BB+HBP+SF,obp=obpDen>0&&H!==null?(H+BB+HBP)/obpDen:null;let singles=seen.single?sums.single:null;if(singles===null&&H!==null)singles=Math.max(0,H-(seen.double?sums.double:0)-(seen.triple?sums.triple:0)-(seen.hr?sums.hr:0));const tb=AB>0&&singles!==null?singles+2*(seen.double?sums.double:0)+3*(seen.triple?sums.triple:0)+4*(seen.hr?sums.hr:0):null;const slg=AB>0&&tb!==null?tb/AB:null,ops=obp!==null&&slg!==null?obp+slg:null;return{games:games.size||'',pa:PA??'',ab:AB??'',h:H??'',avg:fmtRate(avg),obp:fmtRate(obp),slg:fmtRate(slg),ops:fmtRate(ops),hr:seen.hr?sums.hr:'',rbi:seen.rbi?sums.rbi:'',bb:seen.bb?sums.bb:'',so:seen.so?sums.so:''};}
function aggregateOld(rr){const preferred=[...rr].sort((a,b)=>/通算成績|成績一覧/i.test(`${b.fileName||''} ${b.sheetName||''}`)-/通算成績|成績一覧/i.test(`${a.fileName||''} ${a.sheetName||''}`));const out={};for(const k of ['games','pa','ab','h','avg','obp','slg','ops','hr','rbi','bb','so']){const v=first(preferred,aliases[k]);if(v!=='')out[k]=v}return out;}
function metrics(rows,p,y){const rr=rowsFor(rows,p,y);if(!rr.length)return{};if(y==='2026-2027'){
  const aggregateRows=rr.filter(r=>/通算成績|成績一覧/i.test(`${r.fileName||''} ${r.sheetName||''}`)&&!/打撃詳細/i.test(`${r.fileName||''} ${r.sheetName||''}`));
  if(aggregateRows.length){const m=aggregateOld(aggregateRows);if(Object.keys(m).length)return m}
  const detail=rr.filter(r=>/打撃詳細/i.test(`${r.fileName||''} ${r.sheetName||''}`));
  return aggregateCurrent(detail.length?detail:rr)||{};
 }
 return aggregateOld(rr);
}
function text(m){const order=[['games','試合'],['pa','打席'],['ab','打数'],['h','安打'],['avg','打率'],['obp','出塁率'],['slg','長打率'],['ops','OPS'],['hr','本塁打'],['rbi','打点'],['bb','四球'],['so','三振']];const a=[];for(const [k,l] of order)if(m[k]!==undefined&&m[k]!=='')a.push(`${l}${m[k]}`);return a.join(' / ')||'数値未抽出'}
function make(rows){const ps=[];for(const r of rows){const raw=val(r,aliases.name),p=cname(raw);if(valid(p)&&!ps.some(x=>n(x)===n(p)))ps.push(p)}const out=[];for(const p of ps){const a=metrics(rows,p,'2025-2026'),b=metrics(rows,p,'2026-2027');if(!Object.keys(a).length&&!Object.keys(b).length)continue;out.push(`${p}\n  2025-2026（参考）：${text(a)}\n  2026-2027（主評価）：${text(b)}`)}return out.length?`【旧→新 同一指標比較】\n評価優先順位：2026-2027の現チーム成績を主評価とし、2025-2026は参考資料とする。大久保 陽翔・大野 竜暉以外は旧チームでレギュラーではなく出場機会が少なかったため、旧成績の小さい母数を現在の能力差として直接比較しない。\n${out.join('\n')}\n2026-2027の打撃詳細は試合別行を合算し、打率・出塁率・長打率・OPSを再計算する。1試合分を通算値として扱わない。現在の母数が小さくても、それだけを理由に判断を放棄せず、暫定判断と見直し条件を示すこと。`:''}
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e||!/クリーンナップ|中軸|主軸|打線|打順|打撃|打率|ops|長打|安打/i.test(String(q||'')))return e;const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const block=make(rows);if(block){e.comparison=block;e.text=block+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 現チームを主評価、旧チームを参考として、試合別行を通算集計。'}return e};
window.MAGI_EVIDENCE_NUMERIC_COMPARE='v211';
})();