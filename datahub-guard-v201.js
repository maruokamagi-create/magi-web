(()=>{
  'use strict';
  let wrapped=false;
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase();
  const battingQ=q=>/クリーンナップ|中軸|主軸|打線|打順|何番|[1-9１-９]番|打者|打撃|打率|安打|出塁|長打|ops|打点|三振|四球/.test(norm(q));
  const positionOnly=e=>{const f=(e?.files||[]).join(' ');return /希望ポジション|ポジション一覧|position/i.test(f)&&!/打撃|通算成績|成績一覧|個人成績|試合記録|打率|ops|安打/i.test(f)};
  const score=r=>{
    const s=norm(`${r?.fileName||''} ${(r?.columns||[]).join(' ')} ${r?.searchable||''}`);
    let n=0;
    if(/2026[-_. ]?2027|新チーム/.test(s))n+=30;
    if(/2025[-_. ]?2026|旧チーム/.test(s))n-=30;
    if(/打撃|打者|打席|打数|安打|打率|出塁率|長打率|ops|打点|本塁打|二塁打|三塁打|三振|四球/.test(s))n+=45;
    if(/通算成績|成績一覧|個人成績|試合記録|スコア/.test(s))n+=25;
    if(/希望ポジション|ポジション希望/.test(s))n-=70;
    return n;
  };
  const pack=rows=>{
    const top=rows.slice(0,24);if(!top.length)return null;
    const files=[...new Set(top.map(r=>r.fileName).filter(Boolean))];
    return{count:top.length,files,summary:`審議に使用する関連記録${top.length}件を${files.length}ファイルから抽出。`,text:top.map(r=>`[${r.fileName}${r.sheetName?' / '+r.sheetName:''}] ${r.display}`).join('\n')};
  };
  function install(){
    if(wrapped||typeof window.searchDataEvidence!=='function')return false;
    const base=window.searchDataEvidence;
    window.searchDataEvidence=function(q){
      const direct=base(q);
      if(!battingQ(q)||!positionOnly(direct))return direct;
      let records=[];try{records=(typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[]}catch(e){records=window.dataRecords||[]}
      const ranked=records.filter(r=>r&&r.source==='drive').map(r=>({r,s:score(r)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
      const best=ranked[0]?.s||0,chosen=ranked.filter(x=>x.s>=best-25).map(x=>x.r);
      const better=pack(chosen);
      if(better){console.info('[MAGI DATA HUB guard] replaced position-only evidence',direct?.files,'=>',better.files);return better}
      return direct;
    };
    wrapped=true;window.MAGI_DATAHUB_GUARD_V201=true;return true;
  }
  function tidy(){
    const verdict=document.getElementById('verdict'),reason=document.getElementById('reason'),meta=document.getElementById('caseMeta');
    if(verdict&&reason&&/判断材料不足/.test(verdict.textContent||'')&&/[私俺僕]/.test(reason.textContent||''))reason.textContent='現時点では判断材料不足。必要情報を追加して再審議する。';
    if(meta&&/DATA HUB：\d+件参照/.test(meta.innerHTML))meta.innerHTML=meta.innerHTML.replace(/DATA HUB：(\d+)件参照<br>参照ファイル：/,'DATA HUB：関連記録 $1件<br>使用資料：');
  }
  let n=0;const t=setInterval(()=>{n++;install();tidy();if(n>160)clearInterval(t)},250);
  new MutationObserver(()=>tidy()).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
