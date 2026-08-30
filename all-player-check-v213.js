(()=>{
'use strict';
const prev=window.searchDataEvidence;
const ROSTER=['大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'];
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const NAME=['選手名','氏名','名前','選手'];
const canonical=Object.fromEntries(ROSTER.map(x=>[norm(x),x]));
const cname=p=>canonical[norm(p)]||String(p||'').trim();
function idx(r,a){const cs=r.columns||[],want=a.map(norm);for(let i=0;i<cs.length;i++)if(want.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++)if(want.some(x=>x&&norm(cs[i]).includes(x)))return i;return-1}
function player(r){const i=idx(r,NAME);return i<0?'':cname((r.values||[])[i]);}
function currentSeason(r){return norm(`${r.fileName||''} ${r.sheetName||''}`).includes('20262027');}
function playerEvidence(rows,p){const np=norm(p),mine=rows.filter(r=>currentSeason(r)&&norm(player(r))===np);const files=[...new Set(mine.map(r=>r.fileName).filter(Boolean))];const batting=mine.filter(r=>/打撃|打席|打数|安打|打率|出塁|長打|ops|打点|三振|四球/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`));const pitching=mine.filter(r=>/投手|投球|防御率|奪三振/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`));return {count:mine.length,text:`${p}：記録${mine.length}件 / 打撃関連${batting.length}件 / 投手関連${pitching.length}件 / 参照${files.slice(0,3).join('・')||'ファイル名なし'}`};}
function block(rows){const checks=ROSTER.map(p=>({p,...playerEvidence(rows,p)})),missing=checks.filter(x=>x.count===0).map(x=>x.p),complete=missing.length===0;return `【ALL CURRENT TEAM CHECK / 全員確認必須】\n現チーム正式人数：${ROSTER.length}名\n確認対象：${ROSTER.join('・')}\n全員確認状態：${complete?'COMPLETE':'INCOMPLETE'}${missing.length?`\n未確認：${missing.join('・')}`:''}\n${checks.map(x=>'・'+x.text).join('\n')}\n\n必須手順：\n1. 候補を一人も決める前に、上記14名を全員確認する。\n2. MELCHIOR・BALTHASAR・CASPERは、同じ14名分Evidenceを読んだ後、それぞれ独立した専門基準で候補者を抽出する。\n3. 3人の候補者は一致させる必要はない。候補の違いそのものを審議材料にする。\n4. 候補外にした選手も「見ていない」のではなく、確認したうえで各専門基準では優先しなかったものとして扱う。\n5. INCOMPLETEなら候補抽出を完了扱いにせず、未確認選手を具体的に示して再取得する。\n6. 2026-2027ラベルの別資料に現チーム外の名前があっても人数へ加算しない。\n7. 2026-2027を主評価とするが、2025-2026を軽視しない。大久保 陽翔・大野 竜暉の十分な旧チーム出場実績は実戦経験・再現性・役割継続の重要Evidenceとして扱う。`;}
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e||!/クリーンナップ|中軸|主軸|打線|打順|先発|レギュラー|スタメン/i.test(String(q||'')))return e;const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const b=block(rows);e.allPlayerCheck=b;e.authoritativeRoster=ROSTER.slice();e.text=b+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 現チーム正式14名を全員確認してから候補抽出。';return e;};
window.MAGI_CURRENT_ROSTER=ROSTER.slice();
window.MAGI_ALL_PLAYER_CHECK='v214';
})();