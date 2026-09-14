import personaHandler from '../server/api/magi/persona.js';
import orchestrateHandler from '../server/api/magi/orchestrate.js';
import { buildCurrentSelectionEvidence } from '../server/api/magi/_selection-live-evidence.js';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';

export const config = { maxDuration: 60 };

const QUESTION='現時点のベストオーダーを審議して';
const ORIGIN='https://magi-web.vercel.app';

function callHandler(handler, body, ip){
  return new Promise((resolve,reject)=>{
    const req={method:'POST',body,headers:{host:'magi-web.vercel.app',origin:ORIGIN,'x-forwarded-host':'magi-web.vercel.app','x-forwarded-for':ip},socket:{remoteAddress:ip}};
    const res={statusCode:200,headers:{},setHeader(name,value){this.headers[String(name).toLowerCase()]=value;},end(raw=''){
      let data={};try{data=raw?JSON.parse(String(raw)):{};}catch{data={raw:String(raw)}}
      if(this.statusCode>=400)reject(new Error(`${this.statusCode}: ${data?.error||String(raw)}`));else resolve(data);
    }};
    Promise.resolve(handler(req,res)).catch(reject);
  });
}
function uniqueNine(row){const a=Array.isArray(row?.candidatePlayers)?row.candidatePlayers:[];return a.length===9&&new Set(a).size===9&&a.every(name=>CURRENT_ROSTER.includes(name));}
function exactRoster(row){const a=Array.isArray(row?.checkedPlayers)?row.checkedPlayers:[];return a.length===14&&new Set(a).size===14&&CURRENT_ROSTER.every(name=>a.includes(name));}
function textOf(row){return [row?.candidateBasis,row?.primaryReason,row?.publicStatement,...(row?.facts||[]),...(row?.analysis||[]),...(row?.warnings||[])].join(' ');}
function falselyMissingCurrent(row){const s=textOf(row);return /(?:2026-2027|今季通算|今季|現在成績|打撃成績).{0,80}(?:提供されていない|含まれていない|未記載|確認できない|数値がない|数値データがない|欠損)/s.test(s);}
function numericMentionCount(row){const s=textOf(row);const m=s.match(/(?:打率|OPS|出塁率|長打率|打数|打席|安打|打点)\s*(?:[:：=]?\s*)?(?:\.\d+|0\.\d+|\d+(?:\.\d+)?)/g);return m?m.length:0;}
function checkPersona(row,phase,persona){const issues=[];if(!exactRoster(row))issues.push(`${phase}.${persona}: roster not 14/14`);if(!uniqueNine(row))issues.push(`${phase}.${persona}: lineup not legal 9`);if(row?.reviewRequested===true)issues.push(`${phase}.${persona}: reviewRequested`);if(row?.dataConflict===true)issues.push(`${phase}.${persona}: dataConflict`);if(falselyMissingCurrent(row))issues.push(`${phase}.${persona}: current numeric Evidence falsely described as missing`);if(numericMentionCount(row)<2)issues.push(`${phase}.${persona}: fewer than two concrete batting metric mentions`);return issues;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:'GET only'}));}
  const started=Date.now();
  try{
    const evidence=await buildCurrentSelectionEvidence({question:QUESTION,routed:{players:[],domains:['LINEUP'],selectionKind:'FULL_LINEUP'}});
    const currentPlayers=evidence?.allCurrentTeamCheck?.players||[];
    const currentReady=currentPlayers.length===14&&currentPlayers.every(p=>p?.batting?.AVG!==undefined&&p?.batting?.AB!==undefined&&p?.batting?.OPS!==undefined);
    if(!currentReady)throw new Error('live current batting Evidence is not 14/14');
    const caseData={mode:'selection',selectionKind:'FULL_LINEUP',question:QUESTION,evidence};
    const personas=['melchior','balthasar','casper'];
    const primaryArr=await Promise.all(personas.map((p,i)=>callHandler(personaHandler,{persona:p,phase:'PRIMARY',case:caseData},`127.0.1.${i+1}`)));
    const primary=Object.fromEntries(personas.map((p,i)=>[p,primaryArr[i]]));
    const cross=await callHandler(orchestrateHandler,{phase:'CROSS_EXAMINATION',case:caseData,primary},'127.0.1.10');
    const secondArr=await Promise.all(personas.map((p,i)=>callHandler(personaHandler,{persona:p,phase:'SECOND',case:caseData,primarySelf:primary[p],crossExamination:cross},`127.0.1.${i+20}`)));
    const second=Object.fromEntries(personas.map((p,i)=>[p,secondArr[i]]));
    const final=await callHandler(orchestrateHandler,{phase:'FINAL',case:caseData,primary,second,crossExamination:cross},'127.0.1.30');
    const issues=[];
    for(const p of personas){issues.push(...checkPersona(primary[p],'primary',p));issues.push(...checkPersona(second[p],'second',p));}
    if(cross?.reviewRequired===true)issues.push('cross: reviewRequired');
    for(const p of personas){if(!Array.isArray(cross?.challenges?.[p])||cross.challenges[p].length<1)issues.push(`cross.${p}: no challenge`);}
    if(final?.mode!=='FULL_LINEUP')issues.push(`final mode=${final?.mode||'missing'}`);
    if(final?.status!=='LINEUP_RESULT')issues.push(`final status=${final?.status||'missing'}`);
    const lineup=Array.isArray(final?.lineup)?final.lineup:[];
    if(lineup.length!==9||new Set(lineup.map(x=>x?.name)).size!==9||!lineup.every(x=>CURRENT_ROSTER.includes(x?.name)))issues.push('final lineup not legal 9');
    const summary={currentEvidenceCount:evidence?.count||0,currentPlayersWithBatting:currentPlayers.filter(p=>p?.batting&&p.batting.AVG!==undefined&&p.batting.AB!==undefined&&p.batting.OPS!==undefined).length,historicalStatus:evidence?.historicalReference?.status||'',recentSixStatus:evidence?.recentSix?.status||'',primary:Object.fromEntries(personas.map(p=>[p,{lineup:primary[p]?.candidatePlayers||[],metrics:numericMentionCount(primary[p]),statement:primary[p]?.publicStatement||''}])),crossChallenges:Object.fromEntries(personas.map(p=>[p,(cross?.challenges?.[p]||[]).length])),second:Object.fromEntries(personas.map(p=>[p,{lineup:second[p]?.candidatePlayers||[],metrics:numericMentionCount(second[p]),statement:second[p]?.publicStatement||''}])),final:{status:final?.status||'',lineup:lineup.map(x=>({slot:x.slot,name:x.name}))},elapsedMs:Date.now()-started};
    const ok=issues.length===0;res.statusCode=ok?200:500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok,issues,summary}));
  }catch(error){res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');return res.end(JSON.stringify({ok:false,error:error?.message||String(error),elapsedMs:Date.now()-started}));}
}
