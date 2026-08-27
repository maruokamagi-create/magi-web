(()=>{
  'use strict';
  const oldSearch=window.searchDataEvidence;
  function pack(rows){
    const top=rows.slice(0,24);
    if(!top.length)return null;
    const files=[...new Set(top.map(r=>r.fileName))];
    return{
      count:top.length,
      files,
      summary:`${files.length}ファイルから関連行${top.length}件を抽出（${files.join('、')}）。`,
      text:top.map(r=>`[${r.fileName}${r.sheetName?' / '+r.sheetName:''}] ${r.display}`).join('\n')
    };
  }
  function scoreFallback(q,r){
    const s=(r.searchable||'').toLowerCase();
    const f=(r.fileName||'').toLowerCase();
    let score=0;
    const current=/新チーム|現状|今|現在|2026[-./]?2027/i.test(q);
    if(current){
      if(/2026[-_. ]?2027|2026年|2026\.0?8|202608|新チーム/.test(s))score+=16;
      if(/team.?report|練習記録|practice|希望ポジション|ポジション|成績|一覧|選手|チーム/.test(s))score+=8;
      if(/2025[-_. ]?2026|旧チーム/.test(s))score-=12;
    }
    if(/課題|問題|懸念|現状|重要/.test(q)&&/課題|懸念|評価|成績|練習|記録|役割|主将|キャプテン|チーム/.test(s))score+=6;
    if(/google\s*drive|drive|資料|参照/.test(q.toLowerCase()))score+=r.source==='drive'?5:0;
    if(/\.txt$|\.csv$|\.xlsx?$|\.xlsm$|\.json$/i.test(f))score+=2;
    return score;
  }
  window.searchDataEvidence=function(q){
    let direct=null;
    try{if(typeof oldSearch==='function')direct=oldSearch(q)}catch(e){console.warn('[MAGI Drive evidence] direct search failed',e)}
    if(direct)return direct;
    if(!Array.isArray(window.dataRecords)&&typeof dataRecords==='undefined')return null;
    const records=(typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[];
    const driveRows=records.filter(r=>r&&r.source==='drive');
    if(!driveRows.length)return null;
    if(!/google\s*drive|drive|資料|参照|新チーム|現状|課題|チーム/i.test(String(q||'')))return null;
    const ranked=driveRows.map(r=>({r,score:scoreFallback(String(q||''),r)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.r);
    const evidence=pack(ranked.length?ranked:driveRows);
    if(evidence)console.info('[MAGI Drive evidence] fallback evidence selected',evidence.count,evidence.files);
    return evidence;
  };
  window.MAGI_DRIVE_EVIDENCE_V194=true;
})();
