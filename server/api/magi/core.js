import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { routeQuestion } from './_question-router-current.js';
import { recoverContextBoundDeliberation } from './_conversation-recovery.js';
import { buildFastLiveRoute } from './_fast-live-route.js';
import { buildLiveAnswer } from './_live-answer.js';
import { buildStrictPitchingAnswer } from './_strict-pitching-answer.js';
import { buildVerifiedDetailAnswer } from './_detail-live-answer.js';
import { shouldUseVerifiedOldDetailAnswer } from './_verified-detail-route.js';
import { resolveQuestionEvidence } from './_evidence-resolver.js';

const CORE_VERSION='magi-core-purpose-first-v1';

function text(v){return String(v||'').trim()}
function hasPdfModifier(q){return /(?:PDF|ＰＤＦ)/i.test(String(q||''))}

async function classify(question,context){
  let routed=await routeQuestion(question,context);
  routed=await recoverContextBoundDeliberation(question,context,routed);
  return routed;
}
function clarificationAnswer(resolution){
  const names=(resolution?.candidates||[]).slice(0,3).map(x=>x.name).filter(Boolean);
  if(resolution?.status==='AMBIGUOUS') return names.length
    ? `参照する資料を一意に決められませんでした。候補は「${names.join('」「')}」です。どれを使うか教えてください。`
    : '参照する資料を一意に決められませんでした。資料名をもう少しだけ教えてください。';
  if(resolution?.status==='NOT_READABLE') return names.length
    ? `「${names[0]}」は見つかりましたが、現在のMAGIでは本文を安全に読み取れません。別形式の資料があればそちらを使ってください。`
    : '資料は見つかりましたが、現在のMAGIでは本文を安全に読み取れません。';
  return names.length
    ? `指定された資料を一意に特定できませんでした。近い候補は「${names.join('」「')}」です。`
    : '指定された資料をDriveから特定できませんでした。';
}

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res))return;
  try{
    const member=await requireApprovedMember(req,res);if(!member)return;
    const body=await readBody(req);
    const question=text(body?.question);
    const context=Array.isArray(body?.context)?body.context:[];
    if(!question)return sendJson(res,400,{ok:false,error:'question is required'});

    // PDF等の出力形式処理は、既存の検証済み経路へ戻す。COREは意味理解・証拠取得・回答/審議を担当する。
    if(hasPdfModifier(question)) return sendJson(res,200,{ok:true,handled:false,coreVersion:CORE_VERSION,reason:'OUTPUT_FORMAT_FALLBACK'});

    if(shouldUseVerifiedOldDetailAnswer(question)){
      const result=await buildVerifiedDetailAnswer({question});
      return sendJson(res,200,{...result,ok:true,handled:true,coreVersion:CORE_VERSION,integratedRoute:'VERIFIED_OLD_DETAIL'});
    }

    const fastRouted=buildFastLiveRoute(question,context);
    const routed=fastRouted||await classify(question,context);

    if(routed?.route==='DELIBERATION'){
      const resolution=await resolveQuestionEvidence({question,routed});
      if(resolution?.requestedDocument&&resolution.status!=='RESOLVED'){
        return sendJson(res,200,{
          ok:true,handled:true,coreVersion:CORE_VERSION,route:'CLARIFY',action:'CLARIFY',
          answer:clarificationAnswer(resolution),needsClarification:true,clarificationQuestion:clarificationAnswer(resolution),
          evidenceResolution:resolution,routerVersion:routed?.routerVersion||null
        });
      }
      return sendJson(res,200,{
        ok:true,handled:true,coreVersion:CORE_VERSION,route:'DELIBERATION',action:'DELIBERATE',
        routerVersion:routed?.routerVersion||null,understoodRequest:routed?.understoodRequest||question,
        domains:Array.isArray(routed?.domains)?routed.domains:[],players:Array.isArray(routed?.players)?routed.players:[],
        evidencePacket:resolution?.evidence||null,evidenceResolution:resolution,
        fastPath:Boolean(fastRouted)
      });
    }

    const result=routed?.route==='PITCHING_LOOKUP'
      ? await buildStrictPitchingAnswer({question,routed})
      : await buildLiveAnswer({question,routed});
    return sendJson(res,200,{
      ...result,ok:true,handled:true,coreVersion:CORE_VERSION,
      fastPath:Boolean(fastRouted),fastRouterVersion:fastRouted?.routerVersion||null
    });
  }catch(error){
    console.error('[MAGI CORE]',error?.message||error);
    return sendJson(res,502,{ok:false,error:error?.message||'MAGI core failed',coreVersion:CORE_VERSION});
  }
}
