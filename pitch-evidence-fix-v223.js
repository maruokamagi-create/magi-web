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
const statAliases={
 innings:['投球回','投球回数'],win:['勝利','勝'],loss:['敗北','敗'],save:['セーブ'],
 batters:['対打者'],pitches:['投球数'],hits:['被安打'],runs:['失点'],earned:['自責点'],
 walks:['与四球'],hbp:['与死球'],strikeouts:['奪三振'],wildPitches:['暴投']
};
const value=(r,names)=>{const i=idx(r,names);return i<0?'':String((r.values||[])[i]??'').trim()};
const whole=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?Math.trunc(x):null};
const inningsToOuts=v=>{const s=String(v??'').trim().replace(/回$/,'');const m=s.match(/^(\d+)(?:\.(\d))?$/);if(!m)return null;const rem=Number(m[2]||0);return rem<=2?Number(m[1])*3+rem:null};
const formatInnings=o=>`${Math.floor(o/3)}.${o%3}`;
function aggregatePitching(rr){
 const t={games:rr.length,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,hits:0,runs:0,earned:0,walks:0,hbp:0,strikeouts:0,wildPitches:0},missing=[];
 for(const r of rr){
  const o=inningsToOuts(value(r,statAliases.innings));if(o===null)missing.push(`投球回:${r.rowNumber||'?'}行`);else t.outs+=o;
  for(const k of ['win','loss','save','batters','pitches','hits','runs','earned','walks','hbp','strikeouts','wildPitches']){const x=whole(value(r,statAliases[k]));if(x!==null)t[k]+=x}
 }
 t.innings=formatInnings(t.outs);t.era=t.outs>0?(t.earned*21/t.outs).toFixed(2):'取得不能';t.walksHbp=t.walks+t.hbp;
 return{...t,missing:[...new Set(missing)]};
}
function specificPitching(q,rows){
 if(!/投手|ピッチャー|先発|継投|抑え|クローザー|防御率|奪三振|投球/i.test(q))return null;
 const ps=target(q,rows);if(!ps.length)return null;const keys=new Set(ps.map(n)),picked=[],seen=new Set();
 for(const r of rows){if(!keys.has(n(player(r))))continue;const k=`${r.fileName||''}|${r.rowNumber||''}|${r.display||''}`;if(!seen.has(k)){seen.add(k);picked.push(r)}}
 const lines=['【CANONICAL PITCHING TOTALS｜7回制｜プログラム集計】','以下はCSVの各登板をアウト数へ変換して合計した確定値。三賢人はこの数値を変更・再計算・推測してはならない。'];
 const totals={};const missing=[];
 for(const [y] of seasons){
  const rr=picked.filter(r=>season(r)===y);lines.push(`【${y}：${ps.join('・')}】`);
  if(!rr.length){lines.push('対象選手の投手成績行を取得できず。');missing.push(`${y}の投手成績`);continue}
  const t=aggregatePitching(rr);totals[y]=t;
  lines.push(`登板数=${t.games}試合｜投球回=${t.innings}回｜防御率=${t.era}（自責点×7÷投球回）｜勝敗=${t.win}勝${t.loss}敗｜セーブ=${t.save}｜奪三振=${t.strikeouts}｜与四球=${t.walks}｜与死球=${t.hbp}｜与四死球=${t.walksHbp}｜自責点=${t.earned}｜被安打=${t.hits}｜投球数=${t.pitches}`);
  if(t.missing.length){lines.push(`変換不能行=${t.missing.join('、')}`);missing.push(...t.missing)}
 }
 lines.push('投球回の .1 は1アウト、.2は2アウトとして合計する。防御率は7回制として 自責点×7÷投球回 で算出する。打撃・守備成績は投手数値に混入させない。');
 return{rows:picked,totals,missing,text:lines.join('\n')};
}
function install(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.searchDataEvidence.__magiPitchIsolation==='v230')return true;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){
  q=String(q||'');
  const isPitchQuestion=/投手|ピッチャー|先発|継投|抑え|クローザー|防御率|奪三振|投球/i.test(q);
  if(!isPitchQuestion)return prev(q);
  const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'&&pitching(r));
  const p=specificPitching(q,rows);
  if(!p)return{count:0,files:[...new Set(rows.map(r=>r.fileName).filter(Boolean))],seasons:[],players:[],evidenceLayers:['PITCHING ONLY'],missingEvidence:['質問中の対象投手を投手詳細CSVから特定できない'],summary:'投手質問のため打撃・守備データを除外。対象投手の投手行を特定できませんでした。',text:'【投手専用 EVIDENCE】\n打撃・守備・通算打撃成績は除外。対象投手の投手成績行を取得できず、推測で補完しない。'};
  const files=[...new Set(p.rows.map(r=>r.fileName).filter(Boolean))],ys=[...new Set(p.rows.map(season))],ps=[...new Set(p.rows.map(player).filter(Boolean))];
  return{count:p.rows.length,files,seasons:ys,players:ps,evidenceLayers:['PITCHING ONLY','PLAYER-SPECIFIC PITCHING','2025-2026 HISTORY','2026-2027 CURRENT'],missingEvidence:p.missing||[],canonicalPitchingTotals:p.totals,summary:`投手質問として打撃・守備を除外し、投手詳細CSV ${files.length}ファイル・${p.rows.length}行だけを取得。`,text:p.text};
 };
 window.searchDataEvidence.__magiPitchIsolation='v230';
 window.MAGI_PITCH_EVIDENCE_FIX='v230';return true;
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