(()=>{
'use strict';
if(window.MAGI_BEST_ORDER_EVIDENCE_V270)return;
const PLAYERS=['大久保 陽翔','大野 竜暉','嶋田 栄志','井坂 悠聖','橋向 結都','坂田 暉馬','武澤 大翔','大久保 夢翔','吉田 真翔','武田 晴琉翔','鰐渕 将太','上村 蓮','中嶋 玲月','長侶 穹'];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const aliases={name:['選手名','氏名','名前','選手'],avg:['打率'],pa:['打席','打席数'],ab:['打数'],h:['安打'],rbi:['打点'],runs:['得点'],bb:['四球'],hbp:['死球'],so:['三振'],sb:['盗塁'],obp:['出塁率'],slg:['長打率'],ops:['ops'],pos:['守備位置','守備']};
function idx(r,a){const cols=r?.columns||[],want=a.map(norm);for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;return-1}
function val(r,a){const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()}
function season(r){const s=`${r?.fileName||''} ${r?.sheetName||''}`;if(/2025\s*[-–—_. /]?\s*2026|旧チーム/i.test(s))return'2025-2026';if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(s))return'2026-2027';return''}
function useful(r){const s=String(r?.sheetName||'');return !/詳細|相手|打順|得点圏|ピボット|打球|投手|捕手/i.test(s)&&['avg','pa','ab','h','rbi','runs','bb','hbp','so','sb','obp','slg','ops'].filter(k=>val(r,aliases[k])!=='').length}
function bestRows(all,y){const out=[];for(const p of PLAYERS){const rows=all.filter(r=>season(r)===y&&norm(val(r,aliases.name))===norm(p)&&useful(r)>0).sort((a,b)=>useful(b)-useful(a));if(rows[0])out.push([p,rows[0]])}return out}
function battingLine(p,r){return `${p}｜打席=${val(r,aliases.pa)||'取得不能'} 打数=${val(r,aliases.ab)||'取得不能'} 打率=${val(r,aliases.avg)||'取得不能'} 出塁率=${val(r,aliases.obp)||'取得不能'} 長打率=${val(r,aliases.slg)||'取得不能'} OPS=${val(r,aliases.ops)||'取得不能'} 安打=${val(r,aliases.h)||'取得不能'} 得点=${val(r,aliases.runs)||'取得不能'} 打点=${val(r,aliases.rbi)||'取得不能'} 四球=${val(r,aliases.bb)||'取得不能'} 死球=${val(r,aliases.hbp)||'取得不能'} 三振=${val(r,aliases.so)||'取得不能'} 盗塁=${val(r,aliases.sb)||'取得不能'}`}
function positions(all){const lines=[];for(const p of PLAYERS){const rr=all.filter(r=>season(r)==='2026-2027'&&norm(val(r,aliases.name))===norm(p)&&val(r,aliases.pos)!=='').sort((a,b)=>String(b.sheetName||'').includes('一覧')-String(a.sheetName||'').includes('一覧'));if(rr[0])lines.push(`${p}=${val(rr[0],aliases.pos)}`)}return lines}
function isBestOrder(q){return /ベストオーダー|最適(?:な)?打順|打順.*(?:組|決|提案)|スタメン.*打順/i.test(String(q||''))}
function build(q,base){const all=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const old=bestRows(all,'2025-2026'),cur=bestRows(all,'2026-2027'),pos=positions(all);const mandate=[
'【BEST ORDER専用・回答形式は絶対遵守】',
'関連選手を挙げるだけで終えてはならない。最終判断に、1番から9番までの選手名と基本守備位置を番号付きで必ず明示する。',
'さらに先発投手、投手交代時の守備変更、入替候補2名、見直し条件を明示する。抽象的な「軸にする」「様子を見る」だけの回答は禁止。',
'旧年度は実績と再現性、現年度は現在状態、直近6試合は短期状態として分離する。現年度の少数打席だけで固定せず、旧年度を無視もしない。',
'候補14名全員を比較してから9名を選ぶ。守備位置の成立と投手・捕手兼任を必ず確認する。',
'チーム方針：4番は大久保陽翔、5番は中嶋玲月を原則固定する。3番は判断材料不足のため固定しない。大久保陽翔が先発投手の日のみ5〜6番へ下げ、中嶋を4番にする選択肢を持つ。左翼はフライ対応力と脚力を評価して武田晴琉翔を有力候補とする。大久保夢翔は能力を否定せず、役割を絞り、ミス・失点後の切り替えを観察しながら段階起用する。性格を固定評価しない。現時点の暫定案：1嶋田栄志、2大野竜暉、3坂田暉馬（未固定）、4大久保陽翔、5中嶋玲月、6鰐渕将太、7橋向結都、8武田晴琉翔、9吉田真翔。'
];
const text=[...(base?.text?[base.text]:[]),...mandate,'【2025-2026 過去実績】',...old.map(x=>battingLine(...x)),'【2026-2027 現チーム実績】',...cur.map(x=>battingLine(...x)),'【2026-2027 守備候補】',...pos].join('\n');
return{...(base||{}),count:(base?.count||0)+old.length+cur.length+pos.length,files:[...new Set([...(base?.files||[]),...all.map(r=>r.fileName).filter(Boolean)])],evidenceLayers:[...(base?.evidenceLayers||[]),'BEST ORDER','PAST+CURRENT','ALL 14 PLAYERS','DEFENSIVE CONSTRAINTS'],summary:`旧年度${old.length}名・現年度${cur.length}名・守備${pos.length}名を比較し、1〜9番の確定提示を要求。`,text};}
function install(){if(typeof window.searchDataEvidence!=='function')return false;if(window.searchDataEvidence.__bestOrderV270)return true;const prev=window.searchDataEvidence;window.searchDataEvidence=function(q){const base=prev(q);return isBestOrder(q)?build(q,base):base};window.searchDataEvidence.__bestOrderV270=true;window.MAGI_BEST_ORDER_EVIDENCE_V268=true;return true}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(timer)},100);install();
})();
