(()=>{
'use strict';
const prev=window.searchDataEvidence;
const ROSTER=['大久保 陽翔','大野 竜暉','井坂 悠聖','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','中嶋 玲月','吉田 真翔','上村 蓮','大久保 夢翔','長侶 穹','鰐渕 将太','武田 晴琉翔'];
const block=`【2026-2027 CURRENT TEAM CONTEXT】\n現チーム正式確認対象：14名\n${ROSTER.map(x=>'・'+x).join('\n')}\n\n歴史データの扱い：2026-2027を主評価とするが、2025-2026を軽視しない。大久保 陽翔と大野 竜暉は旧チームで十分な出場母数と継続的な実戦経験があり、旧成績は再現性・経験値・役割継続を判断する強い参考Evidenceである。大久保 陽翔は旧チームから継続して4番を担い、新チームでも基本的に同役割を担うチームの柱としての継続性を必ず評価する。ただし既得権として固定せず、現在の明確なEvidenceがあれば変更を検討する。大野 竜暉も旧チームでの十分な実戦経験を現在評価へ接続する。その他の選手は旧チームで出場機会が少なかったため、旧成績の小さい母数を現在評価の不利材料に使わない。\n\n全員確認ルール：候補選定前に上記14名を全員確認する。2026-2027ラベルの別ファイルに他学年・参考選手名が存在しても、この14名以外を現チーム人数に加算しない。`;
window.searchDataEvidence=function(q){const e=typeof prev==='function'?prev(q):null;if(!e)return e;if(/クリーンナップ|中軸|主軸|打線|打順|先発|レギュラー|スタメン|候補|起用/i.test(String(q||''))){e.teamContext=block;e.text=block+'\n\n'+String(e.text||'');e.summary=String(e.summary||'')+' 現チーム14名の正式ロスターと役割継続Contextを付与。';}return e;};
window.MAGI_CURRENT_ROSTER=ROSTER.slice();
window.MAGI_TEAM_CONTEXT='v214';
})();