import assert from 'node:assert/strict';
import { CURRENT_ROSTER } from '../server/api/magi/_roster.js';
import { validatePersonaOutput } from '../server/api/magi/_persona-output-guard.js';

const players=CURRENT_ROSTER.map((name,i)=>({
  name,
  batting:{AVG:`.${String(240+i).padStart(3,'0')}`,OPS:`.${String(620+i*10).padStart(3,'0')}`,AB:String(20+i)}
}));
const BASE_CASE={
  question:'ベストオーダーを1番から9番まで組んで',
  evidence:{allCurrentTeamCheck:{status:'COMPLETE',players}}
};
const result=overrides=>({facts:[],analysis:[],prediction:[],primaryReason:'',publicStatement:'',warnings:[],reviewReason:'',changeReason:'',candidateBasis:'',...overrides});

{
  const issues=validatePersonaOutput(BASE_CASE,result({analysis:['長侶 穹を出塁率の高さから1番に置く。']}),{focused:false});
  assert.ok(issues.some(x=>x.includes('Evidenceにない出塁率')),'G40: missing OBP must block literal 出塁率');
  console.log('PASS G40 missing OBP blocks literal on-base percentage');
}
{
  const issues=validatePersonaOutput(BASE_CASE,result({warnings:['出塁率の記録はEvidenceに含まれていないため確認できません。']}),{focused:false});
  assert.equal(issues.some(x=>x.includes('Evidenceにない出塁率')),false,'G41: explicit evidence-gap statement must be allowed');
  console.log('PASS G41 missing OBP disclaimer is allowed');
}
{
  const issues=validatePersonaOutput(BASE_CASE,result({analysis:['OPSと長打率の高さを基準に中軸へ置く。']}),{focused:false});
  assert.ok(issues.some(x=>x.includes('Evidenceにない長打率')),'G42: missing SLG must block literal 長打率');
  console.log('PASS G42 missing SLG blocks literal slugging percentage');
}
{
  const withDerived={
    ...BASE_CASE,
    evidence:{allCurrentTeamCheck:{status:'COMPLETE',players:players.map((p,i)=>({
      ...p,
      batting:{...p.batting,OBP:`.${String(330+i).padStart(3,'0')}`,SLG:`.${String(410+i).padStart(3,'0')}`}
    }))}}
  };
  const issues=validatePersonaOutput(withDerived,result({analysis:['出塁率と長打率を比較して打順を検討する。']}),{focused:false});
  assert.equal(issues.some(x=>/Evidenceにない(?:出塁率|長打率)/.test(x)),false,'G43: supplied OBP/SLG labels must be allowed');
  console.log('PASS G43 supplied OBP and SLG labels are allowed');
}

console.log('DERIVED METRIC LABEL GUARD RESULT: 4/4 PASS');
