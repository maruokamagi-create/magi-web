(()=>{
'use strict';
if(window.MAGI_TEAM_DATA_AUTOLOAD_V306)return;
window.MAGI_TEAM_DATA_AUTOLOAD_V306=true;

const ROOT_NAME='20_TEAM_DATA_チームデータ';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function setProgress(done,total,label,detail,mode='active'){
  const pct=total?Math.max(0,Math.min(100,Math.round(done/total*100))):0;
  const box=document.getElementById('driveProgress');
  const labelEl=document.getElementById('driveProgressLabel');
  const pctEl=document.getElementById('driveProgressPercent');
  const track=document.getElementById('driveProgressTrack');
  const bar=document.getElementById('driveProgressBar');
  const note=document.getElementById('driveProgressNote');
  if(box){box.classList.remove('hidden','active','complete','error','idle');box.classList.add(mode)}
  if(labelEl)labelEl.textContent=label;
  if(pctEl)pctEl.textContent=pct+'%';
  if(track)track.setAttribute('aria-valuenow',String(pct));
  if(bar)bar.style.width=pct+'%';
  if(note)note.textContent=detail||'';
}

async function waitReady(){
  for(let i=0;i<300;i++){
    let ready=false;
    try{ready=typeof window.scanDrive==='function'&&typeof window.importDriveFile==='function'&&typeof isImportable==='function'&&typeof setDriveState==='function'&&typeof renderDriveFiles==='function'}catch(_){}
    if(ready)return true;
    await sleep(100);
  }
  return false;
}

async function run(){
  if(window.MAGI_TEAM_DATA_AUTOLOAD_RUNNING||window.MAGI_TEAM_DATA_AUTOLOAD_DONE)return;
  if(!await waitReady())return;
  window.MAGI_TEAM_DATA_AUTOLOAD_RUNNING=true;
  try{
    setProgress(0,1,ROOT_NAME+' を読み込んでいます','フォルダ構成を確認しています。操作は不要です。');
    try{setDriveState('Google Drive：20_TEAM_DATA_チームデータ のフォルダ構成を確認しています…','ready')}catch(_){}
    await window.scanDrive();

    let files=[];
    try{files=Array.isArray(driveIndex)?driveIndex:[]}catch(_){}
    const targets=files.filter(f=>{
      try{return f&&isImportable(f)&&f.mimeType!=='application/vnd.google-apps.folder'}catch(_){return false}
    });
    const total=targets.length;
    let done=0,failed=0;
    const failedNames=[];

    if(!total){
      setProgress(1,1,ROOT_NAME+' の読み込み完了','読み込み対象のデータファイルはありません。','complete');
      try{setDriveState(`Google Drive自動確認完了：${ROOT_NAME} の目次${files.length}件を確認。読み込み対象のデータファイルはありません。`,'ready')}catch(_){}
      window.MAGI_TEAM_DATA_AUTOLOAD_DONE=true;
      return;
    }

    for(const f of targets){
      setProgress(done,total,ROOT_NAME+' を読み込んでいます',`${done} / ${total} ファイル　次: ${f.name}`);
      try{setDriveState(`Google Drive：${files.length}件を一覧化。対応ファイルを自動索引化中 ${done+1}/${total}：${f.name}`,'ready')}catch(_){}
      try{
        await window.importDriveFile(f.id,true);
      }catch(error){
        failed++;
        failedNames.push(f.name);
        console.warn('[MAGI team autoload] skipped',f.name,error?.message||error);
      }
      done++;
      setProgress(done,total,ROOT_NAME+' を読み込んでいます',`${done} / ${total} ファイル${failed?`（${failed}件失敗）`:''}`);
      if(done%4===0||done===total){try{renderDriveFiles()}catch(_){}}
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    }

    try{if(typeof window.MAGI_DEDUPE_DRIVE_RECORDS==='function')window.MAGI_DEDUPE_DRIVE_RECORDS()}catch(_){}
    try{renderDriveFiles()}catch(_){}
    let rows=0;
    try{rows=Array.isArray(dataRecords)?dataRecords.filter(r=>r&&r.source==='drive').length:0}catch(_){}
    const summary=`${ROOT_NAME}：${total-failed}/${total}ファイル・${rows}行を索引化${failed?`（失敗${failed}件）`:''}。PDF・画像は一覧のみです。`;
    setProgress(total,total,ROOT_NAME+' の読み込み完了',summary,failed?'complete':'complete');
    try{setDriveState(`Google Drive自動確認完了：${summary}`,'ready')}catch(_){}
    window.MAGI_TEAM_DATA_AUTOLOAD_DONE=true;
    window.MAGI_TEAM_DATA_AUTOLOAD_RESULT={total,loaded:total-failed,failed,failedNames,rows};
  }catch(error){
    console.error('[MAGI team autoload]',error);
    setProgress(0,1,ROOT_NAME+' を読み込めませんでした',error?.message||String(error),'error');
    try{setDriveState(`Google Drive読込失敗：${error?.message||error}`,'error')}catch(_){}
  }finally{
    window.MAGI_TEAM_DATA_AUTOLOAD_RUNNING=false;
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});
else setTimeout(run,0);
})();
