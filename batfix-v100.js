(()=>{
const oldSearch=searchDataEvidence,oldMel=melchior,oldBal=balthasar,oldRender=renderEvidence;
let lastBat=null;
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）【】]/g,'');
const val=(r,i)=>String((r.values||[])[i]??'').trim();
const num=v=>{const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:0};
const fmt=(x,d=3)=>x.toFixed(d).replace(/^0(?=\.)/,'');
function batting(q){
 const all=dataRecords.filter(r=>(r.fileName||'')==='打撃詳細2026-2027.csv'); if(!all.length)return null;
 const nq=n(q),names=[...new Set(all.map(r=>val(r,5)).filter(Boolean))];
 const player=names.filter(x=>nq.includes(n(x))).sort((a,b)=>n(b).length-n(a).length)[0]||'';
 let rows=player?all.filter(r=>n(val(r,5))===n(player)):all.slice();
 rows=rows.map(r=>({r,t:(()=>{const m=val(r,0).match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,+m[3]).getTime():0})(),k:r.rowNumber||0})).sort((a,b)=>b.t-a.t||b.k-a.k).map(x=>x.r);
 if(/最近|直近/.test(q))rows=rows.slice(0,5); if(!rows.length)return null;
 const S=i=>rows.reduce((a,r)=>a+num(val(r,i)),0),PA=S(7),AB=S(8),RBI=S(10),R=S(11),H=S(12),B1=S(13),B2=S(14),B3=S(15),HR=S(16),SO=S(17),BB=S(18),HBP=S(19),SB=S(24),CS=S(26),SF=S(28);
 const avg=AB?H/AB:0,den=AB+BB+HBP+SF,obp=den?(H+BB+HBP)/den:0,slg=AB?(B1+2*B2+3*B3+4*HR)/AB:0,ops=obp+slg;
 const scope=/最近|直近/.test(q)?`直近${rows.length}記録`:`全${rows.length}記録`;
 const summary=`${player?player+'の':''}${scope}：${PA}打席・${AB}打数・${H}安打・打率${fmt(avg)}・出塁率${fmt(obp)}・長打率${fmt(slg)}・OPS${fmt(ops)}・${RBI}打点・${R}得点・三振${SO}・四球${BB}・死球${HBP}・盗塁${SB}${CS?`・盗塁死${CS}`:''}`;
 return{player,rows,files:['打撃詳細2026-2027.csv'],summary,text:rows.slice(0,5).map(r=>`[${r.fileName}] ${r.display}`).join('\n')};
}
searchDataEvidence=function(q){
 if(/打撃|打率|OPS|ops|出塁|長打|安打|打点|打席|打数/.test(q)){
  lastBat=batting(q); if(lastBat)return{count:lastBat.rows.length,files:lastBat.files,summary:lastBat.summary,text:lastBat.text,batAnalysis:lastBat};
 }
 lastBat=null; return oldSearch(q);
};
melchior=function(x,e){const p=oldMel(x,e),b=e&&e.batAnalysis;if(!b)return p;p.vote='cond';p.conf=Math.max(p.conf,92);p.text=`DATA HUBの打撃CSVを列位置まで確認して再集計しました。${b.summary}。この実数値を判断基準にします。`;p.basis=`${b.summary}。参照：打撃詳細2026-2027.csv`;p.concern='直近値は最大5記録で母数が小さいため、通算・対戦相手・打順との比較も必要です。';return p};
balthasar=function(x){const p=oldBal(x);if(!lastBat||!x.tacticHits.length)return p;p.conf=Math.max(p.conf,82);p.basis=`戦術判断に使う実績：${lastBat.summary}`;return p};
renderEvidence=function(e){if(!(e&&e.batAnalysis))return oldRender(e);const box=$('dataEvidence');box.classList.add('show');box.innerHTML='<b>DATA HUB 関連データ</b>\n'+escapeHtml(e.text)+'\n\n<b>【自動集計】</b>\n'+escapeHtml(e.batAnalysis.summary)+'\n<b>【参照ファイル】</b>\n打撃詳細2026-2027.csv'};
window.MAGI_BATTING_SCHEMA_FIX=true;
})();