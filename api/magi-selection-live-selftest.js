import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const packet=await buildCurrentSelectionEvidence({question:'3番は誰がいい？',routed:{players:[],domains:['LINEUP']}});
    const names=packet?.allCurrentTeamCheck?.players?.map(x=>x.name)||[];
    const exact=names.length===CURRENT_ROSTER.length&&CURRENT_ROSTER.every(name=>names.includes(name));
    const hasBatting=packet?.allCurrentTeamCheck?.players?.filter(x=>x?.batting&&Object.keys(x.batting).length).length||0;
    const hasEvidenceText=Boolean(packet?.text&&packet.text.includes('【現チーム全14選手・打撃】'));
    res.status(200).json({
      ok:Boolean(packet)&&exact&&hasBatting>0&&hasEvidenceText,
      version:packet?.resolverVersion||'',
      count:packet?.count||0,
      rosterExact:exact,
      names,
      playersWithBatting:hasBatting,
      sourceName:packet?.sources?.[0]?.name||'',
      hasEvidenceText
    });
  }catch(error){
    res.status(200).json({ok:false,error:error?.message||String(error)});
  }
}
