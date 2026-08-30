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
function make(rows){const ps=[];for(const r of rows){const p=val(r,aliases.name);if(valid(p)&&!ps.some(x=>n(x)===n(p)))ps.push(p)}const out=[];for(const p of ps){const old=line(rows,p,'2025-2026'),cur=line(rows,p,'2026-2027');if(old==='数値未抽出'&&cur==='数値未抽出')continue;out.push(`${p}\n  2026-2027（現在・判断の主軸）：${cur}\n  2025-2026（参考）：${old}`)}return out.length?`【新チーム現在値を主軸にしたEvidence】\n${out.join('\n')}\n判断の主軸は2026-2027の新チーム成績・直近内容とする。2025-2026の旧チーム成績は参考資料であり、現在の序列を旧成績だけで決めないこと。特に大久保陽翔・大野竜暉以外は旧チームでレギュラーではなく出場機会・打席数が少ないため、旧成績の低い数値や小標本を能力差として直接比較しないこと。大久保陽翔・大野竜暉についても旧通算は実績確認の参考に留め、現在の起用判断は2026-2027を優先すること。2026-2027が数値未抽出なら「好調」等で補完せず数値未取得と明記すること。新チームの母数が小さい場合は断定の強さを調整するが、母数が少ないことだけを理由に現在の判断を放棄しないこと。`:''}
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e||!/クリーンナップ|中軸|主軸|打線|打順|打撃|打率|ops|長打|安打/i.test(String(q||'')))return e;const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const block=make(rows);if(block){e.comparison=block;e.text=block+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 2026-2027現在値を判断の主軸、2025-2026旧成績を参考Evidenceとして付与。旧チーム非レギュラーの小標本は能力差として直接比較しない。'}return e};
window.MAGI_EVIDENCE_NUMERIC_COMPARE='v211';
})();