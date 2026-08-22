(async()=>{
  try{
    const r=await fetch('/index.html?v=097',{cache:'no-store'});
    if(!r.ok) throw new Error('index.html '+r.status);
    let h=await r.text();
    h=h.replace('<script src="https://accounts.google.com/gsi/client" async defer></script>','');
    h=h.replace('<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" defer></script>','');
    h=h.replace('</body>','<script src="/analysis-v093.js?v=097"></script><script src="/version-v097.js?v=097"></script></body>');
    document.open();
    document.write(h);
    document.close();
  }catch(e){
    document.body.innerHTML='<div style="padding:28px">MAGI v0.9.7の読み込みに失敗しました。再読み込みしてください。<br><small>'+String(e&&e.message||e)+'</small></div>';
  }
})();