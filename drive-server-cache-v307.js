(()=>{
'use strict';
if(window.MAGI_SERVER_PERSISTENT_CACHE_V307)return;
window.MAGI_SERVER_PERSISTENT_CACHE_V307=true;

const SCOPE_NAME='MAGI重要資料';
const FOLDER_MIME='application/vnd.google-apps.folder';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cachedIds=new Set();
const failedIds=new Map();
let running=false,done=false,renderWrapped=false;

function normalizePath(v){return String(v||'').replace(/\\/g,'/')}
function serverReadable(f){
  if(!f||f.mimeType===FOLDER_MIME)return false;
  const name=String(f.name||''),mime=String(f.mimeType||'').toLowerCase();
  return /\.(pdf|csv|json|txt|xls|xlsx|xlsm)$/i.test(name)||[
    'application/pdf','application/vnd.google-apps.spreadsheet','application/vnd.google-apps.document',
    'text/csv','application/json','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel','application/vnd.ms-excel.sheet.macroenabled.12'
  ].includes(mime);
}
function priorityFile(f){
  if(!serverReadable(f))return false;
  const path=normalizePath(f.path);
  const statsMaster=/(?:2026-2027_CURRENT_現チーム|2025-2026_ARCHIVE_旧チーム)\/03_STATS_成績データ\/00_MASTER_正本\//.test(path);
  const staff=path==='50_STAFF_顧問・指導者'||path.startsWith('50_STAFF_顧問・指導者/');
  return statsMaster||staff;
}

function setProgress(processed,total,label,detail,mode='active'){
  const pct=total?Math.max(0,Math.min(100,Math.round(processed/total*100))):100;
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

function updateCopy(){
  const panel=document.querySelector('.drivePanel');
  const help=panel?.querySelector('.hubText');
  if(help)help.textContent='現・旧チームの正本と、権限に応じた顧問・指導者資料だけを先に準備します。詳細CSV・レポート等は質問時に必要なものだけ取得し、写真・映像は一括読込しません。PDF資料は必要時にサーバーで本文を読み取れます。';
  document.querySelectorAll('.privacy').forEach(el=>{
    if(String(el.textContent||'').includes('Google Drive'))el.innerHTML='<b>Google Drive：</b>読み取り専用。正本と重要資料だけを事前準備し、その他は質問時に必要なものだけ取得します。';
  });
}

function decorateFiles(){
  let files=[];
  try{files=Array.isArray(driveIndex)?driveIndex.filter(f=>f&&f.mimeType!==FOLDER_MIME).slice(0,150):[]}catch(_){return}
  const rows=[...document.querySelectorAll('#driveFiles .driveFile')];
  rows.forEach((row,i)=>{
    const f=files[i];
    if(!f||!priorityFile(f))return;
    const last=row.lastElementChild;
    if(!last)return;
    if(cachedIds.has(f.id))last.outerHTML='<span>重要資料・準備済み</span>';
    else if(failedIds.has(f.id))last.outerHTML='<span>必要時に再取得</span>';
    else if(running)last.outerHTML='<span>重要資料・準備中</span>';
  });
}

function wrapRender(){
  if(renderWrapped||typeof window.renderDriveFiles!=='function')return false;
  const original=window.renderDriveFiles;
  window.renderDriveFiles=function(){
    const result=original.apply(this,arguments);
    setTimeout(decorateFiles,0);
    return result;
  };
  renderWrapped=true;
  return true;
}

async function waitCatalogue(){
  for(let i=0;i<300;i++){
    updateCopy();wrapRender();
    try{if(Array.isArray(driveIndex)&&driveIndex.length)return true}catch(_){}
    if(i===30&&typeof window.MAGI_SERVER_DRIVE_RELOAD==='function'){
      try{await window.MAGI_SERVER_DRIVE_RELOAD()}catch(_){}
    }
    await sleep(100);
  }
  return false;
}

async function warm(){
  if(running||done)return;
  if(!await waitCatalogue())return;
  running=true;
  failedIds.clear();
  cachedIds.clear();
  let cursor=0,total=0,processed=0,hits=0,stored=0,failed=0;
  try{
    setProgress(0,1,'MAGIの重要資料を準備しています','正本と権限に応じた重要資料だけをサーバー側で準備します。');
    try{setDriveState('Google Drive：重要資料を準備しています…','ready')}catch(_){}
    while(true){
      const response=await fetch(`/api/drive/warm?cursor=${cursor}&limit=3`,{cache:'no-store',credentials:'same-origin'});
      if(response.status===401||response.status===403){running=false;return}
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.ok)throw new Error(data?.error||`Drive cache ${response.status}`);
      total=Number(data.total||0);
      processed=Math.min(total,Number(data.cursor||0)+Number(data.processed||0));
      hits+=Number(data.hits||0);stored+=Number(data.stored||0);failed+=Number(data.failed||0);
      for(const r of data.results||[]){
        if(r?.ok&&r.id)cachedIds.add(r.id);
        else if(r?.id)failedIds.set(r.id,r.status||'failed');
      }
      setProgress(processed,total||1,'MAGIの重要資料を準備しています',`${processed} / ${total} 件　準備済み${cachedIds.size}件${failed?`・要再取得${failed}件`:''}`);
      try{renderDriveFiles()}catch(_){}
      if(data.complete||data.nextCursor==null)break;
      cursor=Number(data.nextCursor||processed);
      await sleep(80);
    }
    done=true;
    window.MAGI_SERVER_CACHE_READY=true;
    window.MAGI_SERVER_CACHED_FILE_IDS=[...cachedIds];
    window.MAGI_SERVER_CACHE_RESULT={total,ready:cachedIds.size,hits,stored,failed,failedIds:[...failedIds.keys()]};
    const summary=`${SCOPE_NAME}：${cachedIds.size}/${total}件を準備済み${failed?`（${failed}件は質問時に再取得）`:''}。`;
    setProgress(total||1,total||1,'Google Driveの重要資料準備完了',summary,'complete');
    try{setDriveState(`Google Drive準備完了：${summary} その他は質問時に必要なものだけ取得します。`,'ready')}catch(_){}
    try{renderDriveFiles()}catch(_){}
  }catch(error){
    console.error('[MAGI server cache warm]',error);
    setProgress(processed,total||1,'Google Driveの重要資料を準備できませんでした',error?.message||String(error),'error');
    try{setDriveState(`Google Drive準備失敗：${error?.message||error}`,'error')}catch(_){}
  }finally{
    running=false;
  }
}

window.MAGI_WARM_DRIVE_SERVER_CACHE=warm;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(warm,0),{once:true});
else setTimeout(warm,0);
})();
