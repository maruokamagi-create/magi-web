(()=>{
'use strict';
if(window.MAGI_USER_LANGUAGE_V384)return;
window.MAGI_USER_LANGUAGE_V384=true;

const replacements=[
  [/正本Evidenceが揃わない、または画面と一致しない場合は結果を出しません。/g,'必要なデータが揃っていない、または画面表示と一致しない場合は結果を出しません。'],
  [/ベストオーダー用の正本14名データ/g,'ベストオーダーに必要な現チーム14名の正式データ'],
  [/現チーム14名の正本打撃数値/g,'現チーム14名の正式な打撃データ'],
  [/現チーム14名の正本Evidence/g,'現チーム14名の正式データ'],
  [/正本の打撃数値/g,'正式な打撃データ'],
  [/正本打撃数値/g,'正式な打撃データ'],
  [/正本成績/g,'正式な成績データ'],
  [/正本Evidence/g,'正式データ'],
  [/正本データ/g,'正式データ'],
  [/正本数値/g,'正式な数値データ'],
  [/CASE \/ EVIDENCE/g,'データ確認']
];

function rewrite(value){
  let out=String(value??'');
  for(const [pattern,label] of replacements)out=out.replace(pattern,label);
  return out;
}
function inMagiResult(node){
  const el=node?.parentElement;
  return Boolean(el?.closest?.('#magiResultBundle,#magiChatView,#magiLiveTranscript,.final,.answer'));
}
function rewriteTextNode(node){
  if(!node||node.nodeType!==Node.TEXT_NODE)return;
  const before=node.nodeValue||'';
  let after=rewrite(before);
  if(inMagiResult(node))after=after.replace(/カスペル/g,'カスパー');
  if(after!==before)node.nodeValue=after;
}
function rewriteTree(root){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){rewriteTextNode(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode()))rewriteTextNode(node);
}
function install(){
  rewriteTree(document.body);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')rewriteTextNode(record.target);
      for(const node of record.addedNodes||[])rewriteTree(node);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}
if(document.body)install();
else document.addEventListener('DOMContentLoaded',install,{once:true});
})();
