import { createHash } from 'node:crypto';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

export const config = { maxDuration: 60 };

const QUESTION='今の丸岡中のベストオーダーを、守備位置込みで審議して';
const PERSONAS=['melchior','balthasar','casper'];
const TARGETS={melchior:'MELCHIOR-1',balthasar:'BALTHASAR-2',casper:'CASPER-3'};
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　]/g,'');
const rosterKeys=new Set(CURRENT_ROSTER.map(norm));

async function post(base,path,body){
  const response=await fetch(`${base}${path}`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const raw=await response.text();
  let parsed={};
  try{parsed=raw?JSON.parse(raw):{};}catch(_){parsed={raw:raw.slice(0,300)};}
  if(!response.ok){
    const detail=parsed?.error||parsed?.message||parsed?.raw||`HTTP ${response.status}`;
    throw new Error(`${path} ${response.status}: ${detail}`);
  }
  return parsed;
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
function stableDigest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);}

async function serialPersonaSet(base,buildBody){
  const out={};
  for(const p of PERSONAS)out[p]=await post(base,'/api/magi/persona',buildBody(p));
  return out;
}

async function runOnce(base,packet){
  const caseData={mode:'selection',selectionKind:'FULL_LINEUP',question:QUESTION,evidence:packet};
  const primary=await serialPersonaSet(base,p=>({persona:p,phase:'PRIMARY',case:caseData}));
  for(const p of PERSONAS){
    if(primary[p]?.reviewRequested===true||primary[p]?.dataConflict===true||!validNine(primary[p]))throw new Error(`PRIMARY_${p.toUpperCase()}_INVALID`);
  }

  const cross=await post(base,'/api/magi/orchestrate',{phase:'CROSS_EXAMINATION',case:caseData,primary});
  for(const p of PERSONAS){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)throw new Error(`CROSS_${p.toUpperCase()}_MISSING_CHALLENGE`);}

  const doSecond=async(note='')=>serialPersonaSet(base,p=>({persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:crossFor(p,cross,note)}));

  let second=await doSecond();
  if(allSame(second)){
    second=await doSecond('3賢人の二次打順が完全一致したため、多数派への同調を排除して独立再検証する。同じ案を維持する場合も代替案を比較した理由を明示する。');
  }
  for(const p of PERSONAS){
    if(second[p]?.reviewRequested===true||second[p]?.dataConflict===true||!validNine(second[p]))throw new Error(`SECOND_${p.toUpperCase()}_INVALID`);
  }

  const final=await post(base,'/api/magi/orchestrate',{phase:'FINAL',case:caseData,primary,crossExamination:cross,second});
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
    const host=String(req.headers?.['x-forwarded-host']||req.headers?.host||'magi-web.vercel.app').split(',')[0].trim();
    const proto=String(req.headers?.['x-forwarded-proto']||'https').split(',')[0].trim();
    const base=`${proto}://${host}`;
    const packet=await buildCurrentSelectionEvidence({question:QUESTION,routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}});
    const players=packet?.allCurrentTeamCheck?.players||[];
    const ready=packet?.selectionKind==='FULL_LINEUP'&&Number(packet?.count)===14&&players.length===14&&CURRENT_ROSTER.every(name=>players.some(p=>p?.name===name));
    if(!ready)throw new Error('LIVE_EVIDENCE_NOT_READY');

    const result=await runOnce(base,packet);
    const digest=stableDigest(result);
    return res.status(200).json({
      ok:true,
      question:QUESTION,
      evidence:{count:packet.count,selectionKind:packet.selectionKind,recentSixStatus:packet?.recentSix?.status||'',historicalStatus:packet?.historicalReference?.status||''},
      finalStatus:result.final.status,
      lineup:result.final.lineup.map(x=>({slot:x.slot,name:x.name})),
      digest
    });
  }catch(error){
    console.error('[MAGI LIVE DELIBERATION SELFTEST]',error?.message||error);
    return res.status(200).json({ok:false,question:QUESTION,error:error?.message||String(error)});
  }
}
