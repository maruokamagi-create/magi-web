(()=>{
'use strict';
const n=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const nameCols=['選手名','投手名','氏名','名前','選手'];
const seasons=[['2025-2026',/2025\s*[-–—_. /]?\s*2026|旧チーム/],['2026-2027',/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/]];
const idx=(r,a)=>{const c=r.columns||[],w=a.map(n);for(let i=0;i<c.length;i++)if(w.includes(n(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&n(c[i]).includes(x)))return i;return-1};
const player=r=>{const i=idx(r,nameCols);return i<0?'':String((r.values||[])[i]??'').trim()};
const season=r=>{const s=`${r.fileName||''} ${r.sheetName||''} ${r.searchable||''}`;for(const [y,re] of seasons)if(re.test(s))return y;return'年度不明'};
const pitching=r=>/投手|投球|登板|投球回|防御率|奪三振|与四球|与死球|自責点|被安打|球数/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`);
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
 if(window.MAGI_PITCH_EVIDENCE_FIX==='v223'||typeof window.searchDataEvidence!=='function')return false;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){const base=prev(q),rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'),p=specificPitching(String(q||''),rows);if(!p)return base;const e=base&&typeof base==='object'?base:{};e.text=p.text+(e.text?'\n\n'+e.text:'');e.summary=`対象選手の年度別投手成績を優先取得（${p.rows.length}行）。 `+String(e.summary||'');e.count=(Number(e.count)||0)+p.rows.length;e.evidenceLayers=[...new Set(['PLAYER-SPECIFIC PITCHING','2025-2026 HISTORY','2026-2027 CURRENT',...(e.evidenceLayers||[])])];return e};
 window.MAGI_PITCH_EVIDENCE_FIX='v223';return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
const replacements=[[/試合は明日から始まるんだぞ。?/g,'将来の育成は必要だ。だが、今の勝利につながる具体策はどこにある？'],[/試合は明日なんだぞ。?/g,'今の勝利につながる具体策を示せ。']];
const rewrite=root=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let x;while(x=w.nextNode()){let v=x.nodeValue;for(const [a,b] of replacements)v=v.replace(a,b);if(v!==x.nodeValue)x.nodeValue=v}};
new MutationObserver(ms=>{for(const m of ms)for(const x of m.addedNodes){if(x.nodeType===3){let v=x.nodeValue;for(const [a,b] of replacements)v=v.replace(a,b);x.nodeValue=v}else if(x.nodeType===1)rewrite(x)}}).observe(document.documentElement,{childList:true,subtree:true});
})();