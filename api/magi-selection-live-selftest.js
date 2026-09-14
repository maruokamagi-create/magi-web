import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

function numeric(v){
  const s=String(v??'').trim().replace(/,/g,'');
  return /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s);
}
function hasCoreBatting(player){
  const b=player?.batting||{};
  return numeric(b.AVG)&&numeric(b.AB)&&numeric(b.OPS);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const packet=await buildCurrentSelectionEvidence({
      question:'現時点のベストオーダーを審議して',
      routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}
    });
    const players=packet?.allCurrentTeamCheck?.players||[];
    const names=players.map(x=>x.name);
    const exact=names.length===CURRENT_ROSTER.length&&CURRENT_ROSTER.every(name=>names.includes(name));
    const withCoreBatting=players.filter(hasCoreBatting).length;
    const body=String(packet?.text||'');
    const textHasCurrentNumbers=Boolean(
      body.includes('【現チーム全14選手・打撃】')&&
      CURRENT_ROSTER.every(name=>body.includes(name))&&
      /大野 竜暉：.*打率.*打数.*OPS/.test(body)&&
      /大久保 陽翔：.*打率.*打数.*OPS/.test(body)&&
      /中嶋 玲月：.*打率.*打数.*OPS/.test(body)
    );
    const currentMaster=packet?.sources?.find(x=>x?.season==='current'&&x?.priority==='PRIMARY');
    const fullLineupReady=Boolean(packet)&&packet?.selectionKind==='FULL_LINEUP'&&exact&&withCoreBatting===14&&textHasCurrentNumbers&&/2026-2027.*\.xlsm$/i.test(String(currentMaster?.name||''));
    res.status(200).json({
      ok:fullLineupReady,
      fullLineupReady,
      version:packet?.resolverVersion||'',
      selectionKind:packet?.selectionKind||'',
      count:packet?.count||0,
      rosterExact:exact,
      playersWithCoreBatting:withCoreBatting,
      sourceName:currentMaster?.name||'',
      textHasCurrentNumbers,
      recentSixStatus:packet?.recentSix?.status||'',
      historicalStatus:packet?.historicalReference?.status||''
    });
  }catch(error){
    res.status(200).json({ok:false,fullLineupReady:false,error:error?.message||String(error)});
  }
}
