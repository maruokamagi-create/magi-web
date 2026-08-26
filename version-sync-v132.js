(()=>{
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
  const schedule=()=>{clearTimeout(t);t=setTimeout(apply,50)};
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.addEventListener('load',apply,{once:false});
  setTimeout(apply,300);
  setTimeout(apply,1200);
})();
