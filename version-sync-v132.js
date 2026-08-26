(()=>{
  'use strict';
  const apply=()=>{
    const v=String(window.MAGI_VERSION||'').trim();
    if(!v)return;
    window.MAGI_ACTIVE_VERSION=v;
    document.title='MAGI Web v'+v;
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n;
    while((n=w.nextNode())){
      if(!n.nodeValue)continue;
      n.nodeValue=n.nodeValue.replace(/v0\.(?:9|10)\.\d+/g,'v'+v);
    }
  };

  apply();
  let t=0;
  const schedule=()=>{clearTimeout(t);t=setTimeout(apply,40)};
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  // The legacy loader finishes asynchronously. Keep synchronization active only
  // during startup, then disconnect so normal page use has no observer overhead.
  setTimeout(apply,250);
  setTimeout(apply,800);
  setTimeout(()=>{apply();observer.disconnect();},3000);
})();
