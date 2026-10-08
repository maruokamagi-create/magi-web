import { CURRENT_ROSTER } from './_roster.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';

const BATTING_METRICS=[
  ['AB','打数'],['H','安打'],['AVG','打率'],['OBP','出塁率'],
  ['SLG','長打率'],['OPS','OPS'],['RBI','打点'],['BB','四球'],
  ['HBP','死球'],['SO','三振'],['SB','盗塁'],['CS','盗塁死']
];

function text(value){return String(value??'').trim();}
function names(semantic){return Array.isArray(semantic?.players)?semantic.players:[];}

export function currentTwoPlayerBattingComparison(semantic){
  if(String(semantic?.mode||'').toUpperCase()!=='COMPARISON')return null;
  if(String(semantic?.confidence||'').toUpperCase()!=='HIGH')return null;
  if(!['CURRENT_SEASON','UNSPECIFIED'].includes(String(semantic?.timeScope||'UNSPECIFIED').toUpperCase()))return null;
  if(String(semantic?.selectionKind||'NONE').toUpperCase()!=='NONE')return null;
  const domains=Array.isArray(semantic?.domains)?semantic.domains:[];
  if(!domains.includes('BATTING')||domains.some(d=>['PITCHING','FIELDING','RUNNING','DOCUMENTS'].includes(d)))return null;
  const selected=names(semantic);
  if(selected.length!==2||new Set(selected).size!==2)return null;
  if(!selected.every(name=>CURRENT_ROSTER.includes(name)))return null;
  return selected.slice();
}

// Only confirmed current-master XLSM rows may produce a comparative case.
// Every emitted numerical value comes from the relevant source player row.
export function currentBattingComparisonPacket(semantic,audit){
  const selected=currentTwoPlayerBattingComparison(semantic);
  if(!selected)return null;
  const unavailable=reason=>({status:'UNAVAILABLE',reason});
  if(audit?.sourceType!=='XLSM_MASTER'||audit?.season!=='current'
    ||!/\.xlsm$/i.test(text(audit?.source?.name))||!text(audit?.source?.id))
    return unavailable('CURRENT_XLSM_MASTER_NOT_VERIFIED');
  const byName=audit?.extracted?.playersByName;
  if(!byName||typeof byName!=='object')return unavailable('CURRENT_BATTING_ROWS_UNAVAILABLE');
  const rows=[];
  for(const name of selected){
    const batting=byName[name]?.batting;
    if(!batting||typeof batting!=='object')return unavailable('PLAYER_BATTING_ROW_UNAVAILABLE');
    // Require a verifiable statistical sample before making a comparison.
    if(!['AB','H','AVG'].every(metric=>text(batting[metric])!==''))return unavailable('PLAYER_BATTING_SAMPLE_INCOMPLETE');
    const metrics=Object.fromEntries(BATTING_METRICS
      .filter(([metric])=>text(batting[metric])!=='')
      .map(([metric])=>[metric,batting[metric]]));
    rows.push({name,batting:metrics});
  }
  const source={...audit.source,season:'current',type:'XLSM_MASTER',priority:'PRIMARY'};
  const period=[text(audit?.extracted?.periodStart),text(audit?.extracted?.periodEnd)].filter(Boolean).join('〜');
  const lines=rows.map(row=>`${row.name}：${BATTING_METRICS
    .filter(([metric])=>row.batting[metric]!==undefined)
    .map(([metric,label])=>`${label} ${text(row.batting[metric])}`).join(' / ')}`);
  return {
    status:'COMPLETE',
    evidence:{
      scope:'CURRENT_TWO_PLAYER_BATTING_COMPARISON',
      comparisonKind:'CURRENT_BATTING_TWO_PLAYERS',
      count:2,
      primarySeason:'current',
      sourceType:'XLSM_MASTER',
      periodStart:text(audit?.extracted?.periodStart),
      periodEnd:text(audit?.extracted?.periodEnd),
      comparedPlayers:rows,
      sources:[source],
      files:[source.name],
      text:[`【現チーム2選手の今季打撃正本${period?' '+period:''}】`,...lines].join('\n'),
      summary:'指定された現チーム2選手の今季打撃記録を、同一の正本XLSMと集計期間から照合した比較Evidence。',
      dataRule:'比較対象は指定された2選手だけ。出場数・打数・安打数・打率・OPS等は両者の正本に存在する値のみ使う。未確認項目・勝利への因果・役割適性・指導者意向を推定しない。母数の違いに注意する。'
    }
  };
}

export async function resolveCurrentBattingComparison({semantic,auditProvider=runDriveLiveAudit}={}){
  if(!currentTwoPlayerBattingComparison(semantic))return null;
  try{
    const audit=await auditProvider({season:'current'});
    return currentBattingComparisonPacket(semantic,audit);
  }catch(error){
    console.warn('[MAGI current comparison evidence]',error?.message||error);
    return {status:'UNAVAILABLE',reason:'CURRENT_MASTER_AUDIT_UNAVAILABLE'};
  }
}
