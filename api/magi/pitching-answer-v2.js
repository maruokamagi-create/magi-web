import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';
import { requireApprovedMember } from '../drive/_access.js';
import { runStrictPitchingAudit } from './_drive-pitching-strict.js';

const VERSION='strict-pitching-answer-v1';

function text(v){return String(v||'').trim();}
function seasonFrom(question,routed){
  const q=text(question), s=text(routed?.specificSeason);
  if(/2025\s*[-–—〜~]\s*2026/.test(q)||/2025\s*[-–—〜~]\s*2026/.test(s)||/旧チーム/.test(q)||routed?.timeScope==='PREVIOUS_SEASON') return 'old';
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

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res)) return;
  const member=await requireApprovedMember(req,res); if(!member) return;
  try{
    const body=await readBody(req);
    const question=text(body?.question);
    if(!question) return sendJson(res,400,{ok:false,error:'question is required'});
    let routed=await routeQuestion(question,body?.context||[]);
    routed=await recoverContextBoundDeliberation(question,body?.context||[],routed);
    if(routed?.route==='CLARIFY') return sendJson(res,200,{ok:true,answerEngineVersion:VERSION,route:'CLARIFY',routerVersion:routed?.routerVersion||null,answer:routed?.clarificationQuestion||'もう少し具体的に教えてください。'});
    if(routed?.route!=='PITCHING_LOOKUP') return sendJson(res,200,{ok:true,answerEngineVersion:VERSION,route:routed?.route||'',routerVersion:routed?.routerVersion||null,answer:'この質問は投手成績のライブ回答対象ではありません。',refusedToInvent:true,limitation:'NOT_PITCHING_LOOKUP'});
    const players=Array.isArray(routed?.players)?routed.players:[];
    if(players.length!==1) return sendJson(res,200,{ok:true,answerEngineVersion:VERSION,route:routed.route,routerVersion:routed?.routerVersion||null,answer:'対象投手を一人に特定できませんでした。',refusedToInvent:true,limitation:'PLAYER_NOT_UNIQUE'});
    const playerName=players[0];
    const season=seasonFrom(question,routed);
    const audit=await runStrictPitchingAudit({season,playerName});
    const stats=audit.stats||{};
    const metric=metricFrom(question);
    let answer,evidence=[];
    if(metric){
      const value=stats[metric.key];
      if(value===undefined||value==='') return sendJson(res,200,{ok:true,answerEngineVersion:VERSION,route:routed.route,routerVersion:routed?.routerVersion||null,season,answer:`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}${metric.label}は正本XLSMから確認できませんでした。数値は作りません。`,source:source(audit),refusedToInvent:true,limitation:`PITCHING_METRIC_MISSING_${metric.key}`});
      answer=`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}${metric.label}は${value}です。`;
      evidence=[`${playerName}: ${metric.key}=${value}`];
    }else{
      const parts=[['ERA','防御率'],['APP','登板数'],['IP','投球回'],['SO','奪三振'],['BB','与四球']].filter(([k])=>stats[k]!==undefined&&stats[k]!=='').map(([k,l])=>`${l}${stats[k]}`);
      answer=`${playerName}の${season==='current'?'今期':'2025-2026旧チーム'}投手成績は、${parts.join('、')}です。`;
      evidence=parts;
    }
    return sendJson(res,200,{ok:true,answerEngineVersion:VERSION,route:routed.route,routerVersion:routed?.routerVersion||null,season,answer,evidence,source:source(audit),parser:audit.parser,chosen:audit.chosen,candidateCount:audit.candidateCount,refusedToInvent:false,limitation:null});
  }catch(error){
    console.error('[MAGI strict pitching answer]',error?.message||error);
    return sendJson(res,502,{ok:false,error:error?.message||'Strict pitching answer failed'});
  }
}
