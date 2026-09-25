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
function escapeRegExp(value){
  return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}
function playerLineHasCoreNumbers(body,name){
  const line=String(body||'').split('\n').find(row=>row.startsWith(`${name}：`))||'';
  if(!line)return false;
  const number='[-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
  return ['打率','打数','OPS'].every(label=>new RegExp(`${escapeRegExp(label)}\\s*${number}`,'i').test(line));
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const packet=await buildCurrentSelectionEvidence({
      question:'現時点のベストオーダーを審議して',
      routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}
    });
    const closerPacket=await buildCurrentSelectionEvidence({
      question:'クローザーは誰がいい？',
      routed:{players:[],domains:['PITCHING','TEAM'],selectionKind:'PITCHING_ROLE'}
    });
    const naturalThirdPacket=await buildCurrentSelectionEvidence({
      question:'3番を誰にするか迷ってる。4番の大久保 陽翔につなぐことを考えると、誰がいいと思う？',
      routed:{players:['大久保 陽翔'],domains:['LINEUP','BATTING','TEAM'],selectionKind:'GENERIC_SELECTION'}
    });
    const players=packet?.allCurrentTeamCheck?.players||[];
    const names=players.map(x=>x.name);
    const exact=names.length===CURRENT_ROSTER.length&&CURRENT_ROSTER.every(name=>names.includes(name));
    const withCoreBatting=players.filter(hasCoreBatting).length;
    const body=String(packet?.text||'');
    const textHasCurrentNumbers=Boolean(
      body.includes('【現チーム全14選手・打撃】')&&
      CURRENT_ROSTER.every(name=>body.includes(name))&&
      ['大野 竜暉','大久保 陽翔','中嶋 玲月'].every(name=>playerLineHasCoreNumbers(body,name))
    );
    const currentMaster=packet?.sources?.find(x=>x?.season==='current'&&x?.priority==='PRIMARY');
    const fullLineupReady=Boolean(packet)&&packet?.selectionKind==='FULL_LINEUP'&&exact&&withCoreBatting===14&&textHasCurrentNumbers&&/2026-2027.*\.xlsm$/i.test(String(currentMaster?.name||''));
    const naturalPlayers=naturalThirdPacket?.allCurrentTeamCheck?.players||[];
    const naturalNames=naturalPlayers.map(x=>x.name);
    const naturalThirdReady=Boolean(naturalThirdPacket)&&naturalThirdPacket?.selectionKind==='BATTING_ORDER'&&naturalNames.length===CURRENT_ROSTER.length&&CURRENT_ROSTER.every(name=>naturalNames.includes(name))&&naturalPlayers.filter(hasCoreBatting).length===14&&String(naturalThirdPacket?.text||'').includes('【現チーム全14選手・打撃】');
    const closerPlayers=closerPacket?.allCurrentTeamCheck?.players||[];
    const uemura=closerPlayers.find(p=>p.name==='上村 蓮');
    const closerSource=closerPacket?.sources?.find(x=>x?.priority==='PRIMARY_PITCHING_DETAIL');
    const closerPitchingReady=Boolean(closerPacket)&&closerPacket?.selectionKind==='PITCHING_ROLE'&&closerPlayers.length===CURRENT_ROSTER.length&&!uemura?.pitching&&!closerPacket?.pitchingEligible?.includes('上村 蓮')&&/投手詳細(?:2026-2027)?\.csv$/i.test(String(closerSource?.name||''))&&String(closerPacket?.text||'').includes('上村 蓮：投手記録なし')&&String(closerPacket?.text||'').includes('【投手候補資格】');
    res.status(200).json({
      ok:fullLineupReady&&naturalThirdReady&&closerPitchingReady,
      fullLineupReady,
      closerPitchingReady,
      closerPitchingSource:closerSource?.name||'',
      uemuraPitching:uemura?.pitching||null,
      pitchingEligible:closerPacket?.pitchingEligible||[],
      naturalThirdReady,
      naturalThirdSelectionKind:naturalThirdPacket?.selectionKind||'',
      naturalThirdCount:naturalThirdPacket?.count||0,
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
