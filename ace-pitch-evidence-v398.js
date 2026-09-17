(()=>{
'use strict';
if(window.MAGI_ACE_PITCH_EVIDENCE_V398)return;
window.MAGI_ACE_PITCH_EVIDENCE_V398=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const nameCols=['選手名','投手名','氏名','名前','選手'];
const statAliases={
 innings:['投球回','投球回数'],win:['勝利','勝'],loss:['敗北','敗'],save:['セーブ'],
 batters:['対打者'],pitches:['投球数'],hits:['被安打'],runs:['失点'],earned:['自責点'],
 walks:['与四球'],hbp:['与死球'],strikeouts:['奪三振'],wildPitches:['暴投']
};
const idx=(r,a)=>{const c=r.columns||[],w=a.map(norm);for(let i=0;i<c.length;i++)if(w.includes(norm(c[i])))return i;for(let i=0;i<c.length;i++)if(w.some(x=>x&&norm(c[i]).includes(x)))return i;return-1};
const player=r=>{const i=idx(r,nameCols);return i<0?'':String((r.values||[])[i]??'').trim()};
const season=r=>{const s=`${r.fileName||''} ${r.sheetName||''} ${r.searchable||''}`;if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/.test(s))return'2026-2027';if(/2025\s*[-–—_. /]?\s*2026|旧チーム/.test(s))return'2025-2026';return'年度不明'};
const pitching=r=>/^投手詳細(?:2025-2026|2026-2027)\.csv$/i.test(String(r.fileName||'').trim());
const value=(r,names)=>{const i=idx(r,names);return i<0?'':String((r.values||[])[i]??'').trim()};
const whole=v=>{const s=String(v??'').replace(/,/g,'').trim();if(!s||s==='-'||s==='—')return null;const x=Number(s);return Number.isFinite(x)?Math.trunc(x):null};
const inningsToOuts=v=>{const s=String(v??'').trim().replace(/回$/,'');const m=s.match(/^(\d+)(?:\.(\d))?$/);if(!m)return null;const rem=Number(m[2]||0);return rem<=2?Number(m[1])*3+rem:null};
const fmt=o=>`${Math.floor(o/3)}.${o%3}`;
function aggregate(rows){
 const t={games:rows.length,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,hits:0,runs:0,earned:0,walks:0,hbp:0,strikeouts:0,wildPitches:0};
 for(const r of rows){const o=inningsToOuts(value(r,statAliases.innings));if(o!==null)t.outs+=o;for(const k of ['win','loss','save','batters','pitches','hits','runs','earned','walks','hbp','strikeouts','wildPitches']){const x=whole(value(r,statAliases[k]));if(x!==null)t[k]+=x}}
 t.innings=fmt(t.outs);t.era=t.outs>0?(t.earned*21/t.outs).toFixed(2):'取得不能';t.walksHbp=t.walks+t.hbp;return t;
}
function buildAceEvidence(rows){
 const currentRows=rows.filter(r=>season(r)==='2026-2027');
 const names=[];const seen=new Set();
 for(const r of currentRows){const p=player(r);const k=norm(p);if(!p||!k||k===norm(EXCLUDED)||seen.has(k))continue;seen.add(k);names.push(p)}
 if(!names.length)return null;
 const keys=new Set(names.map(norm));
 const picked=rows.filter(r=>keys.has(norm(player(r))));
 const lines=[
  '【エース候補比較専用 EVIDENCE｜7回制】',
  '2026-2027投手詳細CSVに登板記録がある現チーム投手を自動抽出し、同一基準で比較する。',
  `【候補除外】${EXCLUDED}は正捕手として運用するためエース候補から除外。`,
  `【比較対象】${names.join('・')}`,
  'MELCHIOR-1は数値・母数、BALTHASAR-2は先発として試合を作る力と7回制運用、CASPER-3は現在の守備役割との両立と継続起用を重視する。各賢人は第一候補を1名だけ選ぶ。'
 ];
 const totals={};
 for(const p of names){
   totals[p]={};
   for(const y of ['2026-2027','2025-2026']){
     const rr=picked.filter(r=>norm(player(r))===norm(p)&&season(r)===y);
     if(!rr.length)continue;
     const t=aggregate(rr);totals[p][y]=t;
     lines.push(`【${p}｜${y}】登板=${t.games}｜投球回=${t.innings}｜防御率=${t.era}｜${t.win}勝${t.loss}敗｜奪三振=${t.strikeouts}｜与四球=${t.walks}｜与死球=${t.hbp}｜自責点=${t.earned}｜被安打=${t.hits}｜投球数=${t.pitches}`);
   }
 }
 lines.push('旧チーム成績は参考資料。現チーム2026-2027の実績を主評価とし、母数不足は不確実性として明示する。数値を推測で補完しない。');
 const files=[...new Set(picked.map(r=>r.fileName).filter(Boolean))];
 return {count:picked.length,files,seasons:[...new Set(picked.map(season))],players:names,evidenceLayers:['PITCHING ONLY','ACE CANDIDATE COMPARISON','2026-2027 CURRENT','2025-2026 REFERENCE'],missingEvidence:[],canonicalPitchingTotals:totals,summary:`エース候補比較として現チーム投手${names.length}名・投手詳細CSV ${picked.length}行を取得。`,text:lines.join('\n')};
}
function install(){
 if(typeof window.searchDataEvidence!=='function')return false;
 if(window.searchDataEvidence.__magiAcePitchEvidence==='v398')return true;
 const prev=window.searchDataEvidence;
 window.searchDataEvidence=function(q){
   const s=String(q||'').normalize('NFKC');
   if(!ACE_RE.test(s))return prev(q);
   const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive'&&pitching(r));
   const evidence=buildAceEvidence(rows);
   return evidence||prev(q);
 };
 window.searchDataEvidence.__magiAcePitchEvidence='v398';
 window.MAGI_ACE_PITCH_EVIDENCE_META=Object.freeze({version:'v398',genericAceComparison:true,excludedCatcher:EXCLUDED,observer:false});
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>=120)clearInterval(timer)},100);
install();
})();
