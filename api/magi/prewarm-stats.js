import { requirePost, requireSameOrigin, rateLimit, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { runDriveLiveAudit } from './_drive-live-audit.js';
import { runStrictPitchingAudit } from './_drive-pitching-strict.js';

export default async function handler(req,res){
  if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res)) return;
  const member=await requireApprovedMember(req,res);
  if(!member) return;

  const jobs=[
    ['current-stats',()=>runDriveLiveAudit({season:'current',players:[]})],
    ['current-pitching',()=>runStrictPitchingAudit({season:'current',playerName:'大久保 陽翔'})],
    ['old-stats',()=>runDriveLiveAudit({season:'old',players:[]})],
    ['old-pitching',()=>runStrictPitchingAudit({season:'old',playerName:'宮嵜 翔'})]
  ];

  const settled=await Promise.allSettled(jobs.map(([,run])=>run()));
  const results=settled.map((item,i)=>({
    name:jobs[i][0],
    ok:item.status==='fulfilled',
    cacheHit:item.status==='fulfilled'?Boolean(item.value?.cacheHit):false,
    hotCacheHit:item.status==='fulfilled'?Boolean(item.value?.hotCacheHit):false,
    error:item.status==='rejected'?String(item.reason?.message||item.reason):null
  }));
  return sendJson(res,200,{ok:true,results});
}
