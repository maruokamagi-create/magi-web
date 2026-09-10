import { runStrictPitchingAudit } from './_drive-pitching-strict.js';

const VERSION='strict-pitching-answer-v2-season-aliases';
function text(v){return String(v||'').trim();}
function seasonFrom(question,routed){
  const q=text(question), s=text(routed?.specificSeason), t=text(routed?.timeScope);
  const previousSeasonExplicit =
    /2025\s*[-–—〜~]\s*2026/.test(q) ||
    /2025\s*[-–—〜~]\s*2026/.test(s) ||
    /(?:前|旧)(?:の)?チーム/.test(q) ||
    /(?:前年度|昨年度|昨季|昨シーズン)/.test(q) ||
    t === 'PREVIOUS_SEASON';
  if(previousSeasonExplicit) return 'old';

  const currentSeasonExplicit =
    /2026\s*[-–—〜~]\s*2027/.test(q) ||
    /2026\s*[-–—〜~]\s*2027/.test(s) ||
    /(?:現チーム|今季|今シーズン|今期)/.test(q) ||
    t === 'CURRENT_SEASON';
  if(currentSeasonExplicit) return 'current';

  return 'current';
}
const METRICS=[
  {key:'ERA',label:'防御率',re:/防御率|ERA/i},
  {key:'SO',label:'奪三振',re:/奪三振/},
  {key:'IP',label:'投球回',re:/投球回数|投球回|イニング/},
  {key:'BB',label:'与四球',re:/与四球/},
  {key:'APP',label:'登板数',re:/登板数|登板/},
  {key:'ER',label:'自責点',re:/自責点/},
  {key:'H',label:'被安打',re:/被安打/},
  {key:'WP',label:'暴投',re:/暴投/},
  {key:'HBP',label:'与死球',re:/与死球/}
];
function metricFrom(q){return METRICS.find(m=>m.re.test(q))||null;}
function source(a){return {type:'XLSM_MASTER',name:a?.source?.name||'',path:a?.source?.path||'',modifiedTime:a?.source?.modifiedTime||null,parser:a?.parser||''};}

export async function buildStrictPitchingAnswer({question,routed}){
  const players=Array.isArray(routed?.players)?routed.players:[];
  if(players.length!==1){
    return {ok:true,answerEngineVersion:VERSION,route:routed?.route||'',routerVersion:routed?.routerVersion||null,season:null,answer:'対象投手を一人に特定できませんでした。',refusedToInvent:true,limitation:'PLAYER_NOT_UNIQUE'};
  }
  const playerName=players[0];
  const season=seasonFrom(question,routed);
  const audit=await runStrictPitchingAudit({season,playerName});
  const stats=audit.stats||{};
  const metric=metricFrom(question);
  let answer,evidence=[];
  if(metric){
    const value=stats[metric.key];
    if(value===undefined||value===''){
      return {ok:true,answerEngineVersion:VERSION,route:routed.route,routerVersion:routed?.routerVersion||null,season,answer:`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}${metric.label}は正本XLSMから確認できませんでした。数値は作りません。`,evidence:[],source:source(audit),parser:audit.parser,chosen:audit.chosen,candidateCount:audit.candidateCount,refusedToInvent:true,limitation:`PITCHING_METRIC_MISSING_${metric.key}`};
    }
    answer=`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}${metric.label}は${value}です。`;
    evidence=[`${playerName}: ${metric.key}=${value}`];
  }else{
    const parts=[['ERA','防御率'],['APP','登板数'],['IP','投球回'],['SO','奪三振'],['BB','与四球']].filter(([k])=>stats[k]!==undefined&&stats[k]!=='').map(([k,l])=>`${l}${stats[k]}`);
    answer=`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}投手成績は、${parts.join('、')}です。`;
    evidence=parts;
  }
  return {ok:true,answerEngineVersion:VERSION,route:routed.route,routerVersion:routed?.routerVersion||null,season,answer,evidence,source:source(audit),parser:audit.parser,chosen:audit.chosen,candidateCount:audit.candidateCount,refusedToInvent:false,limitation:null};
}
