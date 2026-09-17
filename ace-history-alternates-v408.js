(()=>{
'use strict';
if(window.MAGI_ACE_HISTORY_ALTERNATES_V408)return;
window.MAGI_ACE_HISTORY_ALTERNATES_V408=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const esc=s=>txt(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function isAce(result){
  return !!result&&ACE_RE.test(txt(result?.case?.question||document.getElementById('q')?.value).normalize('NFKC'));
}
function statsMap(result){return result?.case?.evidence?.canonicalPitchingTotals||{};}
function historyStats(result,name){
  const map=statsMap(result);
  const row=map?.[name]||Object.entries(map).find(([k])=>norm(k)===norm(name))?.[1];
  return row?.['2025-2026']||null;
}
function historyLine(s){
  if(!s)return '前チーム：登板なし';
  const bb=s.walksHbp!==undefined?s.walksHbp:Number(s.walks||0)+Number(s.hbp||0);
  const era=Number.isFinite(Number(s.era))?Number(s.era).toFixed(2):(s.era??'-');
  return `前チーム：登板${s.games??'-'}・投球回${s.innings??'-'}・防御率${era}・奪三振${s.strikeouts??'-'}・四死球${bb??'-'}`;
}
function fixBalthasarTypos(root=document){
  if(!root?.querySelectorAll)return;
  const nodes=root.querySelectorAll('#next,#magiFinalSummaryCard,.aceAlternatesV400,.aceDetailV400');
  for(const node of nodes){
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    const edits=[];
    while(walker.nextNode())if(/バルササル/.test(walker.currentNode.nodeValue||''))edits.push(walker.currentNode);
    edits.forEach(n=>{n.nodeValue=(n.nodeValue||'').replace(/バルササル/g,'バルタザール');});
  }
}
function patchAlternates(result){
  const box=document.querySelector('.aceAlternatesV400');
  if(!box)return false;
  const rows=[...box.querySelectorAll('.aceAltRow')];
  for(const row of rows){
    const nameText=txt(row.querySelector('.aceAltName')?.textContent);
    if(!nameText)continue;
    const name=txt(nameText.replace(/^.*?[：:]/,''));
    if(!name)continue;
    let hist=row.querySelector('.aceAltHistoryV408');
    if(!hist){hist=document.createElement('div');hist.className='aceAltHistoryV408';row.appendChild(hist);}
    hist.textContent=historyLine(historyStats(result,name));
  }
  return true;
}
function ensureStyle(){
  if(document.getElementById('ace-history-alternates-v408-style'))return;
  const s=document.createElement('style');
  s.id='ace-history-alternates-v408-style';
  s.textContent='.aceAlternatesV400 .aceAltStats{font-size:13px!important;line-height:1.6!important;color:#fff!important;font-weight:800!important}.aceAltHistoryV408{margin-top:3px;font-size:13px;line-height:1.6;color:#a9bfd2;font-weight:400}';
  document.head.appendChild(s);
}
function patch(result){
  if(!isAce(result))return;
  ensureStyle();
  patchAlternates(result);
  fixBalthasarTypos(document);
}
function schedule(result){[100,300,700,1300,2200,3600,5200,7200].forEach(ms=>setTimeout(()=>patch(result),ms));}
document.addEventListener('magi:deliberation-result',e=>{if(isAce(e?.detail))schedule(e.detail)});
if(isAce(window.MAGI_LAST_DELIBERATION_RESULT))schedule(window.MAGI_LAST_DELIBERATION_RESULT);
window.MAGI_ACE_HISTORY_ALTERNATES_V408_META=Object.freeze({version:'v408.1',balthasarSpellingFixed:true,alternateHistoryVisible:true,noHistoryLabel:'前チーム：登板なし',currentSeasonEmphasized:true});
})();