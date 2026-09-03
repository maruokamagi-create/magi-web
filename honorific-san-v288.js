(()=>{
  'use strict';

  const SUFFIX='さん';
  const EXCLUDE=new Set(['LINE認証済み','名前未取得']);

  const addSan=(value)=>{
    const text=String(value||'').trim();
    if(!text||EXCLUDE.has(text)||text.endsWith(SUFFIX)) return text;
    return `${text}${SUFFIX}`;
  };

  const updateTextNode=(el)=>{
    if(!el) return;
    const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());
    if(!node) return;
    const before=String(node.nodeValue||'');
    const trimmed=before.trim();
    const after=addSan(trimmed);
    if(after!==trimmed) node.nodeValue=before.replace(trimmed,after);
  };

  const apply=()=>{
    document.querySelectorAll('.magiAuthBarIdentity b').forEach(el=>{
      const next=addSan(el.textContent);
      if(next&&el.textContent!==next) el.textContent=next;
    });
    document.querySelectorAll('.magiMemberName').forEach(updateTextNode);
    document.querySelectorAll('.magiAuthNotice strong').forEach(el=>{
      const next=addSan(el.textContent);
      if(next&&el.textContent!==next) el.textContent=next;
    });
  };

  const observer=new MutationObserver(apply);
  const start=()=>{
    apply();
    observer.observe(document.documentElement,{childList:true,subtree:true});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
