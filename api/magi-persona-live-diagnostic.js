import personaHandler from '../server/api/magi/persona.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';

export const config = { maxDuration: 60 };
const QUESTION='今の丸岡中のベストオーダーを、守備位置込みで審議して';

function invoke(body){
  return new Promise((resolve)=>{
    const req={method:'POST',body,headers:{host:'selftest.local',origin:'https://selftest.local','x-forwarded-host':'selftest.local','x-forwarded-for':'10.99.0.1'},socket:{remoteAddress:'10.99.0.1'}};
    const res={statusCode:200,headersSent:false,setHeader(){},end(value=''){let parsed={};try{parsed=value?JSON.parse(String(value)):{};}catch(_){parsed={raw:String(value)}}this.headersSent=true;resolve({status:this.statusCode,body:parsed});}};
    Promise.resolve(personaHandler(req,res)).catch(error=>resolve({status:599,body:{error:error?.message||String(error)}}));
  });
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const persona=['melchior','balthasar','casper'].includes(String(req.query?.persona||''))?String(req.query.persona):'melchior';
  const captured=[];
  const original=console.error;
  console.error=(...args)=>{captured.push(args.map(x=>typeof x==='string'?x:(x?.message||String(x))).join(' '));original(...args);};
  try{
    const packet=await buildCurrentSelectionEvidence({question:QUESTION,routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}});
    const result=await invoke({persona,phase:'PRIMARY',case:{mode:'selection',selectionKind:'FULL_LINEUP',question:QUESTION,evidence:packet}});
    return res.status(200).json({ok:result.status>=200&&result.status<300,persona,status:result.status,error:result.body?.error||'',reviewRequested:result.body?.reviewRequested??null,candidateCount:Array.isArray(result.body?.candidatePlayers)?result.body.candidatePlayers.length:null,captured:captured.slice(-8)});
  }catch(error){
    return res.status(200).json({ok:false,persona,status:500,error:error?.message||String(error),captured:captured.slice(-8)});
  }finally{console.error=original;}
}
