(()=>{
'use strict';
if(window.MAGI_DRIVE_MEDIA_INDEX_V256)return;
window.MAGI_DRIVE_MEDIA_INDEX_V256=true;

const PDF_MIME='application/pdf';
const PDF_JS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDF_WORKER='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const PDF_CMAP='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/';
const PDF_STANDARD_FONTS='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/';
const TESSERACT_JS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_PDF_BYTES=25*1024*1024;
const MAX_IMAGE_BYTES=15*1024*1024;
const MAX_TEXT_PAGES=50;
const MAX_OCR_PAGES=12;
const AUTO_MEDIA_LIMIT=150;
const CACHE_DB='magi-media-text-v1';
const state=new Map();
let pdfPromise=null,ocrPromise=null,busy=false;

const esc=s=>typeof escapeHtml==='function'?escapeHtml(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const isPdf=f=>f&&(f.mimeType===PDF_MIME||/\.pdf$/i.test(f.name||''));
const isImage=f=>f&&(/^image\//i.test(f.mimeType||'')||/\.(png|jpe?g|webp|gif|bmp|tiff?|heic)$/i.test(f.name||''));
const isMedia=f=>isPdf(f)||isImage(f);
const cacheKey=f=>`${f.id}|${f.modifiedTime||''}|${f.size||''}`;
function loadScript(src,test){
 if(test())return Promise.resolve();
 return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>test()?resolve():reject(new Error('ライブラリを開始できません'));s.onerror=()=>reject(new Error('無料解析ライブラリを読み込めません'));document.head.appendChild(s)});
}
async function loadPdf(){
 if(!pdfPromise)pdfPromise=loadScript(PDF_JS,()=>!!window.pdfjsLib).then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER});
 return pdfPromise;
}
async function loadOcr(){
 if(!ocrPromise)ocrPromise=loadScript(TESSERACT_JS,()=>!!window.Tesseract);
 return ocrPromise;
}
function openCache(){
 return new Promise((resolve,reject)=>{const req=indexedDB.open(CACHE_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('files'))db.createObjectStore('files',{keyPath:'key'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
}
async function cacheGet(key){
 try{const db=await openCache();return await new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}catch(e){return null}
}
async function cachePut(file,text,kind){
 try{const db=await openCache(),item={key:cacheKey(file),id:file.id,text:String(text).slice(0,300000),kind,at:Date.now()};await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){}
}
function addIndexedText(file,text,kind){
 const cleaned=String(text||'').replace(/\u0000/g,'').trim();if(cleaned.length<2)return 0;
 dataRecords=dataRecords.filter(r=>!(r.source==='drive'&&r.fileId===file.id));
 const before=dataRecords.length;
 addTextRecords(file.name,cleaned,'drive',kind);
 for(let i=before;i<dataRecords.length;i++){dataRecords[i].fileId=file.id;dataRecords[i].filePath=file.path||''}
 importedDriveFiles.add(file.id);
 state.set(file.id,{kind:'done',label:kind==='PDF文字抽出'?'PDF読取済み':'OCR済み'});
 updateRoute();
 return dataRecords.length-before;
}
async function fetchBlob(file){
 const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`);
 return r.blob();
}
async function extractPdfText(blob,onProgress){
 await loadPdf();
 const pdf=await window.pdfjsLib.getDocument({
  data:new Uint8Array(await blob.arrayBuffer()),
  cMapUrl:PDF_CMAP,
  cMapPacked:true,
  standardFontDataUrl:PDF_STANDARD_FONTS,
  useSystemFonts:true
 }).promise;
 const limit=Math.min(pdf.numPages,MAX_TEXT_PAGES),out=[];
 for(let i=1;i<=limit;i++){
  onProgress?.(i,limit,'PDFの文字を読み取り中');
  const page=await pdf.getPage(i),content=await page.getTextContent();
  const line=content.items.map(x=>String(x.str||'')).join(' ').replace(/\s+/g,' ').trim();
  if(line)out.push(`[PDF ${i}ページ] ${line}`);
 }
 return{text:out.join('\n'),pdf,pages:pdf.numPages};
}
async function imageToCanvas(blob){
 const url=URL.createObjectURL(blob);
 try{
  const img=await new Promise((resolve,reject)=>{const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(new Error('この画像形式を端末で開けません'));x.src=url});
  const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);return canvas;
 }finally{URL.revokeObjectURL(url)}
}
async function recognize(source,file,label){
 await loadOcr();
 const result=await window.Tesseract.recognize(source,'jpn+eng',{logger:m=>{if(m.status==='recognizing text'){const p=Math.round((m.progress||0)*100);state.set(file.id,{kind:'working',label:`${label} ${p}%`});renderDriveFiles()}}});
 return String(result?.data?.text||'').trim();
}
async function ocrPdf(pdf,file,onProgress){
 const limit=Math.min(pdf.numPages,MAX_OCR_PAGES),out=[];
 for(let i=1;i<=limit;i++){
  onProgress?.(i,limit,'スキャンPDFをOCR中');
  const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.6}),canvas=document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
  const text=await recognize(canvas,file,`PDF ${i}/${limit}`);
  if(text)out.push(`[OCR ${i}ページ] ${text}`);
 }
 return out.join('\n');
}
function progress(file,now,total,label){
 const pct=Math.round(now/Math.max(1,total)*100);state.set(file.id,{kind:'working',label:`${label} ${pct}%`});
 if(typeof setDriveState==='function')setDriveState(`${file.name}：${label} ${now}/${total}`,'ready');
 renderDriveFiles();
}
async function importMedia(file,{forceOcr=false,silent=false}={}){
 const size=Number(file.size)||0,limit=isPdf(file)?MAX_PDF_BYTES:MAX_IMAGE_BYTES;
 if(size>limit)throw new Error(`端末負荷を避けるため${Math.round(limit/1024/1024)}MB以下のファイルに対応しています`);
 const cached=await cacheGet(cacheKey(file));
 if(cached?.text){const count=addIndexedText(file,cached.text,cached.kind||'保存済み解析');renderDriveFiles();return count}
 state.set(file.id,{kind:'working',label:isPdf(file)?'PDF読取中':'無料OCR準備中'});renderDriveFiles();
 const blob=await fetchBlob(file);
 let text='',kind='';
 if(isPdf(file)){
  const extracted=await extractPdfText(blob,(n,t,l)=>progress(file,n,t,l));text=extracted.text;kind='PDF文字抽出';
  if(text.replace(/\s/g,'').length<40){
   if(!forceOcr){state.set(file.id,{kind:'ocr',label:'スキャンPDF：無料OCR'});renderDriveFiles();return 0}
   text=await ocrPdf(extracted.pdf,file,(n,t,l)=>progress(file,n,t,l));kind='PDF OCR';
  }
 }else{
  const canvas=await imageToCanvas(blob);text=await recognize(canvas,file,'画像OCR');kind='画像OCR';
 }
 if(text.replace(/\s/g,'').length<2)throw new Error('読み取れる文字を検出できませんでした');
 const count=addIndexedText(file,text,kind);await cachePut(file,text,kind);
 if(!silent&&typeof setDriveState==='function')setDriveState(`解析完了：${file.name} ／ ${count}行を検索・審議に利用できます。`,'ready');
 renderDriveFiles();return count;
}
async function importMediaById(id,forceOcr=false){
 if(busy){if(typeof setDriveState==='function')setDriveState('別の画像・PDFを解析中です。完了までお待ちください。','error');return 0}
 const file=driveIndex.find(x=>x.id===id);if(!file)return 0;
 busy=true;
 try{return await importMedia(file,{forceOcr})}catch(e){state.set(id,{kind:'error',label:'解析失敗：再試行'});renderDriveFiles();if(typeof setDriveState==='function')setDriveState(`${file.name}：${e.message}`,'error');return 0}finally{busy=false}
}
function mediaAction(file){
 const s=state.get(file.id);
 if(importedDriveFiles.has(file.id))return '<span>内容を利用可能</span>';
 if(s?.kind==='working')return `<span>${esc(s.label)}</span>`;
 if(s?.kind==='ocr')return `<button class="secondary miniBtn" onclick="MAGI_MEDIA_IMPORT('${file.id}',true)">${esc(s.label)}</button>`;
 if(isPdf(file))return `<button class="secondary miniBtn" onclick="MAGI_MEDIA_IMPORT('${file.id}',false)">PDF読取</button>`;
 if(isImage(file))return `<button class="secondary miniBtn" onclick="MAGI_MEDIA_IMPORT('${file.id}',true)">無料OCR</button>`;
 return '<span>未解析</span>';
}
function renderFiles(){
 const box=document.getElementById('driveFiles');if(!box)return;
 box.classList.remove('hidden');const files=driveIndex.filter(f=>f.mimeType!==FOLDER_MIME);
 if(!files.length){box.innerHTML='<div class="driveFile">対象ファイルがありません。</div>';return}
 box.innerHTML=files.slice(0,150).map(f=>`<div class="driveFile"><div><b>${esc(f.name)}</b><br>${esc(f.path||'')}</div>${isMedia(f)?mediaAction(f):(isImportable(f)?(importedDriveFiles.has(f.id)?'<span>索引済み</span>':`<button class="secondary miniBtn" onclick="importDriveFile('${f.id}')">再試行</button>`):'<span>未解析</span>')}</div>`).join('');
}
async function restoreCached(){
 for(const file of driveIndex.filter(isMedia)){
  const cached=await cacheGet(cacheKey(file));if(cached?.text)addIndexedText(file,cached.text,cached.kind||'保存済み解析');
 }
}
async function autoMedia(){
 const targets=driveIndex.filter(f=>isMedia(f)&&!importedDriveFiles.has(f.id)&&(Number(f.size)||0)<=(isPdf(f)?MAX_PDF_BYTES:MAX_IMAGE_BYTES)).slice(0,AUTO_MEDIA_LIMIT);
 for(let i=0;i<targets.length;i++){
  const file=targets[i];state.set(file.id,{kind:'working',label:`自動解析 ${i+1}/${targets.length}`});renderFiles();
  try{await importMedia(file,{forceOcr:true,silent:true})}catch(e){state.set(file.id,{kind:'error',label:'読取不可：再試行'})}
 }
 renderFiles();
}
function updateLegend(){
 const legend=document.getElementById('driveLegend');if(!legend)return;
 legend.innerHTML='<b>ファイルの利用状態</b><div class="driveLegendRow"><span class="driveLegendTag indexed">索引済み</span><span>表・文章・PDF文字・OCR結果をMAGIの質問と審議に使えます。</span></div><div class="driveLegendRow"><span class="driveLegendTag listed">未解析</span><span>画像は「無料OCR」、PDFは「PDF読取」を押すと端末内で解析します。</span></div>';
 const intro=document.querySelector('.drivePanel .hubText');
 if(intro&&/画像・PDFは一覧のみ/.test(intro.textContent))intro.textContent=intro.textContent.replace('画像・PDFは一覧のみです。','PDFは文字を抽出し、画像・スキャンPDFは端末内の無料OCRで読み取れます。');
}
const originalImport=window.importDriveFile;
const originalScan=window.scanDrive;
window.MAGI_MEDIA_IMPORT=importMediaById;
window.renderDriveFiles=renderFiles;
window.importDriveFile=async function(id,silent=false){
 const file=driveIndex.find(x=>x.id===id);return isMedia(file)?importMediaById(id,isPdf(file)?false:true):originalImport(id,silent);
};
window.scanDrive=async function(...args){
 const result=await originalScan.apply(this,args);
 if(!driveToken)return result;
 updateLegend();await restoreCached();renderFiles();await autoMedia();
 const media=driveIndex.filter(isMedia).length,ready=driveIndex.filter(f=>isMedia(f)&&importedDriveFiles.has(f.id)).length;
 if(typeof setDriveState==='function')setDriveState(`Google Drive接続済み。画像・PDF ${media}件中${ready}件の内容を利用できます。未解析は各ファイルの無料ボタンから読み取れます。`,'ready');
 return result;
};
updateLegend();
window.MAGI_DRIVE_MEDIA_INDEX='v256';
})();
