(()=>{
'use strict';
if(window.MAGI_DRIVE_RESILIENCE_V207)return;
const IMPORTANT=[
  {name:'丸岡中軟式野球部_通算成績一覧2025-2026.xlsm',label:'2025-2026旧チーム通算成績'}
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const qEscape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
function stateEl(){return document.getElementById('driveState')}
function setStatus(text,cls='ready'){try{if(typeof setDriveState==='function')setDriveState(text,cls);else{const el=stateEl();if(el){el.textContent=text;el.className='driveState '+cls}}}catch(e){}}
function indexedByName(name){try{return typeof driveIndex!=='undefined'&&Array.isArray(driveIndex)&&driveIndex.some(f=>f&&f.name===name)}catch(e){return false}}
function loadedByName(name){try{if(typeof driveIndex==='undefined'||typeof importedDriveFiles==='undefined')return false;const f=driveIndex.find(x=>x&&x.name===name);return !!(f&&importedDriveFiles.has(f.id))}catch(e){return false}}
async function directFind(name){
  if(typeof driveFetch!=='function')return [];
  const q=encodeURIComponent(`name='${qEscape(name)}' and trashed=false`);
  const fields=encodeURIComponent('files(id,name,mimeType,modifiedTime,size,webViewLink,parents)');
  const url=`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=20&fields=${fields}&spaces=drive&corpora=user&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const r=await driveFetch(url),j=await r.json();
  return Array.isArray(j.files)?j.files:[];
}
async function attachAndImport(f){
  try{
    if(typeof driveIndex!=='undefined'&&Array.isArray(driveIndex)&&!driveIndex.some(x=>x&&x.id===f.id)){
      driveIndex.push({...f,path:`ROOT/(再取得)/${f.name}`});
    }
    if(typeof importedDriveFiles!=='undefined'&&importedDriveFiles.has(f.id))return true;
    if(typeof importDriveFile==='function')await importDriveFile(f.id,true);
    if(typeof renderDriveFiles==='function')renderDriveFiles();
    return typeof importedDriveFiles!=='undefined'?importedDriveFiles.has(f.id):true;
  }catch(e){console.warn('[MAGI Drive resilience] import failed',f&&f.name,e);return false}
}
async function ensureOne(target,attempts=3){
  if(loadedByName(target.name))return{ok:true,recovered:false,name:target.name};
  const waits=[0,1200,2800];
  for(let i=0;i<Math.max(1,attempts);i++){
    if(i>0)await sleep(waits[Math.min(i,waits.length-1)]);
    try{
      if(indexedByName(target.name)){
        const f=driveIndex.find(x=>x&&x.name===target.name);
        const ok=await attachAndImport(f);
        if(ok)return{ok:true,recovered:true,name:target.name};
      }
      const hits=await directFind(target.name);
      if(hits.length){
        const ok=await attachAndImport(hits[0]);
        if(ok)return{ok:true,recovered:true,name:target.name};
      }
    }catch(e){
      if(/未接続|認証期限/.test(String(e&&e.message||e)))return{ok:false,disconnected:true,name:target.name};
      console.warn('[MAGI Drive resilience] retry',i+1,target.name,e);
    }
  }
  return{ok:false,name:target.name};
}
async function ensureImportant(attempts=3,announce=true){
  const results=[];
  for(const t of IMPORTANT)results.push(await ensureOne(t,attempts));
  const missing=results.filter(x=>!x.ok&&!x.disconnected),recovered=results.filter(x=>x.recovered);
  window.MAGI_DRIVE_MISSING_IMPORTANT=missing.map(x=>x.name);
  if(announce&&missing.length){
    setStatus(`Google Drive接続済み。⚠ 重要データ未検出：${missing.map(x=>x.name).join('、')}。Drive反映遅延の可能性があるため自動再確認を続けます。`,'ready');
  }else if(announce&&recovered.length){
    setStatus(`Google Drive接続済み。重要データを再取得しました：${recovered.map(x=>x.name).join('、')}。`,'ready');
  }
  return{missing,recovered};
}
const originalScan=window.scanDrive;
if(typeof originalScan==='function'){
  window.scanDrive=async function(){
    await originalScan.apply(this,arguments);
    return ensureImportant(3,true);
  };
}
let bgBusy=false;
setInterval(async()=>{
  if(bgBusy||document.hidden)return;
  const el=stateEl();
  if(!el||!String(el.textContent||'').includes('Google Drive接続済み'))return;
  bgBusy=true;
  try{
    const r=await ensureImportant(1,false);
    if(r.recovered.length)setStatus(`Google Drive接続済み。重要データを自動再取得しました：${r.recovered.map(x=>x.name).join('、')}。`,'ready');
  }finally{bgBusy=false}
},60000);
window.MAGI_DRIVE_RESILIENCE_V207=true;
window.MAGI_DRIVE_IMPORT_GUARD='important-file-retry-v1';
})();
