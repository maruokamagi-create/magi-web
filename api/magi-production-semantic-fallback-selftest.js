import { deterministicSemanticFallback } from '../server/api/magi/_semantic-authority.js';

const VERSION='magi-production-semantic-fallback-selftest-v2';
const cases=[
{id:1,q:'嶋田 栄志の通算打撃成績を教えて',expect:{mode:'SUMMARY',player:'嶋田 栄志',domain:'BATTING',timeScope:'CAREER',selectionKind:'NONE'}},
{id:2,q:'大野 竜暉のOPSを教えて',expect:{mode:'SINGLE_VALUE',player:'大野 竜暉',domain:'BATTING',metric:'OPS',selectionKind:'NONE'}},
{id:3,q:'橋向 結都の防御率を教えて',expect:{mode:'SINGLE_VALUE',player:'橋向 結都',domain:'PITCHING',metric:'ERA',selectionKind:'NONE'}},
{id:4,q:'武澤 大翔の守備成績を教えて',expect:{mode:'SUMMARY',player:'武澤 大翔',domain:'FIELDING',selectionKind:'NONE'}},
{id:5,q:'現時点のベストオーダーを審議して',expect:{mode:'DELIBERATION',domain:'LINEUP',selectionKind:'FULL_LINEUP'}},
{id:6,q:'7回制の投手運用を考えて',expect:{mode:'DELIBERATION',domain:'PITCHING',selectionKind:'PITCHING_PLAN'}},
{id:7,q:'成績を教えて',expect:null},
{id:8,q:'3番を誰にするか迷ってる。4番の大久保 陽翔につなぐことを考えると、誰がいいと思う？',expect:{mode:'DELIBERATION',player:'大久保 陽翔',domain:'LINEUP',selectionKind:'GENERIC_SELECTION'}}
];
function judge(result,expect){
 if(expect===null)return result===null;
 if(!result||result.semanticAuthority!=='DETERMINISTIC_FALLBACK'||result.confidence!=='HIGH')return false;
 if(expect.mode&&result.mode!==expect.mode)return false;
 if(expect.player&&!(result.players||[]).includes(expect.player))return false;
 if(expect.domain&&!(result.domains||[]).includes(expect.domain))return false;
 if(expect.timeScope&&result.timeScope!==expect.timeScope)return false;
 if(expect.metric&&result.metric!==expect.metric)return false;
 if(expect.selectionKind&&result.selectionKind!==expect.selectionKind)return false;
 return true;
}
export default async function handler(req,res){
 try{
  const results=cases.map(tc=>{const result=deterministicSemanticFallback(tc.q,new Error('forced semantic provider outage'));return{id:tc.id,question:tc.q,pass:judge(result,tc.expect),result};});
  const passed=results.filter(x=>x.pass).length;
  res.statusCode=passed===results.length?200:500;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({ok:passed===results.length,version:VERSION,total:results.length,passed,results}));
 }catch(error){
  res.statusCode=500;res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({ok:false,version:VERSION,error:String(error?.message||error)}));
 }
}
