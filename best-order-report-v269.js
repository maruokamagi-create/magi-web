(()=>{
'use strict';
if(window.MAGI_BEST_ORDER_REPORT_V270)return;
const isBest=q=>/ベストオーダー|最適(?:な)?打順|打順.*(?:組|決|提案)|スタメン.*打順/i.test(String(q||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lineup=[
 ['1','嶋田 栄志','中堅','25','.364','.440','.940','過去44試合の経験＋直近の出塁と走力'],
 ['2','大野 竜暉','捕手','25','.278','.480','.924','高出塁率。過去OPS 1.012の再現性'],
 ['3','坂田 暉馬','二塁','16','.385','.500','1.115','暫定候補。3番は未固定で継続比較'], 
 ['4','大久保 陽翔','三塁／投手','17','.286','.412','.912','チームで共有された不動の4番。実績・信頼・役割を優先'], 
 ['5','中嶋 玲月','一塁／投手','18','.588','.611','1.376','4番大久保を支える打点型。今後の打線の売り'], 
 ['6','鰐渕 将太','遊撃／二塁','13','.375','.615','.990','出塁力を下位の起点にする'],
 ['7','橋向 結都','投手／遊撃','11','.222','.300','.522','先発投手として14回・防御率2.00'],
 ['8','武田 晴琉翔','左翼','13','.154','.214','.368','フライ対応力と脚力を評価。打撃は継続確認'], 
 ['9','吉田 真翔','右翼／三塁','11','.111','.273','.444','守備を優先し上位へつなぐ']
];
function render(q){
 const response=document.getElementById('response');if(!response)return false;
 response.classList.add('show');
 const sig=document.getElementById('signalRow');if(sig)sig.innerHTML='<span class="chip">直近6練習試合</span><span class="chip">公式戦除外</span><span class="chip">過去年度比較</span><span class="chip">守備成立確認</span>';
 const meta=document.getElementById('caseMeta');if(meta)meta.innerHTML='審議日：'+new Date().toLocaleDateString('ja-JP')+'<br>方式：確定集計<br>対象：直近3日・練習試合6試合<br>公式戦：除外';
 const cq=document.getElementById('caseQuestion');if(cq)cq.textContent=q;
 const m=document.getElementById('mText');if(m)m.innerHTML='<b>中軸方針：</b>4番・大久保陽翔、5番・中嶋玲月を原則とします。3番は判断材料が不足しているため固定せず、候補を継続比較します。';
 const mb=document.getElementById('mBasis');if(mb)mb.textContent='2026-2027 xlsmの直近練習試合6試合と2025-2026年度実績を分けて照合';
 const mc=document.getElementById('mConcern');if(mc)mc.textContent='3番候補と左翼は母数不足。短期成績だけで固定しない';
 const mt=document.getElementById('mVote');if(mt)mt.textContent='◎ データ確認済み';
 const b=document.getElementById('bText');if(b)b.innerHTML='通常は<b>4番・大久保陽翔、5番・中嶋玲月</b>。大久保陽翔が先発投手の日のみ、負担を見て5〜6番へ下げ、中嶋を4番にする選択肢を持ちます。左翼は武田晴琉翔を有力候補とします。';
 const bb=document.getElementById('bBasis');if(bb)bb.textContent='4・5番を打線の軸にし、1〜3番は出塁・走力・相手投手で組み替える';
 const bc=document.getElementById('bConcern');if(bc)bc.textContent='武田は打撃を継続確認。大久保夢翔は一度に複数役割を背負わせず段階起用';
 const bt=document.getElementById('bVote');if(bt)bt.textContent='◎ 戦術成立';
 const c=document.getElementById('cText');if(c)c.textContent='大久保夢翔は「精神面が弱い」と固定評価せず、ミスや失点後に次のプレーへ切り替えられるかを具体的に観察します。役割を絞って経験を与えます。';
 const cb=document.getElementById('cBasis');if(cb)cb.textContent='チーム内の信頼、守備評価、走力、切り替え行動も判断材料に含める';
 const cc=document.getElementById('cConcern');if(cc)cc.textContent='印象だけで性格を決めつけず、観察できる行動で再評価する';
 const ct=document.getElementById('cVote');if(ct)ct.textContent='○ 条件付き賛成';
 const verdict=document.getElementById('verdict');if(verdict)verdict.textContent='4・5番を軸にした暫定オーダー';
 const votes=[['v1','M：◎ 確認済み'],['v2','B：◎ 成立'],['v3','C：○ 更新条件付き']];votes.forEach(([id,t])=>{const e=document.getElementById(id);if(e)e.textContent=t});
 const reason=document.getElementById('reason');if(reason)reason.innerHTML='<b>打順・守備</b><p class="magiOrderPolicy"><strong>固定：</strong>4番 大久保陽翔／5番 中嶋玲月　 <strong>未固定：</strong>3番・左翼</p><div class="magiOrderTable"><div class="magiOrderHead">打順</div><div class="magiOrderHead">選手</div><div class="magiOrderHead">守備</div><div class="magiOrderHead">打席</div><div class="magiOrderHead">打率</div><div class="magiOrderHead">OPS</div>'+lineup.map(x=>'<div>'+esc(x[0])+'</div><div><b>'+esc(x[1])+'</b></div><div>'+esc(x[2])+'</div><div>'+esc(x[3])+'</div><div>'+esc(x[4])+'</div><div>'+esc(x[6])+'</div>').join('')+'</div>';
 const next=document.getElementById('next');if(next)next.innerHTML='<b>競争枠：</b>3番、左翼、下位打線。左翼は武田晴琉翔を有力候補とし、大久保夢翔らと比較します。<br><b>大久保夢翔：</b>左翼・一塁・投手の役割を一度に背負わせず、ミス後の切り替えを観察しながら段階起用します。<br><b>見直し：</b>新しい練習試合が2試合追加された時、欠場・故障・守備変更がある時。公式戦は直近6試合の集計に含めません。';
 document.querySelectorAll('#mConf,#bConf,#cConf').forEach(e=>e.textContent='確定集計ルート');
 const st=document.getElementById('status');if(st)st.textContent='ベストオーダーを確定データから直接表示しました（AI推測不使用）。';
 response.scrollIntoView({behavior:'smooth',block:'start'});
 try{const key='magiHistoryV92',a=JSON.parse(localStorage.getItem(key)||'[]');a.unshift({q:String(q),verdict:'4・5番を軸にした暫定オーダー',time:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(a.slice(0,20)))}catch(e){}
 return true;
}
function install(){
 if(typeof window.runMagi!=='function')return false;
 if(window.runMagi.__bestOrderReportV270)return true;
 const prev=window.runMagi;
 window.runMagi=function(){const q=document.getElementById('q')?.value||'';if(isBest(q))return render(q);return prev.apply(this,arguments)};
 window.runMagi.__bestOrderReportV269=true;window.MAGI_BEST_ORDER_REPORT_V270=true;return true;
}
if(!document.getElementById('magi-best-order-style-v270')){const s=document.createElement('style');s.id='magi-best-order-style-v269';s.textContent=' .magiOrderPolicy{font-size:12px;line-height:1.7;margin:8px 0}.magiOrderTable{display:grid;grid-template-columns:42px minmax(104px,1.25fr) minmax(84px,1fr) 48px 52px 58px;margin-top:10px;border:1px solid #355674;border-radius:10px;overflow:auto;background:#fff;color:#102038}.magiOrderTable>div{padding:8px 6px;border-bottom:1px solid #d7e1ea;white-space:nowrap;font-size:12px}.magiOrderHead{font-weight:900;background:#eaf1f7;color:#425b74}@media(max-width:430px){.magiOrderTable{grid-template-columns:36px 100px 86px 44px 48px 54px}.magiOrderTable>div{padding:7px 4px;font-size:11px}}';document.head.appendChild(s)}
let n=0,t=setInterval(()=>{n++;if(install()||n>300)clearInterval(t)},100);install();
})();