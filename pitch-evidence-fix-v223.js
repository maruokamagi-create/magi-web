(()=>{
'use strict';
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const nameCols=['選手名','投手名','氏名','名前','選手'];
const seasons=[['2025-2026',/2025\s*[-–—_. /]?\s*2026|旧チーム/],['2026-2027',/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/]];
const idx=(r,a)=>{const c=r.columns||[],w=a.map(n);for(let i=0;i<c.length;i++)if(w.includes(n(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&n(c[i]).includes(x)))return i;return-1};
const player=r=>{const i=idx(r,nameCols);return i<0?'':String((r.values||[])[i]??'').trim()};
const season=r=>{const s=`${r.fileName||''} ${r.sheetName||''} ${r.searchable||''}`;for(const [y,re] of seasons)if(re.test(s))return y;return'年度不明'};
const pitching=r=>/^投手詳細(?:2025-2026|2026-2027)\.csv$/i.test(String(r.fileName||'').trim());
const target=(q,rows)=>{const z=n(q),a=[];for(const r of rows){const p=player(r),k=n(p);if(p&&k&&z.includes(k)&&!a.some(x=>n(x)===k))a.push(p)}return a};
function specificPitching(q,rows){
 if(!/投手|ピッチャー|先発|継投|抑え|クローザー|防御率|奪三振|投球/i.test(q))return null;
 const ps=target(q,rows);if(!ps.length)return null;const keys=new Set(ps.map(n)),picked=[],seen=new Set();
 for(const r of rows){if(!pitching(r)||!keys.has(n(player(r))))continue;const k=`${season(r)}|${n(player(r))}|${r.fileName||''}|${r.sheetName||''}|${r.display||''}`;if(!seen.has(k)){seen.add(k);picked.push(r)}}
 const lines=['【対象選手優先・投手成績 EVIDENCE】'];
 for(const [y] of seasons){const rr=picked.filter(r=>season(r)===y);lines.push(`【${y} 投手成績：${ps.join('・')}】`);if(!rr.length)lines.push('対象選手の投手成績行を取得できず。推測で補完しない。');else for(const r of rr.slice(0,30))lines.push(`[${r.fileName||'ファイル名不明'}${r.sheetName?' / '+r.sheetName:''}] ${r.display||''}`)}
 lines.push('投手成績は打撃成績で代用しない。登板数・投球回・防御率・奪三振・与四死球を年度別に読み取り、記載のない指標だけを取得不能とする。');
 return{rows:picked,text:lines.join('\n')};
}
function install(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.searchDataEvidence.__magiPitchIsolation==='v229')return true;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){
  q=String(q||'');
  const isPitchQuestion=/投手|ピッチャー|先発|継投|抑え|クローザー|防御率|奪三振|投球/i.test(q);
  if(!isPitchQuestion)return prev(q);
  const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'&&pitching(r));
  const p=specificPitching(q,rows);
  if(!p)return{count:0,files:[...new Set(rows.map(r=>r.fileName).filter(Boolean))],seasons:[],players:[],evidenceLayers:['PITCHING ONLY'],missingEvidence:['質問中の対象投手を投手詳細CSVから特定できない'],summary:'投手質問のため打撃・守備データを除外。対象投手の投手行を特定できませんでした。',text:'【投手専用 EVIDENCE】\n打撃・守備・通算打撃成績は除外。対象投手の投手成績行を取得できず、推測で補完しない。'};
  const files=[...new Set(p.rows.map(r=>r.fileName).filter(Boolean))],ys=[...new Set(p.rows.map(season))],ps=[...new Set(p.rows.map(player).filter(Boolean))];
  return{count:p.rows.length,files,seasons:ys,players:ps,evidenceLayers:['PITCHING ONLY','PLAYER-SPECIFIC PITCHING','2025-2026 HISTORY','2026-2027 CURRENT'],missingEvidence:[],summary:`投手質問として打撃・守備を除外し、投手詳細CSV ${files.length}ファイル・${p.rows.length}行だけを取得。`,text:p.text};
 };
 window.searchDataEvidence.__magiPitchIsolation='v229';
 window.MAGI_PITCH_EVIDENCE_FIX='v229';return true;
}
let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>180)clearInterval(timer)},100);
const replacements=[
 [/試合(?:は|が)?明日(?:から始まる)?(?:なん)?だぞ[。！!]?/g,'次の試合に向けた勝ち筋も必要だ。'],
 [/明日の試合/g,'次の試合'],
 [/試合は明日/g,'次の試合']
];
const rewriteText=x=>{if(!x||x.nodeType!==3)return;let v=x.nodeValue;for(const [a,b] of replacements)v=v.replace(a,b);if(v!==x.nodeValue)x.nodeValue=v};
const rewrite=root=>{if(root.nodeType===3){rewriteText(root);return}const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let x;while(x=w.nextNode())rewriteText(x)};
new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')rewriteText(m.target);for(const x of m.addedNodes)rewrite(x)}}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
rewrite(document.documentElement);
})();