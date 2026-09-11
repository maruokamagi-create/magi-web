import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';
import { buildVerifiedDetailAnswer } from './_detail-live-answer.js';
import { shouldUseVerifiedOldDetailAnswer } from './_verified-detail-route.js';
import { resolveQuestionEvidence } from './_evidence-resolver.js';
import { buildCurrentSelectionEvidence } from './_selection-live-evidence.js';
import { understandRequest } from './_semantic-request.js';
import { applySemanticGuard } from './_semantic-postguard.js';
import { isExplicitPitchingPlanQuestion } from './_pitching-plan.js';

const CORE_VERSION='magi-core-semantic-first-v4-pitching-plan-routing';

function text(v){return String(v||'').trim()}
function hasPdfModifier(q){return /(?:PDF|ＰＤＦ)/i.test(String(q||''))}

async function classify(question,context){
  let routed=await routeQuestion(question,context);
  routed=await recoverContextBoundDeliberation(question,context,routed);
  return routed;
}
function clarificationAnswer(message){
  return text(message)||'質問の意味を正確に確認したいので、もう少し具体的に教えてください。';
}
function routedFromSemantic(semantic){
  const domain=semantic?.domains?.find(d=>['BATTING','PITCHING','FIELDING'].includes(d))||semantic?.domains?.[0]||'OTHER';
  const route=domain==='PITCHING'?'PITCHING_LOOKUP':domain==='BATTING'?'BATTING_LOOKUP':domain==='FIELDING'?'FIELDING_LOOKUP':'GENERAL_QUESTION';
  return {
    route,modelRoute:route,confidence:semantic?.confidence||'HIGH',
    understoodRequest:semantic?.understoodRequest||'',routeReason:semantic?.routeReason||'',
    players:Array.isArray(semantic?.players)?semantic.players:[],domains:Array.isArray(semantic?.domains)?semantic.domains:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',
    needsDeliberation:false,needsClarification:false,clarificationQuestion:'',contextRequired:false,contextReferences:[],ambiguities:[],unresolvedEntities:[],
    safeToExecute:true,safetyStatus:'READY',routerVersion:semantic?.semanticVersion||'semantic-request'
  };
}
function reportKind(semantic){
  const ds=Array.isArray(semantic?.domains)?semantic.domains:[];
  if(ds.includes('PITCHING'))return'PITCHING';
  if(ds.includes('FIELDING'))return'FIELDING';
  if(ds.includes('BATTING'))return'BATTING';
  return'';
}
function pitchingPlanSemantic(question){
  return {
    semanticVersion:'semantic-pitching-plan-direct-v1',mode:'DELIBERATION',confidence:'HIGH',
    understoodRequest:'7回制の投手運用を、先発・第2投手・終盤・クローザーの4役で審議する',
    routeReason:'複数投手の役割配置を決める明示的な投手運用相談。',players:[],domains:['PITCHING','TACTICS'],
    timeScope:'CURRENT_SEASON',specificSeason:'',metric:'',opponent:'',breakdowns:[],clarificationQuestion:'',needsData:true,
    groundedPlayers:[],preflightApplied:true,originalQuestion:question
  };
}
async function deliberationPayload({question,semantic,routed}){
  const resolution=await resolveQuestionEvidence({question,routed});
  if(resolution?.requestedDocument&&resolution.status!=='RESOLVED'){
    const names=(resolution?.candidates||[]).slice(0,3).map(x=>x.name).filter(Boolean);
    const answer=names.length?`参照する資料を一意に決められませんでした。候補は「${names.join('」「')}」です。どれを使うか教えてください。`:'参照する資料を一意に決められませんでした。資料名をもう少し具体的に教えてください。';
    return {ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,needsClarification:true,clarificationQuestion:answer,semantic,evidenceResolution:resolution};
  }

  let effectiveResolution=resolution;
  if(!resolution?.requestedDocument){
    const liveSelectionEvidence=await buildCurrentSelectionEvidence({question,routed});
    if(liveSelectionEvidence){
      effectiveResolution={
        version:liveSelectionEvidence.resolverVersion,
        status:'RESOLVED',
        requestedDocument:false,
        source:'CURRENT_MASTER_LIVE_SELECTION',
        evidence:liveSelectionEvidence
      };
    }
  }

  return {
    ok:true,handled:true,coreVersion:CORE_VERSION,route:'DELIBERATION',action:'DELIBERATE',
    routerVersion:routed?.routerVersion||semantic?.semanticVersion||null,understoodRequest:semantic?.understoodRequest||routed?.understoodRequest||question,
    domains:Array.isArray(semantic?.domains)?semantic.domains:[],players:Array.isArray(semantic?.players)?semantic.players:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',
    evidencePacket:effectiveResolution?.evidence||null,evidenceResolution:effectiveResolution,semantic,fastPath:false
  };
}

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res))return;
  try{
    const member=await requireApprovedMember(req,res);if(!member)return;
    const body=await readBody(req);
    const question=text(body?.question);
    const context=Array.isArray(body?.context)?body.context:[];
    if(!question)return sendJson(res,400,{ok:false,error:'question is required'});

    if(hasPdfModifier(question))return sendJson(res,200,{ok:true,handled:false,coreVersion:CORE_VERSION,reason:'OUTPUT_FORMAT_FALLBACK'});

    // Accuracy-first: only explicit structured pitching plans bypass semantic interpretation.
    // Generic requests such as 「継投どうする？」 still pass through semantic/context checks first.
    const semantic=isExplicitPitchingPlanQuestion({question})
      ? pitchingPlanSemantic(question)
      : applySemanticGuard(question,context,await understandRequest(question,context));

    if(semantic.mode==='CLARIFY'){
      const answer=clarificationAnswer(semantic.clarificationQuestion);
      return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
    }

    if(semantic.mode==='FULL_REPORT'){
      const kind=reportKind(semantic);
      if(kind){
        return sendJson(res,200,{
          ok:true,handled:true,coreVersion:CORE_VERSION,route:`${kind}_REPORT`,action:'FULL_REPORT',reportKind:kind,
          understoodRequest:semantic.understoodRequest,players:semantic.players,domains:semantic.domains,timeScope:semantic.timeScope,
          specificSeason:semantic.specificSeason,opponent:semantic.opponent,breakdowns:semantic.breakdowns,semantic,fastPath:false
        });
      }
    }

    if(semantic.mode==='DELIBERATION'){
      const routed=await classify(question,context);
      routed.route='DELIBERATION';routed.modelRoute='DELIBERATION';routed.needsDeliberation=true;routed.needsClarification=false;
      if(semantic.players?.length)routed.players=semantic.players;
      if(semantic.domains?.length)routed.domains=semantic.domains;
      if(semantic.timeScope)routed.timeScope=semantic.timeScope;
      if(semantic.specificSeason)routed.specificSeason=semantic.specificSeason;
      if(semantic.opponent)routed.opponent=semantic.opponent;
      return sendJson(res,200,await deliberationPayload({question,semantic,routed}));
    }

    if(['SINGLE_VALUE','SUMMARY'].includes(semantic.mode)){
      const kind=reportKind(semantic);
      if(kind==='FIELDING'){
        return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'FIELDING_REPORT',action:'FULL_REPORT',reportKind:'FIELDING',understoodRequest:semantic.understoodRequest,players:semantic.players,domains:semantic.domains,timeScope:semantic.timeScope,specificSeason:semantic.specificSeason,opponent:semantic.opponent,breakdowns:semantic.breakdowns,semantic,fastPath:false});
      }
      const routed=routedFromSemantic(semantic);
      if(shouldUseVerifiedOldDetailAnswer(question)){
        const result=await buildVerifiedDetailAnswer({question});
        return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,integratedRoute:'VERIFIED_OLD_DETAIL',semantic,fastPath:false});
      }
      const result=routed.route==='PITCHING_LOOKUP'?await buildStrictPitchingAnswer({question,routed}):await buildLiveAnswer({question,routed});
      return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,semantic,fastPath:false});
    }

    const routed=await classify(question,context);
    if(routed?.route==='DELIBERATION')return sendJson(res,200,await deliberationPayload({question,semantic,routed}));
    return sendJson(res,200,{ok:true,handled:false,coreVersion:CORE_VERSION,reason:`SEMANTIC_${semantic.mode}_LEGACY_FALLBACK`,semantic,routed,fastPath:false});
  }catch(error){
    console.error('[MAGI CORE]',error?.message||error);
    return sendJson(res,502,{ok:false,error:error?.message||'MAGI core failed',coreVersion:CORE_VERSION});
  }
}
