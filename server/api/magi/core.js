import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';
import { buildVerifiedDetailAnswer } from './_detail-live-answer.js';
import { shouldUseVerifiedOldDetailAnswer } from './_verified-detail-route.js';
import { resolveQuestionEvidence } from './_evidence-resolver.js';
import { buildCurrentSelectionEvidence } from './_selection-live-evidence.js';
import { understandRequestGeminiFirst } from './_semantic-authority.js';

const CORE_VERSION='magi-core-gemini-first-v8-single-semantic-entry';

function text(v){return String(v||'').trim()}
function isExistingPdfReference(q){
  const s=String(q||'');
  return /(?:\.pdf\b|PDF(?:ファイル|資料|文書|レポート)?)[^。！？!?]{0,40}(?:見て|確認して|読んで|参照して|中身|内容|記載|探して|検索して|開いて)/i.test(s)
    || /(?:見て|確認して|読んで|参照して|探して|検索して|開いて)[^。！？!?]{0,40}(?:\.pdf\b|PDF(?:ファイル|資料|文書|レポート)?)/i.test(s);
}
function hasPdfModifier(q){
  const s=String(q||'');
  if(!/(?:PDF|ＰＤＦ)/i.test(s)||isExistingPdfReference(s))return false;
  return /(?:PDF|ＰＤＦ)(?:形式)?(?:にして|化して|で出して|で見せて|で保存して|で作って|でお願い|で表示して|で出力して|で)?/i.test(s);
}
function clarificationAnswer(message){
  return text(message)||'質問の意味を正確に確認したいので、もう少し具体的に教えてください。';
}
function routedFromSemantic(semantic){
  const domains=Array.isArray(semantic?.domains)?semantic.domains:[];
  const domain=domains.find(d=>['BATTING','PITCHING','FIELDING'].includes(d))||domains[0]||'OTHER';
  let route='GENERAL_QUESTION';
  if(domain==='PITCHING')route='PITCHING_LOOKUP';
  else if(domain==='BATTING')route='BATTING_LOOKUP';
  else if(domain==='FIELDING')route='FIELDING_LOOKUP';
  else if(domain==='TEAM')route='TEAM_LOOKUP';
  else if(Array.isArray(semantic?.players)&&semantic.players.length===1)route='PLAYER_OVERVIEW';
  return {
    route,modelRoute:route,confidence:semantic?.confidence||'HIGH',
    understoodRequest:semantic?.understoodRequest||'',routeReason:semantic?.routeReason||'',
    players:Array.isArray(semantic?.players)?semantic.players:[],domains,
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'NONE',
    needsDeliberation:false,needsClarification:false,clarificationQuestion:'',contextRequired:false,contextReferences:[],ambiguities:[],unresolvedEntities:[],
    safeToExecute:true,safetyStatus:'READY',routerVersion:semantic?.semanticVersion||'semantic-authority'
  };
}
function deliberationRouteFromSemantic(semantic){
  return {
    route:'DELIBERATION',modelRoute:'DELIBERATION',confidence:semantic?.confidence||'HIGH',
    understoodRequest:semantic?.understoodRequest||'',routeReason:semantic?.routeReason||'',
    players:Array.isArray(semantic?.players)?semantic.players:[],domains:Array.isArray(semantic?.domains)?semantic.domains:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'GENERIC_SELECTION',
    needsDeliberation:true,needsClarification:false,clarificationQuestion:'',contextRequired:false,contextReferences:[],ambiguities:[],unresolvedEntities:[],validationIssues:[],
    safeToExecute:true,safetyStatus:'READY',routerVersion:semantic?.semanticVersion||'semantic-authority'
  };
}
function reportKind(semantic){
  const ds=Array.isArray(semantic?.domains)?semantic.domains:[];
  if(ds.includes('PITCHING'))return'PITCHING';
  if(ds.includes('FIELDING'))return'FIELDING';
  if(ds.includes('BATTING'))return'BATTING';
  return'';
}
async function deliberationPayload({question,semantic,routed,role='member'}){
  const resolution=await resolveQuestionEvidence({question,routed,role});
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
    routerVersion:routed?.routerVersion||semantic?.semanticVersion||null,understoodRequest:semantic?.understoodRequest||question,
    domains:Array.isArray(semantic?.domains)?semantic.domains:[],players:Array.isArray(semantic?.players)?semantic.players:[],
    timeScope:semantic?.timeScope||'UNSPECIFIED',specificSeason:semantic?.specificSeason||'',opponent:semantic?.opponent||'',gameInnings:semantic?.gameInnings||null,
    selectionKind:semantic?.selectionKind||'NONE',
    evidencePacket:effectiveResolution?.evidence||null,evidenceResolution:effectiveResolution,semantic,fastPath:false
  };
}
async function documentPayload({question,semantic,role='member'}){
  const routed=routedFromSemantic(semantic);
  const resolution=await resolveQuestionEvidence({question,routed,role});
  if(resolution?.status==='RESOLVED'&&resolution?.evidence){
    const source=resolution?.evidence?.sourceName||resolution?.evidence?.name||resolution?.source||'指定資料';
    return {
      ok:true,handled:true,coreVersion:CORE_VERSION,route:'DOCUMENT_SEARCH',action:'ANSWER',
      answer:`${source}を確認しました。`,understoodRequest:semantic.understoodRequest,semantic,
      evidencePacket:resolution.evidence,evidenceResolution:resolution,fastPath:false
    };
  }
  const names=(resolution?.candidates||[]).slice(0,3).map(x=>x.name).filter(Boolean);
  const answer=names.length?`参照する資料を一意に決められませんでした。候補は「${names.join('」「')}」です。どれを使うか教えてください。`:'参照する資料を特定できませんでした。資料名をもう少し具体的に教えてください。';
  return {ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,evidenceResolution:resolution,fastPath:false};
}

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res))return;
  try{
    const member=await requireApprovedMember(req,res);if(!member)return;
    const body=await readBody(req);
    const question=text(body?.question);
    const context=Array.isArray(body?.context)?body.context:[];
    if(!question)return sendJson(res,400,{ok:false,error:'question is required'});

    // Single semantic entrypoint: every non-empty question is understood by Gemini first.
    const semantic=await understandRequestGeminiFirst(question,context);

    if(semantic.mode==='CLARIFY'){
      const answer=clarificationAnswer(semantic.clarificationQuestion);
      return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
    }

    // Output-format handling happens only after semantic understanding.
    if(hasPdfModifier(question)){
      return sendJson(res,200,{ok:true,handled:false,coreVersion:CORE_VERSION,reason:'OUTPUT_FORMAT_FALLBACK_AFTER_SEMANTIC',semantic,fastPath:false});
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
      const answer='一覧表示する成績種別を確定できませんでした。打撃・投手・守備のどれを見たいか教えてください。';
      return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
    }

    if(semantic.mode==='DELIBERATION'||semantic.mode==='COMPARISON'){
      const routed=deliberationRouteFromSemantic(semantic);
      return sendJson(res,200,await deliberationPayload({question,semantic,routed,role:member.role}));
    }

    if(semantic.mode==='DOCUMENT_SEARCH'){
      return sendJson(res,200,await documentPayload({question,semantic,role:member.role}));
    }

    if(['SINGLE_VALUE','SUMMARY','GENERAL'].includes(semantic.mode)){
      const routed=routedFromSemantic(semantic);
      if(semantic.mode==='GENERAL'&&routed.route==='GENERAL_QUESTION'){
        const answer='質問の意味は理解できましたが、現在のMAGIで実行する処理を安全に確定できませんでした。対象の選手・試合・知りたいことをもう少し具体的に教えてください。';
        return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
      }
      if(routed.route==='FIELDING_LOOKUP'){
        return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'FIELDING_REPORT',action:'FULL_REPORT',reportKind:'FIELDING',understoodRequest:semantic.understoodRequest,players:semantic.players,domains:semantic.domains,timeScope:semantic.timeScope,specificSeason:semantic.specificSeason,opponent:semantic.opponent,breakdowns:semantic.breakdowns,semantic,fastPath:false});
      }
      if(shouldUseVerifiedOldDetailAnswer(question)){
        const result=await buildVerifiedDetailAnswer({question});
        return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,integratedRoute:'VERIFIED_OLD_DETAIL',semantic,fastPath:false});
      }
      const result=routed.route==='PITCHING_LOOKUP'?await buildStrictPitchingAnswer({question,routed}):await buildLiveAnswer({question,routed});
      return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,semantic,fastPath:false});
    }

    const answer='質問の意味は理解できましたが、対応する処理を安全に確定できませんでした。もう少し具体的に教えてください。';
    return sendJson(res,200,{ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',answer,clarificationQuestion:answer,needsClarification:true,semantic,fastPath:false});
  }catch(error){
    console.error('[MAGI CORE]',error?.message||error);
    return sendJson(res,502,{ok:false,error:error?.message||'MAGI core failed',coreVersion:CORE_VERSION});
  }
}
