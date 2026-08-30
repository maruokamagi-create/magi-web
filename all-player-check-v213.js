(()=>{
'use strict';
const prev=window.searchDataEvidence;
const EXPECTED_CURRENT_ROSTER=14;
const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const NAME=['選手名','氏名','名前','選手'];
const canonical={'大久保陽翔':'大久保 陽翔','大野竜暉':'大野 竜暉','井坂悠聖':'井坂 悠聖','坂田暉馬':'坂田 暉馬','嶋田栄志':'嶋田 栄志','武澤大翔':'武澤 大翔','橋向結都':'橋向 結都','中嶋玲月':'中嶋 玲月','吉田真翔':'吉田 真翔'};
const cname=p=>canonical[norm(p)]||String(p||'').trim();
function idx(r,a){const cs=r.columns||[],want=a.map(norm);for(let i=0;i<cs.length;i++)if(want.includes(norm(cs[i])))return i;for(let i=0;i<cs.length;i++)if(want.some(x=>x&&norm(cs[i]).includes(x)))return i;return-1}
function player(r){const i=idx(r,NAME);return i<0?'':cname((r.values||[])[i]);}
function currentSeason(r){return norm(`${r.fileName||''} ${r.sheetName||''}`).includes('20262027');}
function valid(p){return !!p&&p.length<=18&&!/^(総計|合計|計|チーム|全体|選手名|投手名|氏名)$/u.test(p);}
function roster(rows){const out=[];for(const r of rows){if(!currentSeason(r))continue;const p=player(r);if(valid(p)&&!out.some(x=>norm(x)===norm(p)))out.push(p)}return out;}
function playerEvidence(rows,p){const np=norm(p),mine=rows.filter(r=>currentSeason(r)&&norm(player(r))===np);const files=[...new Set(mine.map(r=>r.fileName).filter(Boolean))];const batting=mine.filter(r=>/打撃|打席|打数|安打|打率|出塁|長打|ops|打点|三振|四球/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`));const pitching=mine.filter(r=>/投手|投球|防御率|奪三振/i.test(`${r.fileName||''} ${r.sheetName||''} ${(r.columns||[]).join(' ')}`));return `${p}：記録${mine.length}件 / 打撃関連${batting.length}件 / 投手関連${pitching.length}件 / 参照${files.slice(0,3).join('・')||'ファイル名なし'}`;}
function block(rows){const ps=roster(rows);const complete=ps.length>=EXPECTED_CURRENT_ROSTER;return `【ALL CURRENT TEAM CHECK / 全員確認必須】\n現チーム想定人数：${EXPECTED_CURRENT_ROSTER}名\n識別できた現チーム選手：${ps.length}名\n全員確認状態：${complete?'COMPLETE':'INCOMPLETE'}\n${ps.map(p=>'・'+playerEvidence(rows,p)).join('\n')}\n\n必須手順：\n1. 候補を一人も決める前に、上記の現チーム選手を全員確認する。\n2. MELCHIOR・BALTHASAR・CASPERは、同じ全員分Evidenceを読んだ後、それぞれ独立した専門基準で候補者を抽出する。\n3. 3人の候補者は一致させる必要はない。候補の違いそのものを審議材料にする。\n4. 候補外にした選手も「見ていない」のではなく、確認したうえで各専門基準では優先しなかったものとして扱う。\n5. 全員確認状態がINCOMPLETEなら候補抽出を完了扱いにせず、誰が確認できていないかを具体化して再取得する。\n6. 2026-2027を主評価、2025-2026は参考とする。ただし大久保 陽翔・大野 竜暉の旧チーム継続出場実績は実戦経験・再現性の参考として評価する。`;
}
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e||!/クリーンナップ|中軸|主軸|打線|打順|先発|レギュラー|スタメン/i.test(String(q||'')))return e;const rows=((typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]).filter(r=>r&&r.source==='drive');const b=block(rows);e.allPlayerCheck=b;e.text=b+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 現チーム全員確認を候補抽出より先に必須化。';return e;};
window.MAGI_ALL_PLAYER_CHECK='v213';
})();