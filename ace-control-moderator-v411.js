(()=>{
'use strict';
if(window.MAGI_ACE_CONTROL_MODERATOR_V411)return;
window.MAGI_ACE_CONTROL_MODERATOR_V411=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const CONTROL_IMG='/magi-official-symbol-v125.svg?v=195';
const txt=v=>String(v??'').trim();
const list=v=>Array.isArray(v)?v.filter(Boolean):[];
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const PERSONAS=[['melchior','メルキオール'],['balthasar','バルタザール'],['casper','カスパー']];
function isAce(result){return !!result&&ACE_RE.test(txt(result?.case?.question||document.getElementById('q')?.value).normalize('NFKC'));}
function firstChoice(group,key){return list(group?.[key]?.candidatePlayers).map(txt).find(Boolean)||'';}
function choices(result,stage='primary'){
 return PERSONAS.map(([key,label])=>({key,label,name:firstChoice(result?.[stage],key)})).filter(x=>x.name);
}
function uniqueNames(rows){const out=[];for(const r of rows){if(!out.some(x=>norm(x)===norm(r.name)))out.push(r.name)}return out;}
function openingText(result){
 const primary=choices(result,'primary');
 const names=uniqueNames(primary);
 const disagreement=list(result?.crossExamination?.disagreement).map(txt).filter(Boolean);
 if(disagreement.length){
   const topic=disagreement.slice(0,2).map(x=>x.length>70?x.slice(0,69)+'…':x).join('／');
   return `一次判断を確認。主な争点は「${topic}」です。3賢人は、現チームの二重照合済投手成績を主評価、前チーム成績を経験・再現性の参考として、この差を直接検証してください。`;
 }
 if(names.length===1&&names[0]){
   return `一次判断を確認。3賢人の第一候補は「${names[0]}」で一致しています。結論だけで終わらせず、現チームを主評価、前チームを参考評価として、投球回・防御率・奪三振・四死球・先発経験と再現性を相互検証してください。`;
 }
 if(primary.length){
   return `一次判断を確認。第一候補は ${primary.map(x=>`${x.label}：${x.name}`).join('／')} です。3賢人は、現チームを主評価、前チームを参考評価として、候補差の根拠を直接検証してください。`;
 }
 return '一次判断を確認。3賢人は、現チームの二重照合済投手成績を主評価、前チーム成績を参考評価として、エース第一候補の根拠を直接検証してください。';
}
function closingText(result){
 const primary=choices(result,'primary');
 const second=choices(result,'second');
 const changes=[];
 for(const p of primary){const s=second.find(x=>x.key===p.key);if(s?.name&&norm(s.name)!==norm(p.name))changes.push(`${p.label}：${p.name}→${s.name}`)}
 if(changes.length)return `相互検証をここで区切ります。判断変更は ${changes.join('／')} です。各賢人は、今の検証を踏まえた二次判断を確定してください。`;
 return '相互検証をここで区切ります。各賢人は、今のやり取りを踏まえて第一候補を維持するか変更するか、二次判断を確定してください。';
}
function row(text,label,kind){
 const el=document.createElement('div');
 el.className='magiMsg system magiMidControl magiAceMidControlV411';
 el.dataset.magiCanonicalControl='true';el.dataset.magiAceControl=kind;
 el.innerHTML=`<img class="magiAvatar" src="${CONTROL_IMG}" alt=""><div class="magiMsgCol"><div class="magiSender">MAGI CONTROL<span>${label}</span></div><div class="magiBubble"><span class="magiSpeechText"></span></div></div>`;
 el.querySelector('.magiSpeechText').textContent=text;
 return el;
}
function patch(result){
 if(!isAce(result))return false;
 const body=document.querySelector('#magiChatView .magiChatBody');if(!body)return false;
 body.querySelectorAll('.magiAceMidControlV411').forEach(n=>n.remove());
 const phases=[...body.querySelectorAll('.magiChatPhase')];
 const cross=phases.find(n=>/相互検証/.test(n.textContent||''));
 const second=phases.find(n=>/二次判定/.test(n.textContent||''));
 if(!cross||!second)return false;
 const open=row(openingText(result),'争点整理','opening');
 cross.insertAdjacentElement('afterend',open);
 const close=row(closingText(result),'相互検証まとめ','closing');
 body.insertBefore(close,second);
 return true;
}
function schedule(result){[100,300,700,1300,2200,3600,5200,7600].forEach(ms=>setTimeout(()=>patch(result),ms));}
document.addEventListener('magi:deliberation-result',e=>{if(isAce(e?.detail))schedule(e.detail)});
if(isAce(window.MAGI_LAST_DELIBERATION_RESULT))schedule(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_ACE_CONTROL_MODERATOR_V411_META=Object.freeze({version:'v411',role:'moderator-only',opening:'争点整理',closing:'相互検証まとめ',observer:false,wiseMenUntouched:true});
})();