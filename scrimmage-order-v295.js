(()=>{
'use strict';
if(window.MAGI_SCRIMMAGE_ORDER_V295)return;

const OLD=[
 ['1','増田 晃大','三塁'],['2','宮村 龍','捕手'],['3','宮嵜 翔','投手'],
 ['4','櫻川 莉大','一塁'],['5','坂本 陸','遊撃'],['6','前川 夢斗','中堅'],
 ['7','北 淳志','二塁'],['8','佐々木 悠成','左翼'],['9','下田 涼歩','右翼']
];
const CURRENT=[
 ['1','嶋田 栄志','中堅'],['2','大野 竜暉','捕手'],['3','坂田 暉馬','二塁'],
 ['4','大久保 陽翔','三塁'],['5','中嶋 玲月','一塁'],['6','鰐渕 将太','遊撃'],
 ['7','橋向 結都','投手'],['8','武田 晴琉翔','左翼'],['9','吉田 真翔','右翼']
];
const CURRENT_BENCH=['武澤 大翔','井坂 悠聖','大久保 夢翔','上村 蓮','長侶 穹'];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aliases={name:['選手名','氏名','名前','選手'],avg:['打率'],pa:['打席','打席数'],ops:['ops']};

function isTarget(q){
 const s=String(q||'');
 return /紅白戦/.test(s)&&/新旧|旧.*新|新.*旧|3年|三年/.test(s)&&/オーダー|打順|スタメン|チーム/.test(s);
}
function idx(r,a){
 const cols=r?.columns||[],want=a.map(norm);
 for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;
 return -1;
}
function val(r,a){const i=idx(r,a);return i<0?'':String((r?.values||[])[i]??'').trim()}
function season(r){
 const s=`${r?.fileName||''} ${r?.sheetName||''}`;
 if(/2025\s*[-–—_. /]?\s*2026|旧チーム/i.test(s))return'2025-2026';
 if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/i.test(s))return'2026-2027';
 return'';
}
function useful(r){
 const s=String(r?.sheetName||'');
 if(/詳細|相手|打順|得点圏|ピボット|打球|投手|捕手/i.test(s))return 0;
 return ['avg','pa','ops'].filter(k=>val(r,aliases[k])!=='').length;
}
function stat(all,name,y){
 const row=all.filter(r=>season(r)===y&&norm(val(r,aliases.name))===norm(name)&&useful(r)>0).sort((a,b)=>useful(b)-useful(a))[0];
 if(!row)return null;
 return {pa:val(row,aliases.pa),avg:val(row,aliases.avg),ops:val(row,aliases.ops),file:row.fileName||''};
}
function teamTable(title,sub,rows,y,all,cls){
 const body=rows.map(x=>{
   const s=stat(all,x[1],y);
   return `<div>${esc(x[0])}</div><div><b>${esc(x[1])}</b></div><div>${esc(x[2])}</div><div>${esc(s?.avg||'—')}</div><div>${esc(s?.ops||'—')}</div>`;
 }).join('');
 return `<section class="scrimTeam ${cls}"><div class="scrimTeamHead"><div><small>${esc(sub)}</small><b>${esc(title)}</b></div><span>1–9</span></div><div class="scrimGrid"><div class="scrimTh">打順</div><div class="scrimTh">選手</div><div class="scrimTh">守備</div><div class="scrimTh">打率</div><div class="scrimTh">OPS</div>${body}</div></section>`;
}
function installStyle(){
 if(document.getElementById('magi-scrimmage-v295-style'))return;
 const s=document.createElement('style');s.id='magi-scrimmage-v295-style';
 s.textContent=`.scrimWrap{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.scrimTeam{border:1px solid #cad7e3;border-radius:12px;overflow:hidden;background:#fff;color:#102038}.scrimTeamHead{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#0b2748;color:#fff}.scrimTeam.current .scrimTeamHead{background:#7b1723}.scrimTeamHead small{display:block;font-size:10px;opacity:.72}.scrimTeamHead b{display:block;font-size:16px;margin-top:2px}.scrimTeamHead span{font-weight:900}.scrimGrid{display:grid;grid-template-columns:42px minmax(104px,1.4fr) 62px 52px 58px}.scrimGrid>div{padding:8px 5px;border-bottom:1px solid #e0e7ee;font-size:12px;white-space:nowrap}.scrimTh{font-size:10px!important;font-weight:900;background:#edf3f8;color:#4a6178}.scrimBench{margin-top:12px;padding:11px 12px;border-radius:10px;background:#eef3f8;font-size:12px;line-height:1.75}.scrimNote{margin-top:10px;font-size:12px;line-height:1.75;color:#52677c}@media(max-width:760px){.scrimWrap{grid-template-columns:1fr}.scrimGrid{grid-template-columns:38px minmax(104px,1.45fr) 56px 50px 55px}.scrimGrid>div{font-size:11px;padding:8px 4px}}`;
 document.head.appendChild(s);
}
function setText(id,text){const e=document.getElementById(id);if(e)e.textContent=text}
function render(q){
 installStyle();
 const all=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');
 const files=[...new Set(all.filter(r=>/2025\s*[-–—_. /]?\s*2026|2026\s*[-–—_. /]?\s*2027/i.test(`${r.fileName||''} ${r.sheetName||''}`)).map(r=>r.fileName).filter(Boolean))];
 const oldReady=OLD.filter(x=>stat(all,x[1],'2025-2026')).length;
 const currentReady=CURRENT.filter(x=>stat(all,x[1],'2026-2027')).length;
 const response=document.getElementById('response');if(!response)return false;
 response.classList.add('show');
 setText('caseQuestion',q);
 const meta=document.getElementById('caseMeta');if(meta)meta.innerHTML=`審議日：${new Date().toLocaleDateString('ja-JP')}<br>審議方式：新旧チーム紅白戦編成<br>DATA HUB：旧${oldReady}/9名・新${currentReady}/9名の打撃行を確認<br>参照：${esc(files.slice(0,3).join('、')||'Drive正本を索引化中')}`;
 const sig=document.getElementById('signalRow');if(sig)sig.innerHTML='<span class="chip">旧チーム9名</span><span class="chip">新チーム14名</span><span class="chip">守備成立</span><span class="chip">全員参加</span>';
 const finalTitle=document.querySelector('.final .title');if(finalTitle)finalTitle.textContent='《MAGI》紅白戦編成';
 setText('verdict','旧チーム9名 vs 新チーム14名');
 setText('v1','MELCHIOR：成績と守備を照合');setText('v2','BALTHASAR：勝負が成立');setText('v3','CASPER：新チーム全員を起用');
 const reason=document.getElementById('reason');if(reason)reason.innerHTML=`<b>紅白戦スターティングオーダー</b><div class="scrimWrap">${teamTable('旧チーム','3年生 9名',OLD,'2025-2026',all,'old')}${teamTable('新チーム','2年生＋1年生',CURRENT,'2026-2027',all,'current')}</div><div class="scrimBench"><b>新チーム交代枠：</b>${CURRENT_BENCH.map(esc).join('・')}<br>紅白戦では途中から守備・打席へ入り、14名全員を起用します。</div><div class="scrimNote">「—」はその選手の該当年度通算行を端末でまだ取得できていない項目です。名前や数字を推測で補うことはしません。</div>`;
 setText('mText',`旧チームは9名全員を守備位置まで成立させました。打撃データ取得は旧${oldReady}/9名、新${currentReady}/9名です。`);
 setText('mBasis','2025-2026・2026-2027の通算成績表を年度別に分離して確認');
 setText('mConcern',oldReady===9&&currentReady===9?'数値の欠損なし。紅白戦当日の出欠のみ確認が必要です。':'未取得の数値は推測せず「—」で表示します。');
 setText('mVote','◎ データ確認');
 setText('bText','旧チームは宮嵜 翔、新チームは橋向 結都を先発に置き、両軍とも捕手・内外野が成立する形にしました。');
 setText('bBasis','旧チームは実績、新チームは現時点の主力構成と4番・大久保 陽翔、5番・中嶋 玲月の軸を反映');
 setText('bConcern','新チームは交代枠5名にも打席を確保し、勝負と確認を両立させます。');setText('bVote','◎ 戦術成立');
 setText('cText','新チームは9人だけで終わらせません。交代枠5名を守備と打席に入れ、14名全員の現在地を見ます。');
 setText('cBasis','紅白戦を勝敗だけでなく、役割確認と競争機会として使う');setText('cConcern','交代時刻を先に決め、出場機会が曖昧にならないようにします。');setText('cVote','○ 条件付き賛成');
 document.querySelectorAll('#mConf,#bConf,#cConf').forEach(e=>e.textContent='Drive正本＋守備成立チェック');
 const next=document.getElementById('next');if(next){next.style.display='block';next.innerHTML='<b>変更条件：</b>当日の欠席・故障、投手の球数、最新試合での守備位置変更。新しい成績表を読み込めば、打率・OPS表示も更新します。'}
 const protocol=document.getElementById('engineProtocol');if(protocol)protocol.classList.add('hidden');
 setText('status','新旧チームの紅白戦オーダーを、実名・守備位置付きで表示しました。');
 try{const key='magiHistoryV92',a=JSON.parse(localStorage.getItem(key)||'[]');a.unshift({q:String(q),verdict:'旧チーム9名 vs 新チーム14名',time:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(a.slice(0,20)))}catch(_){ }
 response.scrollIntoView({behavior:'smooth',block:'start'});return true;
}
function install(){
 if(typeof window.runMagi!=='function')return false;
 if(window.runMagi.__scrimmageOrderV295)return true;
 const prev=window.runMagi;
 window.runMagi=function(){const q=document.getElementById('q')?.value||'';if(isTarget(q))return render(q);return prev.apply(this,arguments)};
 window.runMagi.__scrimmageOrderV295=true;window.MAGI_SCRIMMAGE_ORDER_V295=true;return true;
}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);install();
})();
