(()=>{
const mark=()=>{for(const el of document.querySelectorAll('.sectionHead span,.status')){if(/v0\.9\.4/.test(el.textContent))el.textContent=el.textContent.replace(/v0\.9\.4/g,'v0.9.5')}};
const _run=runMagi;
runMagi=function(){_run();setTimeout(mark,0)};
const _clear=clearAll;
clearAll=function(){_clear();mark()};
mark();
})();