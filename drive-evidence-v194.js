(()=>{
  'use strict';
  const oldSearch=window.searchDataEvidence;
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase();

  function pack(rows,meta={}){
    const top=rows.slice(0,36);
    if(!top.length)return null;
    const files=[...new Set(top.map(r=>r.fileName).filter(Boolean))];
    const seasons=[...new Set(top.map(r=>seasonOf(r)).filter(Boolean))];
    return{
      count:top.length,
      files,
      seasons,
      evidenceLayers:meta.layers||[],
      summary:`審議に使用する関連記録${top.length}件を${files.length}ファイルから抽出${seasons.length?`（対象：${seasons.join('・')}）`:''}。${files.join('、')}`,
      text:top.map(r=>`[${seasonOf(r)||'年度不明'} / ${r.fileName}${r.sheetName?' / '+r.sheetName:''}] ${r.display}`).join('\n')
    };
  }

  function topicOf(q){
    const s=norm(q);
    if(/クリーンナップ|中軸|主軸|打線|打順|何番|[1-9１-９]番|打者|打撃|打率|安打|出塁|長打|ops|打点|三振|四球/.test(s))return'batting';
    if(/投手|ピッチャー|先発|継投|抑え|防御率|奪三振|投球/.test(s))return'pitching';
    if(/守備位置|希望ポジション|ポジション希望|守備|失策|エラー|守備率/.test(s))return'fielding';
    return'general';
  }

  function seasonOf(r){
    const s=norm(`${r?.fileName||''} ${r?.sheetName||''} ${r?.searchable||''}`);
    if(/2025\s*[-–—_. /]?\s*2026|旧チーム/.test(s))return'2025-2026';
    if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/.test(s))return'2026-2027';
    return'';
  }

  function isPositionOnlyEvidence(evidence){
    const fs=(evidence?.files||[]).join(' ');
    return !!fs && /希望ポジション|ポジション一覧|position/i.test(fs) && !/打撃|打者|通算成績|成績一覧|打率|ops|安打/i.test(fs);
  }

  function scoreRow(q,r,topic){
    const s=norm(`${r.searchable||''} ${(r.columns||[]).join(' ')}`);
    const f=norm(r.fileName||'');
    let score=0;
    const season=seasonOf(r);

    // Current data is important, but historical evidence must not be excluded.
    if(season==='2026-2027')score+=18;
    if(season==='2025-2026')score+=12;

    if(topic==='batting'){
      if(/打撃|打者|打席|打数|安打|打率|出塁率|長打率|ops|打点|本塁打|二塁打|三塁打|三振|四球/.test(s))score+=42;
      if(/通算成績|成績一覧|個人成績|試合記録|スコア/.test(f+' '+s))score+=24;
      if(/打撃詳細/.test(f))score+=22;
      if(/希望ポジション|ポジション希望|守備位置/.test(f+' '+s))score-=70;
      if(/投手詳細|投手成績/.test(f)&&!/打撃|打数|安打|打率/.test(s))score-=25;
    }else if(topic==='pitching'){
      if(/投手|投球回|防御率|奪三振|被安打|与四球|自責点|球数/.test(s))score+=42;
      if(/投手詳細|投手成績|通算成績|試合記録/.test(f+' '+s))score+=24;
      if(/希望ポジション/.test(f+' '+s))score-=50;
    }else if(topic==='fielding'){
      if(/守備|守備率|失策|エラー|刺殺|補殺|ポジション/.test(s))score+=32;
      if(/守備詳細|守備位置/.test(f))score+=20;
      if(/希望ポジション/.test(f+' '+s)&&/希望ポジション|ポジション希望/.test(q))score+=28;
    }else{
      if(/成績|一覧|選手|チーム|練習|記録|評価/.test(s))score+=10;
    }

    if(/google\s*drive|drive|資料|参照/i.test(q))score+=r.source==='drive'?5:0;
    if(/\.txt$|\.csv$|\.xlsx?$|\.xlsm$|\.json$/i.test(f))score+=2;
    return score;
  }

  function crossSeasonEvidence(question,driveRows,topic){
    const ranked=driveRows.map(r=>({r,score:scoreRow(question,r,topic)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!ranked.length)return null;

    // For decision questions, deliberately assemble evidence layers instead of taking only nearest lexical matches.
    const current=ranked.filter(x=>seasonOf(x.r)==='2026-2027');
    const history=ranked.filter(x=>seasonOf(x.r)==='2025-2026');
    const other=ranked.filter(x=>!seasonOf(x.r));
    const chosen=[];
    const add=(arr,n)=>arr.slice(0,n).forEach(x=>{if(!chosen.includes(x.r))chosen.push(x.r)});

    if(topic==='batting'){
      add(current,18); // CURRENT FORM
      add(history,14); // CAREER / PRIOR EXPERIENCE
      add(other,4);
      return pack(chosen,{layers:['CURRENT','HISTORY','SAMPLE/EXPERIENCE']});
    }
    if(topic==='pitching'){
      add(current,18); add(history,14); add(other,4);
      return pack(chosen,{layers:['CURRENT','HISTORY','ROLE/WORKLOAD']});
    }
    if(topic==='fielding'){
      add(current,18); add(history,12); add(other,6);
      return pack(chosen,{layers:['CURRENT','HISTORY','ROLE']});
    }
    const best=ranked[0]?.score||0;
    return pack(ranked.filter(x=>x.score>=Math.max(1,best-28)).map(x=>x.r),{layers:['CURRENT','HISTORY','CONTEXT']});
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

    const evidence=crossSeasonEvidence(question,driveRows,topic);
    if(topic==='batting'&&evidence){
      const corpus=evidence.files.join(' ')+' '+evidence.text;
      if(/打撃|打者|通算成績|成績一覧|個人成績|試合記録|打率|ops|安打/i.test(corpus)){
        console.info('[MAGI Drive evidence] cross-season batting evidence selected',evidence.count,evidence.files,evidence.seasons);
        return evidence;
      }
    }

    if(evidence&&!isPositionOnlyEvidence(evidence)){
      console.info('[MAGI Drive evidence] cross-season evidence selected',evidence.count,evidence.files,evidence.seasons);
      return evidence;
    }
    if(direct&&!isPositionOnlyEvidence(direct))return direct;
    return evidence||direct;
  };
  window.MAGI_DRIVE_EVIDENCE_V194=true;
  window.MAGI_EVIDENCE_ENGINE='cross-season-v1';
})();
