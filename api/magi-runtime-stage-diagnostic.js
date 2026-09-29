export const config={maxDuration:60};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const stage=String(req.query?.stage||'base');
  const started=Date.now();
  try{
    if(stage==='base') return res.status(200).json({ok:true,stage,elapsedMs:Date.now()-started});
    if(stage==='vercelCacheImport'){
      const mod=await import('@vercel/functions');
      return res.status(200).json({ok:true,stage,hasGetCache:typeof mod.getCache==='function',elapsedMs:Date.now()-started});
    }
    if(stage==='xlsxImport'){
      const mod=await import('xlsx');
      return res.status(200).json({ok:true,stage,hasRead:typeof (mod.read||mod.default?.read)==='function',elapsedMs:Date.now()-started});
    }
    if(stage==='auditImport'){
      const mod=await import('../server/api/magi/_drive-live-audit.js');
      return res.status(200).json({ok:true,stage,hasAudit:typeof mod.runDriveLiveAudit==='function',elapsedMs:Date.now()-started});
    }
    if(stage==='auditCurrent'){
      const mod=await import('../server/api/magi/_drive-live-audit.js');
      const packet=await mod.runDriveLiveAudit({season:'current'});
      return res.status(200).json({ok:true,stage,season:packet?.season||'',cacheHit:Boolean(packet?.cacheHit),count:Object.keys(packet?.extracted?.playersByName||{}).length,elapsedMs:Date.now()-started});
    }
    return res.status(400).json({ok:false,error:'unknown_stage',stage});
  }catch(error){
    return res.status(200).json({ok:false,stage,error:error?.message||String(error),stack:String(error?.stack||'').split('\n').slice(0,6),elapsedMs:Date.now()-started});
  }
}
