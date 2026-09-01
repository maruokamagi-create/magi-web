(()=>{
'use strict';
if(window.MAGI_DRIVE_PROGRESS_V241)return;

const state=document.getElementById('driveState');
const panel=state&&state.closest('.drivePanel');
if(!state||!panel)return;

const style=document.createElement('style');
style.id='magi-drive-progress-v241-style';
style.textContent=`
.driveProgress{margin:12px 0 2px;padding:12px 13px;border:1px solid rgba(126,176,255,.28);border-radius:12px;background:rgba(5,20,35,.64);box-shadow:inset 0 1px 0 rgba(255,255,255,.035);transition:border-color .2s ease,background .2s ease}
.driveProgress.hidden{display:none}
.driveProgressHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.driveProgressLabel{min-width:0;color:#dbe9f7;font-size:13px;font-weight:800;line-height:1.35}
.driveProgressPercent{flex:0 0 auto;color:#8fc3ff;font-size:13px;font-weight:900;font-variant-numeric:tabular-nums}
.driveProgressTrack{position:relative;height:10px;overflow:hidden;border-radius:999px;background:#07111d;border:1px solid rgba(126,176,255,.22)}
.driveProgressBar{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#3d7fff 0%,#44b7ff 55%,#6fe2c2 100%);box-shadow:0 0 13px rgba(68,183,255,.55);transition:width .34s ease}
.driveProgress.active .driveProgressBar::after{content:"";display:block;width:42%;height:100%;margin-left:-42%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.48),transparent);animation:magiDriveSweep 1.25s linear infinite}
.driveProgress.complete{border-color:rgba(91,218,155,.46);background:rgba(7,38,30,.58)}
.driveProgress.complete .driveProgressPercent{color:#74e3aa}
.driveProgress.error{border-color:rgba(255,105,125,.48);background:rgba(54,13,24,.52)}
.driveProgress.error .driveProgressBar{background:linear-gradient(90deg,#c74762,#ff718a);box-shadow:none}
.driveProgress.error .driveProgressPercent{color:#ff8da0}
.driveProgressNote{margin-top:7px;color:#8fa9bf;font-size:11px;line-height:1.45}.driveLegend{margin:10px 0 0;padding:10px 12px;border:1px solid #294a69;border-radius:11px;background:#071827;color:#b8cadb;font-size:11px;line-height:1.55}.driveLegend b{display:block;color:#fff;margin-bottom:6px}.driveLegendRow{display:flex;align-items:flex-start;gap:8px;margin-top:4px}.driveLegendTag{flex:0 0 auto;min-width:58px;padding:2px 6px;border-radius:999px;text-align:center;font-size:9px;font-weight:900}.driveLegendTag.indexed{background:#123d2d;color:#7be2ad;border:1px solid #24684b}.driveLegendTag.listed{background:#293340;color:#c8d2dc;border:1px solid #495869}
@keyframes magiDriveSweep{to{margin-left:100%}}
@media(max-width:430px){.driveProgress{padding:11px 12px}.driveProgressLabel,.driveProgressPercent{font-size:12px}}
@media(prefers-reduced-motion:reduce){.driveProgressBar{transition:none}.driveProgress.active .driveProgressBar::after{animation:none}}
`;
document.head.appendChild(style);

const box=document.createElement('div');
box.id='driveProgress';
box.className='driveProgress hidden';
box.setAttribute('role','status');
box.setAttribute('aria-live','polite');
box.innerHTML='<div class="driveProgressHead"><div id="driveProgressLabel" class="driveProgressLabel">接続準備中</div><div id="driveProgressPercent" class="driveProgressPercent">0%</div></div><div id="driveProgressTrack" class="driveProgressTrack" role="progressbar" aria-label="Google Drive 読み込み進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="driveProgressBar" class="driveProgressBar"></div></div><div id="driveProgressNote" class="driveProgressNote">Googleの認証画面では、接続を許可してMAGI-WEBへ戻ってください。</div>';
state.parentNode.insertBefore(box,state);

const filesBox=document.getElementById('driveFiles');
if(filesBox&&!document.getElementById('driveLegend')){
  const legend=document.createElement('div');
  legend.id='driveLegend';legend.className='driveLegend';
  legend.innerHTML='<b>ファイル表示の意味</b><div class="driveLegendRow"><span class="driveLegendTag indexed">索引済み</span><span>ファイルの中身まで読み込み、MAGIの質問・検索に利用できます。</span></div><div class="driveLegendRow"><span class="driveLegendTag listed">一覧のみ</span><span>ファイル名と保存場所だけ確認済みです。画像・PDFの中身は読み込んでいません。</span></div>';
  filesBox.parentNode.insertBefore(legend,filesBox);
}

const label=document.getElementById('driveProgressLabel');
const percent=document.getElementById('driveProgressPercent');
const track=document.getElementById('driveProgressTrack');
const bar=document.getElementById('driveProgressBar');
const note=document.getElementById('driveProgressNote');
let value=0,finishTimer=0,busy=false;

function render(next,text,mode='active',detail=''){
  clearTimeout(finishTimer);
  value=Math.max(0,Math.min(100,Math.round(next)));
  busy=mode==='active';
  box.classList.remove('hidden','active','complete','error');
  box.classList.add(mode);
  label.textContent=text;
  percent.textContent=value+'%';
  bar.style.width=value+'%';
  track.setAttribute('aria-valuenow',String(value));
  note.textContent=detail||(
    mode==='complete'?'Google Driveの資料を利用できます。':
    mode==='error'?'表示された内容を確認して、もう一度お試しください。':
    '処理中はこの画面を閉じずにお待ちください。'
  );
  if(mode==='complete'){
    finishTimer=setTimeout(()=>box.classList.add('hidden'),4200);
  }
}
function begin(kind){
  render(kind==='reload'?12:6,kind==='reload'?'フォルダを再読み込みしています':'Google認証を待っています','active',
    kind==='reload'?'保存済みの接続でDriveの資料を更新しています。':'Googleの画面が開いたら、接続を許可してください。');
}
function infer(text){
  const t=String(text||'').trim();
  if(!t)return;
  if(/未接続|認証期限|認証エラー|接続できません|読込失敗|取込失敗|失敗：|OAuth Client IDが未入力/.test(t)){
    render(Math.max(value,12),'Google Driveを読み込めませんでした','error',t);
    return;
  }
  if(/設定を端末に保存/.test(t)&&!busy)return;
  if(/認証ライブラリを読み込み中/.test(t)){render(8,'Google認証を準備しています','active','数秒後にもう一度「Google Drive接続」を押してください。');return}
  if(/認証画面|Google認証待ち|接続を許可/.test(t)){render(Math.max(value,10),'Google認証を待っています','active','Googleの画面で接続を許可してください。');return}
  if(/接続アカウントを確認/.test(t)){render(24,'接続アカウントを確認しています');return}
  if(/チームフォルダを読み込/.test(t)){render(36,'チームフォルダを開いています');return}
  if(/フォルダだけ再読み込み/.test(t)){render(18,'フォルダを再読み込みしています');return}
  if(/階層を確認中/.test(t)){render(48,'フォルダ構成を確認しています');return}
  if(/別方式で探索中|下位階層を別方式で確認中/.test(t)){
    const m=t.match(/(\d+)件/),extra=m?Math.min(10,Number(m[1])/100):0;
    render(58+extra,'下位フォルダまで確認しています');
    return;
  }
  const indexing=t.match(/自動索引化中\s*(\d+)\s*\/\s*(\d+)/);
  if(indexing){
    const done=Number(indexing[1]),total=Math.max(1,Number(indexing[2]));
    render(68+(done/total)*27,'対応ファイルを読み込んでいます','active',done+' / '+total+' ファイル');
    return;
  }
  if(/Google Drive読込完了|Google Drive自動確認完了|Google Drive接続済み：|取込完了：/.test(t)){
    const warning=/一部要確認|未検出/.test(t);
    render(100,warning?'Google Driveの読み込みが完了しました（一部要確認）':'Google Driveの読み込みが完了しました','complete',t.replace(/^(Google Drive読込完了(?:（一部要確認）)?：|Google Drive自動確認完了：|Google Drive接続済み：|取込完了：)/,''));
    return;
  }
  if(/重要データ.*(?:最終確認中|確認中)/.test(t)){render(97,'重要データを最終確認しています','active','全体の読み込みは完了しています。重要データ3件の利用可否を確認中です。');return}
}
new MutationObserver(()=>infer(state.textContent)).observe(state,{childList:true,subtree:true,characterData:true});

const connect=document.getElementById('connectDriveBtn');
const reauth=document.getElementById('reauthBtn');
const reload=document.getElementById('reloadDriveBtn');
if(connect)connect.addEventListener('click',()=>begin('connect'),true);
if(reauth)reauth.addEventListener('click',()=>begin('connect'),true);
if(reload)reload.addEventListener('click',()=>begin('reload'),true);

window.MAGI_DRIVE_PROGRESS_V241=true;
window.MAGI_DRIVE_PROGRESS_VERSION='2.0';
})();