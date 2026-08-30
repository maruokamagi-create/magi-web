(()=>{
'use strict';
const prev=window.searchDataEvidence;
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const aliases={name:['選手名','氏名','名前','選手'],games:['試合数','試合','出場試合'],pa:['打席数','打席','pa'],ab:['打数','ab'],h:['安打','h'],avg:['打率','avg'],obp:['出塁率','obp'],slg:['長打率','slg'],ops:['ops'],hr:['本塁打','hr'],rbi:['打点','rbi'],bb:['四球','bb'],so:['三振','so','k']};
const idx=(r,a)=>{const c=r.columns||[],w=a.map(n);for(let i=0;i<c.length;i++)if(w.includes(n(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&n(c[i]).includes(x)))return i;return-1};
const val=(r,a)=>{const i=idx(r,a);return i<0?'':String((r.values||[])[i]??'').trim()};
const season=r=>{const s=n(`${r.fileName||''} ${r.sheetName||''}`);return s.includes('20252026')?'2025-2026':s.includes('20262027')?'2026-2027':''};
const valid=p=>p&&!/^(総計|合計|計|チーム|全体|選手名|氏名)$/u.test(p)&&p.length<=18;
function metricRows(rows,p,y){const np=n(p);return rows.filter(r=>season(r)===y&&n(val(r,aliases.name))===np&&/打撃|通算成績|打撃詳細|成績一覧/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`));}
function first(rows,a){for(const r of rows){const v=val(r,a);if(v!==''&&v!=='-'&&v!=='—')return v}return''}
function line(rows,p,y){const rr=metricRows(rows,p,y),parts=[];for(const [k,label] of [['games','試合'],['pa','打席'],['ab','打数'],['h','安打'],['avg','打率'],['obp','出塁率'],['slg','長打率'],['ops','OPS'],['hr','本塁打'],['rbi','打点'],['bb','四球'],['so','三振']]){const v=first(rr,aliases[k]);if(v!=='')parts.push(`${label}${v}`)}return parts.length?parts.join(' / '):'数値未抽出'}
function make(rows){const ps=[];for(const r of rows){const p=val(r,aliases.name);if(valid(p)&&!ps.some(x=>n(x)===n(p)))ps.push(p)}const out=[];for(const p of ps){const a=line(rows,p,'2025-2026'),b=line(rows,p,'2026-2027');if(a==='数値未抽出'&&b==='数値未抽出')continue;out.push(`${p}\n  2025-2026：${a}\n  2026-2027：${b}`)}return out.length?`【旧→新 同一指標比較（最優先Evidence）】\n${out.join('\n')}\n上記の具体値を根拠欄でも明示すること。2026-2027が数値未抽出なら「数試合」「好調」などへ言い換えて補完せず、数値未取得と明記すること。母数が小さい現在値は旧通算と同じ重みで断定しない。`:''}
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e||!/クリーンナップ|中軸|主軸|打線|打順|打撃|打率|ops|長打|安打/i.test(String(q||'')))return e;const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const block=make(rows);if(block){e.comparison=block;e.text=block+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 同一指標の具体値比較を最優先Evidenceとして付与。'}return e};
window.MAGI_EVIDENCE_NUMERIC_COMPARE='v210';
})();