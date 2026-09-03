(()=>{
'use strict';
if(window.MAGI_SERVER_DRIVE_V293)return;
window.MAGI_SERVER_DRIVE_V293=true;

const ROOT_ID='1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
const FOLDER_MIME_SERVER='application/vnd.google-apps.folder';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function styleLegacyDrive(){
  const panel=document.querySelector('.drivePanel');
  if(!panel)return;
  panel.querySelector('.settingGrid')?.classList.add('hidden');
  panel.querySelector('.actions')?.classList.add('hidden');
  const account=document.getElementById('driveAccountState');
  if(account)account.classList.add('hidden');
  const help=panel.querySelector('.hubText');
  if(help)help.textContent='Google DriveはMAGI-WEBがサーバー側で読み取り専用接続します。利用者のGoogleログインや接続操作は不要です。承認済みの利用者は必要なチーム資料を自動で参照できます。';
  const root=document.getElementById('driveRootId');
  if(root)root.value=ROOT_ID;

  document.querySelectorAll('.privacy').forEach(el=>{
    if(String(el.textContent||'').includes('Google Drive')){
      el.innerHTML='<b>無料構成：</b>有料AI APIなし。Google Driveは読み取り専用。MAGI-WEBがサーバー側で必要な資料を取得し、利用者のGoogleアカウント認証は不要です。';
    }
  });
}

function dedupeDriveRecords(){
  const seen=new Set();
  const next=[];
  let removed=0;
  for(const r of dataRecords){
    if(!r||r.source!=='drive'){
      next.push(r);
      continue;
    }
    const key=[
      String(r.fileName||''),
      String(r.sheetName||''),
      String(r.rowNumber??''),
      JSON.stringify(Array.isArray(r.columns)?r.columns:[]),
      JSON.stringify(Array.isArray(r.values)?r.values:[])
    ].join('\u001f');
    if(seen.has(key)){
      removed++;
      continue;
    }
    seen.add(key);
    next.push(r);
  }
  if(removed)dataRecords=next;
  return removed;
}

async function readIndex(){
  const response=await fetch('/api/drive/index',{cache:'no-store',credentials:'same-origin'});
  const data=await response.json().catch(()=>({}));
  if(response.status===401||response.status===403)return{skip:true,status:response.status};
  if(!response.ok||!data?.ok)throw new Error(data?.error||'Drive index failed');
  return data;
}

async function serverImportFile(id,silent=false){
  const f=driveIndex.find(x=>x&&x.id===id);
  if(!f)return 0;
  try{
    if(!silent)setDriveState(`${f.name} を読み込み中…`,'ready');
    dataRecords=dataRecords.filter(r=>!(r&&r.source==='drive'&&r.fileId===id));
    const before=dataRecords.length;
    const tag=()=>{for(let i=before;i<dataRecords.length;i++)dataRecords[i].fileId=id};
    const response=await fetch(`/api/drive/file?id=${encodeURIComponent(id)}`,{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error(`Drive file ${response.status}`);

    if(f.mimeType==='application/vnd.google-apps.spreadsheet'){
      addWorkbookRecords(f.name,await response.arrayBuffer(),'drive');
    }else if(f.mimeType==='application/vnd.google-apps.document'){
      addTextRecords(f.name,await response.text(),'drive');
    }else if(/\.(xls|xlsx|xlsm)$/i.test(f.name)||/spreadsheetml|ms-excel/.test(f.mimeType||'')){
      addWorkbookRecords(f.name,await response.arrayBuffer(),'drive');
    }else if(/json/i.test(f.mimeType||'')||/\.json$/i.test(f.name)){
      addJsonRecords(f.name,JSON.parse(await response.text()),'drive');
    }else if(/csv/i.test(f.mimeType||'')||/\.csv$/i.test(f.name)){
      addTableRecords(f.name,'CSV',parseCsv(await response.text()),'drive');
    }else{
      addTextRecords(f.name,await response.text(),'drive');
    }
    tag();
    importedDriveFiles.add(f.id);
    if(!silent){
      setDriveState(`取込完了：${f.name} ／ ${dataRecords.length-before}行を索引化。`,'ready');
      renderDriveFiles();
    }
    try{updateRoute()}catch(_){ }
    return dataRecords.length-before;
  }catch(error){
    if(!silent)setDriveState(`ファイル取込失敗：${error?.message||error}`,'error');
    throw error;
  }
}

async function serverScanDrive(){
  try{
    styleLegacyDrive();
    setDriveState('Google Drive：MAGI-WEBが自動接続しています…','ready');
    const data=await readIndex();
    if(data?.skip)return;
    if(!data.configured){
      driveIndex=[];
      dataRecords=dataRecords.filter(r=>r.source!=='drive');
      importedDriveFiles.clear();
      renderDriveFiles();
      setDriveState('Google Drive：管理者側の自動接続設定を準備中です。利用者側での操作は不要です。','');
      return;
    }

    driveIndex=Array.isArray(data.files)?data.files:[];
    dataRecords=dataRecords.filter(r=>r.source!=='drive');
    importedDriveFiles.clear();
    renderDriveFiles();
    const targets=driveIndex.filter(f=>typeof isImportable==='function'&&isImportable(f));
    let failed=0;
    for(let i=0;i<targets.length;i++){
      setDriveState(`Google Drive：${driveIndex.length}件を一覧化。対応ファイルを自動索引化中 ${i+1}/${targets.length}…`,'ready');
      try{await serverImportFile(targets[i].id,true)}catch(_){failed++}
    }
    const duplicates=dedupeDriveRecords();
    renderDriveFiles();
    const rows=dataRecords.filter(r=>r&&r.source==='drive').length;
    const files=driveIndex.filter(f=>f&&f.mimeType!==FOLDER_MIME_SERVER).length;
    setDriveState(`Google Drive読込完了：${driveIndex.length}件（ファイル${files}件）を一覧化、${importedDriveFiles.size}ファイル・${rows}行を自動索引化${duplicates?`（重複${duplicates}行を除外）`:''}${failed?`（${failed}件は取込失敗）`:''}。利用者のGoogleログインは不要です。`,'ready');
  }catch(error){
    console.error('[MAGI server Drive UI]',error);
    setDriveState(`Google Drive読込失敗：${error?.message||error}`,'error');
  }
}

async function install(attempt=0){
  styleLegacyDrive();
  const ready=typeof setDriveState==='function'&&typeof renderDriveFiles==='function'&&typeof isImportable==='function'&&typeof addWorkbookRecords==='function'&&typeof addTextRecords==='function'&&typeof addTableRecords==='function'&&typeof parseCsv==='function';
  if(!ready){
    if(attempt<80){await sleep(100);return install(attempt+1)}
    return;
  }
  try{driveToken='MAGI_SERVER'}catch(_){ }
  try{document.getElementById('driveRootId').value=ROOT_ID}catch(_){ }
  try{localStorage.removeItem('magiDriveRootV7')}catch(_){ }

  try{scanDrive=serverScanDrive}catch(_){ }
  try{importDriveFile=serverImportFile}catch(_){ }
  window.scanDrive=serverScanDrive;
  window.importDriveFile=serverImportFile;
  window.MAGI_SERVER_DRIVE_RELOAD=serverScanDrive;

  await serverScanDrive();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
else install();
})();
