(()=>{
'use strict';
const CURRENT=/現在|現チーム|今季|新チーム|現時点|直近/;
const HIST=/旧チーム|2025-2026|昨季|過去/;
const nums='0-9０-９';

function facts(){return window.MAGI_NUMERIC_FACTS||{};}
function playerNamesIn(s){const f=facts();return Object.keys(f).filter(n=>String(s||'').includes(n));}
function fixSegment(seg){
  let s=String(seg||'');
  const names=playerNamesIn(s);
  if(names.length!==1)return s;
  const name=names[0],m=facts()[name];
  if(!m||!m.avg)return s;
  const current=CURRENT.test(s);
  const historical=HIST.test(s)&&!current;
  if(historical)return s;
  if(current){
    s=s.replace(new RegExp(`[${nums}]割台`,'g'),`打率${m.avg}`);
    s=s.replace(/打率\s*0?\.\d{3}/g,`打率${m.avg}`);
    s=s.replace(/打率\s*\.\d{3}/g,`打率${m.avg}`);
    if(Number.isFinite(Number(m.ab))&&Number.isFinite(Number(m.so))){
      const exact=`${m.ab}打数${m.so}三振`;
      s=s.replace(/三振の多さ/g,exact).replace(/三振が多い/g,exact).replace(/三振も多い/g,exact);
    }
  }
  return s;
}
function fixText(text){
  return String(text??'').split(/([。！？\n])/).map((x,i)=>i%2?x:fixSegment(x)).join('');
}
function apply(root){
  if(!root||!Object.keys(facts()).length)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){const before=node.nodeValue||'',after=fixText(before);if(after!==before)node.nodeValue=after;}
}
let busy=false,timer=0;
function run(){if(busy)return;busy=true;try{apply(document.getElementById('response'));apply(document.getElementById('magiChatView'));}finally{busy=false}}
function schedule(){clearTimeout(timer);timer=setTimeout(run,80)}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
const status=document.getElementById('status');if(status)new MutationObserver(schedule).observe(status,{subtree:true,childList:true,characterData:true});
schedule();
window.MAGI_NUMERIC_EVIDENCE_GUARD='v220';
})();