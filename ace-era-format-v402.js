(()=>{
'use strict';
if(window.MAGI_ACE_ERA_FORMAT_V402)return;
window.MAGI_ACE_ERA_FORMAT_V402=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','OPTION']);
const txt=v=>String(v??'');
function isAce(){return ACE_RE.test(txt(document.getElementById('q')?.value).normalize('NFKC'));}
function formatEraText(s){
  return txt(s).replace(/(防御率\s*[:：]?\s*)(\d+(?:\.\d+)?)/g,(m,prefix,num)=>{
    const n=Number(num);
    if(!Number.isFinite(n))return m;
    return prefix+n.toFixed(2);
  });
}
function patchNode(root=document.body){
  if(!root||!isAce())return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const p=node.parentElement;
    if(!p||SKIP.has(p.tagName))return NodeFilter.FILTER_REJECT;
    return node.nodeValue?.includes('防御率')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){const before=node.nodeValue||'',after=formatEraText(before);if(after!==before)node.nodeValue=after;}
}
let timer=0;
function schedule(root){clearTimeout(timer);timer=setTimeout(()=>patchNode(root&&root.nodeType===1?root:document.body),40);}
const obs=new MutationObserver(muts=>{if(!isAce())return;for(const m of muts){if(m.type==='characterData'){schedule(m.target.parentElement);return}if(m.addedNodes?.length){schedule(document.body);return}}});
function install(){if(!document.body)return false;obs.observe(document.body,{subtree:true,childList:true,characterData:true});patchNode(document.body);return true;}
if(!install())document.addEventListener('DOMContentLoaded',install,{once:true});
document.addEventListener('magi:deliberation-result',()=>setTimeout(()=>patchNode(document.body),60));
window.MAGI_ACE_ERA_FORMAT_META=Object.freeze({version:'v402',scope:'ace-display-only',decimalPlaces:2});
})();
