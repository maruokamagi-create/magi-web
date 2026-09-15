import { createHash } from 'node:crypto';
import personaHandler from '../server/api/magi/persona.js';
import orchestrateHandler from '../server/api/magi/orchestrate.js';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

export const config = { maxDuration: 60 };

const QUESTION='今の丸岡中のベストオーダーを、守備位置込みで審議して';
const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={melchior:'MELCHIOR-1',balthasar:'BALTHASAR-2',casper:'CASPER-3'};
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　]/g,'');
const rosterKeys=new Set(CURRENT_ROSTER.map(norm));

function invoke(handler,body,ip){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const headers={};
    const req={
      method:'POST',
      body,
      headers:{host:'selftest.local',origin:'https://selftest.local','x-forwarded-host':'selftest.local','x-forwarded-for':ip},
      socket:{remoteAddress:ip}
    };
    const res={
      statusCode:200,
      headersSent:false,
      setHeader(name,value){headers[String(name).toLowerCase()]=value;},
      end(value=''){
        if(settled)return;settled=true;this.headersSent=true;
        let parsed=value;
        try{parsed=value?JSON.parse(String(value)):null;}catch(_){ }
        if(this.statusCode<200||this.statusCode>=300){
          const err=new Error(parsed?.error||`handler status ${this.statusCode}`);err.status=this.statusCode;err.body=parsed;reject(err);return;
        }
        resolve(parsed);
      }
    };
    Promise.resolve(handler(req,res)).catch(reject);
  });
}

function crossFor(persona,cross,independenceReview=''){
  return {
    ...(cross||{}),
    challengeToSelf:Array.isArray(cross?.challenges?.[persona])?cross.challenges[persona]:[],
    challengeTarget:TARGETS[persona],
    challengeSemantics:`challengeToSelf と challenges.${persona} は ${TARGETS[persona]} に向けられた質問。自分宛ての指摘に答えた後、自分の専門領域だけで二次判断する。`,
    independenceRule:'他の2人格に合わせない。違いを作るためだけにも変えない。Evidenceと一次案を自分の専門領域で再検証する。',
    ...(independenceReview?{independenceReview}:{})
  };
}

function candidateSeq(v){return (Array.isArray(v?.candidatePlayers)?v.candidatePlayers:[]).map(norm);}
function validNine(v){const s=candidateSeq(v);return s.length===9&&new Set(s).size===9&&s.every(x=>rosterKeys.has(x));}
function allSame(set){
  const seqs=PERSONAS.map(p=>candidateSeq(set?.[p]));
  if(seqs.some(s=>s.length!==9))return false;
  return seqs.slice(1).every(s=>s.every((v,i)=>v===seqs[0][i]));
}
function stableDigest(value){
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
}

async function runOnce(packet,tag){
  const caseData={mode:'selection',selectionKind:'FULL_LINEUP',question:QUESTION,evidence:packet};
  const primary=Object.fromEntries(await Promise.all(PERSONAS.map(async(p,i)=>[
    p,
    await invoke(personaHandler,{persona:p,phase:'PRIMARY',case:caseData},`10.61.${tag}.${i+1}`)
  ])));
  for(const p of PERSONAS){
    if(primary[p]?.reviewRequested===true||primary[p]?.dataConflict===true||!validNine(primary[p]))throw new Error(`PRIMARY_${p.toUpperCase()}_INVALID`);
  }

  const cross=await invoke(orchestrateHandler,{phase:'CROSS_EXAMINATION',case:caseData,primary},`10.62.${tag}.1`);
  for(const p of PERSONAS){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)throw new Error(`CROSS_${p.toUpperCase()}_MISSING_CHALLENGE`);}

  const doSecond=async(note='')=>Object.fromEntries(await Promise.all(PERSONAS.map(async(p,i)=>[
    p,
    await invoke(personaHandler,{persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross,note)},`10.63.${tag}.${i+1}`)
  ])));

  let second=await doSecond();
  if(allSame(second)){
    second=await doSecond('3賢人の二次打順が完全一致したため、多数派への同調を排除して独立再検証する。同じ案を維持する場合も代替案を比較した理由を明示する。');
  }
  for(const p of PERSONAS){
    if(second[p]?.reviewRequested===true||second[p]?.dataConflict===true||!validNine(second[p]))throw new Error(`SECOND_${p.toUpperCase()}_INVALID`);
  }

  const final=await invoke(orchestrateHandler,{phase:'FINAL',case:caseData,primary,crossExamination:cross,second},`10.64.${tag}.1`);
  const names=Array.isArray(final?.lineup)?final.lineup.map(x=>x?.name).filter(Boolean):[];
  const legal=final?.mode==='FULL_LINEUP'&&final?.status==='LINEUP_RESULT'&&names.length===9&&new Set(names.map(norm)).size===9&&names.every(n=>rosterKeys.has(norm(n)));
  if(!legal)throw new Error(`FINAL_INVALID_${String(final?.status||'NO_STATUS')}`);
  return {
    primary:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:primary[p].candidatePlayers,judgment:primary[p].judgment,confidence:primary[p].confidence}])),
    cross:{agreement:cross?.agreement||[],disagreement:cross?.disagreement||[],domainConflicts:cross?.domainConflicts||[],challenges:cross?.challenges||{},informationGaps:cross?.informationGaps||[]},
    second:Object.fromEntries(PERSONAS.map(p=>[p,{candidatePlayers:second[p].candidatePlayers,judgment:second[p].judgment,confidence:second[p].confidence}])),
    final:{mode:final.mode,status:final.status,lineup:final.lineup,recommendation:final.recommendation,personaLineups:final.personaLineups}
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  try{
    const packet=await buildCurrentSelectionEvidence({question:QUESTION,routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}});
    const players=packet?.allCurrentTeamCheck?.players||[];
    const ready=packet?.selectionKind==='FULL_LINEUP'&&Number(packet?.count)===14&&players.length===14&&CURRENT_ROSTER.every(name=>players.some(p=>p?.name===name));
    if(!ready)throw new Error('LIVE_EVIDENCE_NOT_READY');

    const first=await runOnce(packet,1);
    const second=await runOnce(packet,2);
    const firstStable=stableDigest(first);
    const secondStable=stableDigest(second);
    const reproducible=firstStable===secondStable;
    if(!reproducible)throw new Error(`NON_REPRODUCIBLE_${firstStable}_${secondStable}`);

    return res.status(200).json({
      ok:true,
      question:QUESTION,
      evidence:{count:packet.count,selectionKind:packet.selectionKind,recentSixStatus:packet?.recentSix?.status||'',historicalStatus:packet?.historicalReference?.status||''},
      finalStatus:first.final.status,
      lineup:first.final.lineup.map(x=>({slot:x.slot,name:x.name})),
      reproducible,
      digest:firstStable
    });
  }catch(error){
    console.error('[MAGI LIVE DELIBERATION SELFTEST]',error?.message||error);
    return res.status(200).json({ok:false,question:QUESTION,error:error?.message||String(error)});
  }
}
