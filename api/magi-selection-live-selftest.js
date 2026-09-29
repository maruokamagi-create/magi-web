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
    const adminFullPacket=await buildCurrentSelectionEvidence({
      question:'現時点のベストオーダーを審議して',
      routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'},
      staffAccessContext:{role:'admin',purpose:'DELIBERATION'}
    });
    const memberFullPacket=await buildCurrentSelectionEvidence({
      question:'現時点のベストオーダーを審議して',
      routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'},
      staffAccessContext:{role:'member',purpose:'DELIBERATION'}
    });
    const closerPacket=await buildCurrentSelectionEvidence({
      question:'クローザーは誰がいい？',
      routed:{players:[],domains:['PITCHING','TEAM'],selectionKind:'PITCHING_ROLE'}
    });
    const closerAdminPacket=await buildCurrentSelectionEvidence({
      question:'クローザーは誰がいい？',
      routed:{players:[],domains:['PITCHING','TEAM'],selectionKind:'PITCHING_ROLE'},
      staffAccessContext:{role:'admin',purpose:'DELIBERATION'}
    });
    const closerMemberPacket=await buildCurrentSelectionEvidence({
      question:'クローザーは誰がいい？',
      routed:{players:[],domains:['PITCHING','TEAM'],selectionKind:'PITCHING_ROLE'},
      staffAccessContext:{role:'member',purpose:'DELIBERATION'}
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
    const dynamicLineupRulesReady=packet?.resolverVersion==='selection-live-evidence-v17-dated-strategy-reference'
      && body.includes('標準オーダーをコード内の固定打順から決めない')
      && !body.includes('現在の上位5人の基準線')
      && !body.includes('橋向 結都は先発投手でない日は遊撃・6番')
      && !body.includes('武田 晴琉翔は左翼が第一適性')
      && !body.includes('大久保 陽翔は現チームのキャプテン')
      && !body.includes('1番 大野 竜暉、2番 坂田 暉馬');
    const strategyReferenceReady=adminFullPacket?.strategySnapshotStatus==='REFERENCE_ONLY'\n      && adminObservationText.includes('【過去の指導者起用方針】')\n      && adminObservationText.includes('2026-08-02')\n      && adminObservationText.includes('現在の固定方針ではなく');\n    const memberStrategyReferenceBlocked=memberFullPacket?.strategySnapshotStatus!=='REFERENCE_ONLY'\n      && !memberObservationText.includes('【過去の指導者起用方針】');\n    const naturalPlayers=naturalThirdPacket?.allCurrentTeamCheck?.players||[];
    const naturalNames=naturalPlayers.map(x=>x.name);
    const naturalThirdReady=Boolean(naturalThirdPacket)&&naturalThirdPacket?.selectionKind==='BATTING_ORDER'&&naturalNames.length===CURRENT_ROSTER.length&&CURRENT_ROSTER.every(name=>naturalNames.includes(name))&&naturalPlayers.filter(hasCoreBatting).length===14&&String(naturalThirdPacket?.text||'').includes('【現チーム全14選手・打撃】');
    const closerPlayers=closerPacket?.allCurrentTeamCheck?.players||[];
    const uemura=closerPlayers.find(p=>p.name==='上村 蓮');
    const closerSource=closerPacket?.sources?.find(x=>x?.priority==='PRIMARY_PITCHING_DETAIL');
    const sakata=closerPlayers.find(p=>p.name==='坂田 暉馬');
    const sakataSaveCount=String(sakata?.pitching?.SV??'').trim();
    const closerHasSaveEvidence=sakataSaveCount==='2'&&String(closerPacket?.text||'').includes('坂田 暉馬：')&&String(closerPacket?.text||'').includes('セーブ 2')&&String(closerPacket?.text||'').includes('【クローザー役割実績】');
    const closerPitchingReady=closerHasSaveEvidence&&Boolean(closerPacket)&&closerPacket?.selectionKind==='PITCHING_ROLE'&&closerPlayers.length===CURRENT_ROSTER.length&&!uemura?.pitching&&!closerPacket?.pitchingEligible?.includes('上村 蓮')&&/投手詳細(?:2026-2027)?\.csv$/i.test(String(closerSource?.name||''))&&String(closerPacket?.text||'').includes('上村 蓮：投手記録なし')&&String(closerPacket?.text||'').includes('【投手候補資格】');

    const adminText=String(closerAdminPacket?.text||'');
    const memberText=String(closerMemberPacket?.text||'');
    const adminCoachEvidenceReady=closerAdminPacket?.coachObservationStatus==='COMPLETE'
      && adminText.includes('【指導者観察・投手起用】')
      && adminText.includes('坂田 暉馬')
      && adminText.includes('制球')
      && adminText.includes('内野守備')
      && String(closerAdminPacket?.allCurrentTeamCheck?.players?.find(p=>p.name==='坂田 暉馬')?.pitching?.SV??'').trim()==='2';
    const memberCoachEvidenceBlocked=closerMemberPacket?.coachObservationStatus!=='COMPLETE'
      && !memberText.includes('内野守備に専念');
    const adminObservationText=String(adminFullPacket?.text||'');
    const memberObservationText=String(memberFullPacket?.text||'');
    const adminNormalizedObservationReady=adminFullPacket?.normalizedObservationStatus==='COMPLETE'
      && adminObservationText.includes('【観察Evidence】')
      && adminObservationText.includes('PARENT')===false
      && adminObservationText.includes('大野 竜暉')
      && adminObservationText.includes('精神的な成長');
    const memberNormalizedObservationBlocked=memberFullPacket?.normalizedObservationStatus!=='COMPLETE'
      && !memberObservationText.includes('精神的な成長');

    res.status(200).json({
      ok:fullLineupReady&&dynamicLineupRulesReady&&naturalThirdReady&&closerPitchingReady&&adminCoachEvidenceReady&&memberCoachEvidenceBlocked&&adminNormalizedObservationReady&&memberNormalizedObservationBlocked&&strategyReferenceReady&&memberStrategyReferenceBlocked,
      fullLineupReady,
      dynamicLineupRulesReady,
      adminNormalizedObservationReady,
      memberNormalizedObservationBlocked,
      adminNormalizedObservationStatus:adminFullPacket?.normalizedObservationStatus||'',
      memberNormalizedObservationStatus:memberFullPacket?.normalizedObservationStatus||'',
      adminNormalizedObservationError:adminFullPacket?.normalizedObservationError||'',
      adminNormalizedObservationHttpStatus:adminFullPacket?.normalizedObservationHttpStatus??null,
      memberNormalizedObservationError:memberFullPacket?.normalizedObservationError||'',
      memberNormalizedObservationHttpStatus:memberFullPacket?.normalizedObservationHttpStatus??null,
      adminCoachEvidenceReady,
      memberCoachEvidenceBlocked,
      adminCoachObservationStatus:closerAdminPacket?.coachObservationStatus||'',
      memberCoachObservationStatus:closerMemberPacket?.coachObservationStatus||'',
      adminCoachObservationError:closerAdminPacket?.coachObservationError||'',
      adminCoachObservationHttpStatus:closerAdminPacket?.coachObservationHttpStatus??null,
      memberCoachObservationError:closerMemberPacket?.coachObservationError||'',
      memberCoachObservationHttpStatus:closerMemberPacket?.coachObservationHttpStatus??null,
      closerPitchingReady,
      closerPitchingSource:closerSource?.name||'',
      uemuraPitching:uemura?.pitching||null,
      pitchingEligible:closerPacket?.pitchingEligible||[],
      closerHasSaveEvidence,
      sakataSaveCount,
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
