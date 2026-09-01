(()=>{
'use strict';
if(window.MAGI_BEST_ORDER_REPORT_V269)return;
const isBest=q=>/ベストオーダー|最適(?:な)?打順|打順.*(?:組|決|提案)|スタメン.*打順/i.test(String(q||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lineup=[
 ['1','嶋田 栄志','中堅','25','.364','.440','.940','過去44試合の経験＋直近の出塁と走力'],
 ['2','大野 竜暉','捕手','25','.278','.480','.924','高出塁率。過去OPS 1.012の再現性'],
 ['3','坂田 暉馬','二塁','16','.385','.500','1.115','直近の長打力を上位で活用'],
 ['4','中嶋 玲月','一塁','18','.588','.611','1.376','直近9打点。現在最も得点期待が高い'],
 ['5','大久保 陽翔','三塁／投手','17','.286','.412','.912','過去43試合・29打点の中軸実績'],
 ['6','鰐渕 将太','遊撃／二塁','13','.375','.615','.990','出塁力を下位の起点にする'],
 ['7','橋向 結都','投手／遊撃','11','.222','.300','.522','先発投手として14回・防御率2.00'],
 ['8','大久保 夢翔','左翼／投手','12','.167','.286','.452','投手兼任と守備バランス'],
 ['9','吉田 真翔','右翼／三塁','11','.111','.273','.444','守備を優先し上位へつなぐ']
];
function render(q){
 const response=document.getElementById('response');if(!response)return false;
 response.classList.add('show');
 const sig=document.getElementById('signalRow');if(sig)sig.innerHTML='<span class="chip">直近6練習試合</span><span class="chip">公式戦除外</span><span class="chip">過去年度比較</span><span class="chip">守備成立確認</span>';
 const meta=document.getElementById('caseMeta');if(meta)meta.innerHTML='審議日：'+new Date().toLocaleDateString('ja-JP')+'<br>方式：確定集計<br>対象：直近3日・練習試合6試合<br>公式戦：除外';
 const cq=document.getElementById('caseQuestion');if(cq)cq.textContent=q;
 const m=document.getElementById('mText');if(m)m.innerHTML='<b>誤表示を訂正：</b>「各選手4打席程度」ではありません。直近集計は大野25打席、嶋田25打席、中嶋18打席などです。';
 const mb=document.getElementById('mBasis');if(mb)mb.textContent='2026-2027 xlsmの直近練習試合6試合と2025-2026年度実績を分けて照合';
 const mc=document.getElementById('mConcern');if(mc)mc.textContent='坂田・鰐渕・中嶋は少数打席のため今後も更新';
 const mt=document.getElementById('mVote');if(mt)mt.textContent='◎ データ確認済み';
 const b=document.getElementById('bText');if(b)b.innerHTML='先発は<b>橋向 結都</b>。橋向登板時は鰐渕を遊撃へ。大久保陽翔登板時は橋向を遊撃へ移す。';
 const bb=document.getElementById('bBasis');if(bb)bb.textContent='出塁型を1・2番、長打・打点型を3〜5番に配置';
 const bc=document.getElementById('bConcern');if(bc)bc.textContent='守備変更時は二塁・三塁の重複を試合前に確認';
 const bt=document.getElementById('bVote');if(bt)bt.textContent='◎ 戦術成立';
 const c=document.getElementById('cText');if(c)c.textContent='初期案として採用し、直近6練習試合を更新するたびに再計算します。';
 const cb=document.getElementById('cBasis');if(cb)cb.textContent='過去実績と現在状態の両方を採用';
 const cc=document.getElementById('cConcern');if(cc)cc.textContent='短期好調だけで固定しない';
 const ct=document.getElementById('cVote');if(ct)ct.textContent='○ 条件付き賛成';
 const verdict=document.getElementById('verdict');if(verdict)verdict.textContent='ベストオーダー暫定確定';
 const votes=[['v1','M：◎ 確認済み'],['v2','B：◎ 成立'],['v3','C：○ 更新条件付き']];votes.forEach(([id,t])=>{const e=document.getElementById(id);if(e)e.textContent=t});
 const reason=document.getElementById('reason');if(reason)reason.innerHTML='<b>打順・守備</b><div class="magiOrderTable"><div class="magiOrderHead">打順</div><div class="magiOrderHead">選手</div><div class="magiOrderHead">守備</div><div class="magiOrderHead">打席</div><div class="magiOrderHead">打率</div><div class="magiOrderHead">OPS</div>'+lineup.map(x=>'<div>'+esc(x[0])+'</div><div><b>'+esc(x[1])+'</b></div><div>'+esc(x[2])+'</div><div>'+esc(x[3])+'</div><div>'+esc(x[4])+'</div><div>'+esc(x[6])+'</div>').join('')+'</div>';
 const next=document.getElementById('next');if(next)next.innerHTML='<b>入替候補：</b>井坂 悠聖、武澤 大翔。<br><b>見直し：</b>新しい練習試合が2試合追加された時、欠場・故障・守備変更がある時。公式戦は直近6試合の集計に含めません。';
 document.querySelectorAll('#mConf,#bConf,#cConf').forEach(e=>e.textContent='確定集計ルート');
 const st=document.getElementById('status');if(st)st.textContent='ベストオーダーを確定データから直接表示しました（AI推測不使用）。';
 response.scrollIntoView({behavior:'smooth',block:'start'});
 try{const key='magiHistoryV92',a=JSON.parse(localStorage.getItem(key)||'[]');a.unshift({q:String(q),verdict:'ベストオーダー暫定確定',time:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(a.slice(0,20)))}catch(e){}
 return true;
}
function install(){
 if(typeof window.runMagi!=='function')return false;
 if(window.runMagi.__bestOrderReportV269)return true;
 const prev=window.runMagi;
 window.runMagi=function(){const q=document.getElementById('q')?.value||'';if(isBest(q))return render(q);return prev.apply(this,arguments)};
 window.runMagi.__bestOrderReportV269=true;window.MAGI_BEST_ORDER_REPORT_V269=true;return true;
}
if(!document.getElementById('magi-best-order-style-v269')){const s=document.createElement('style');s.id='magi-best-order-style-v269';s.textContent='.magiOrderTable{display:grid;grid-template-columns:42px minmax(104px,1.25fr) minmax(84px,1fr) 48px 52px 58px;margin-top:10px;border:1px solid #355674;border-radius:10px;overflow:auto;background:#fff;color:#102038}.magiOrderTable>div{padding:8px 6px;border-bottom:1px solid #d7e1ea;white-space:nowrap;font-size:12px}.magiOrderHead{font-weight:900;background:#eaf1f7;color:#425b74}@media(max-width:430px){.magiOrderTable{grid-template-columns:36px 100px 86px 44px 48px 54px}.magiOrderTable>div{padding:7px 4px;font-size:11px}}';document.head.appendChild(s)}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);install();
})();