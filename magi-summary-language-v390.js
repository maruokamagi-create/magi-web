(()=>{
'use strict';
const base=window.MAGI_CONTROL_SUMMARY_V377;if(!base||window.MAGI_SUMMARY_LANGUAGE_V390)return;
window.MAGI_SUMMARY_LANGUAGE_V390=true;
const jp=s=>String(s??'').replace(/MELCHIOR(?:-1)?/g,'メルキオール').replace(/BALTHASAR(?:-2)?/g,'バルタザール').replace(/CASPER(?:-3)?/g,'カスパー');
const uniq=arr=>[...new Set((arr||[]).map(x=>jp(x).trim()).filter(Boolean))];
function conditions(items){
  const rows=uniq(items);const sample=rows.filter(x=>/(?:母数|打数|打席数|サンプル)/.test(x));
  const others=rows.filter(x=>!/(?:母数|打数|打席数|サンプル)/.test(x));
  const out=[];
  if(sample.length)out.push('15打数未満の選手は、今後の打席数が増えた時点で成績の変化をもう一度確認する。');
  out.push(...others);
  return out.slice(0,3);
}
function build(result){
  const model=base.build?.(result);if(!model)return model;
  const deadlock=model.decisionType==='DEADLOCK';
  const label=model.decisionType==='CONSENSUS'?'3人の意見が一致しました':model.decisionType==='MAJORITY'?'2人の意見が一致しました':'3人の意見が分かれました';
  let disagreement=jp(model.mainDisagreement||'');
  disagreement=disagreement.replace(/基準案：/g,deadlock?'表示中の参考案：':'多数案：');
  return Object.freeze({
    ...model,
    label,
    supportingPersonas:(model.supportingPersonas||[]).map(jp),
    minorityPersona:jp(model.minorityPersona||''),
    decisionLead:jp(model.decisionLead||''),
    decisiveReasons:(model.decisiveReasons||[]).map(jp),
    mainDisagreement:disagreement,
    minorityOpinion:jp(model.minorityOpinion||''),
    majorChanges:(model.majorChanges||[]).map(jp),
    reDeliberationConditions:conditions(model.reDeliberationConditions||[])
  });
}
window.MAGI_CONTROL_SUMMARY_V377=Object.freeze({...base,build,version:'control-summary-v377-parent-language-v390'});
})();
