import { CURRENT_ROSTER, playerKey } from './_roster.js';

// A model sometimes publishes a valid structured shortlist while leaving its
// selection rationale empty. Recover ONLY with exact structured current-team
// batting evidence. Never invent why a slot wins, alter the chosen candidates,
// or silently treat synthetic smoke data as real production player statistics.
const CURRENT_METRICS=[['AB','打数'],['AVG','打率'],['OBP','出塁率'],['SLG','長打率'],['OPS','OPS']];
function metricText(value,key){
  if(value===null||value===undefined)return '';
  const s=String(value).trim();
  if(!/^(?:\d+|\d*\.\d+)$/.test(s))return '';
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||(key==='AB'&&!Number.isInteger(n)))return '';
  return s;
}

export function recoverMissingBattingSelectionBasis(result,caseData){
  if(!result||String(result.candidateBasis||'').trim())return false;
  const kind=String(caseData?.selectionKind||caseData?.evidence?.selectionKind||'').toUpperCase();
  const question=String(caseData?.question||'').normalize('NFKC');
  const selected=kind==='BATTING_ORDER'
    ||(String(caseData?.mode||'').toLowerCase()==='selection'
      && !kind && /[1-9]番|打順|クリーンナップ|中軸/.test(question));
  if(!selected)return false;
  const players=caseData?.evidence?.allCurrentTeamCheck;
  if(players?.status!=='COMPLETE'||!Array.isArray(players.players)||players.players.length!==CURRENT_ROSTER.length)return false;

  const rosterKeys=new Set(CURRENT_ROSTER.map(playerKey));
  const current=new Map();
  for(const player of players.players){
    const key=playerKey(player?.name);
    if(!rosterKeys.has(key)||current.has(key))return false;
    current.set(key,player);
  }
  if(current.size!==CURRENT_ROSTER.length)return false;

  const checked=Array.isArray(result.checkedPlayers)?result.checkedPlayers.map(playerKey):[];
  if(checked.length!==CURRENT_ROSTER.length||new Set(checked).size!==CURRENT_ROSTER.length||checked.some(key=>!rosterKeys.has(key)))return false;
  const chosen=Array.isArray(result.candidatePlayers)?result.candidatePlayers:[];
  if(!chosen.length||chosen.length>CURRENT_ROSTER.length)return false;
  const chosenKeys=chosen.map(playerKey);
  if(new Set(chosenKeys).size!==chosenKeys.length||chosenKeys.some(key=>!rosterKeys.has(key)))return false;

  const described=chosen.slice(0,3).map((name,index)=>{
    const row=current.get(playerKey(name));
    const metrics=CURRENT_METRICS.map(([key,label])=>{
      const n=metricText(row?.batting?.[key],key);
      return n?label+' '+n:null;
    }).filter(Boolean);
    return {name:CURRENT_ROSTER.find(p=>playerKey(p)===playerKey(name)),index,metrics};
  });
  if(!described.some(x=>x.metrics.length))return false;

  result.candidateBasis='提示した候補順：'+described.map(x=>
    (x.index+1)+'番目 '+x.name+'（'+(x.metrics.join('、')||'今季通算の打撃数値は未取得')+'）'
  ).join('、')+'。この打撃記録は候補間の比較材料ですが、打順位置の優位性や勝敗への効果を証明するものではありません。';
  result.warnings=[...new Set([...(Array.isArray(result.warnings)?result.warnings:[]),
    '元の候補選出理由が欠落していたため、今季の確認済み数値だけを提示しました。順位の優劣は未確定です。'])];
  if(result.confidence==='HIGH')result.confidence='MEDIUM';
  return true;
}
