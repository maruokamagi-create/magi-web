(()=>{
  const genericOk=typeof searchDataEvidence==='function'&&/buildGenericAnalysis|genericAnalysis/.test(String(searchDataEvidence));
  const analysisOk=typeof runMagi==='function'&&/DATA HUB|pendingAutoRun|_runMagiV98/.test(String(runMagi));
  const box=document.createElement('div');
  box.id='engineStateV099';
  box.style.cssText='margin:10px 0;padding:10px 12px;border:1px solid #315574;border-radius:10px;background:#071827;color:#d7e9fa;font-size:12px;line-height:1.6';
  box.textContent=`成績解析エンジン：${genericOk?'ON':'OFF'} ／ Drive自動審議：${analysisOk?'ON':'OFF'} ／ v0.9.9`;
  const judge=document.getElementById('judge');
  if(judge)judge.insertBefore(box,judge.children[1]||null); else document.body.prepend(box);
  if(!genericOk||!analysisOk){
    const old=runMagi;
    runMagi=function(){
      const s=document.getElementById('status');
      if(s)s.textContent='成績解析エンジンの読み込みに失敗しました。v0.9.9ページを再読み込みしてください。';
      else old();
    };
  }
})();