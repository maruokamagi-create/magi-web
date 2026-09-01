(()=>{
'use strict';
if(window.MAGI_DRIVE_RESILIENCE_V241)return;
const IMPORTANT=[
  {name:'丸岡中軟式野球部_通算成績一覧2025-2026.xlsm',label:'2025-2026旧チーム通算成績'},
  {name:'投手詳細2025-2026.csv',label:'2025-2026旧チーム投手成績',encoding:'shift_jis',id:'1thxQXAdswckPVdmXdvRXPeuVAfDtskUB'},
  {name:'投手詳細2026-2027.csv',label:'2026-2027現チーム投手成績',encoding:'shift_jis'}
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
function decodeCsvBuffer(buffer,preferred){
  const bytes=new Uint8Array(buffer);
  if(preferred==='shift_jis')return new TextDecoder('shift_jis').decode(bytes);
  const utf8=new TextDecoder('utf-8').decode(bytes);
  if(!utf8.includes('\uFFFD'))return utf8;
  try{return new TextDecoder('shift_jis').decode(bytes)}catch(e){return utf8}
}
async function importCsvSafely(f,encoding){
  if(typeof driveFetch!=='function'||typeof addTableRecords!=='function'||typeof parseCsv!=='function')return false;
  const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media&supportsAllDrives=true`);
  const text=decodeCsvBuffer(await r.arrayBuffer(),encoding);
  if(typeof dataRecords!=='undefined')dataRecords=dataRecords.filter(x=>!(x&&x.source==='drive'&&x.fileId===f.id));
  const before=typeof dataRecords!=='undefined'?dataRecords.length:0;
  addTableRecords(f.name,'CSV',parseCsv(text),'drive');
  if(typeof dataRecords!=='undefined')for(let i=before;i<dataRecords.length;i++)dataRecords[i].fileId=f.id;
  if(typeof importedDriveFiles!=='undefined')importedDriveFiles.add(f.id);
  return true;
}
async function attachAndImport(f){
  try{
    if(typeof driveIndex!=='undefined'&&Array.isArray(driveIndex)&&!driveIndex.some(x=>x&&x.id===f.id)){
      driveIndex.push({...f,path:`ROOT/(再取得)/${f.name}`});
    }
    if(typeof importedDriveFiles!=='undefined'&&importedDriveFiles.has(f.id))return true;
    const important=IMPORTANT.find(x=>x.name===f.name);
    if(important&&/\.csv(?:\.csv)?$/i.test(f.name))await importCsvSafely(f,important.encoding);
    else if(typeof importDriveFile==='function')await importDriveFile(f.id,true);
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
function driveSummary(results=[]){
  const list=typeof driveIndex!=='undefined'&&Array.isArray(driveIndex)?driveIndex:[];
  const folders=list.filter(f=>f&&f.mimeType==='application/vnd.google-apps.folder').length;
  const files=list.filter(f=>f&&f.mimeType!=='application/vnd.google-apps.folder').length;
  const indexed=typeof importedDriveFiles!=='undefined'&&importedDriveFiles?importedDriveFiles.size:0;
  const rows=typeof dataRecords!=='undefined'&&Array.isArray(dataRecords)?dataRecords.filter(r=>r&&r.source==='drive').length:0;
  const ok=results.filter(x=>x&&x.ok).length;
  const recovered=results.filter(x=>x&&x.recovered);
  const missing=results.filter(x=>x&&!x.ok&&!x.disconnected);
  const parts=[`全体${list.length}件（フォルダ${folders}件・ファイル${files}件）を確認`,`対応${indexed}ファイル・${rows}行を索引化`];
  if(missing.length)parts.push(`重要データ${IMPORTANT.length}件中${ok}件を確認（未検出${missing.length}件）`);
  else parts.push(`重要データ${IMPORTANT.length}件を確認済み`);
  if(recovered.length)parts.push(`今回${recovered.length}件を再取得`);
  return{list,folders,files,indexed,rows,ok,recovered,missing,text:parts.join('。')+'。画像・PDFは一覧のみです。'};
}
async function ensureImportant(attempts=3,announce=true){
  const results=[];
  for(const t of IMPORTANT)results.push(await ensureOne(t,attempts));
  const summary=driveSummary(results),missing=summary.missing,recovered=summary.recovered;
  window.MAGI_DRIVE_MISSING_IMPORTANT=missing.map(x=>x.name);
  window.MAGI_DRIVE_LAST_SUMMARY={total:summary.list.length,folders:summary.folders,files:summary.files,indexed:summary.indexed,rows:summary.rows,importantTotal:IMPORTANT.length,importantReady:summary.ok,recovered:recovered.map(x=>x.name),missing:missing.map(x=>x.name)};
  if(announce){
    if(missing.length)setStatus(`Google Drive読込完了（一部要確認）：${summary.text} 未検出：${missing.map(x=>x.name).join('、')}。自動再確認を続けます。`,'ready');
    else setStatus(`Google Drive読込完了：${summary.text}`,'ready');
  }
  return{missing,recovered,summary};
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
    if(r.recovered.length){const s=driveSummary(IMPORTANT.map(t=>({name:t.name,ok:loadedByName(t.name),recovered:r.recovered.some(x=>x.name===t.name)})));setStatus(`Google Drive自動確認完了：${s.text}`,'ready');}
  }finally{bgBusy=false}
},60000);
window.MAGI_DRIVE_RESILIENCE_V241=true;
window.MAGI_DRIVE_IMPORT_GUARD='important-file-summary-v2';
})();
