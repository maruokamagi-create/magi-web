(()=>{
  window.MAGI_ACTIVE_VERSION='0.9.7';
  const mark=()=>{
    for(const el of document.querySelectorAll('.sectionHead span,.status')){
      el.textContent=el.textContent.replace(/v0\.9\.[0-9]+/g,'v0.9.7');
    }
  };
  const oldRun=runMagi;
  runMagi=function(){oldRun();setTimeout(mark,0)};
  const oldClear=clearAll;
  clearAll=function(){oldClear();mark()};
  mark();
})();