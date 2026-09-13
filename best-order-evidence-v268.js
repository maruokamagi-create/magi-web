(()=>{
'use strict';
if(window.MAGI_BEST_ORDER_EVIDENCE_V342)return;
window.MAGI_BEST_ORDER_EVIDENCE_V342=true;
const PLAYERS=['大久保 陽翔','大野 竜暉','嶋田 栄志','井坂 悠聖','橋向 結都','坂田 暉馬','武澤 大翔','大久保 夢翔','吉田 真翔','武田 晴琉翔','鰐渕 将太','上村 蓮','中嶋 玲月','長侶 穹'];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const aliases={
 name:['選手名','氏名','名前','選手'],games:['試合','試合数','出場試合'],avg:['打率'],pa:['打席','打席数','PA'],ab:['打数','AB'],h:['安打','H'],rbi:['打点','RBI'],runs:['得点'],bb:['四球','BB'],hbp:['死球','HBP'],so:['三振','SO','K'],sb:['盗塁','SB'],obp:['出塁率','OBP'],slg:['長打率','SLG'],ops:['OPS'],pos:['守備位置','守備'],
 date:['開催日','試合日','日付'],event:['大会名','大会','区分'],game:['試合順','試合','試合番号'],opp:['相手校','対戦相手','相手'],single:['単打'],double:['二塁打','2塁打'],triple:['三塁打','3塁打'],hr:['本塁打','HR'],sf:['犠飛','犠牲フライ']
};
function idx(r,a){const cols=r?.columns||[],want=a.map(norm);for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;return-1}
function val(r,a){const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()}
function num(v){const n=Number(String(v??'').replace(/[%％,]/g,''));return Number.isFinite(n)?n:0}
function season(r){const s=`${r?.fileName||''} ${r?.sheetName||''}`;if(/2025\s*[-–—_. /]?\s*2026|旧チーム/i.test(s))return'2025-2026';if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(s))return'2026-2027';return''}
function useful(r){const s=String(r?.sheetName||'');return !/詳細|相手|打順|得点圏|ピボット|打球|投手|捕手/i.test(s)&&['avg','pa','ab','h','rbi','runs','bb','hbp','so','sb','obp','slg','ops'].filter(k=>val(r,aliases[k])!=='').length}
function bestRows(all,y){const out=[];for(const p of PLAYERS){const rows=all.filter(r=>season(r)===y&&norm(val(r,aliases.name))===norm(p)&&useful(r)>0).sort((a,b)=>useful(b)-useful(a));if(rows[0])out.push([p,rows[0]])}return out}
function battingLine(p,r){return `${p}｜試合=${val(r,aliases.games)||'取得不能'} 打席=${val(r,aliases.pa)||'取得不能'} 打数=${val(r,aliases.ab)||'取得不能'} 打率=${val(r,aliases.avg)||'取得不能'} 出塁率=${val(r,aliases.obp)||'取得不能'} 長打率=${val(r,aliases.slg)||'取得不能'} OPS=${val(r,aliases.ops)||'取得不能'} 安打=${val(r,aliases.h)||'取得不能'} 得点=${val(r,aliases.runs)||'取得不能'} 打点=${val(r,aliases.rbi)||'取得不能'} 四球=${val(r,aliases.bb)||'取得不能'} 死球=${val(r,aliases.hbp)||'取得不能'} 三振=${val(r,aliases.so)||'取得不能'} 盗塁=${val(r,aliases.sb)||'取得不能'}`}
function positions(all){const lines=[];for(const p of PLAYERS){const rr=all.filter(r=>season(r)==='2026-2027'&&norm(val(r,aliases.name))===norm(p)&&val(r,aliases.pos)!=='').sort((a,b)=>String(b.sheetName||'').includes('一覧')-String(a.sheetName||'').includes('一覧'));if(rr[0])lines.push(`${p}=${val(rr[0],aliases.pos)}`)}return lines}
function parseDate(v){const m=String(v||'').match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);return m?Date.UTC(+m[1],+m[2]-1,+m[3]):0}
function gameNo(v){const m=String(v||'').match(/(\d+)/);return m?Number(m[1]):0}
function gameKey(r){return [val(r,aliases.date),val(r,aliases.event),val(r,aliases.game),val(r,aliases.opp)].join('|')}
function recentSix(all){
 const detail=all.filter(r=>season(r)==='2026-2027'&&/打撃詳細2026-2027\.csv/i.test(String(r?.fileName||''))&&val(r,aliases.date)&&val(r,aliases.name));
 const gm=new Map();
 for(const r of detail){const k=gameKey(r);if(!gm.has(k))gm.set(k,{key:k,date:parseDate(val(r,aliases.date)),gameNo:gameNo(val(r,aliases.game)),label:`${val(r,aliases.date)} ${val(r,aliases.game)} ${val(r,aliases.opp)}`.trim()})}
 const games=[...gm.values()].sort((a,b)=>(b.date-a.date)||(b.gameNo-a.gameNo)).slice(0,6);const keys=new Set(games.map(g=>g.key));
 const lines=[];
 for(const p of PLAYERS){
  const rows=detail.filter(r=>keys.has(gameKey(r))&&norm(val(r,aliases.name))===norm(p));if(!rows.length)continue;
  const t={pa:0,ab:0,h:0,bb:0,hbp:0,sf:0,d2:0,d3:0,hr:0,rbi:0,runs:0,so:0,sb:0};const appeared=new Set();
  for(const r of rows){appeared.add(gameKey(r));t.pa+=num(val(r,aliases.pa));t.ab+=num(val(r,aliases.ab));t.h+=num(val(r,aliases.h));t.bb+=num(val(r,aliases.bb));t.hbp+=num(val(r,aliases.hbp));t.sf+=num(val(r,aliases.sf));t.d2+=num(val(r,aliases.double));t.d3+=num(val(r,aliases.triple));t.hr+=num(val(r,aliases.hr));t.rbi+=num(val(r,aliases.rbi));t.runs+=num(val(r,aliases.runs));t.so+=num(val(r,aliases.so));t.sb+=num(val(r,aliases.sb))}
  const avg=t.ab?t.h/t.ab:0,obp=(t.ab+t.bb+t.hbp+t.sf)?(t.h+t.bb+t.hbp)/(t.ab+t.bb+t.hbp+t.sf):0,tb=t.h+t.d2+2*t.d3+3*t.hr,slg=t.ab?tb/t.ab:0,ops=obp+slg;
  const f=n=>n.toFixed(3).replace(/^0/,'.');
  lines.push(`${p}｜直近${appeared.size}試合 打席=${t.pa} 打数=${t.ab} 安打=${t.h} 打率=${f(avg)} 出塁率=${f(obp)} 長打率=${f(slg)} OPS=${f(ops)} 打点=${t.rbi} 得点=${t.runs} 三振=${t.so} 盗塁=${t.sb}`);
 }
 return{games,lines};
}
function isBestOrder(q){return /ベストオーダー|最適(?:な)?打順|打順.*(?:組|決|提案)|スタメン.*打順/i.test(String(q||''))}
function build(q,base){const all=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const old=bestRows(all,'2025-2026'),cur=bestRows(all,'2026-2027'),pos=positions(all),recent=recentSix(all);const mandate=[
'【BEST ORDER専用・回答形式は絶対遵守】',
'関連選手を挙げるだけで終えてはならない。最終判断に、1番から9番までの選手名と基本守備位置を番号付きで必ず明示する。',
'さらに先発投手、投手交代時の守備変更、入替候補2名、見直し条件を明示する。抽象的な「軸にする」「様子を見る」だけの回答は禁止。',
'打順判断は必ず3層で行う。①2025-2026の過去実績＝実績・再現性・経験、②2026-2027通算＝現在地、③直近6試合＝最近の調子・短期トレンド。どれか1層だけで決めてはならない。',
'過去実績は「参考資料だから弱く扱う」のではなく、現在選手について再現性を測る重要なベースラインとして明示的に評価する。ただし過去だけで現状を上書きしない。',
'直近6試合は必ず打撃詳細2026-2027.csvの試合別記録から集計した値を使う。短期成績は調子判断に使うが、打席が少ない場合は母数不足を明示する。',
'最終打順では各選手について、少なくとも「過去実績」「今季通算」「直近6試合」のうち利用できる数値を理由に含める。「信頼」「役割」「バランス」だけで打順を説明してはならない。',
'4番や中軸を変更する場合は、過去実績・今季通算・直近6の3層から、従来の中軸候補を上回る具体的根拠を示す。根拠が弱ければ変更しない。',
'候補14名全員を比較してから9名を選ぶ。守備位置の成立と投手・捕手兼任を必ず確認する。',
'チーム方針：4番は大久保陽翔、5番は中嶋玲月を原則固定する。3番は判断材料不足のため固定しない。大久保陽翔が先発投手の日のみ5〜6番へ下げ、中嶋を4番にする選択肢を持つ。左翼はフライ対応力と脚力を評価して武田晴琉翔を有力候補とする。大久保夢翔は能力を否定せず、役割を絞り、ミス・失点後の切り替えを観察しながら段階起用する。性格を固定評価しない。'
];
const recentHeader=recent.games.length?`【直近6試合 対象】${recent.games.map(g=>g.label).join(' / ')}`:'【直近6試合 対象】打撃詳細CSVから試合を抽出できず';
const text=[...(base?.text?[base.text]:[]),...mandate,'【2025-2026 過去実績・再現性】',...old.map(x=>battingLine(...x)),'【2026-2027 今季通算】',...cur.map(x=>battingLine(...x)),recentHeader,'【直近6試合 最近の調子】',...(recent.lines.length?recent.lines:['集計不能。直近6試合を推測で補わないこと。']),'【2026-2027 守備候補】',...pos].join('\n');
return{...(base||{}),count:(base?.count||0)+old.length+cur.length+recent.lines.length+pos.length,files:[...new Set([...(base?.files||[]),...all.map(r=>r.fileName).filter(Boolean)])],evidenceLayers:[...(base?.evidenceLayers||[]),'PAST PERFORMANCE / REPEATABILITY','CURRENT SEASON','RECENT SIX FORM','ALL 14 PLAYERS','DEFENSIVE CONSTRAINTS'],summary:`過去実績${old.length}名・今季通算${cur.length}名・直近6集計${recent.lines.length}名・守備${pos.length}名を比較。過去の再現性と最近の調子を両方使って1〜9番を審議する。`,text};}
function install(){if(typeof window.searchDataEvidence!=='function')return false;if(window.searchDataEvidence.__bestOrderV342)return true;const prev=window.searchDataEvidence;window.searchDataEvidence=function(q){const base=prev(q);return isBestOrder(q)?build(q,base):base};window.searchDataEvidence.__bestOrderV342=true;window.MAGI_BEST_ORDER_EVIDENCE_V268=true;return true}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>300)clearInterval(timer)},100);install();
})();
