(()=>{
  'use strict';
  const oldSearch=window.searchDataEvidence;
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase();

  function pack(rows){
    const top=rows.slice(0,24);
    if(!top.length)return null;
    const files=[...new Set(top.map(r=>r.fileName).filter(Boolean))];
    return{
      count:top.length,
      files,
      summary:`審議に使用する関連記録${top.length}件を${files.length}ファイルから抽出（${files.join('、')}）。`,
      text:top.map(r=>`[${r.fileName}${r.sheetName?' / '+r.sheetName:''}] ${r.display}`).join('\n')
    };
  }

  function topicOf(q){
    const s=norm(q);
    if(/クリーンナップ|中軸|主軸|打線|打順|何番|[1-9１-９]番|打者|打撃|打率|安打|出塁|長打|ops|打点|三振|四球/.test(s))return'batting';
    if(/投手|ピッチャー|先発|継投|抑え|防御率|奪三振|投球/.test(s))return'pitching';
    if(/守備位置|希望ポジション|ポジション希望|守備|失策|エラー|守備率/.test(s))return'fielding';
    return'general';
  }

  function isPositionOnlyEvidence(evidence){
    const fs=(evidence?.files||[]).join(' ');
    return !!fs && /希望ポジション|ポジション一覧|position/i.test(fs) && !/打撃|打者|通算成績|成績一覧|打率|ops|安打/i.test(fs);
  }

  function scoreRow(q,r,topic){
    const s=norm(`${r.searchable||''} ${(r.columns||[]).join(' ')}`);
    const f=norm(r.fileName||'');
    let score=0;
    const current=/新チーム|現状|今|現在|2026\s*[-–—/]?\s*2027/i.test(q);

    if(current){
      if(/2026[-_. ]?2027|2026年|新チーム/.test(s+' '+f))score+=30;
      if(/2025[-_. ]?2026|旧チーム/.test(s+' '+f))score-=30;
    }

    if(topic==='batting'){
      if(/打撃|打者|打席|打数|安打|打率|出塁率|長打率|ops|打点|本塁打|二塁打|三塁打|三振|四球/.test(s))score+=42;
      if(/通算成績|成績一覧|個人成績|試合記録|スコア/.test(f+' '+s))score+=24;
      if(/希望ポジション|ポジション希望|守備位置/.test(f+' '+s))score-=70;
      if(/投手詳細|投手成績/.test(f)&&!/打撃|打数|安打|打率/.test(s))score-=25;
    }else if(topic==='pitching'){
      if(/投手|投球回|防御率|奪三振|被安打|与四球|自責点|球数/.test(s))score+=42;
      if(/投手詳細|投手成績|通算成績|試合記録/.test(f+' '+s))score+=24;
      if(/希望ポジション/.test(f+' '+s))score-=50;
    }else if(topic==='fielding'){
      if(/守備|守備率|失策|エラー|刺殺|補殺|ポジション/.test(s))score+=32;
      if(/希望ポジション/.test(f+' '+s)&&/希望ポジション|ポジション希望/.test(q))score+=28;
    }else{
      if(/成績|一覧|選手|チーム|練習|記録|評価/.test(s))score+=10;
    }

    if(/google\s*drive|drive|資料|参照/i.test(q))score+=r.source==='drive'?5:0;
    if(/\.txt$|\.csv$|\.xlsx?$|\.xlsm$|\.json$/i.test(f))score+=2;
    return score;
  }

  window.searchDataEvidence=function(q){
    const question=String(q||'');
    const topic=topicOf(question);
    let direct=null;
    try{if(typeof oldSearch==='function')direct=oldSearch(question)}catch(e){console.warn('[MAGI Drive evidence] direct search failed',e)}

    if(!Array.isArray(window.dataRecords)&&typeof dataRecords==='undefined')return direct;
    const records=(typeof dataRecords!=='undefined'?dataRecords:window.dataRecords)||[];
    const driveRows=records.filter(r=>r&&r.source==='drive');
    if(!driveRows.length)return direct;

    const shouldSearch=/google\s*drive|drive|資料|参照|新チーム|現状|課題|チーム|クリーンナップ|中軸|主軸|打線|打順|打撃|打率|投手|守備/i.test(question);
    if(!shouldSearch)return direct;

    const ranked=driveRows.map(r=>({r,score:scoreRow(question,r,topic)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    const bestScore=ranked[0]?.score||0;
    const focused=ranked.filter(x=>x.score>=Math.max(1,bestScore-28)).map(x=>x.r);
    const fallback=pack(focused.length?focused:ranked.map(x=>x.r));

    if(topic==='batting'&&fallback){
      const battingFiles=fallback.files.join(' ');
      const looksBatting=/打撃|打者|通算成績|成績一覧|個人成績|試合記録|打率|ops|安打/i.test(battingFiles+' '+fallback.text);
      if(looksBatting){
        console.info('[MAGI Drive evidence] batting-focused evidence selected',fallback.count,fallback.files);
        return fallback;
      }
      if(direct&&isPositionOnlyEvidence(direct))console.warn('[MAGI Drive evidence] rejected position-only evidence for batting question',direct.files);
    }

    if(direct&&!isPositionOnlyEvidence(direct))return direct;
    if(fallback){console.info('[MAGI Drive evidence] focused fallback evidence selected',fallback.count,fallback.files);return fallback}
    return direct;
  };
  window.MAGI_DRIVE_EVIDENCE_V194=true;
})();
