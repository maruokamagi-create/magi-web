(()=>{
'use strict';
if(window.MAGI_LINEUP_FINALIZER_V350)return;
window.MAGI_LINEUP_FINALIZER_V350=true;

const PERSONAS=['melchior','balthasar','casper'];
const ROSTER=['井坂 悠聖','大久保 陽翔','大野 竜暉','坂田 暉馬','嶋田 栄志','武澤 大翔','橋向 結都','上村 蓮','大久保 夢翔','長侶 穹','中嶋 玲月','吉田 真翔','鰐渕 将太','武田 晴琉翔'];
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s　]/g,'');
const rosterMap=new Map(ROSTER.map(n=>[norm(n),n]));
const clone=v=>JSON.parse(JSON.stringify(v??null));
const confidenceRank={LOW:0,MEDIUM:1,HIGH:2};

function isFullLineupInput(input){
 const q=String(input?.question||'').normalize('NFKC');
 return String(input?.evidence?.selectionKind||'').toUpperCase()==='FULL_LINEUP'||/ベストオーダー|ベスト打順/.test(q)||/(?:打順|オーダー|打線).{0,18}(?:どうする|どう組|組んで|組む|考えて|決めて|作って|審議)/.test(q)||/1番.{0,50}9番/.test(q);
}
function validOrder(value){
 const raw=Array.isArray(value?.candidatePlayers)?value.candidatePlayers:[];
 if(raw.length!==9)return null;
 const out=[];const seen=new Set();
 for(const n of raw){const k=norm(n),official=rosterMap.get(k);if(!official||seen.has(k))return null;seen.add(k);out.push(official)}
 return out.length===9?out:null;
}
function canFinalize(second){
 if(!second)return false;
 for(const p of PERSONAS){if(second?.[p]?.dataConflict===true)return false;if(!validOrder(second?.[p]))return false}
 return true;
}
function compact(values,limit=6){const out=[];for(const v of values||[]){const s=String(v||'').trim();if(!s||out.includes(s))continue;out.push(s);if(out.length>=limit)break}return out}
function buildConsensus(second,cross){
 const entries=PERSONAS.map(p=>[p,second[p]]);
 const personaLineups={};const table=new Map();
 for(const [p,v] of entries){const order=validOrder(v);if(!order)return null;personaLineups[p]=order;order.forEach((name,index)=>{const k=norm(name),row=table.get(k)||{name,support:0,rankTotal:0,ranks:[],firstPlaceCount:0};row.support++;row.rankTotal+=index+1;row.ranks.push(index+1);if(index===0)row.firstPlaceCount++;table.set(k,row)})}
 const playerSupport=[...table.values()].map(r=>({...r,averageRank:Number((r.rankTotal/r.support).toFixed(2))})).sort((a,b)=>b.support-a.support||a.averageRank-b.averageRank||b.firstPlaceCount-a.firstPlaceCount||a.name.localeCompare(b.name,'ja'));
 const scored=entries.map(([p])=>{const order=personaLineups[p];let agreementScore=0,totalDeviation=0;order.forEach((name,index)=>{const r=table.get(norm(name)),slot=index+1,dev=Math.abs(slot-(r?.averageRank||slot));agreementScore+=(r?.support||0)*100-dev*10;totalDeviation+=dev});return{persona:p,order,agreementScore:Number(agreementScore.toFixed(2)),totalDeviation:Number(totalDeviation.toFixed(2))}}).sort((a,b)=>b.agreementScore-a.agreementScore||a.totalDeviation-b.totalDeviation||a.persona.localeCompare(b.persona,'ja'));
 const selected=scored[0];
 const lineup=selected.order.map((name,index)=>{const r=table.get(norm(name));return{slot:index+1,name,support:r?.support||0,averageRank:r?Number((r.rankTotal/r.support).toFixed(2)):null,ranks:r?.ranks||[]}});
 const slotConflicts=[];for(let i=0;i<9;i++){const choices=entries.map(([p])=>({persona:p,name:personaLineups[p][i]}));if(new Set(choices.map(x=>x.name)).size>1)slotConflicts.push({slot:i+1,choices})}
 const confidences=entries.map(([,v])=>String(v?.confidence||'LOW').toUpperCase()).sort((a,b)=>(confidenceRank[a]??0)-(confidenceRank[b]??0));
 const warnings=compact([...(cross?.warnings||[]),...entries.flatMap(([,v])=>Array.isArray(v?.warnings)?v.warnings:[])]);
 const gaps=compact(cross?.informationGaps||[]);
 return {
   mode:'FULL_LINEUP',status:'LINEUP_RESULT',
   recommendation:lineup.map(x=>`${x.slot}番 ${x.name}`).join(' / '),
   lineup,personaLineups,slotConflicts,playerSupport,selectedFromPersona:selected.persona,
   confidence:confidences[0]||'LOW',
   majorReasons:compact(entries.map(([,v])=>v?.primaryReason)),
   warnings,reDeliberationConditions:compact([...gaps,...warnings],5),reviewReason:'',
   crossDiscussion:{agreement:Array.isArray(cross?.agreement)?cross.agreement:[],disagreement:Array.isArray(cross?.disagreement)?cross.disagreement:[],domainConflicts:Array.isArray(cross?.domainConflicts)?cross.domainConflicts:[],challenges:cross?.challenges||{melchior:[],balthasar:[],casper:[]},informationGaps:gaps}
 };
}
function shouldReplace(input,final,second){
 if(!isFullLineupInput(input)||!canFinalize(second))return false;
 const status=String(final?.status||'');
 return !final||status==='LINEUP_REVIEW_REQUIRED'||status==='MAGI_REVIEW_REQUIRED'||status==='INSUFFICIENT_EVIDENCE'||!Array.isArray(final?.lineup)||final.lineup.length!==9;
}
function install(){
 const base=window.MAGI_ENGINE_V1;
 if(!base||typeof base.deliberate!=='function')return false;
 if(String(base.version||'').includes('lineup-finalizer-v350'))return true;
 const original=base.deliberate.bind(base);
 const wrapped=async function(input,options={}){
   let capturedSecond=null,capturedCross=null,correctedFinal=null;
   const o={...options};
   const onCross=options.onCrossComplete,onSecond=options.onSecondComplete,onFinal=options.onFinalComplete;
   o.onCrossComplete=c=>{capturedCross=clone(c);if(typeof onCross==='function')onCross(c)};
   o.onSecondComplete=s=>{capturedSecond=clone(s);if(typeof onSecond==='function')onSecond(s)};
   o.onFinalComplete=f=>{correctedFinal=shouldReplace(input,f,capturedSecond)?buildConsensus(capturedSecond,capturedCross):f;if(typeof onFinal==='function')onFinal(correctedFinal)};
   const result=await original(input,o);
   const second=capturedSecond||result?.second,cross=capturedCross||result?.crossExamination;
   const final=correctedFinal||(shouldReplace(input,result?.final,second)?buildConsensus(second,cross):result?.final);
   return Object.freeze({...result,engineVersion:`${String(result?.engineVersion||base.version||'MAGI')}+lineup-finalizer-v350`,final});
 };
 window.MAGI_ENGINE_V1=Object.freeze({version:`${String(base.version||'MAGI')}+lineup-finalizer-v350`,personas:Array.isArray(base.personas)?base.personas.slice():PERSONAS.slice(),deliberate:wrapped});
 return true;
}
let n=0;const t=setInterval(()=>{n++;if(install()||n>400)clearInterval(t)},50);install();
})();
