(()=>{
'use strict';
if(window.MAGI_SERVER_DRIVE_V300)return;
window.MAGI_SERVER_DRIVE_V300=true;

const ROOT_ID='1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
const FOLDER_MIME_SERVER='application/vnd.google-apps.folder';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fileCache=new Map();
const MAX_QUERY_FILES=4;
const CSV_FETCH_TIMEOUT_MS=12000;
const WORKBOOK_FETCH_TIMEOUT_MS=20000;
let scanPromise=null;
let clickBusy=false;

const norm=s=>String(s??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();

function styleLegacyDrive(){
  const panel=document.querySelector('.drivePanel');
  if(!panel)return;
  panel.querySelector('.settingGrid')?.classList.add('hidden');
  panel.querySelector('.actions')?.classList.add('hidden');
  const account=document.getElementById('driveAccountState');
  if(account)account.classList.add('hidden');
  const help=panel.querySelector('.hubText');
  if(help)help.textContent='Google Driveは目次だけを先に確認し、質問に必要な資料だけをその都度読み込みます。全ファイルの一括読込は行いません。';
  const root=document.getElementById('driveRootId');
  if(root)root.value=ROOT_ID;
  document.querySelectorAll('.privacy').forEach(el=>{
    if(String(el.textContent||'').includes('Google Drive')){
      el.innerHTML='<b>無料構成：</b>有料AI APIなし。Google Driveは読み取り専用。質問に必要な資料だけをサーバー側で取得します。';
    }
  });
}

function canonicalFileName(name){
  const s=String(name||'').normalize('NFKC');
  const dot=s.lastIndexOf('.');
  const stem=dot>=0?s.slice(0,dot):s;
  const ext=dot>=0?s.slice(dot).toLowerCase():'';
  return stem
    .replace(/\s*[（(]\d+[）)]\s*$/,'')
    .replace(/(?:\s*[-_]?\s*(?:copy|コピー|複製))\s*$/i,'')
    .replace(/\s+/g,'')+ext;
}

function dedupeDriveRecords(){
  const seen=new Set(),next=[];
  let removed=0;
  for(const r of dataRecords){
    if(!r||r.source!=='drive'){next.push(r);continue}
    const key=[
      canonicalFileName(r.fileName),
      String(r.sheetName||'').normalize('NFKC').trim(),
      String(r.rowNumber??''),
      JSON.stringify(Array.isArray(r.columns)?r.columns:[]),
      JSON.stringify(Array.isArray(r.values)?r.values:[])
    ].join('\u001f');
    if(seen.has(key)){removed++;continue}
    seen.add(key);next.push(r);
  }
  if(removed)dataRecords=next;
  return removed;
}
window.MAGI_DEDUPE_DRIVE_RECORDS=dedupeDriveRecords;

function smartTextScore(s){
  const text=String(s||'');
  const replacement=(text.match(/�/g)||[]).length;
  const mojibake=(text.match(/[\u0080-\u009f]/g)||[]).length;
  const japanese=(text.match(/[ぁ-んァ-ヶ一-龯々]/g)||[]).length;
  const known=(text.match(/選手|開催日|打席|打数|安打|打率|打点|得点|出塁率|長打率|守備|相手校/g)||[]).length;
  return japanese+known*24-replacement*40-mojibake*18;
}
function decodeBytesSmart(buffer){
  const bytes=buffer instanceof ArrayBuffer?buffer:buffer?.buffer;
  let utf8='',shiftJis='';
  try{utf8=new TextDecoder('utf-8',{fatal:false}).decode(bytes)}catch(_){}
  try{shiftJis=new TextDecoder('shift_jis',{fatal:false}).decode(bytes)}catch(_){}
  return smartTextScore(shiftJis)>smartTextScore(utf8)?shiftJis:utf8;
}
async function responseTextSmart(response){return decodeBytesSmart(await response.arrayBuffer())}
window.MAGI_DECODE_TEXT_SMART=decodeBytesSmart;

function cloneRecord(r){
  return {
    ...r,
    columns:Array.isArray(r?.columns)?r.columns.slice():r?.columns,
    values:Array.isArray(r?.values)?r.values.slice():r?.values
  };
}

async function fetchWithTimeout(url,options={},ms=CSV_FETCH_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{
    return await fetch(url,{...options,signal:controller.signal});
  }finally{
    clearTimeout(timer);
  }
}

async function readIndex(){
  const response=await fetchWithTimeout('/api/drive/index',{cache:'no-store',credentials:'same-origin'},12000);
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
    const isWorkbook=f.mimeType==='application/vnd.google-apps.spreadsheet'||/\.(xls|xlsx|xlsm)$/i.test(String(f.name||''))||/spreadsheetml|ms-excel/.test(f.mimeType||'');
    const timeout=isWorkbook?WORKBOOK_FETCH_TIMEOUT_MS:CSV_FETCH_TIMEOUT_MS;
    const response=await fetchWithTimeout(`/api/drive/file?id=${encodeURIComponent(id)}`,{cache:'no-store',credentials:'same-origin'},timeout);
    if(!response.ok)throw new Error(response.status===504?'Drive file timeout':`Drive file ${response.status}`);

    if(f.mimeType==='application/vnd.google-apps.spreadsheet'){
      addWorkbookRecords(f.name,await response.arrayBuffer(),'drive');
    }else if(f.mimeType==='application/vnd.google-apps.document'){
      addTextRecords(f.name,await responseTextSmart(response),'drive');
    }else if(/\.(xls|xlsx|xlsm)$/i.test(f.name)||/spreadsheetml|ms-excel/.test(f.mimeType||'')){
      addWorkbookRecords(f.name,await response.arrayBuffer(),'drive');
    }else if(/json/i.test(f.mimeType||'')||/\.json$/i.test(f.name)){
      addJsonRecords(f.name,JSON.parse(await responseTextSmart(response)),'drive');
    }else if(/csv/i.test(f.mimeType||'')||/\.csv$/i.test(f.name)){
      addTableRecords(f.name,'CSV',parseCsv(await responseTextSmart(response)),'drive');
    }else{
      addTextRecords(f.name,await responseTextSmart(response),'drive');
    }

    tag();
    dedupeDriveRecords();
    importedDriveFiles.add(f.id);
    const cachedRows=dataRecords.filter(r=>r&&r.source==='drive'&&r.fileId===id).map(cloneRecord);
    fileCache.set(id,{modifiedTime:String(f.modifiedTime||''),records:cachedRows});
    if(!silent){
      setDriveState(`取込完了：${f.name} ／ ${cachedRows.length}行を索引化。`,'ready');
      renderDriveFiles();
    }
    try{updateRoute()}catch(_){}
    return cachedRows.length;
  }catch(error){
    if(!silent)setDriveState(`ファイル取込失敗：${error?.name==='AbortError'?'時間超過':error?.message||error}`,'error');
    throw error;
  }
}

function importableFile(f){
  if(!f||f.mimeType===FOLDER_MIME_SERVER)return false;
  if(typeof isImportable!=='function'||!isImportable(f))return false;
  if(/\.(pdf|png|jpe?g|webp|gif|bmp|tiff?|heic)$/i.test(String(f.name||'')))return false;
  return true;
}
function sameSeason(f,y){return norm(`${f?.name||''} ${f?.path||''}`).includes(norm(y))}
function pushMatches(out,predicate,limit=3){
  let added=0;
  for(const f of driveIndex){
    if(out.length>=MAX_QUERY_FILES||limit<=0)break;
    if(!importableFile(f)||!predicate(f)||out.some(x=>x.id===f.id))continue;
    out.push(f);limit--;added++;
  }
  return added;
}
function queryWords(q){
  const stop=new Set(['について','審議して','比較して','読み込み','読み込んで','して','する','ありか','どう','過去','成績','選手','チーム']);
  return (String(q||'').match(/[一-龯々ァ-ヶA-Za-z0-9._-]{2,}/g)||[])
    .map(x=>norm(x)).filter(x=>x.length>=2&&!stop.has(x)).slice(0,18);
}
function planQueryFiles(q){
  const text=String(q||''),z=norm(text),out=[];
  const wantsOld=/2025\s*[-–—_. /]?\s*2026|旧チーム|昨季|前年|過去成績|過去も|昨年/i.test(text)||z.includes('20252026');
  const oldOnly=/旧チームだけ|昨季だけ|前年だけ|過去だけ/i.test(text);
  const wantsCurrent=!oldOnly;
  const batting=/打撃|打率|出塁率|長打率|OPS|安打|打点|打席|打数|打順|クリーンナップ|中軸|主軸|[1-9１-９一二三四五六七八九]番/i.test(text);
  const pitching=/投手|投球|防御率|奪三振|与四死球|四死球|先発|継投|クローザー|リリーフ|救援/i.test(text);
  const fielding=/守備|失策|守備率|捕手|一塁|二塁|三塁|遊撃|左翼|中堅|右翼|外野|内野|ポジション/i.test(text);
  const practice=/練習|練習試合|メニュー|課題|トレーニング/i.test(text);
  const teamInfo=/キャプテン|副キャプテン|人事|関係|育成|役割|チーム内|選手評価|プロフィール/i.test(text);

  const addSeasonWorkbook=y=>pushMatches(out,f=>sameSeason(f,y)&&/通算成績一覧/i.test(String(f.name||''))&&/\.(xlsm|xlsx|xls)$/i.test(String(f.name||'')),1);

  if(batting){
    if(wantsCurrent){
      const n=pushMatches(out,f=>sameSeason(f,'2026-2027')&&/^打撃詳細2026-2027(?:\s*[（(]\d+[）)])?\.csv$/i.test(String(f.name||'')),1);
      if(!n){
        const m=pushMatches(out,f=>sameSeason(f,'2026-2027')&&/打撃詳細/i.test(String(f.name||''))&&/\.csv$/i.test(String(f.name||'')),1);
        if(!m)addSeasonWorkbook('2026-2027');
      }
    }
    if(wantsOld){
      const n=addSeasonWorkbook('2025-2026');
      if(!n)pushMatches(out,f=>sameSeason(f,'2025-2026')&&/打撃詳細/i.test(String(f.name||''))&&/\.csv$/i.test(String(f.name||'')),1);
    }
  }

  if(pitching){
    if(wantsCurrent){
      const n=pushMatches(out,f=>sameSeason(f,'2026-2027')&&/投手詳細/i.test(String(f.name||''))&&/\.csv$/i.test(String(f.name||'')),1);
      if(!n)addSeasonWorkbook('2026-2027');
    }
    if(wantsOld){
      const n=pushMatches(out,f=>sameSeason(f,'2025-2026')&&/投手詳細/i.test(String(f.name||''))&&/\.csv$/i.test(String(f.name||'')),1);
      if(!n)addSeasonWorkbook('2025-2026');
    }
  }

  if(fielding){
    if(wantsCurrent){
      const n=pushMatches(out,f=>sameSeason(f,'2026-2027')&&(/守備詳細/i.test(String(f.name||''))||/FIELDING_守備成績/i.test(String(f.path||'')))&&/\.csv$/i.test(String(f.name||'')),1);
      if(!n)addSeasonWorkbook('2026-2027');
    }
    if(wantsOld)addSeasonWorkbook('2025-2026');
  }

  if(practice)pushMatches(out,f=>/07_PRACTICE_練習記録/i.test(String(f.path||'')),2);
  if(teamInfo)pushMatches(out,f=>/01_PLAYERS_選手データ|10_TEAM_INFO_チーム資料|50_STAFF_顧問・指導者/i.test(String(f.path||'')),2);

  if(!out.length){
    const words=queryWords(text),ranked=[];
    for(const f of driveIndex){
      if(!importableFile(f))continue;
      const hay=norm(`${f.name||''} ${f.path||''}`);
      let score=0;
      for(const w of words)if(w&&hay.includes(w))score+=w.length>=5?5:2;
      if(score>0)ranked.push({f,score});
    }
    ranked.sort((a,b)=>b.score-a.score);
    for(const x of ranked.slice(0,3))if(!out.some(f=>f.id===x.f.id))out.push(x.f);
  }

  return out.slice(0,MAX_QUERY_FILES);
}

function restoreCachedFile(f){
  const cached=fileCache.get(f.id);
  if(!cached||cached.modifiedTime!==String(f.modifiedTime||'')||!cached.records?.length)return false;
  dataRecords.push(...cached.records.map(cloneRecord));
  importedDriveFiles.add(f.id);
  return true;
}

async function prepareQueryFiles(q){
  if(scanPromise)await scanPromise;
  if(!Array.isArray(driveIndex)||!driveIndex.length)await serverScanDrive();
  const targets=planQueryFiles(q);
  const ids=new Set(targets.map(f=>f.id));

  dataRecords=dataRecords.filter(r=>r?.source!=='drive'||ids.has(r.fileId));
  importedDriveFiles.clear();
  for(const f of targets){
    const active=dataRecords.some(r=>r&&r.source==='drive'&&r.fileId===f.id);
    if(active){importedDriveFiles.add(f.id);continue}
    restoreCachedFile(f);
  }

  let loaded=0,failed=0;
  const failedNames=[];
  for(let i=0;i<targets.length;i++){
    const f=targets[i];
    if(importedDriveFiles.has(f.id))continue;
    setDriveState(`必要資料を読み込み中 ${i+1}/${targets.length}：${f.name}`,'ready');
    try{
      await serverImportFile(f.id,true);
      loaded++;
    }catch(error){
      failed++;
      failedNames.push(f.name);
      console.warn('[MAGI lazy Drive] skipped',f.name,error?.message||error);
    }
  }
  dedupeDriveRecords();
  renderDriveFiles();

  const rows=dataRecords.filter(r=>r&&r.source==='drive').length;
  const names=targets.map(f=>f.name);
  window.MAGI_LAZY_ACTIVE_FILES=names.slice();
  window.MAGI_LAZY_ACTIVE_FILE_IDS=targets.map(f=>f.id);
  window.MAGI_LAZY_DRIVE_PLAN={version:'v300',question:String(q||''),files:names.slice(),rows,failed,failedNames:failedNames.slice()};

  if(targets.length){
    setDriveState(`必要資料${targets.length}件の確認完了：${names.join('、')} ／ ${rows}行${failed?`（読込失敗：${failedNames.join('、')}）`:''}`,'ready');
  }else{
    setDriveState(`Drive目次${driveIndex.length}件を確認。今回の質問では追加ファイル読込なし。`,'ready');
  }
  return{targets,rows,loaded,failed,failedNames};
}
window.MAGI_PREPARE_QUERY_FILES=prepareQueryFiles;
window.MAGI_PLAN_QUERY_FILES=planQueryFiles;

async function serverScanDrive(){
  if(scanPromise)return scanPromise;
  scanPromise=(async()=>{
    try{
      styleLegacyDrive();
      setDriveState('Google Drive：目次を確認しています…','ready');
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
      const files=driveIndex.filter(f=>f&&f.mimeType!==FOLDER_MIME_SERVER).length;
      setDriveState(`Google Drive：目次${driveIndex.length}件（ファイル${files}件）を確認済み。中身は未読です。MAGI実行時に必要な資料だけ読み込みます。`,'ready');
    }catch(error){
      console.error('[MAGI server Drive UI]',error);
      setDriveState(`Google Drive読込失敗：${error?.name==='AbortError'?'目次確認が時間超過しました':error?.message||error}`,'error');
    }
  })();
  try{return await scanPromise}finally{scanPromise=null}
}

function installLazyClick(){
  if(window.MAGI_LAZY_CLICK_V300)return;
  window.MAGI_LAZY_CLICK_V300=true;
  document.addEventListener('click',async event=>{
    const btn=event.target?.closest?.('#judge .actions button.primary');
    if(!btn)return;
    const text=String(btn.textContent||'');
    if(!/MAGI実行/.test(text))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(clickBusy)return;
    const q=document.getElementById('q')?.value?.trim()||'';
    if(!q){
      const status=document.getElementById('status');
      if(status)status.textContent='相談内容を入力してください。';
      return;
    }
    clickBusy=true;
    btn.disabled=true;
    const oldText=btn.textContent;
    btn.textContent='必要資料を確認中…';
    try{
      const prep=await prepareQueryFiles(q);
      const status=document.getElementById('status');
      if(status)status.textContent=prep.failed?'一部資料は時間超過のため除外しました。取得済みデータで審議を続行します。':'必要資料の読み込み完了。MAGI審議を開始します…';
      btn.textContent='MAGI審議中…';
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
      if(typeof window.runMagi==='function')await window.runMagi();
    }catch(error){
      console.error('[MAGI lazy Drive]',error);
      const status=document.getElementById('status');
      if(status)status.textContent=`必要資料の読み込みに失敗しました：${error?.name==='AbortError'?'時間超過':error?.message||error}`;
    }finally{
      clickBusy=false;
      btn.disabled=false;
      btn.textContent=oldText;
    }
  },true);
}

async function install(attempt=0){
  styleLegacyDrive();
  const ready=typeof setDriveState==='function'&&typeof renderDriveFiles==='function'&&typeof isImportable==='function'&&typeof addWorkbookRecords==='function'&&typeof addTextRecords==='function'&&typeof addTableRecords==='function'&&typeof parseCsv==='function';
  if(!ready){
    if(attempt<120){await sleep(100);return install(attempt+1)}
    return;
  }
  try{driveToken='MAGI_SERVER'}catch(_){}
  try{document.getElementById('driveRootId').value=ROOT_ID}catch(_){}
  try{localStorage.removeItem('magiDriveRootV7')}catch(_){}

  try{scanDrive=serverScanDrive}catch(_){}
  try{importDriveFile=serverImportFile}catch(_){}
  window.scanDrive=serverScanDrive;
  window.importDriveFile=serverImportFile;
  window.MAGI_SERVER_DRIVE_RELOAD=serverScanDrive;
  installLazyClick();
  await serverScanDrive();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});
else install();
})();
