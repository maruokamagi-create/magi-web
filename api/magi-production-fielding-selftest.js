import { runFieldingCsvAudit } from '../server/api/magi/_fielding-csv-audit.js';

export const config={maxDuration:60};
export default async function handler(req,res){
 try{
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET only'});
  const current=await runFieldingCsvAudit({season:'current'});
  const players=Array.isArray(current?.players)?current.players:[];
  const names=players.map(x=>x?.name).filter(Boolean);
  const required=['大野 竜暉','橋向 結都','武澤 大翔'];
  const missing=required.filter(n=>!names.includes(n));
  const withMaster=players.filter(x=>x?.master).length;
  const pass=missing.length===0&&players.length>=14&&withMaster>=14;
  return res.status(pass?200:500).json({ok:pass,season:'current',playerCount:players.length,withMaster,missing,overallState:current?.overallState||null,source:current?.authoritativeSource||null});
 }catch(e){return res.status(500).json({ok:false,error:e?.message||String(e)})}
}
