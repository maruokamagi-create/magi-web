function text(v){return String(v||'').trim()}
function normalized(v){return text(v).normalize('NFKC').replace(/[\s　]+/g,'')}
export function needsCrossEvidenceAnalysis(question,semantic){
  const s=normalized(question)+normalized(semantic?.understoodRequest||'');
  const teamChange=/(チーム|新チーム|現チーム).{0,24}(変化|成長|改善|課題|弱点|強み|問題|どう変わ|分析|評価)|(?:弱点|強み|課題|問題).{0,24}(チーム|新チーム|現チーム)/.test(s);
  const playerEvaluation=Array.isArray(semantic?.players)&&semantic.players.length===1&&/(評価|どう|状態|調子|成長|課題|強み|弱み|起用|適性|固定|先発|クローザー|抑え|スタメン|打順|守備位置|ポジション)/.test(s);
  const observation=/指導者|保護者|観察|情報提供|統合台帳|意見/.test(s);
  return teamChange||playerEvaluation||observation;
}
